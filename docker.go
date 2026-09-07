package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type DockerManager struct {
	dataDir string
	uid     int
	gid     int
}

type DockerStats struct {
	CPUPerc  string `json:"cpu"`
	MemUsage string `json:"memory"`
	MemPerc  string `json:"memory_percent"`
	NetIO    string `json:"network"`
	PIDs     string `json:"pids"`
}

type DockerState struct {
	Status     string `json:"status"`
	Running    bool   `json:"running"`
	OOMKilled  bool   `json:"oom_killed"`
	ExitCode   int    `json:"exit_code"`
	Error      string `json:"error,omitempty"`
	StartedAt  string `json:"started_at,omitempty"`
	FinishedAt string `json:"finished_at,omitempty"`
}

const containerRuntimeSchema = "2"

var safeID = regexp.MustCompile(`^[a-zA-Z0-9_-]{4,64}$`)

func NewDockerManager(dataDir string) *DockerManager {
	return &DockerManager{dataDir: dataDir, uid: os.Getuid(), gid: os.Getgid()}
}

func (d *DockerManager) Ping(ctx context.Context) error {
	_, err := d.run(ctx, "info", "--format", "{{.ServerVersion}}")
	return err
}

func (d *DockerManager) containerName(id string) (string, error) {
	if !safeID.MatchString(id) {
		return "", errors.New("invalid bot id")
	}
	return "elitecp_" + id, nil
}

func (d *DockerManager) AppDir(id string) (string, error) {
	if !safeID.MatchString(id) {
		return "", errors.New("invalid bot id")
	}
	return filepath.Join(d.dataDir, "bots", id, "app"), nil
}

func (d *DockerManager) PrepareDataDir(id string) error {
	appDir, err := d.AppDir(id)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Join(appDir, ".home"), 0750); err != nil {
		return err
	}
	return os.Chmod(appDir, 0750)
}

func (d *DockerManager) containerExists(ctx context.Context, name string) bool {
	cmd := exec.CommandContext(ctx, "docker", "inspect", name)
	return cmd.Run() == nil
}

func (d *DockerManager) imageExists(ctx context.Context, image string) bool {
	cmd := exec.CommandContext(ctx, "docker", "image", "inspect", image)
	return cmd.Run() == nil
}

func (d *DockerManager) EnsureContainer(ctx context.Context, b Bot, env []EnvVar) error {
	name, err := d.containerName(b.ID)
	if err != nil {
		return err
	}
	if d.containerExists(ctx, name) {
		out, labelErr := d.run(ctx, "inspect", "--format", `{{index .Config.Labels "elitecp.runtime_schema"}}`, name)
		if labelErr == nil && strings.TrimSpace(out) == containerRuntimeSchema {
			return nil
		}
		// Containers created by an older eLite CP release keep their original
		// Docker command forever. Recreate them once so the new startup pipeline
		// (dependency install + per-bot runtime isolation) becomes active.
		return d.RecreateContainer(ctx, b, env)
	}
	return d.createContainer(ctx, b, env)
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

func renderBotCommand(command string, b Bot) string {
	command = strings.ReplaceAll(command, "{{dependency_file}}", shellQuote(b.DependencyFile))
	command = strings.ReplaceAll(command, "{{main_file}}", shellQuote(b.MainFile))
	return command
}

func (d *DockerManager) bootstrapCommand(b Bot) string {
	installCmd := strings.TrimSpace(renderBotCommand(b.InstallCommand, b))
	startupCmd := strings.TrimSpace(renderBotCommand(b.Startup, b))
	depFile := strings.TrimSpace(b.DependencyFile)
	planHash := fmt.Sprintf("%x", sha256.Sum256([]byte(b.Runtime+"\x00"+b.DependencyFile+"\x00"+b.InstallCommand)))[:16]
	stamp := "/app/.elitecp/deps-" + planHash + ".sha256"

	var script strings.Builder
	script.WriteString("set -eu\n")
	script.WriteString("printf '\\n[eLite CP] ────────────────────────────────────────\\n'\n")
	script.WriteString("printf '[eLite CP] Startup pipeline started\\n'\n")
	script.WriteString("printf '[eLite CP] Runtime: " + b.Runtime + "\\n'\n")
	script.WriteString("printf '[eLite CP] Working directory: /app\\n'\n")
	script.WriteString("mkdir -p /app/.elitecp /app/.home\n")

	if b.Runtime == "python" {
		script.WriteString("printf '[eLite CP] [1/3] Preparing isolated Python environment...\\n'\n")
		script.WriteString("if [ ! -x /app/.elitecp/venv/bin/python ]; then\n")
		script.WriteString("  printf '[eLite CP] Creating per-bot venv at /app/.elitecp/venv\\n'\n")
		script.WriteString("  python -m venv /app/.elitecp/venv\n")
		script.WriteString("fi\n")
		script.WriteString(". /app/.elitecp/venv/bin/activate\n")
		script.WriteString("printf '[eLite CP] Python: '; python --version 2>&1\n")
		script.WriteString("printf '[eLite CP] Pip: '; python -m pip --version 2>&1\n")
	} else if b.Runtime == "node" {
		script.WriteString("printf '[eLite CP] [1/3] Preparing isolated Node.js environment...\\n'\n")
		script.WriteString("printf '[eLite CP] Node: '; node --version 2>&1\n")
		script.WriteString("printf '[eLite CP] npm: '; npm --version 2>&1\n")
	}

	script.WriteString("printf '[eLite CP] [2/3] Checking dependencies...\\n'\n")
	if depFile != "" && installCmd != "" {
		depQuoted := shellQuote(depFile)
		stampQuoted := shellQuote(stamp)
		script.WriteString("if [ -f " + depQuoted + " ]; then\n")
		if b.Runtime == "node" {
			script.WriteString("  hash_input=\"$({ sha256sum " + depQuoted + "; [ -f package-lock.json ] && sha256sum package-lock.json || true; [ -f npm-shrinkwrap.json ] && sha256sum npm-shrinkwrap.json || true; })\"\n")
			script.WriteString("  current_hash=\"$(printf '%s' \"$hash_input\" | sha256sum)\"; current_hash=\"${current_hash%% *}\"\n")
		} else {
			script.WriteString("  current_hash=\"$(sha256sum " + depQuoted + ")\"; current_hash=\"${current_hash%% *}\"\n")
		}
		script.WriteString("  previous_hash=\"$(cat " + stampQuoted + " 2>/dev/null || true)\"\n")
		script.WriteString("  if [ \"$current_hash\" != \"$previous_hash\" ]; then\n")
		script.WriteString("    printf '[eLite CP] Dependency file: " + strings.ReplaceAll(depFile, "'", "") + "\\n'\n")
		script.WriteString("    printf '[eLite CP] Install command: %s\\n' " + shellQuote(installCmd) + "\n")
		script.WriteString("    printf '[eLite CP] Installing dependencies...\\n'\n")
		script.WriteString("    if " + installCmd + "; then\n")
		script.WriteString("      printf '%s' \"$current_hash\" > " + stampQuoted + "\n")
		script.WriteString("      printf '[eLite CP] Dependencies installed successfully.\\n'\n")
		script.WriteString("    else\n")
		script.WriteString("      code=$?; printf '[eLite CP] ERROR: dependency installation failed (exit %s).\\n' \"$code\"; exit \"$code\"\n")
		script.WriteString("    fi\n")
		script.WriteString("  else\n")
		script.WriteString("    printf '[eLite CP] Dependencies unchanged; install skipped.\\n'\n")
		script.WriteString("  fi\n")
		script.WriteString("else\n")
		script.WriteString("  printf '[eLite CP] Dependency file not found: " + strings.ReplaceAll(depFile, "'", "") + " (install skipped)\\n'\n")
		script.WriteString("fi\n")
	} else {
		script.WriteString("printf '[eLite CP] No dependency install step configured.\\n'\n")
	}

	script.WriteString("printf '[eLite CP] [3/3] Starting application...\\n'\n")
	script.WriteString("printf '[eLite CP] Startup command: %s\\n' " + shellQuote(startupCmd) + "\n")
	script.WriteString("printf '[eLite CP] ────────────────────────────────────────\\n\\n'\n")
	script.WriteString("exec " + startupCmd + "\n")
	return script.String()
}

func (d *DockerManager) createContainer(ctx context.Context, b Bot, env []EnvVar) error {
	name, err := d.containerName(b.ID)
	if err != nil {
		return err
	}
	if err := d.PrepareDataDir(b.ID); err != nil {
		return err
	}
	appDir, _ := d.AppDir(b.ID)
	if !d.imageExists(ctx, b.Image) {
		pullCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
		defer cancel()
		if _, err := d.run(pullCtx, "pull", b.Image); err != nil {
			return fmt.Errorf("docker image pull failed: %w", err)
		}
	}

	args := []string{
		"create",
		"--name", name,
		"--label", "elitecp.managed=true",
		"--label", "elitecp.bot_id=" + b.ID,
		"--label", "elitecp.runtime_schema=" + containerRuntimeSchema,
		"--restart", "unless-stopped",
		"--memory", fmt.Sprintf("%dm", b.MemoryMB),
		"--cpus", strconv.FormatFloat(b.CPUs, 'f', 2, 64),
		"--pids-limit", "256",
		"--cap-drop", "ALL",
		"--security-opt", "no-new-privileges:true",
		"--init",
		"--user", fmt.Sprintf("%d:%d", d.uid, d.gid),
		"--workdir", "/app",
		"--volume", appDir + ":/app",
		"--env", "HOME=/app/.home",
		"--env", "PYTHONDONTWRITEBYTECODE=1",
		"--env", "PYTHONUNBUFFERED=1",
		"--env", "PIP_DISABLE_PIP_VERSION_CHECK=1",
		"--env", "PIP_CACHE_DIR=/app/.home/.cache/pip",
		"--env", "NPM_CONFIG_CACHE=/app/.home/.cache/npm",
	}
	for _, e := range env {
		args = append(args, "--env", e.Key+"="+e.Value)
	}
	args = append(args, b.Image, "/bin/sh", "-lc", d.bootstrapCommand(b))
	_, err = d.run(ctx, args...)
	return err
}

func (d *DockerManager) RecreateContainer(ctx context.Context, b Bot, env []EnvVar) error {
	name, err := d.containerName(b.ID)
	if err != nil {
		return err
	}
	wasRunning := d.Status(ctx, b.ID) == "running"
	if d.containerExists(ctx, name) {
		stopCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		_, _ = d.run(stopCtx, "stop", "--time", "8", name)
		cancel()
		_, _ = d.run(ctx, "rm", "-f", name)
	}
	if err := d.createContainer(ctx, b, env); err != nil {
		return err
	}
	if wasRunning {
		_, err = d.run(ctx, "start", name)
	}
	return err
}

func (d *DockerManager) Start(ctx context.Context, b Bot, env []EnvVar) error {
	if err := d.EnsureContainer(ctx, b, env); err != nil {
		return err
	}
	name, _ := d.containerName(b.ID)
	_, err := d.run(ctx, "start", name)
	return err
}

func (d *DockerManager) Stop(ctx context.Context, id string) error {
	name, err := d.containerName(id)
	if err != nil {
		return err
	}
	if !d.containerExists(ctx, name) {
		return nil
	}
	_, err = d.run(ctx, "stop", "--time", "10", name)
	return err
}

func (d *DockerManager) Restart(ctx context.Context, b Bot, env []EnvVar) error {
	if err := d.EnsureContainer(ctx, b, env); err != nil {
		return err
	}
	name, _ := d.containerName(b.ID)
	if d.Status(ctx, b.ID) != "running" {
		_, err := d.run(ctx, "start", name)
		return err
	}
	_, err := d.run(ctx, "restart", "--time", "10", name)
	return err
}

func (d *DockerManager) ResetDependencyCache(id string) error {
	appDir, err := d.AppDir(id)
	if err != nil {
		return err
	}
	matches, err := filepath.Glob(filepath.Join(appDir, ".elitecp", "deps-*.sha256"))
	if err != nil {
		return err
	}
	for _, match := range matches {
		if err := os.Remove(match); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

func (d *DockerManager) Remove(ctx context.Context, id string, deleteFiles bool) error {
	name, err := d.containerName(id)
	if err != nil {
		return err
	}
	if d.containerExists(ctx, name) {
		if _, err := d.run(ctx, "rm", "-f", name); err != nil {
			return err
		}
	}
	if deleteFiles {
		base := filepath.Join(d.dataDir, "bots", id)
		return os.RemoveAll(base)
	}
	return nil
}

func (d *DockerManager) State(ctx context.Context, id string) DockerState {
	name, err := d.containerName(id)
	if err != nil {
		return DockerState{Status: "unknown", ExitCode: -1, Error: err.Error()}
	}
	out, err := d.run(ctx, "inspect", "--format", "{{json .State}}", name)
	if err != nil {
		return DockerState{Status: "offline", ExitCode: -1}
	}
	var raw struct {
		Status     string `json:"Status"`
		Running    bool   `json:"Running"`
		OOMKilled  bool   `json:"OOMKilled"`
		ExitCode   int    `json:"ExitCode"`
		Error      string `json:"Error"`
		StartedAt  string `json:"StartedAt"`
		FinishedAt string `json:"FinishedAt"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &raw); err != nil {
		return DockerState{Status: "unknown", ExitCode: -1, Error: err.Error()}
	}
	status := raw.Status
	if status == "created" || status == "exited" || status == "dead" {
		status = "offline"
	}
	return DockerState{Status: status, Running: raw.Running, OOMKilled: raw.OOMKilled, ExitCode: raw.ExitCode, Error: raw.Error, StartedAt: raw.StartedAt, FinishedAt: raw.FinishedAt}
}

func (d *DockerManager) Status(ctx context.Context, id string) string {
	return d.State(ctx, id).Status
}

func (d *DockerManager) Stats(ctx context.Context, id string) (DockerStats, error) {
	name, err := d.containerName(id)
	if err != nil {
		return DockerStats{}, err
	}
	if d.Status(ctx, id) != "running" {
		return DockerStats{}, errors.New("bot is not running")
	}
	out, err := d.run(ctx, "stats", "--no-stream", "--format", "{{json .}}", name)
	if err != nil {
		return DockerStats{}, err
	}
	var raw struct {
		CPUPerc  string `json:"CPUPerc"`
		MemUsage string `json:"MemUsage"`
		MemPerc  string `json:"MemPerc"`
		NetIO    string `json:"NetIO"`
		PIDs     string `json:"PIDs"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &raw); err != nil {
		return DockerStats{}, err
	}
	return DockerStats{CPUPerc: raw.CPUPerc, MemUsage: raw.MemUsage, MemPerc: raw.MemPerc, NetIO: raw.NetIO, PIDs: raw.PIDs}, nil
}

func (d *DockerManager) Exec(ctx context.Context, b Bot, command string) (string, error) {
	name, err := d.containerName(b.ID)
	if err != nil {
		return "", err
	}
	if d.Status(ctx, b.ID) != "running" {
		return "", errors.New("bot is not running")
	}
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	// Interactive commands should use the same per-bot runtime environment as
	// the startup pipeline. This keeps `pip`, `python`, npm cache and HOME scoped
	// to the bot instead of the host or a different interpreter.
	wrapped := "export HOME=/app/.home; cd /app; "
	if b.Runtime == "python" {
		wrapped += "if [ -f /app/.elitecp/venv/bin/activate ]; then . /app/.elitecp/venv/bin/activate; fi; "
	}
	wrapped += command
	return d.runLimited(ctx, 256*1024, "exec", name, "/bin/sh", "-lc", wrapped)
}

func (d *DockerManager) StartLogs(ctx context.Context, id string, tail int) (io.ReadCloser, func(), error) {
	name, err := d.containerName(id)
	if err != nil {
		return nil, nil, err
	}
	if !d.containerExists(ctx, name) {
		return nil, nil, errors.New("container not created yet")
	}
	cmd := exec.CommandContext(ctx, "docker", "logs", "--timestamps", "--tail", strconv.Itoa(tail), "--follow", name)
	pr, pw := io.Pipe()
	cmd.Stdout = pw
	cmd.Stderr = pw
	if err := cmd.Start(); err != nil {
		_ = pr.Close()
		_ = pw.Close()
		return nil, nil, err
	}
	go func() {
		err := cmd.Wait()
		_ = pw.CloseWithError(err)
	}()
	cleanup := func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = pr.Close()
		_ = pw.Close()
	}
	return pr, cleanup, nil
}

func (d *DockerManager) run(ctx context.Context, args ...string) (string, error) {
	return d.runLimited(ctx, 1024*1024, args...)
}

func (d *DockerManager) runLimited(ctx context.Context, limit int64, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "docker", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &limitedWriter{w: &stdout, remaining: limit}
	cmd.Stderr = &limitedWriter{w: &stderr, remaining: limit}
	err := cmd.Run()
	if err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return stdout.String(), fmt.Errorf("%s", msg)
	}
	return stdout.String(), nil
}

type limitedWriter struct {
	w         io.Writer
	remaining int64
}

func (l *limitedWriter) Write(p []byte) (int, error) {
	original := len(p)
	if l.remaining <= 0 {
		return original, nil
	}
	if int64(len(p)) > l.remaining {
		p = p[:l.remaining]
	}
	n, err := l.w.Write(p)
	l.remaining -= int64(n)
	if err != nil {
		return n, err
	}
	return original, nil
}

func processExitCode(err error) int {
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		if status, ok := exitErr.Sys().(syscall.WaitStatus); ok {
			return status.ExitStatus()
		}
	}
	return -1
}
