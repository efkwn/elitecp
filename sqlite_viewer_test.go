package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSQLiteDiscoveryTablesAndRows(t *testing.T) {
	base := t.TempDir()
	path := filepath.Join(base, "bot-data.db")
	db, err := OpenDB(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY, body TEXT, score REAL, optional TEXT, snowflake INTEGER)`); err != nil {
		t.Fatal(err)
	}
	if err := db.exec(`INSERT INTO messages(body, score, optional, snowflake) VALUES(?, ?, NULL, 9223372036854775807)`, "hello", 4.5); err != nil {
		t.Fatal(err)
	}
	if err := db.exec(`CREATE TABLE "odd""name" (value TEXT)`); err != nil {
		t.Fatal(err)
	}
	if err := db.exec(`INSERT INTO "odd""name"(value) VALUES('quoted')`); err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// A valid database hidden under a dependency directory should be skipped.
	skippedDir := filepath.Join(base, "node_modules", "pkg")
	if err := os.MkdirAll(skippedDir, 0750); err != nil {
		t.Fatal(err)
	}
	skippedDB, err := OpenDB(filepath.Join(skippedDir, "cache.db"))
	if err != nil {
		t.Fatal(err)
	}
	_ = skippedDB.Close()

	dbs, err := findSQLiteDatabases(base)
	if err != nil {
		t.Fatal(err)
	}
	if len(dbs) != 1 || dbs[0].Path != "bot-data.db" {
		t.Fatalf("unexpected discovered databases: %#v", dbs)
	}

	tables, err := readSQLiteTables(path)
	if err != nil {
		t.Fatal(err)
	}
	foundMessages := false
	foundOdd := false
	for _, table := range tables {
		if table.Name == "messages" {
			foundMessages = true
		}
		if table.Name == `odd"name` {
			foundOdd = true
		}
	}
	if !foundMessages || !foundOdd {
		t.Fatalf("expected test tables, got %#v", tables)
	}

	rows, err := readSQLiteRows(path, "messages", 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows.Columns) != 5 || len(rows.Rows) != 1 {
		t.Fatalf("unexpected rows: %#v", rows)
	}
	if rows.Rows[0][1] != "hello" || rows.Rows[0][3] != nil || rows.Rows[0][4] != "9223372036854775807" {
		t.Fatalf("unexpected row values: %#v", rows.Rows[0])
	}

	quotedRows, err := readSQLiteRows(path, `odd"name`, 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(quotedRows.Rows) != 1 || quotedRows.Rows[0][0] != "quoted" {
		t.Fatalf("quoted table name failed: %#v", quotedRows.Rows)
	}

	if _, err := readSQLiteRows(path, `messages"; DROP TABLE messages; --`, 0, 100); err == nil {
		t.Fatal("expected invalid table name to be rejected")
	}
}
