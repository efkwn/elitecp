package main

/*
#cgo LDFLAGS: -lsqlite3
#include <sqlite3.h>
#include <stdlib.h>
*/
import "C"

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
	"unsafe"
)

const (
	maxSQLiteScanFiles = 10000
	maxSQLiteDatabases = 64
	defaultSQLiteRows  = 100
	maxSQLiteRows      = 200
)

var sqliteMagic = []byte("SQLite format 3\x00")

type SQLiteDatabaseFile struct {
	Name       string    `json:"name"`
	Path       string    `json:"path"`
	Size       int64     `json:"size"`
	ModifiedAt time.Time `json:"modified_at"`
}

type SQLiteTableInfo struct {
	Name string `json:"name"`
}

type SQLiteRows struct {
	Path    string   `json:"path"`
	Table   string   `json:"table"`
	Columns []string `json:"columns"`
	Rows    [][]any  `json:"rows"`
	Offset  int      `json:"offset"`
	Limit   int      `json:"limit"`
	HasMore bool     `json:"has_more"`
}

func isSQLiteFile(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()
	header := make([]byte, len(sqliteMagic))
	if _, err := f.Read(header); err != nil {
		return false
	}
	return bytes.Equal(header, sqliteMagic)
}

func findSQLiteDatabases(base string) ([]SQLiteDatabaseFile, error) {
	var out []SQLiteDatabaseFile
	seen := 0
	errStop := errors.New("sqlite scan complete")

	err := filepath.WalkDir(base, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			// A single unreadable runtime/cache path should not make the whole explorer fail.
			if path == base {
				return err
			}
			if d != nil && d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if path == base {
			return nil
		}

		name := d.Name()
		if d.IsDir() {
			switch name {
			case ".home", ".elitecp", ".elitecp-venv", ".venv", "venv", "node_modules", ".git", "__pycache__":
				return filepath.SkipDir
			}
			return nil
		}
		if d.Type()&os.ModeSymlink != 0 || !d.Type().IsRegular() {
			return nil
		}

		seen++
		if seen > maxSQLiteScanFiles {
			return errStop
		}
		if !isSQLiteFile(path) {
			return nil
		}
		info, statErr := d.Info()
		if statErr != nil {
			return nil
		}
		rel, relErr := filepath.Rel(base, path)
		if relErr != nil {
			return nil
		}
		out = append(out, SQLiteDatabaseFile{
			Name:       name,
			Path:       filepath.ToSlash(rel),
			Size:       info.Size(),
			ModifiedAt: info.ModTime(),
		})
		if len(out) >= maxSQLiteDatabases {
			return errStop
		}
		return nil
	})
	if err != nil && !errors.Is(err, errStop) {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i].Path) < strings.ToLower(out[j].Path) })
	return out, nil
}

func openSQLiteReadOnly(path string) (*C.sqlite3, error) {
	cpath := C.CString(path)
	defer C.free(unsafe.Pointer(cpath))
	var conn *C.sqlite3
	flags := C.int(C.SQLITE_OPEN_READONLY | C.SQLITE_OPEN_FULLMUTEX)
	if rc := C.sqlite3_open_v2(cpath, &conn, flags, nil); rc != C.SQLITE_OK {
		msg := "could not open SQLite database"
		if conn != nil {
			msg = C.GoString(C.sqlite3_errmsg(conn))
			C.sqlite3_close(conn)
		}
		return nil, errors.New(msg)
	}
	C.sqlite3_busy_timeout(conn, 1500)
	return conn, nil
}

func prepareSQLite(conn *C.sqlite3, query string) (*C.sqlite3_stmt, error) {
	cq := C.CString(query)
	defer C.free(unsafe.Pointer(cq))
	var st *C.sqlite3_stmt
	if rc := C.sqlite3_prepare_v2(conn, cq, -1, &st, nil); rc != C.SQLITE_OK {
		return nil, errors.New(C.GoString(C.sqlite3_errmsg(conn)))
	}
	return st, nil
}

func quoteSQLiteIdentifier(v string) string {
	return `"` + strings.ReplaceAll(v, `"`, `""`) + `"`
}

func readSQLiteTables(path string) ([]SQLiteTableInfo, error) {
	conn, err := openSQLiteReadOnly(path)
	if err != nil {
		return nil, err
	}
	defer C.sqlite3_close(conn)

	st, err := prepareSQLite(conn, `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name COLLATE NOCASE`)
	if err != nil {
		return nil, err
	}
	defer C.sqlite3_finalize(st)

	var tables []SQLiteTableInfo
	for {
		rc := C.sqlite3_step(st)
		if rc == C.SQLITE_DONE {
			break
		}
		if rc != C.SQLITE_ROW {
			return nil, errors.New(C.GoString(C.sqlite3_errmsg(conn)))
		}
		tables = append(tables, SQLiteTableInfo{Name: colText(st, 0)})
		if len(tables) >= 512 {
			break
		}
	}
	return tables, nil
}

func sqliteTableExists(conn *C.sqlite3, table string) (bool, error) {
	st, err := prepareSQLite(conn, `SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
	if err != nil {
		return false, err
	}
	defer C.sqlite3_finalize(st)
	if err := bindStmt(st, []any{table}); err != nil {
		return false, err
	}
	rc := C.sqlite3_step(st)
	if rc == C.SQLITE_ROW {
		return true, nil
	}
	if rc == C.SQLITE_DONE {
		return false, nil
	}
	return false, errors.New(C.GoString(C.sqlite3_errmsg(conn)))
}

func sqliteColumnValue(st *C.sqlite3_stmt, idx int) any {
	switch C.sqlite3_column_type(st, C.int(idx)) {
	case C.SQLITE_NULL:
		return nil
	case C.SQLITE_INTEGER:
		// Return numeric values as strings because the browser viewer is display-only.
		// This preserves 64-bit IDs (for example Discord snowflakes) without
		// JavaScript number rounding.
		return strconv.FormatInt(int64(C.sqlite3_column_int64(st, C.int(idx))), 10)
	case C.SQLITE_FLOAT:
		return strconv.FormatFloat(float64(C.sqlite3_column_double(st, C.int(idx))), 'g', -1, 64)
	case C.SQLITE_TEXT:
		return colText(st, idx)
	case C.SQLITE_BLOB:
		return fmt.Sprintf("[BLOB · %d bytes]", int(C.sqlite3_column_bytes(st, C.int(idx))))
	default:
		return ""
	}
}

func readSQLiteRows(path, table string, offset, limit int) (SQLiteRows, error) {
	result := SQLiteRows{Path: path, Table: table, Offset: offset, Limit: limit}
	conn, err := openSQLiteReadOnly(path)
	if err != nil {
		return result, err
	}
	defer C.sqlite3_close(conn)

	exists, err := sqliteTableExists(conn, table)
	if err != nil {
		return result, err
	}
	if !exists {
		return result, errors.New("table not found")
	}

	query := fmt.Sprintf("SELECT * FROM %s LIMIT ? OFFSET ?", quoteSQLiteIdentifier(table))
	st, err := prepareSQLite(conn, query)
	if err != nil {
		return result, err
	}
	defer C.sqlite3_finalize(st)
	if err := bindStmt(st, []any{limit + 1, offset}); err != nil {
		return result, err
	}

	columnCount := int(C.sqlite3_column_count(st))
	result.Columns = make([]string, columnCount)
	for i := 0; i < columnCount; i++ {
		result.Columns[i] = C.GoString(C.sqlite3_column_name(st, C.int(i)))
	}

	for {
		rc := C.sqlite3_step(st)
		if rc == C.SQLITE_DONE {
			break
		}
		if rc != C.SQLITE_ROW {
			return result, errors.New(C.GoString(C.sqlite3_errmsg(conn)))
		}
		row := make([]any, columnCount)
		for i := 0; i < columnCount; i++ {
			row[i] = sqliteColumnValue(st, i)
		}
		result.Rows = append(result.Rows, row)
		if len(result.Rows) > limit {
			result.HasMore = true
			result.Rows = result.Rows[:limit]
			break
		}
	}
	return result, nil
}

func (a *App) sqlitePath(r *http.Request) (string, string, error) {
	base, err := a.botBase(r.PathValue("id"))
	if err != nil {
		return "", "", errors.New("bot not found")
	}
	rel := strings.TrimSpace(r.URL.Query().Get("path"))
	if rel == "" {
		return "", "", errors.New("database path is required")
	}
	path, err := securePath(base, rel, false)
	if err != nil {
		return "", "", err
	}
	info, err := os.Stat(path)
	if err != nil || !info.Mode().IsRegular() {
		return "", "", errors.New("database file not found")
	}
	if !isSQLiteFile(path) {
		return "", "", errors.New("file is not a SQLite database")
	}
	return path, filepath.ToSlash(rel), nil
}

func (a *App) listSQLiteDatabases(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	base, err := a.botBase(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	databases, err := findSQLiteDatabases(base)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not scan bot files for SQLite databases")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"databases": databases})
}

func (a *App) listSQLiteTables(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	path, rel, err := a.sqlitePath(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	tables, err := readSQLiteTables(path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": rel, "tables": tables})
}

func (a *App) listSQLiteRows(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	path, rel, err := a.sqlitePath(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	table := strings.TrimSpace(r.URL.Query().Get("table"))
	if table == "" || len(table) > 512 {
		writeError(w, http.StatusBadRequest, "table is required")
		return
	}
	limit := defaultSQLiteRows
	if v, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && v > 0 {
		limit = v
	}
	if limit > maxSQLiteRows {
		limit = maxSQLiteRows
	}
	offset := 0
	if v, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && v > 0 {
		offset = v
	}
	if offset > 10_000_000 {
		writeError(w, http.StatusBadRequest, "offset is too large")
		return
	}
	rows, err := readSQLiteRows(path, table, offset, limit)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	rows.Path = rel
	writeJSON(w, http.StatusOK, rows)
}
