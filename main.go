package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

const version = "0.4.0"

type Config struct {
	ListenAddr string
	DataDir    string
	DBPath     string
	PublicURL  string
}

func loadConfig() Config {
	dataDir := getenv("ELITECP_DATA_DIR", "/var/lib/elitecp")
	return Config{
		ListenAddr: getenv("ELITECP_LISTEN", "127.0.0.1:9080"),
		DataDir:    dataDir,
		DBPath:     getenv("ELITECP_DB", filepath.Join(dataDir, "elitecp.db")),
		PublicURL:  os.Getenv("ELITECP_PUBLIC_URL"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)
	cfg := loadConfig()

	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "version", "--version", "-v":
			fmt.Println("eLite CP", version)
			return
		case "setup-admin":
			if err := setupAdminCommand(cfg, os.Args[2:]); err != nil {
				log.Fatal(err)
			}
			return
		case "doctor":
			if err := doctorCommand(cfg); err != nil {
				log.Fatal(err)
			}
			return
		}
	}

	if err := os.MkdirAll(cfg.DataDir, 0750); err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(cfg.DataDir, "bots"), 0750); err != nil {
		log.Fatal(err)
	}

	db, err := OpenDB(cfg.DBPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	docker := NewDockerManager(cfg.DataDir)
	app := NewApp(cfg, db, docker)

	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           app.Routes(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      0, // WebSocket/log streams may live for a long time.
		IdleTimeout:       90 * time.Second,
	}

	go func() {
		log.Printf("eLite CP %s listening on http://%s", version, cfg.ListenAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func setupAdminCommand(cfg Config, args []string) error {
	fs := flag.NewFlagSet("setup-admin", flag.ContinueOnError)
	username := fs.String("username", "", "admin username")
	password := fs.String("password", "", "admin password")
	passwordStdin := fs.Bool("password-stdin", false, "read admin password from stdin")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *passwordStdin {
		b, err := io.ReadAll(io.LimitReader(os.Stdin, 4097))
		if err != nil {
			return err
		}
		*password = strings.TrimRight(string(b), "\r\n")
	}
	if *username == "" || *password == "" {
		return errors.New("usage: elitecp setup-admin --username <name> (--password <password> | --password-stdin)")
	}
	if len(*password) < 10 {
		return errors.New("admin password must be at least 10 characters")
	}
	if err := os.MkdirAll(cfg.DataDir, 0750); err != nil {
		return err
	}
	db, err := OpenDB(cfg.DBPath)
	if err != nil {
		return err
	}
	defer db.Close()
	return db.UpsertAdmin(*username, *password)
}

func doctorCommand(cfg Config) error {
	db, err := OpenDB(cfg.DBPath)
	if err != nil {
		return fmt.Errorf("sqlite: %w", err)
	}
	defer db.Close()
	dm := NewDockerManager(cfg.DataDir)
	if err := dm.Ping(context.Background()); err != nil {
		return fmt.Errorf("docker: %w", err)
	}
	fmt.Printf("eLite CP %s\nSQLite: OK\nDocker: OK\nData: %s\n", version, cfg.DataDir)
	return nil
}
