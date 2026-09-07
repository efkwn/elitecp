package main

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed web/*
var embeddedWeb embed.FS

type contextKey string

const userContextKey contextKey = "user"

type App struct {
	cfg       Config
	db        *DB
	docker    *DockerManager
	loginMu   sync.Mutex
	loginHits map[string][]time.Time
}

func NewApp(cfg Config, db *DB, docker *DockerManager) *App {
	return &App{
		cfg:       cfg,
		db:        db,
		docker:    docker,
		loginHits: make(map[string][]time.Time),
	}
}

func (a *App) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{"ok": true, "version": version})
	})
	mux.HandleFunc("POST /api/login", a.login)

	mux.Handle("GET /api/me", a.auth(http.HandlerFunc(a.me)))
	mux.Handle("POST /api/logout", a.auth(http.HandlerFunc(a.logout)))
	mux.Handle("GET /api/system", a.auth(http.HandlerFunc(a.systemInfo)))
	mux.Handle("GET /api/bots", a.auth(http.HandlerFunc(a.listBots)))
	mux.Handle("POST /api/bots", a.auth(http.HandlerFunc(a.createBot)))
	mux.Handle("GET /api/bots/{id}", a.auth(http.HandlerFunc(a.getBot)))
	mux.Handle("PUT /api/bots/{id}", a.auth(http.HandlerFunc(a.updateBot)))
	mux.Handle("DELETE /api/bots/{id}", a.auth(http.HandlerFunc(a.deleteBot)))
	mux.Handle("POST /api/bots/{id}/action", a.auth(http.HandlerFunc(a.botAction)))
	mux.Handle("GET /api/bots/{id}/stats", a.auth(http.HandlerFunc(a.botStats)))
	mux.Handle("GET /api/bots/{id}/env", a.auth(http.HandlerFunc(a.getEnv)))
	mux.Handle("PUT /api/bots/{id}/env", a.auth(http.HandlerFunc(a.putEnv)))
	mux.Handle("POST /api/bots/{id}/exec", a.auth(http.HandlerFunc(a.execBot)))
	mux.Handle("GET /api/bots/{id}/console", a.auth(http.HandlerFunc(a.consoleSSE)))
	mux.Handle("GET /api/bots/{id}/files", a.auth(http.HandlerFunc(a.listFiles)))
	mux.Handle("GET /api/bots/{id}/file", a.auth(http.HandlerFunc(a.readFile)))
	mux.Handle("PUT /api/bots/{id}/file", a.auth(http.HandlerFunc(a.writeFile)))
	mux.Handle("DELETE /api/bots/{id}/file", a.auth(http.HandlerFunc(a.deleteFile)))
	mux.Handle("POST /api/bots/{id}/upload", a.auth(http.HandlerFunc(a.uploadFiles)))
	mux.Handle("POST /api/bots/{id}/mkdir", a.auth(http.HandlerFunc(a.makeDir)))
	mux.Handle("GET /api/bots/{id}/download", a.auth(http.HandlerFunc(a.downloadFile)))
	mux.Handle("GET /api/bots/{id}/sqlite", a.auth(http.HandlerFunc(a.listSQLiteDatabases)))
	mux.Handle("GET /api/bots/{id}/sqlite/tables", a.auth(http.HandlerFunc(a.listSQLiteTables)))
	mux.Handle("GET /api/bots/{id}/sqlite/rows", a.auth(http.HandlerFunc(a.listSQLiteRows)))

	webRoot, err := fs.Sub(embeddedWeb, "web")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(webRoot))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		fileServer.ServeHTTP(w, r)
	}))

	return a.securityHeaders(a.recoverer(a.accessLog(mux)))
}

func (a *App) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		next.ServeHTTP(w, r)
	})
}

func (a *App) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic: %v", rec)
				writeError(w, http.StatusInternalServerError, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (a *App) accessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/api/bots/" {
			log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
		}
	})
}

func (a *App) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("elitecp_session")
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		u, err := a.db.UserBySession(cookie.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "session expired")
			return
		}
		if isStateChanging(r.Method) && !sameOrigin(r) {
			writeError(w, http.StatusForbidden, "origin rejected")
			return
		}
		ctx := context.WithValue(r.Context(), userContextKey, u)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func isStateChanging(method string) bool {
	return method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete
}

func sameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return strings.EqualFold(u.Host, r.Host)
}

func remoteIP(r *http.Request) string {
	if ip := strings.TrimSpace(strings.Split(r.Header.Get("CF-Connecting-IP"), ",")[0]); ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func (a *App) allowLogin(ip string) bool {
	a.loginMu.Lock()
	defer a.loginMu.Unlock()
	now := time.Now()
	cutoff := now.Add(-10 * time.Minute)
	hits := a.loginHits[ip]
	fresh := hits[:0]
	for _, t := range hits {
		if t.After(cutoff) {
			fresh = append(fresh, t)
		}
	}
	if len(fresh) >= 20 {
		a.loginHits[ip] = fresh
		return false
	}
	a.loginHits[ip] = append(fresh, now)
	return true
}

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	if !a.allowLogin(remoteIP(r)) {
		writeError(w, http.StatusTooManyRequests, "too many login attempts; try again later")
		return
	}
	var in struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	u, err := a.db.Authenticate(in.Username, in.Password)
	if err != nil {
		time.Sleep(250 * time.Millisecond)
		writeError(w, http.StatusUnauthorized, "invalid username or password")
		return
	}
	token, err := a.db.CreateSession(u.ID, 7*24*time.Hour)
	if err != nil {
		writeError(w, 500, "could not create session")
		return
	}
	secure := r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") || strings.HasPrefix(a.cfg.PublicURL, "https://")
	http.SetCookie(w, &http.Cookie{Name: "elitecp_session", Value: token, Path: "/", HttpOnly: true, Secure: secure, SameSite: http.SameSiteStrictMode, MaxAge: 7 * 24 * 3600})
	writeJSON(w, 200, map[string]any{"user": u})
}

func (a *App) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("elitecp_session"); err == nil {
		a.db.DeleteSession(c.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: "elitecp_session", Value: "", Path: "/", HttpOnly: true, MaxAge: -1, SameSite: http.SameSiteStrictMode})
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (a *App) me(w http.ResponseWriter, r *http.Request) {
	u, _ := r.Context().Value(userContextKey).(*User)
	writeJSON(w, 200, map[string]any{"user": u, "version": version})
}

func (a *App) systemInfo(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
	defer cancel()
	dockerErr := a.docker.Ping(ctx)

	payload := map[string]any{
		"version":   version,
		"docker_ok": dockerErr == nil,
		"data_dir":  a.cfg.DataDir,
	}
	if metrics, err := collectSystemSnapshot("/"); err == nil {
		payload["metrics"] = metrics
	} else {
		payload["metrics_error"] = err.Error()
	}
	writeJSON(w, 200, payload)
}

func (a *App) listBots(w http.ResponseWriter, r *http.Request) {
	bots, err := a.db.ListBots()
	if err != nil {
		writeError(w, 500, "could not list bots")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()
	for i := range bots {
		state := a.docker.State(ctx, bots[i].ID)
		bots[i].Status = state.Status
		bots[i].State = &state
	}
	writeJSON(w, 200, map[string]any{"bots": bots})
}

type runtimeDefaults struct {
	Image          string
	DependencyFile string
	MainFile       string
	InstallCommand string
	Startup        string
}

func defaultRuntime(runtime string) runtimeDefaults {
	switch runtime {
	case "python":
		return runtimeDefaults{
			Image:          "python:3.12-slim-bookworm",
			DependencyFile: "requirements.txt",
			MainFile:       "bot.py",
			InstallCommand: `python -m pip install --disable-pip-version-check -r {{dependency_file}}`,
			Startup:        `python {{main_file}}`,
		}
	case "node":
		return runtimeDefaults{
			Image:          "node:22-bookworm-slim",
			DependencyFile: "package.json",
			MainFile:       "index.js",
			InstallCommand: `if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi`,
			Startup:        `node {{main_file}}`,
		}
	}
	return runtimeDefaults{}
}

func validBotFile(value string, allowEmpty bool) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return allowEmpty
	}
	if len(value) > 255 || strings.ContainsRune(value, 0) || strings.HasPrefix(value, "/") || strings.Contains(value, "\\") {
		return false
	}
	for _, part := range strings.Split(value, "/") {
		if part == "" || part == "." || part == ".." {
			return false
		}
	}
	return true
}

func newBotID() (string, error) {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (a *App) createBot(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name           string  `json:"name"`
		Runtime        string  `json:"runtime"`
		DependencyFile string  `json:"dependency_file"`
		MainFile       string  `json:"main_file"`
		InstallCommand string  `json:"install_command"`
		Startup        string  `json:"startup"`
		MemoryMB       int     `json:"memory_mb"`
		CPUs           float64 `json:"cpus"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || len(in.Name) > 64 {
		writeError(w, 400, "name must be 1-64 characters")
		return
	}
	defaults := defaultRuntime(in.Runtime)
	if defaults.Image == "" {
		writeError(w, 400, "runtime must be python or node")
		return
	}
	in.DependencyFile = strings.TrimSpace(in.DependencyFile)
	in.MainFile = strings.TrimSpace(in.MainFile)
	in.InstallCommand = strings.TrimSpace(in.InstallCommand)
	in.Startup = strings.TrimSpace(in.Startup)
	if in.DependencyFile == "" {
		in.DependencyFile = defaults.DependencyFile
	}
	if in.MainFile == "" {
		in.MainFile = defaults.MainFile
	}
	if in.InstallCommand == "" {
		in.InstallCommand = defaults.InstallCommand
	}
	if in.Startup == "" {
		in.Startup = defaults.Startup
	}
	if !validBotFile(in.DependencyFile, true) || !validBotFile(in.MainFile, false) {
		writeError(w, 400, "invalid dependency or main file path")
		return
	}
	if len(in.InstallCommand) > 8192 || len(in.Startup) > 8192 {
		writeError(w, 400, "install/startup command is too long")
		return
	}
	if in.MemoryMB == 0 {
		in.MemoryMB = 512
	}
	if in.CPUs == 0 {
		in.CPUs = 0.5
	}
	if in.MemoryMB < 64 || in.MemoryMB > 32768 || in.CPUs < 0.1 || in.CPUs > 32 {
		writeError(w, 400, "invalid resource limits")
		return
	}
	id, err := newBotID()
	if err != nil {
		writeError(w, 500, "could not create bot id")
		return
	}
	now := time.Now().UTC()
	b := Bot{
		ID: id, Name: in.Name, Runtime: in.Runtime, Image: defaults.Image,
		DependencyFile: in.DependencyFile, MainFile: in.MainFile, InstallCommand: in.InstallCommand, Startup: in.Startup,
		MemoryMB: in.MemoryMB, CPUs: in.CPUs, CreatedAt: now, UpdatedAt: now, Status: "offline",
	}
	if err := a.docker.PrepareDataDir(id); err != nil {
		writeError(w, 500, "could not prepare bot directory")
		return
	}
	if err := a.db.CreateBot(b); err != nil {
		writeError(w, 500, "could not save bot")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"bot": b})
}

func (a *App) getBot(w http.ResponseWriter, r *http.Request) {
	b, err := a.db.GetBot(r.PathValue("id"))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, 404, "bot not found")
		} else {
			writeError(w, 500, "could not load bot")
		}
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	state := a.docker.State(ctx, b.ID)
	b.Status = state.Status
	b.State = &state
	writeJSON(w, 200, map[string]any{"bot": b})
}

func (a *App) updateBot(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, err := a.db.GetBot(id)
	if err != nil {
		writeError(w, 404, "bot not found")
		return
	}
	var in struct {
		Name           string  `json:"name"`
		DependencyFile string  `json:"dependency_file"`
		MainFile       string  `json:"main_file"`
		InstallCommand string  `json:"install_command"`
		Startup        string  `json:"startup"`
		MemoryMB       int     `json:"memory_mb"`
		CPUs           float64 `json:"cpus"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.DependencyFile = strings.TrimSpace(in.DependencyFile)
	in.MainFile = strings.TrimSpace(in.MainFile)
	in.InstallCommand = strings.TrimSpace(in.InstallCommand)
	in.Startup = strings.TrimSpace(in.Startup)
	if in.Name == "" || len(in.Name) > 64 || !validBotFile(in.DependencyFile, true) || !validBotFile(in.MainFile, false) || in.Startup == "" || len(in.Startup) > 8192 || len(in.InstallCommand) > 8192 {
		writeError(w, 400, "invalid bot settings")
		return
	}
	if in.MemoryMB < 64 || in.MemoryMB > 32768 || in.CPUs < 0.1 || in.CPUs > 32 {
		writeError(w, 400, "invalid resource limits")
		return
	}
	if err := a.db.UpdateBot(id, in.Name, in.DependencyFile, in.MainFile, in.InstallCommand, in.Startup, in.MemoryMB, in.CPUs); err != nil {
		writeError(w, 500, "could not save bot")
		return
	}
	b.Name, b.DependencyFile, b.MainFile, b.InstallCommand, b.Startup, b.MemoryMB, b.CPUs = in.Name, in.DependencyFile, in.MainFile, in.InstallCommand, in.Startup, in.MemoryMB, in.CPUs
	env, _ := a.db.GetEnv(id)
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
	defer cancel()
	if err := a.docker.RecreateContainer(ctx, *b, env); err != nil {
		writeError(w, 500, "settings saved, but container rebuild failed: "+err.Error())
		return
	}
	state := a.docker.State(ctx, id)
	b.Status = state.Status
	b.State = &state
	writeJSON(w, 200, map[string]any{"bot": b})
}

func (a *App) deleteBot(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := a.db.GetBot(id); err != nil {
		writeError(w, 404, "bot not found")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	if err := a.docker.Remove(ctx, id, true); err != nil {
		writeError(w, 500, "could not remove container: "+err.Error())
		return
	}
	if err := a.db.DeleteBot(id); err != nil {
		writeError(w, 500, "could not delete bot")
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (a *App) botAction(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, err := a.db.GetBot(id)
	if err != nil {
		writeError(w, 404, "bot not found")
		return
	}
	var in struct {
		Action string `json:"action"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	env, _ := a.db.GetEnv(id)
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Minute)
	defer cancel()
	switch in.Action {
	case "start":
		err = a.docker.Start(ctx, *b, env)
	case "stop":
		err = a.docker.Stop(ctx, id)
	case "restart":
		err = a.docker.Restart(ctx, *b, env)
	case "rebuild":
		err = a.docker.RecreateContainer(ctx, *b, env)
	case "reinstall":
		err = a.docker.ResetDependencyCache(id)
		if err == nil {
			err = a.docker.Restart(ctx, *b, env)
		}
	default:
		writeError(w, 400, "unknown action")
		return
	}
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	state := a.docker.State(ctx, id)
	writeJSON(w, 200, map[string]any{"ok": true, "status": state.Status, "state": state})
}

func (a *App) botStats(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	stats, err := a.docker.Stats(ctx, r.PathValue("id"))
	if err != nil {
		writeJSON(w, 200, map[string]any{"available": false})
		return
	}
	writeJSON(w, 200, map[string]any{"available": true, "stats": stats})
}

func (a *App) getEnv(w http.ResponseWriter, r *http.Request) {
	if _, err := a.db.GetBot(r.PathValue("id")); err != nil {
		writeError(w, 404, "bot not found")
		return
	}
	env, err := a.db.GetEnv(r.PathValue("id"))
	if err != nil {
		writeError(w, 500, "could not load environment")
		return
	}
	writeJSON(w, 200, map[string]any{"env": env})
}

var envKeyRE = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]{0,127}$`)

func (a *App) putEnv(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, err := a.db.GetBot(id)
	if err != nil {
		writeError(w, 404, "bot not found")
		return
	}
	var in struct {
		Env []EnvVar `json:"env"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	if len(in.Env) > 128 {
		writeError(w, 400, "too many environment variables")
		return
	}
	seen := map[string]bool{}
	for i := range in.Env {
		in.Env[i].Key = strings.TrimSpace(in.Env[i].Key)
		if !envKeyRE.MatchString(in.Env[i].Key) || len(in.Env[i].Value) > 8192 || strings.ContainsRune(in.Env[i].Value, 0) || seen[in.Env[i].Key] {
			writeError(w, 400, "invalid or duplicate environment variable")
			return
		}
		seen[in.Env[i].Key] = true
	}
	if err := a.db.ReplaceEnv(id, in.Env); err != nil {
		writeError(w, 500, "could not save environment")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
	defer cancel()
	if err := a.docker.RecreateContainer(ctx, *b, in.Env); err != nil {
		writeError(w, 500, "environment saved, but container rebuild failed: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "status": a.docker.Status(ctx, id)})
}

func (a *App) execBot(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, err := a.db.GetBot(id)
	if err != nil {
		writeError(w, 404, "bot not found")
		return
	}
	var in struct {
		Command string `json:"command"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	in.Command = strings.TrimSpace(in.Command)
	if in.Command == "" || len(in.Command) > 2048 {
		writeError(w, 400, "invalid command")
		return
	}
	out, err := a.docker.Exec(r.Context(), *b, in.Command)
	if err != nil {
		writeJSON(w, 200, map[string]any{"ok": false, "output": out, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "output": out})
}

func (a *App) consoleSSE(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := a.db.GetBot(id); err != nil {
		writeError(w, 404, "bot not found")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, 500, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	reader, cleanup, err := a.docker.StartLogs(ctx, id, 250)
	if err != nil {
		fmt.Fprintf(w, "event: system\ndata: %s\n\n", sseEscape(err.Error()))
		flusher.Flush()
		return
	}
	defer cleanup()
	defer reader.Close()

	buf := make([]byte, 16*1024)
	for {
		n, readErr := reader.Read(buf)
		if n > 0 {
			fmt.Fprintf(w, "data: %s\n\n", sseEscape(string(buf[:n])))
			flusher.Flush()
		}
		if readErr != nil {
			state := a.docker.State(context.Background(), id)
			message := fmt.Sprintf("container stopped (exit %d)", state.ExitCode)
			if state.OOMKilled {
				message = fmt.Sprintf("container was killed by the memory limit (OOM, exit %d). Increase RAM or reduce memory usage", state.ExitCode)
			} else if state.Error != "" {
				message += ": " + state.Error
			}
			fmt.Fprintf(w, "event: system\ndata: %s\n\n", sseEscape(message))
			flusher.Flush()
			return
		}
	}
}

func sseEscape(s string) string {
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.ReplaceAll(s, "\n", "\\n")
	return s
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, 1024*1024+1))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"error": message})
}

func parseIntQuery(r *http.Request, key string, fallback int) int {
	v, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil {
		return fallback
	}
	return v
}
