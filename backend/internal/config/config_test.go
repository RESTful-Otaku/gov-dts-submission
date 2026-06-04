package config

import (
	"strings"
	"testing"
)

func TestLoad_Defaults(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("HTTP_PORT", "")
	t.Setenv("DB_DRIVER", "")
	t.Setenv("DB_DSN", "")
	t.Setenv("LOG_JSON", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Env != "development" || cfg.HTTPPort != "8080" || cfg.DBDriver != "sqlite3" {
		t.Fatalf("defaults: %+v", cfg)
	}
	if cfg.DBDsn != "" || cfg.LogJSON != false {
		t.Fatalf("unexpected: %+v", cfg)
	}
}

func TestLoad_CustomEnv(t *testing.T) {
	t.Setenv("APP_ENV", "staging")
	t.Setenv("HTTP_PORT", "3000")
	t.Setenv("DB_DRIVER", "sqlite3")
	t.Setenv("LOG_JSON", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Env != "staging" || cfg.HTTPPort != "3000" || !cfg.LogJSON {
		t.Fatalf("got %+v", cfg)
	}
}

func TestLoad_PostgresAlias_WithDSN(t *testing.T) {
	t.Setenv("DB_DRIVER", "postgres")
	t.Setenv("DB_DSN", "postgres://x:y@localhost/db")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.DBDriver != "postgres" {
		t.Fatalf("driver: %q", cfg.DBDriver)
	}
}

func TestLoad_Pgx_RequiresDSN(t *testing.T) {
	t.Setenv("DB_DRIVER", "pgx")
	t.Setenv("DB_DSN", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "DB_DSN") {
		t.Fatalf("unexpected err: %v", err)
	}
}

func TestLoad_MariaDB_RequiresDSN(t *testing.T) {
	t.Setenv("DB_DRIVER", "mariadb")
	t.Setenv("DB_DSN", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestLoad_UnsupportedDriver(t *testing.T) {
	t.Setenv("DB_DRIVER", "oracle")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "unsupported") {
		t.Fatalf("unexpected err: %v", err)
	}
}

func TestLoad_LogJSON_ParseBool(t *testing.T) {
	t.Setenv("DB_DRIVER", "sqlite3")
	t.Setenv("LOG_JSON", "1")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.LogJSON {
		t.Fatal("expected LogJSON true for LOG_JSON=1")
	}

	t.Setenv("LOG_JSON", "not-a-bool")

	cfg, err = Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.LogJSON {
		t.Fatal("invalid LOG_JSON should fall back to false")
	}
}
