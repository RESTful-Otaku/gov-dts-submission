package storage

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/j-m-harrison/dts-submission/internal/task"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestSQLiteStore_CreateAndGetTask(t *testing.T) {
	db := newTestDB(t)
	store := NewSQLiteStore(db)
	ctx := context.Background()
	due := time.Now().UTC().Add(2 * time.Hour)
	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "Write tests",
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
	if fetched.Title != "Write tests" || fetched.Status != task.StatusTodo {
		t.Errorf("got title=%q status=%q", fetched.Title, fetched.Status)
	}
}

func TestSQLiteStore_ListTasks(t *testing.T) {
	db := newTestDB(t)
	store := NewSQLiteStore(db)
	ctx := context.Background()
	now := time.Now().UTC()
	for i := 0; i < 3; i++ {
		_, err := store.CreateTask(ctx, task.NewTaskInput{
			Title:  "Task",
			Status: task.StatusTodo,
			DueAt:  now.Add(time.Duration(i) * time.Hour),
		})
		if err != nil {
			t.Fatalf("CreateTask: %v", err)
		}
	}
	all, err := store.ListTasks(ctx)
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("expected 3 tasks, got %d", len(all))
	}
}

func TestSQLiteStore_UpdateTaskStatus(t *testing.T) {
	db := newTestDB(t)
	store := NewSQLiteStore(db)
	ctx := context.Background()
	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "Update status",
		Status: task.StatusTodo,
		DueAt:  time.Now().UTC().Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	updated, err := store.UpdateTaskStatus(ctx, created.ID, task.StatusInProgress)
	if err != nil {
		t.Fatalf("UpdateTaskStatus: %v", err)
	}
	if updated.Status != task.StatusInProgress {
		t.Fatalf("expected status in_progress, got %q", updated.Status)
	}
}

func TestSQLiteStore_DeleteTask(t *testing.T) {
	db := newTestDB(t)
	store := NewSQLiteStore(db)
	ctx := context.Background()
	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "Delete me",
		Status: task.StatusTodo,
		DueAt:  time.Now().UTC().Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if err := store.DeleteTask(ctx, created.ID); err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}
	if _, err := store.GetTask(ctx, created.ID); err != ErrNotFound {
		t.Fatalf("expected ErrNotFound after delete, got %v", err)
	}
}

