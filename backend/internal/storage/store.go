package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/j-m-harrison/dts-submission/internal/task"
)

// ErrNotFound is returned when a task is not found.
var ErrNotFound = errors.New("task not found")

// Store defines the persistence port for tasks. It is intentionally small so
// that different database backends (SQLite, Postgres, MariaDB, etc.) can
// implement it without leaking database-specific concerns into the rest of
// the application.
type Store interface {
	CreateTask(ctx context.Context, in task.NewTaskInput) (*task.Task, error)
	GetTask(ctx context.Context, id string) (*task.Task, error)
	ListTasks(ctx context.Context, opts ListOptions) ([]*task.Task, error)
	UpdateTaskStatus(ctx context.Context, id string, status task.Status) (*task.Task, error)
	UpdateTask(ctx context.Context, id string, in *task.UpdateTaskInput) (*task.Task, error)
	DeleteTask(ctx context.Context, id string) error
}

type ListOptions struct {
	Limit  int
	Offset int
}

// NewStoreFromDBDriver returns the Store implementation for the given *sql.DB
// and normalized database driver name.
func NewStoreFromDBDriver(db *sql.DB, driver string) Store {
	driver = strings.TrimSpace(strings.ToLower(driver))
	switch driver {
	case "pgx", "postgres":
		return NewPostgresStore(db)
	case "mariadb":
		return NewMariaDBStore(db)
	default:
		return NewSQLiteStore(db)
	}
}

// NewStoreFromDB returns the Store implementation selected from DB_DRIVER.
// Prefer NewStoreFromDBDriver in new code so store selection is explicit.
func NewStoreFromDB(db *sql.DB) Store {
	return NewStoreFromDBDriver(db, os.Getenv("DB_DRIVER"))
}

func allowDestructiveMigrations() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("ALLOW_DESTRUCTIVE_MIGRATIONS")))
	return v == "1" || v == "true" || v == "yes"
}

func destructiveMigrationBlockedError(backend string) error {
	return fmt.Errorf("refusing destructive %s migration for legacy integer task IDs; set ALLOW_DESTRUCTIVE_MIGRATIONS=true to allow table drop", backend)
}

