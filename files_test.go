package main

import (
	"os"
	"path/filepath"
	"testing"
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
