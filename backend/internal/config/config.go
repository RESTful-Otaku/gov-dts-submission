package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// AppConfig captures the minimal set of configuration required to run the API
// in different environments and against different databases. It is intentionally
// small and focuses on 12-factor style environment configuration.
type AppConfig struct {
	// Env is the deployment environment identifier, e.g. "development",
	// "test", "staging", "production".
	Env string

	// HTTPPort is the TCP port the HTTP server listens on, without a leading
	// colon (e.g. "8080").
	HTTPPort string

	// DBDriver is the database/sql driver name: "sqlite3" (default), "pgx"
	// (Postgres), or "mariadb".
	DBDriver string

	// DBDsn is the driver-specific connection string.
	DBDsn string

	// LogJSON controls whether logs are emitted as JSON lines rather than the
	// default text format.
	LogJSON bool
}

// Load loads configuration from environment variables, applying sensible
// defaults for local development.
//
// Supported variables:
//   - APP_ENV        (default: "development")
//   - HTTP_PORT      (default: "8080")
//   - DB_DRIVER      (default: "sqlite3")
//   - DB_DSN         (required for non-sqlite drivers; optional for sqlite3)
//   - LOG_JSON       ("true" to enable JSON logging)
func Load() (*AppConfig, error) {
	env := readEnvDefault("APP_ENV", "development")
	httpPort := readEnvDefault("HTTP_PORT", "8080")
	dbDriver := strings.TrimSpace(readEnvDefault("DB_DRIVER", "sqlite3"))
	dbDsn := strings.TrimSpace(os.Getenv("DB_DSN"))
	logJSON := readBoolEnv("LOG_JSON", false)

	if httpPort == "" {
		return nil, fmt.Errorf("HTTP_PORT must not be empty")
	}
	if dbDriver == "" {
		return nil, fmt.Errorf("DB_DRIVER must not be empty")
	}
	switch dbDriver {
	case "sqlite3", "pgx", "postgres", "mariadb":
	default:
		return nil, fmt.Errorf("unsupported DB_DRIVER %q", dbDriver)
	}
	if dbDriver != "sqlite3" && dbDsn == "" {
		return nil, fmt.Errorf("DB_DSN is required when DB_DRIVER=%s", dbDriver)
	}

	return &AppConfig{
		Env:      env,
		HTTPPort: httpPort,
		DBDriver: dbDriver,
		DBDsn:    dbDsn,
		LogJSON:  logJSON,
	}, nil
}

func readEnvDefault(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func readBoolEnv(key string, def bool) bool {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

