package main

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

type FileEntry struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	Size    int64     `json:"size"`
	IsDir   bool      `json:"is_dir"`
	ModTime time.Time `json:"modified_at"`
}

func securePath(base, rel string, allowMissingFinal bool) (string, error) {
	rel = strings.TrimSpace(rel)
	rel = strings.TrimPrefix(rel, "/")
	clean := filepath.Clean(rel)
	if clean == "." {
		clean = ""
	}
	if clean == ".." || strings.HasPrefix(clean, ".."+string(os.PathSeparator)) || filepath.IsAbs(clean) {
		return "", errors.New("invalid path")
	}
	candidate := filepath.Join(base, clean)
	relCheck, err := filepath.Rel(base, candidate)
	if err != nil || relCheck == ".." || strings.HasPrefix(relCheck, ".."+string(os.PathSeparator)) {
		return "", errors.New("path escapes bot directory")
	}

	// Reject symlinks in every existing component so file operations cannot escape the bot root.
	current := base
	parts := strings.Split(relCheck, string(os.PathSeparator))
	for i, part := range parts {
		if part == "" || part == "." {
			continue
		}
		current = filepath.Join(current, part)
		info, statErr := os.Lstat(current)
		if statErr != nil {
			if os.IsNotExist(statErr) && allowMissingFinal && i == len(parts)-1 {
				break
			}
			if os.IsNotExist(statErr) && allowMissingFinal {
				continue
			}
			return "", statErr
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return "", errors.New("symlinks are not allowed")
		}
	}
	return candidate, nil
}

func (a *App) botBase(id string) (string, error) {
	if _, err := a.db.GetBot(id); err != nil {
		return "", errors.New("bot not found")
	}
	return a.docker.AppDir(id)
}

func (a *App) listFiles(w http.ResponseWriter, r *http.Request) {
	base, err := a.botBase(r.PathValue("id"))
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	rel := r.URL.Query().Get("path")
	dir, err := securePath(base, rel, false)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		writeError(w, 400, "directory not found")
		return
	}
	out := make([]FileEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.Name() == ".home" || entry.Name() == ".elitecp" || entry.Name() == ".elitecp-venv" {
			continue
		}
		info, err := entry.Info()
		if err != nil || info.Mode()&os.ModeSymlink != 0 {
			continue
		}
		entryRel := filepath.ToSlash(filepath.Join(rel, entry.Name()))
		out = append(out, FileEntry{Name: entry.Name(), Path: entryRel, Size: info.Size(), IsDir: entry.IsDir(), ModTime: info.ModTime()})
		if len(out) >= 1000 {
			break
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	writeJSON(w, 200, map[string]any{"path": filepath.ToSlash(rel), "files": out})
}

func (a *App) readFile(w http.ResponseWriter, r *http.Request) {
	base, err := a.botBase(r.PathValue("id"))
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	path, err := securePath(base, r.URL.Query().Get("path"), false)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		writeError(w, 404, "file not found")
		return
	}
	if info.Size() > 2*1024*1024 {
		writeError(w, 413, "file is too large for the editor (2 MB max)")
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		writeError(w, 500, "could not read file")
		return
	}
	if !utf8.Valid(data) || bytes.IndexByte(data, 0) >= 0 {
		writeError(w, 415, "binary files cannot be edited here")
		return
	}
	writeJSON(w, 200, map[string]any{"path": r.URL.Query().Get("path"), "content": string(data)})
}

func (a *App) writeFile(w http.ResponseWriter, r *http.Request) {
	base, err := a.botBase(r.PathValue("id"))
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	rel := r.URL.Query().Get("path")
	if rel == "" {
		writeError(w, 400, "path is required")
		return
	}
	path, err := securePath(base, rel, true)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	var in struct {
		Content string `json:"content"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	if len(in.Content) > 2*1024*1024 {
		writeError(w, 413, "file is too large")
		return
	}
	if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil {
		writeError(w, 500, "could not create parent directory")
		return
	}
	if err := os.WriteFile(path, []byte(in.Content), 0640); err != nil {
		writeError(w, 500, "could not write file")
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (a *App) deleteFile(w http.ResponseWriter, r *http.Request) {
	base, err := a.botBase(r.PathValue("id"))
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	rel := r.URL.Query().Get("path")
	if rel == "" || rel == "/" || rel == "." {
		writeError(w, 400, "refusing to delete bot root")
		return
	}
	path, err := securePath(base, rel, false)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	if err := os.RemoveAll(path); err != nil {
		writeError(w, 500, "could not delete path")
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (a *App) makeDir(w http.ResponseWriter, r *http.Request) {
	base, err := a.botBase(r.PathValue("id"))
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	var in struct {
		Path string `json:"path"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	if in.Path == "" {
		writeError(w, 400, "path is required")
		return
	}
	path, err := securePath(base, in.Path, true)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	if err := os.MkdirAll(path, 0750); err != nil {
		writeError(w, 500, "could not create directory")
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (a *App) uploadFiles(w http.ResponseWriter, r *http.Request) {
	base, err := a.botBase(r.PathValue("id"))
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 70*1024*1024)
	if err := r.ParseMultipartForm(70 << 20); err != nil {
		writeError(w, 400, "upload is too large or invalid")
		return
	}
	targetRel := r.FormValue("path")
	target, err := securePath(base, targetRel, true)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	if err := os.MkdirAll(target, 0750); err != nil {
		writeError(w, 500, "could not create upload directory")
		return
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		writeError(w, 400, "no files uploaded")
		return
	}
	count := 0
	for _, header := range files {
		if err := a.saveUploadedFile(target, header); err != nil {
			writeError(w, 400, err.Error())
			return
		}
		count++
	}
	writeJSON(w, 200, map[string]any{"ok": true, "uploaded": count})
}

func (a *App) saveUploadedFile(target string, header *multipart.FileHeader) error {
	name := filepath.Base(header.Filename)
	if name == "." || name == "" {
		return errors.New("invalid upload name")
	}
	src, err := header.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	if strings.EqualFold(filepath.Ext(name), ".zip") {
		data, err := io.ReadAll(io.LimitReader(src, 65*1024*1024))
		if err != nil {
			return err
		}
		if len(data) >= 65*1024*1024 {
			return errors.New("zip is too large")
		}
		return extractZipSafe(target, data)
	}

	dstPath, err := securePath(target, name, true)
	if err != nil {
		return err
	}
	dst, err := os.OpenFile(dstPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0640)
	if err != nil {
		return err
	}
	defer dst.Close()
	_, err = io.Copy(dst, io.LimitReader(src, 65*1024*1024))
	return err
}

func extractZipSafe(target string, data []byte) error {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return errors.New("invalid zip archive")
	}
	if len(zr.File) > 5000 {
		return errors.New("zip contains too many files")
	}
	var total uint64
	for _, f := range zr.File {
		if f.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("symlink rejected: %s", f.Name)
		}
		total += f.UncompressedSize64
		if total > 300*1024*1024 {
			return errors.New("expanded zip is too large")
		}
		cleanName := filepath.Clean(filepath.FromSlash(f.Name))
		if cleanName == "." || cleanName == "" {
			continue
		}
		dstPath, err := securePath(target, cleanName, true)
		if err != nil {
			return fmt.Errorf("unsafe zip path: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(dstPath, 0750); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(dstPath), 0750); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		dst, err := os.OpenFile(dstPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0640)
		if err != nil {
			rc.Close()
			return err
		}
		_, copyErr := io.Copy(dst, io.LimitReader(rc, int64(f.UncompressedSize64)+1))
		closeErr := dst.Close()
		rc.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
	}
	return nil
}
