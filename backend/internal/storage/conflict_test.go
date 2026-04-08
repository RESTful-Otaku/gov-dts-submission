package storage

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/j-m-harrison/dts-submission/internal/task"
	_ "github.com/mattn/go-sqlite3"
)

func newSQLiteStoreForConflictTest(t *testing.T) (*SQLiteStore, *sql.DB) {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return NewSQLiteStore(db), db
}

func TestSQLiteUpdateTaskStatus_ReturnsErrConflict_OnStaleWrite(t *testing.T) {
	store, db := newSQLiteStoreForConflictTest(t)
	ctx := context.Background()
	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "stale-status",
		Status: task.StatusTodo,
		DueAt:  time.Now().UTC().Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	restore := setBeforeConditionalUpdateHookForTest(func() {
		_, hookErr := db.ExecContext(ctx, `UPDATE tasks SET updated_at = ? WHERE id = ?`, time.Now().UTC().Add(time.Second), created.ID)
		if hookErr != nil {
			t.Fatalf("hook update failed: %v", hookErr)
		}
	})
	defer restore()

	_, err = store.UpdateTaskStatus(ctx, created.ID, task.StatusInProgress)
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("expected ErrConflict, got %v", err)
	}
}

func TestSQLiteUpdateTaskStatus_ReturnsErrNotFound_WhenDeletedMidFlight(t *testing.T) {
	store, db := newSQLiteStoreForConflictTest(t)
	ctx := context.Background()
	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "deleted-status",
		Status: task.StatusTodo,
		DueAt:  time.Now().UTC().Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	restore := setBeforeConditionalUpdateHookForTest(func() {
		_, hookErr := db.ExecContext(ctx, `DELETE FROM tasks WHERE id = ?`, created.ID)
		if hookErr != nil {
			t.Fatalf("hook delete failed: %v", hookErr)
		}
	})
	defer restore()

	_, err = store.UpdateTaskStatus(ctx, created.ID, task.StatusInProgress)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestSQLiteUpdateTask_ReturnsErrConflict_OnStaleWrite(t *testing.T) {
	store, db := newSQLiteStoreForConflictTest(t)
	ctx := context.Background()
	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "stale-update",
		Status: task.StatusTodo,
		DueAt:  time.Now().UTC().Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	newTitle := "updated"

	restore := setBeforeConditionalUpdateHookForTest(func() {
		_, hookErr := db.ExecContext(ctx, `UPDATE tasks SET updated_at = ? WHERE id = ?`, time.Now().UTC().Add(time.Second), created.ID)
		if hookErr != nil {
			t.Fatalf("hook update failed: %v", hookErr)
		}
	})
	defer restore()

	_, err = store.UpdateTask(ctx, created.ID, &task.UpdateTaskInput{Title: &newTitle})
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("expected ErrConflict, got %v", err)
	}
}

func TestSQLiteUpdateTask_ReturnsErrNotFound_WhenDeletedMidFlight(t *testing.T) {
	store, db := newSQLiteStoreForConflictTest(t)
	ctx := context.Background()
	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "deleted-update",
		Status: task.StatusTodo,
		DueAt:  time.Now().UTC().Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	newTitle := "updated"

	restore := setBeforeConditionalUpdateHookForTest(func() {
		_, hookErr := db.ExecContext(ctx, `DELETE FROM tasks WHERE id = ?`, created.ID)
		if hookErr != nil {
			t.Fatalf("hook delete failed: %v", hookErr)
		}
	})
	defer restore()

	_, err = store.UpdateTask(ctx, created.ID, &task.UpdateTaskInput{Title: &newTitle})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}
