package storage

import (
	"context"
	"database/sql"
	"errors"
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
	ListTasks(ctx context.Context) ([]*task.Task, error)
	UpdateTaskStatus(ctx context.Context, id string, status task.Status) (*task.Task, error)
	UpdateTask(ctx context.Context, id string, in *task.UpdateTaskInput) (*task.Task, error)
	DeleteTask(ctx context.Context, id string) error
}

// NewStoreFromDB returns the Store implementation for the given *sql.DB.
// The implementation is chosen from DB_DRIVER (pgx/postgres → PostgresStore,
// mariadb → MariaDBStore, otherwise SQLiteStore) so that placeholders and SQL
// match the connected database.
func NewStoreFromDB(db *sql.DB) Store {
	driver := strings.TrimSpace(strings.ToLower(os.Getenv("DB_DRIVER")))
	switch driver {
	case "pgx", "postgres":
		return NewPostgresStore(db)
	case "mariadb":
		return NewMariaDBStore(db)
	default:
		return NewSQLiteStore(db)
	}
}

