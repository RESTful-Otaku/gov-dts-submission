package seed

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/j-m-harrison/dts-submission/internal/storage"
	"github.com/j-m-harrison/dts-submission/internal/task"
)

// mockStore implements storage.Store for DemoTasksStore tests only.
type mockStore struct {
	existing []*task.Task
	created  []task.NewTaskInput
}

func (m *mockStore) CreateTask(ctx context.Context, in task.NewTaskInput) (*task.Task, error) {
	m.created = append(m.created, in)
	now := time.Now().UTC()
	return &task.Task{
		ID:          "generated-id",
		Title:       in.Title,
		Description: in.Description,
		Status:      in.Status,
		Priority:    in.Priority,
		Owner:       in.Owner,
		Tags:        in.Tags,
		DueAt:       in.DueAt,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (m *mockStore) ListTasks(ctx context.Context, _ storage.ListOptions) ([]*task.Task, error) {
	return m.existing, nil
}

func (m *mockStore) GetTask(ctx context.Context, id string) (*task.Task, error) {
	return nil, storage.ErrNotFound
}

func (m *mockStore) UpdateTaskStatus(ctx context.Context, id string, status task.Status) (*task.Task, error) {
	return nil, errors.New("not used")
}

func (m *mockStore) UpdateTask(ctx context.Context, id string, in *task.UpdateTaskInput) (*task.Task, error) {
	return nil, errors.New("not used")
}

func (m *mockStore) DeleteTask(ctx context.Context, id string) error {
	return errors.New("not used")
}

func TestDemoTasksStore_SeedsWhenEmpty(t *testing.T) {
	ctx := context.Background()
	m := &mockStore{existing: []*task.Task{}}
	if err := DemoTasksStore(ctx, m); err != nil {
		t.Fatalf("DemoTasksStore: %v", err)
	}
	if len(m.created) == 0 {
		t.Fatal("expected seeded tasks")
	}
	for _, in := range m.created {
		if in.Title == "" {
			t.Fatal("empty title")
		}
		if in.DueAt.Before(time.Now().UTC()) {
			t.Fatalf("due in past: %v", in.DueAt)
		}
	}
}

func TestDemoTasksStore_SkipsExistingTitles(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()
	m := &mockStore{
		existing: []*task.Task{
			{Title: "Review case bundle", ID: "1", Status: task.StatusTodo, DueAt: now.Add(time.Hour), Priority: task.PriorityNormal},
		},
	}
	if err := DemoTasksStore(ctx, m); err != nil {
		t.Fatalf("DemoTasksStore: %v", err)
	}
	for _, in := range m.created {
		if in.Title == "Review case bundle" {
			t.Fatal("should not create duplicate Review case bundle")
		}
	}
	if len(m.created) == 0 {
		t.Fatal("expected other templates to still seed")
	}
}
