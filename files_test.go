package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSecurePathRejectsTraversalAndSymlink(t *testing.T) {
	base := t.TempDir()
	if _, err := securePath(base, "../../etc/passwd", true); err == nil {
		t.Fatal("expected traversal to be rejected")
	}
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(base, "link")); err != nil {
		t.Fatal(err)
	}
	if _, err := securePath(base, "link/file.txt", true); err == nil {
		t.Fatal("expected symlink path to be rejected")
	}
	if p, err := securePath(base, "folder/file.txt", true); err != nil || filepath.Dir(p) != filepath.Join(base, "folder") {
		t.Fatalf("valid path rejected: %s %v", p, err)
	}
}

func TestDownloadFileServesOnlyBotFile(t *testing.T) {
	dataDir := t.TempDir()
	db, err := OpenDB(filepath.Join(dataDir, "elitecp.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	now := time.Now().UTC()
	bot := Bot{ID: "abc12345", Name: "Bot", Runtime: "python", Image: "python:3.12-slim-bookworm", DependencyFile: "requirements.txt", MainFile: "bot.py", InstallCommand: "", Startup: "python bot.py", MemoryMB: 256, CPUs: .5, CreatedAt: now, UpdatedAt: now}
	if err := db.CreateBot(bot); err != nil {
		t.Fatal(err)
	}
	docker := NewDockerManager(dataDir)
	appDir, _ := docker.AppDir(bot.ID)
	if err := os.MkdirAll(appDir, 0750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(appDir, "hello.txt"), []byte("hello elitecp"), 0640); err != nil {
		t.Fatal(err)
	}

	app := NewApp(Config{DataDir: dataDir}, db, docker)
	req := httptest.NewRequest(http.MethodGet, "/api/bots/abc12345/download?path=hello.txt", nil)
	req.SetPathValue("id", bot.ID)
	rr := httptest.NewRecorder()
	app.downloadFile(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	if got := rr.Body.String(); got != "hello elitecp" {
		t.Fatalf("unexpected download body: %q", got)
	}
	if !strings.Contains(rr.Header().Get("Content-Disposition"), "attachment") {
		t.Fatalf("missing attachment disposition: %q", rr.Header().Get("Content-Disposition"))
	}
}
