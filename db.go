package main

/*
#cgo LDFLAGS: -lsqlite3
#include <sqlite3.h>
#include <stdlib.h>
*/
import "C"

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"
)

var ErrNotFound = errors.New("not found")

type DB struct {
	mu   sync.Mutex
	conn *C.sqlite3
}

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type Bot struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Runtime   string    `json:"runtime"`
	Image     string    `json:"image"`
	Startup   string    `json:"startup"`
	MemoryMB  int       `json:"memory_mb"`
	CPUs      float64   `json:"cpus"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Status    string    `json:"status,omitempty"`
}

type EnvVar struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

func OpenDB(path string) (*DB, error) {
	cpath := C.CString(path)
	defer C.free(unsafe.Pointer(cpath))
	var conn *C.sqlite3
	flags := C.int(C.SQLITE_OPEN_READWRITE | C.SQLITE_OPEN_CREATE | C.SQLITE_OPEN_FULLMUTEX)
	if rc := C.sqlite3_open_v2(cpath, &conn, flags, nil); rc != C.SQLITE_OK {
		msg := "sqlite open failed"
		if conn != nil {
			msg = C.GoString(C.sqlite3_errmsg(conn))
			C.sqlite3_close(conn)
		}
		return nil, errors.New(msg)
	}
	db := &DB{conn: conn}
	if err := db.exec(`PRAGMA journal_mode=WAL`); err != nil {
		db.Close()
		return nil, err
	}
	_ = db.exec(`PRAGMA foreign_keys=ON`)
	_ = db.exec(`PRAGMA busy_timeout=5000`)
	if err := db.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func (db *DB) Close() error {
	db.mu.Lock()
	defer db.mu.Unlock()
	if db.conn != nil {
		if rc := C.sqlite3_close(db.conn); rc != C.SQLITE_OK {
			return errors.New(C.GoString(C.sqlite3_errmsg(db.conn)))
		}
		db.conn = nil
	}
	return nil
}

func (db *DB) Ping() error {
	return db.exec(`SELECT 1`)
}

func (db *DB) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE COLLATE NOCASE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'admin',
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS bots (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			runtime TEXT NOT NULL,
			image TEXT NOT NULL,
			startup TEXT NOT NULL,
			memory_mb INTEGER NOT NULL DEFAULT 512,
			cpus REAL NOT NULL DEFAULT 0.50,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS bot_env (
			bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			PRIMARY KEY(bot_id, key)
		)`,
	}
	for _, s := range stmts {
		if err := db.exec(s); err != nil {
			return err
		}
	}
	return nil
}

type bindValue any

func (db *DB) prepareLocked(query string) (*C.sqlite3_stmt, error) {
	cq := C.CString(query)
	defer C.free(unsafe.Pointer(cq))
	var st *C.sqlite3_stmt
	if rc := C.sqlite3_prepare_v2(db.conn, cq, -1, &st, nil); rc != C.SQLITE_OK {
		return nil, errors.New(C.GoString(C.sqlite3_errmsg(db.conn)))
	}
	return st, nil
}

func bindStmt(st *C.sqlite3_stmt, args []any) error {
	for i, arg := range args {
		idx := C.int(i + 1)
		var rc C.int
		switch v := arg.(type) {
		case nil:
			rc = C.sqlite3_bind_null(st, idx)
		case string:
			cs := C.CString(v)
			rc = C.sqlite3_bind_text(st, idx, cs, C.int(len(v)), (*[0]byte)(C.SQLITE_TRANSIENT))
			C.free(unsafe.Pointer(cs))
		case int:
			rc = C.sqlite3_bind_int64(st, idx, C.sqlite3_int64(v))
		case int64:
			rc = C.sqlite3_bind_int64(st, idx, C.sqlite3_int64(v))
		case float64:
			rc = C.sqlite3_bind_double(st, idx, C.double(v))
		case time.Time:
			s := v.UTC().Format(time.RFC3339Nano)
			cs := C.CString(s)
			rc = C.sqlite3_bind_text(st, idx, cs, C.int(len(s)), (*[0]byte)(C.SQLITE_TRANSIENT))
			C.free(unsafe.Pointer(cs))
		default:
			return fmt.Errorf("unsupported sqlite bind type %T", arg)
		}
		if rc != C.SQLITE_OK {
			return errors.New("sqlite bind failed")
		}
	}
	return nil
}

func (db *DB) exec(query string, args ...any) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	return db.execLocked(query, args...)
}

func (db *DB) execLocked(query string, args ...any) error {
	st, err := db.prepareLocked(query)
	if err != nil {
		return err
	}
	defer C.sqlite3_finalize(st)
	if err := bindStmt(st, args); err != nil {
		return err
	}
	rc := C.sqlite3_step(st)
	if rc != C.SQLITE_DONE && rc != C.SQLITE_ROW {
		return errors.New(C.GoString(C.sqlite3_errmsg(db.conn)))
	}
	return nil
}

func colText(st *C.sqlite3_stmt, idx int) string {
	p := C.sqlite3_column_text(st, C.int(idx))
	if p == nil {
		return ""
	}
	n := C.sqlite3_column_bytes(st, C.int(idx))
	return C.GoStringN((*C.char)(unsafe.Pointer(p)), n)
}

func colInt64(st *C.sqlite3_stmt, idx int) int64 {
	return int64(C.sqlite3_column_int64(st, C.int(idx)))
}
func colFloat(st *C.sqlite3_stmt, idx int) float64 {
	return float64(C.sqlite3_column_double(st, C.int(idx)))
}

func parseDBTime(s string) time.Time {
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t
	}
	if t, err := time.Parse("2006-01-02 15:04:05", s); err == nil {
		return t.UTC()
	}
	return time.Time{}
}

func pbkdf2SHA256(password, salt []byte, iter, keyLen int) []byte {
	hLen := sha256.Size
	nBlocks := (keyLen + hLen - 1) / hLen
	out := make([]byte, 0, nBlocks*hLen)
	for block := 1; block <= nBlocks; block++ {
		mac := hmac.New(sha256.New, password)
		mac.Write(salt)
		mac.Write([]byte{byte(block >> 24), byte(block >> 16), byte(block >> 8), byte(block)})
		u := mac.Sum(nil)
		t := append([]byte(nil), u...)
		for i := 1; i < iter; i++ {
			mac = hmac.New(sha256.New, password)
			mac.Write(u)
			u = mac.Sum(nil)
			for j := range t {
				t[j] ^= u[j]
			}
		}
		out = append(out, t...)
	}
	return out[:keyLen]
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	const iterations = 310000
	dk := pbkdf2SHA256([]byte(password), salt, iterations, 32)
	return fmt.Sprintf("pbkdf2_sha256$%d$%s$%s", iterations,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(dk)), nil
}

func verifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2_sha256" {
		return false
	}
	iter, err := strconv.Atoi(parts[1])
	if err != nil || iter < 100000 || iter > 1000000 {
		return false
	}
	salt, err1 := base64.RawStdEncoding.DecodeString(parts[2])
	want, err2 := base64.RawStdEncoding.DecodeString(parts[3])
	if err1 != nil || err2 != nil || len(want) != 32 {
		return false
	}
	got := pbkdf2SHA256([]byte(password), salt, iter, len(want))
	return subtle.ConstantTimeCompare(got, want) == 1
}

func (db *DB) UpsertAdmin(username, password string) error {
	username = strings.TrimSpace(username)
	if len(username) < 3 || len(username) > 64 {
		return errors.New("username must be 3-64 characters")
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	return db.exec(`INSERT INTO users(username,password_hash,role) VALUES(?,?, 'admin')
		ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, role='admin'`, username, hash)
}

func (db *DB) Authenticate(username, password string) (*User, error) {
	db.mu.Lock()
	defer db.mu.Unlock()
	st, err := db.prepareLocked(`SELECT id,username,role,password_hash FROM users WHERE username=?`)
	if err != nil {
		return nil, err
	}
	defer C.sqlite3_finalize(st)
	if err := bindStmt(st, []any{strings.TrimSpace(username)}); err != nil {
		return nil, err
	}
	if C.sqlite3_step(st) != C.SQLITE_ROW {
		return nil, errors.New("invalid credentials")
	}
	u := &User{ID: colInt64(st, 0), Username: colText(st, 1), Role: colText(st, 2)}
	if !verifyPassword(colText(st, 3), password) {
		return nil, errors.New("invalid credentials")
	}
	return u, nil
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (db *DB) CreateSession(userID int64, ttl time.Duration) (string, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}
	expires := time.Now().UTC().Add(ttl)
	if err := db.exec(`INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)`, token, userID, expires); err != nil {
		return "", err
	}
	_ = db.exec(`DELETE FROM sessions WHERE expires_at < ?`, time.Now().UTC())
	return token, nil
}

func (db *DB) UserBySession(token string) (*User, error) {
	db.mu.Lock()
	defer db.mu.Unlock()
	st, err := db.prepareLocked(`SELECT u.id,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?`)
	if err != nil {
		return nil, err
	}
	defer C.sqlite3_finalize(st)
	if err := bindStmt(st, []any{token, time.Now().UTC()}); err != nil {
		return nil, err
	}
	if C.sqlite3_step(st) != C.SQLITE_ROW {
		return nil, ErrNotFound
	}
	return &User{ID: colInt64(st, 0), Username: colText(st, 1), Role: colText(st, 2)}, nil
}

func (db *DB) DeleteSession(token string) { _ = db.exec(`DELETE FROM sessions WHERE token=?`, token) }

func (db *DB) ListBots() ([]Bot, error) {
	db.mu.Lock()
	defer db.mu.Unlock()
	st, err := db.prepareLocked(`SELECT id,name,runtime,image,startup,memory_mb,cpus,created_at,updated_at FROM bots ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer C.sqlite3_finalize(st)
	var out []Bot
	for {
		rc := C.sqlite3_step(st)
		if rc == C.SQLITE_DONE {
			break
		}
		if rc != C.SQLITE_ROW {
			return nil, errors.New(C.GoString(C.sqlite3_errmsg(db.conn)))
		}
		out = append(out, Bot{
			ID: colText(st, 0), Name: colText(st, 1), Runtime: colText(st, 2), Image: colText(st, 3), Startup: colText(st, 4),
			MemoryMB: int(colInt64(st, 5)), CPUs: colFloat(st, 6), CreatedAt: parseDBTime(colText(st, 7)), UpdatedAt: parseDBTime(colText(st, 8)),
		})
	}
	return out, nil
}

func (db *DB) GetBot(id string) (*Bot, error) {
	db.mu.Lock()
	defer db.mu.Unlock()
	st, err := db.prepareLocked(`SELECT id,name,runtime,image,startup,memory_mb,cpus,created_at,updated_at FROM bots WHERE id=?`)
	if err != nil {
		return nil, err
	}
	defer C.sqlite3_finalize(st)
	if err := bindStmt(st, []any{id}); err != nil {
		return nil, err
	}
	if C.sqlite3_step(st) != C.SQLITE_ROW {
		return nil, ErrNotFound
	}
	return &Bot{
		ID: colText(st, 0), Name: colText(st, 1), Runtime: colText(st, 2), Image: colText(st, 3), Startup: colText(st, 4),
		MemoryMB: int(colInt64(st, 5)), CPUs: colFloat(st, 6), CreatedAt: parseDBTime(colText(st, 7)), UpdatedAt: parseDBTime(colText(st, 8)),
	}, nil
}

func (db *DB) CreateBot(b Bot) error {
	return db.exec(`INSERT INTO bots(id,name,runtime,image,startup,memory_mb,cpus,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,
		b.ID, b.Name, b.Runtime, b.Image, b.Startup, b.MemoryMB, b.CPUs, b.CreatedAt, b.UpdatedAt)
}

func (db *DB) DeleteBot(id string) error { return db.exec(`DELETE FROM bots WHERE id=?`, id) }

func (db *DB) UpdateBot(id, name, startup string, memory int, cpus float64) error {
	return db.exec(`UPDATE bots SET name=?,startup=?,memory_mb=?,cpus=?,updated_at=? WHERE id=?`, name, startup, memory, cpus, time.Now().UTC(), id)
}

func (db *DB) GetEnv(botID string) ([]EnvVar, error) {
	db.mu.Lock()
	defer db.mu.Unlock()
	st, err := db.prepareLocked(`SELECT key,value FROM bot_env WHERE bot_id=? ORDER BY key`)
	if err != nil {
		return nil, err
	}
	defer C.sqlite3_finalize(st)
	if err := bindStmt(st, []any{botID}); err != nil {
		return nil, err
	}
	var env []EnvVar
	for {
		rc := C.sqlite3_step(st)
		if rc == C.SQLITE_DONE {
			break
		}
		if rc != C.SQLITE_ROW {
			return nil, errors.New(C.GoString(C.sqlite3_errmsg(db.conn)))
		}
		env = append(env, EnvVar{Key: colText(st, 0), Value: colText(st, 1)})
	}
	return env, nil
}

func (db *DB) ReplaceEnv(botID string, env []EnvVar) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	if err := db.execLocked(`BEGIN IMMEDIATE`); err != nil {
		return err
	}
	committed := false
	defer func() {
		if !committed {
			_ = db.execLocked(`ROLLBACK`)
		}
	}()
	if err := db.execLocked(`DELETE FROM bot_env WHERE bot_id=?`, botID); err != nil {
		return err
	}
	for _, e := range env {
		if err := db.execLocked(`INSERT INTO bot_env(bot_id,key,value) VALUES(?,?,?)`, botID, e.Key, e.Value); err != nil {
			return err
		}
	}
	if err := db.execLocked(`COMMIT`); err != nil {
		return err
	}
	committed = true
	return nil
}
