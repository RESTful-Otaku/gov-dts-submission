package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/j-m-harrison/dts-submission/internal/config"
	httpapi "github.com/j-m-harrison/dts-submission/internal/http"
	_ "github.com/mattn/go-sqlite3"
)

// Smoke-test the same wiring as main: config → InitDatabase (SQLite) → HTTP routes.
func TestDefaultAPI_SQLiteHealthAndReady(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	t.Setenv("HTTP_PORT", "8080")
	t.Setenv("DB_DRIVER", "sqlite3")
	t.Setenv("DB_DSN", "")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("config.Load: %v", err)
	}
	db, err := httpapi.InitDatabase(ctx, dir, cfg)
	if err != nil {
		t.Fatalf("InitDatabase: %v", err)
	}
	defer db.Close()

	srv := httpapi.NewServerWithDriver(db, cfg.DBDriver)
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	for _, path := range []string{"/api/health", "/api/live", "/api/ready"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("%s: status %d", path, rr.Code)
		}
		if rr.Header().Get("X-Content-Type-Options") != "nosniff" {
			t.Fatalf("%s: missing nosniff", path)
		}
		if rr.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("%s: expected Cache-Control no-store, got %q", path, rr.Header().Get("Cache-Control"))
		}
	}
}
