package main

import (
	"bytes"
	"context"
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
		return nil
	}
	return d.createContainer(ctx, b, env)
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
	}
	for _, e := range env {
		args = append(args, "--env", e.Key+"="+e.Value)
	}
	args = append(args, b.Image, "/bin/sh", "-lc", b.Startup)
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
	_, err := d.run(ctx, "restart", "--time", "10", name)
	return err
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

func (d *DockerManager) Status(ctx context.Context, id string) string {
	name, err := d.containerName(id)
	if err != nil {
		return "unknown"
	}
	out, err := d.run(ctx, "inspect", "--format", "{{.State.Status}}", name)
	if err != nil {
		return "offline"
	}
	s := strings.TrimSpace(out)
	if s == "created" || s == "exited" || s == "dead" {
		return "offline"
	}
	return s
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

func (d *DockerManager) Exec(ctx context.Context, id, command string) (string, error) {
	name, err := d.containerName(id)
	if err != nil {
		return "", err
	}
	if d.Status(ctx, id) != "running" {
		return "", errors.New("bot is not running")
	}
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	return d.runLimited(ctx, 256*1024, "exec", name, "/bin/sh", "-lc", command)
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
