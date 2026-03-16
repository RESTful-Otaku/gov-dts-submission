package storage_test

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	"github.com/j-m-harrison/dts-submission/internal/storage"
	"github.com/j-m-harrison/dts-submission/internal/task"
	_ "github.com/go-sql-driver/mysql"
)

func newTestMariaDB(t *testing.T) *sql.DB {
	t.Helper()

	dsn := os.Getenv("MARIADB_DSN")
	if dsn == "" {
		t.Skip("MARIADB_DSN not set; skipping MariaDB integration tests")
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatalf("open mariadb: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancel)
	if err := storage.MigrateMariaDB(ctx, db); err != nil {
		t.Fatalf("migrate mariadb: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestMariaDBStore_CRUD(t *testing.T) {
	db := newTestMariaDB(t)
	store := storage.NewMariaDBStore(db)
	ctx := context.Background()

	due := time.Now().UTC().Add(2 * time.Hour)
	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "Write MariaDB tests",
		Status: task.StatusTodo,
		DueAt:  due,
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected non-empty UUID id")
	}

	fetched, err := store.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if fetched.Title != created.Title || fetched.Status != created.Status {
		t.Fatalf("round-trip mismatch: got %+v", fetched)
	}

	all, err := store.ListTasks(ctx)
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(all) == 0 {
		t.Fatal("expected at least one task in list")
	}

	updated, err := store.UpdateTaskStatus(ctx, created.ID, task.StatusInProgress)
	if err != nil {
		t.Fatalf("UpdateTaskStatus: %v", err)
	}
	if updated.Status != task.StatusInProgress {
		t.Fatalf("expected status in_progress, got %q", updated.Status)
	}

	if err := store.DeleteTask(ctx, created.ID); err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}
	if _, err := store.GetTask(ctx, created.ID); err != storage.ErrNotFound {
		t.Fatalf("expected ErrNotFound after delete, got %v", err)
	}
}

