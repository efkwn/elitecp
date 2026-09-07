package main

import (
	"errors"
	"path/filepath"
	"testing"
	"time"
)

func testDB(t *testing.T) *DB {
	t.Helper()
	db, err := OpenDB(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestAdminAuthAndSession(t *testing.T) {
	db := testDB(t)
	if err := db.UpsertAdmin("admin", "VeryStrongPass123!"); err != nil {
		t.Fatal(err)
	}
	u, err := db.Authenticate("admin", "VeryStrongPass123!")
	if err != nil || u.Username != "admin" {
		t.Fatalf("auth failed: user=%v err=%v", u, err)
	}
	if _, err := db.Authenticate("admin", "wrong-password"); err == nil {
		t.Fatal("expected wrong password to fail")
	}
	token, err := db.CreateSession(u.ID, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	got, err := db.UserBySession(token)
	if err != nil || got.ID != u.ID {
		t.Fatalf("session lookup failed: %v %v", got, err)
	}
	db.DeleteSession(token)
	if _, err := db.UserBySession(token); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected deleted session to be missing, got %v", err)
	}
}

func TestBotAndEnvCRUD(t *testing.T) {
	db := testDB(t)
	now := time.Now().UTC().Truncate(time.Microsecond)
	bot := Bot{ID: "abc12345", Name: "Bot", Runtime: "python", Image: "python:3.12-slim-bookworm", Startup: "python main.py", MemoryMB: 256, CPUs: .5, CreatedAt: now, UpdatedAt: now}
	if err := db.CreateBot(bot); err != nil {
		t.Fatal(err)
	}
	got, err := db.GetBot(bot.ID)
	if err != nil || got.Name != "Bot" {
		t.Fatalf("get bot: %v %v", got, err)
	}
	env := []EnvVar{{Key: "TOKEN", Value: "secret"}, {Key: "MODE", Value: "prod"}}
	if err := db.ReplaceEnv(bot.ID, env); err != nil {
		t.Fatal(err)
	}
	gotEnv, err := db.GetEnv(bot.ID)
	if err != nil || len(gotEnv) != 2 {
		t.Fatalf("get env: %#v %v", gotEnv, err)
	}
	if err := db.DeleteBot(bot.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.GetBot(bot.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected deleted bot to be missing, got %v", err)
	}
}
