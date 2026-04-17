package storage_test

import (
	"context"
	"database/sql"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/j-m-harrison/dts-submission/internal/storage"
	"github.com/j-m-harrison/dts-submission/internal/task"
)

func newTestSQLiteDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := storage.Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestSQLiteStore_CreateAndGetTask(t *testing.T) {
	db := newTestSQLiteDB(t)
	store := storage.NewSQLiteStore(db)
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
	db := newTestSQLiteDB(t)
	store := storage.NewSQLiteStore(db)
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
	all, err := store.ListTasks(ctx, storage.ListOptions{})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("expected 3 tasks, got %d", len(all))
	}
}

func TestSQLiteStore_UpdateTaskStatus(t *testing.T) {
	db := newTestSQLiteDB(t)
	store := storage.NewSQLiteStore(db)
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
	db := newTestSQLiteDB(t)
	store := storage.NewSQLiteStore(db)
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
	if _, err := store.GetTask(ctx, created.ID); err != storage.ErrNotFound {
		t.Fatalf("expected ErrNotFound after delete, got %v", err)
	}
}

func TestSQLiteStore_GetTask_NotFound(t *testing.T) {
	db := newTestSQLiteDB(t)
	store := storage.NewSQLiteStore(db)
	ctx := context.Background()
	_, err := store.GetTask(ctx, "00000000-0000-0000-0000-000000000099")
	if err != storage.ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestSQLiteStore_UpdateTask_Title(t *testing.T) {
	db := newTestSQLiteDB(t)
	store := storage.NewSQLiteStore(db)
	ctx := context.Background()
	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "Before",
		Status: task.StatusTodo,
		DueAt:  time.Now().UTC().Add(time.Hour),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	newTitle := "After"
	updated, err := store.UpdateTask(ctx, created.ID, &task.UpdateTaskInput{Title: &newTitle})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	if updated.Title != "After" {
		t.Fatalf("title: got %q", updated.Title)
	}
}

func TestSQLiteMigrate_BlocksDestructiveLegacyDropByDefault(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer db.Close()

	_, err = db.ExecContext(context.Background(), `CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL)`)
	if err != nil {
		t.Fatalf("create legacy table: %v", err)
	}

	err = storage.Migrate(context.Background(), db)
	if err == nil {
		t.Fatalf("expected migrate to fail without ALLOW_DESTRUCTIVE_MIGRATIONS")
	}
	if !strings.Contains(err.Error(), "ALLOW_DESTRUCTIVE_MIGRATIONS=true") {
		t.Fatalf("expected explicit guidance in error, got: %v", err)
	}
}

func TestSQLiteMigrate_AllowsDestructiveLegacyDrop_WhenExplicitlyEnabled(t *testing.T) {
	t.Setenv("ALLOW_DESTRUCTIVE_MIGRATIONS", "true")

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer db.Close()

	_, err = db.ExecContext(context.Background(), `CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL)`)
	if err != nil {
		t.Fatalf("create legacy table: %v", err)
	}

	if err := storage.Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate with explicit destructive opt-in: %v", err)
	}
}

func TestSQLiteStore_GetTask_InvalidTagsJSON_ReturnsError(t *testing.T) {
	db := newTestSQLiteDB(t)
	store := storage.NewSQLiteStore(db)
	ctx := context.Background()
	due := time.Now().UTC().Add(time.Hour)
	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "Bad tags payload",
		Status: task.StatusTodo,
		DueAt:  due,
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	_, err = db.ExecContext(ctx, `UPDATE tasks SET tags = ? WHERE id = ?`, `{"not":"an-array"}`, created.ID)
	if err != nil {
		t.Fatalf("inject malformed tags JSON: %v", err)
	}

	if _, err := store.GetTask(ctx, created.ID); err == nil {
		t.Fatal("expected GetTask to fail for malformed tags JSON")
	}
}

