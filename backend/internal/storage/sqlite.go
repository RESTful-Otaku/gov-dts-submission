package storage

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/j-m-harrison/dts-submission/internal/task"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(db *sql.DB) *SQLiteStore {
	return &SQLiteStore{db: db}
}

// Migrate applies the SQLite schema with UUID primary keys. If the tasks table
// exists with the legacy INTEGER id, it is recreated (data is lost).
func Migrate(ctx context.Context, db *sql.DB) error {
	var idType string
	row := db.QueryRowContext(ctx, "SELECT type FROM pragma_table_info('tasks') WHERE name='id'")
	if err := row.Scan(&idType); err == nil && idType == "INTEGER" {
		if !allowDestructiveMigrations() {
			return destructiveMigrationBlockedError("sqlite")
		}
		if _, err := db.ExecContext(ctx, "DROP TABLE tasks"); err != nil {
			return err
		}
	}
	const q = `
CREATE TABLE IF NOT EXISTS tasks (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	description TEXT,
	status TEXT NOT NULL,
	priority TEXT NOT NULL DEFAULT 'normal',
	owner TEXT NOT NULL DEFAULT '',
	tags TEXT NOT NULL DEFAULT '[]',
	due_at TIMESTAMP NOT NULL,
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL
);
`
	_, err := db.ExecContext(ctx, q)
	return err
}

func (s *SQLiteStore) CreateTask(ctx context.Context, in task.NewTaskInput) (*task.Task, error) {
	now := time.Now().UTC()
	priority := in.Priority
	if priority == "" {
		priority = task.PriorityNormal
	}
	tagsJSON, err := TagsJSON(in.Tags)
	if err != nil {
		return nil, err
	}
	id := uuid.New().String()
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO tasks (id, title, description, status, priority, owner, tags, due_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, in.Title, in.Description, in.Status, priority, in.Owner, tagsJSON, in.DueAt.UTC(), now, now)
	if err != nil {
		return nil, err
	}
	return &task.Task{
		ID:          id,
		Title:       in.Title,
		Description: in.Description,
		Status:      in.Status,
		Priority:    priority,
		Owner:       in.Owner,
		Tags:        in.Tags,
		DueAt:       in.DueAt.UTC(),
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (s *SQLiteStore) GetTask(ctx context.Context, id string) (*task.Task, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, title, description, status, priority, owner, tags, due_at, created_at, updated_at
		FROM tasks WHERE id = ?
	`, id)
	var t task.Task
	var desc sql.NullString
	var tagsRaw string
	if err := row.Scan(&t.ID, &t.Title, &desc, &t.Status, &t.Priority, &t.Owner, &tagsRaw, &t.DueAt, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if desc.Valid {
		t.Description = &desc.String
	}
	tags, _ := ParseTagsJSON(tagsRaw)
	t.Tags = tags
	t.DueAt = t.DueAt.UTC()
	t.CreatedAt = t.CreatedAt.UTC()
	t.UpdatedAt = t.UpdatedAt.UTC()
	return &t, nil
}

func (s *SQLiteStore) ListTasks(ctx context.Context, opts ListOptions) ([]*task.Task, error) {
	q := `
		SELECT id, title, description, status, priority, owner, tags, due_at, created_at, updated_at
		FROM tasks ORDER BY due_at ASC, id ASC
	`
	var rows *sql.Rows
	var err error
	if opts.Limit > 0 {
		q += " LIMIT ? OFFSET ?"
		rows, err = s.db.QueryContext(ctx, q, opts.Limit, max(0, opts.Offset))
	} else {
		rows, err = s.db.QueryContext(ctx, q)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]*task.Task, 0)
	for rows.Next() {
		var t task.Task
		var desc sql.NullString
		var tagsRaw string
		if err := rows.Scan(&t.ID, &t.Title, &desc, &t.Status, &t.Priority, &t.Owner, &tagsRaw, &t.DueAt, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		if desc.Valid {
			t.Description = &desc.String
		}
		tags, _ := ParseTagsJSON(tagsRaw)
		t.Tags = tags
		t.DueAt = t.DueAt.UTC()
		t.CreatedAt = t.CreatedAt.UTC()
		t.UpdatedAt = t.UpdatedAt.UTC()
		result = append(result, &t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *SQLiteStore) UpdateTaskStatus(ctx context.Context, id string, status task.Status) (*task.Task, error) {
	now := time.Now().UTC()
	res, err := s.db.ExecContext(ctx, `UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`, status, now, id)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrNotFound
	}
	return s.GetTask(ctx, id)
}

func (s *SQLiteStore) UpdateTask(ctx context.Context, id string, in *task.UpdateTaskInput) (*task.Task, error) {
	if in == nil {
		return s.GetTask(ctx, id)
	}
	current, err := s.GetTask(ctx, id)
	if err != nil {
		return nil, err
	}
	title := current.Title
	if in.Title != nil {
		title = strings.TrimSpace(*in.Title)
	}
	desc := current.Description
	if in.Description != nil {
		desc = in.Description
	}
	status := current.Status
	if in.Status != nil {
		status = *in.Status
	}
	priority := current.Priority
	if in.Priority != nil {
		priority = *in.Priority
	}
	tags := current.Tags
	if in.Tags != nil {
		tags = in.Tags
	}
	tagsJSON, err := TagsJSON(tags)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	res, err := s.db.ExecContext(ctx, `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, tags = ?, updated_at = ? WHERE id = ?`,
		title, desc, status, priority, tagsJSON, now, id)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrNotFound
	}
	return s.GetTask(ctx, id)
}

func (s *SQLiteStore) DeleteTask(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

