package storage_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/j-m-harrison/dts-submission/internal/storage"
	"github.com/j-m-harrison/dts-submission/internal/task"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func newTestMongoStore(t *testing.T) *storage.MongoStore {
	t.Helper()

	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		t.Skip("MONGO_URI not set; skipping MongoDB integration tests")
	}
	dbName := os.Getenv("MONGO_DATABASE")
	if dbName == "" {
		dbName = "tasks_test"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatalf("connect mongo: %v", err)
	}
	t.Cleanup(func() {
		_ = client.Disconnect(context.Background())
	})

	store := storage.NewMongoStore(client, storage.MongoConfig{
		DatabaseName:   dbName,
		CollectionName: "tasks",
	})
	if err := storage.EnsureMongoIndexes(ctx, store); err != nil {
		t.Fatalf("ensure indexes: %v", err)
	}

	// Clean collection before each test run.
	if err := store.Collection().Drop(ctx); err != nil {
		t.Fatalf("drop collection: %v", err)
	}

	return store
}

func TestMongoStore_CreateAndGetTask(t *testing.T) {
	store := newTestMongoStore(t)
	ctx := context.Background()
	due := time.Now().UTC().Add(2 * time.Hour)

	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "Write Mongo tests",
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
	if fetched.Title != "Write Mongo tests" || fetched.Status != task.StatusTodo {
		t.Errorf("got title=%q status=%q", fetched.Title, fetched.Status)
	}
}

func TestMongoStore_ListTasks(t *testing.T) {
	store := newTestMongoStore(t)
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

func TestMongoStore_UpdateTaskStatusAndDelete(t *testing.T) {
	store := newTestMongoStore(t)
	ctx := context.Background()

	created, err := store.CreateTask(ctx, task.NewTaskInput{
		Title:  "Mongo status",
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

	if err := store.DeleteTask(ctx, created.ID); err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}
	if _, err := store.GetTask(ctx, created.ID); err != storage.ErrNotFound {
		t.Fatalf("expected ErrNotFound after delete, got %v", err)
	}
}

