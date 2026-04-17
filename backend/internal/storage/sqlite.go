package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
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
CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	username TEXT NOT NULL UNIQUE,
	first_name TEXT NOT NULL DEFAULT '',
	last_name TEXT NOT NULL DEFAULT '',
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'viewer',
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMP NOT NULL,
	created_at TIMESTAMP NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
	tags, err := ParseTagsJSON(tagsRaw)
	if err != nil {
		return nil, fmt.Errorf("parse tags for task %s: %w", t.ID, err)
	}
	t.Tags = tags
	t.DueAt = t.DueAt.UTC()
	t.CreatedAt = t.CreatedAt.UTC()
	t.UpdatedAt = t.UpdatedAt.UTC()
	return &t, nil
}

func (s *SQLiteStore) ListTasks(ctx context.Context, opts ListOptions) ([]*task.Task, error) {
	q := `
		SELECT id, title, description, status, priority, owner, tags, due_at, created_at, updated_at
		FROM tasks
	`
	conds := make([]string, 0, 5)
	args := make([]any, 0, 8)
	if opts.Status != "" {
		conds = append(conds, "LOWER(status) = ?")
		args = append(args, opts.Status)
	}
	if opts.Priority != "" {
		conds = append(conds, "LOWER(priority) = ?")
		args = append(args, opts.Priority)
	}
	if opts.Owner != "" {
		conds = append(conds, "LOWER(owner) LIKE ?")
		args = append(args, "%"+opts.Owner+"%")
	}
	if opts.Tag != "" {
		conds = append(conds, "LOWER(tags) LIKE ?")
		args = append(args, "%"+opts.Tag+"%")
	}
	if opts.Q != "" {
		conds = append(conds, "LOWER(title || ' ' || COALESCE(description,'') || ' ' || status || ' ' || priority || ' ' || owner || ' ' || tags) LIKE ?")
		args = append(args, "%"+opts.Q+"%")
	}
	if len(conds) > 0 {
		q += " WHERE " + strings.Join(conds, " AND ")
	}
	switch opts.Sort {
	case "title":
		q += " ORDER BY LOWER(title)"
	case "priority":
		q += " ORDER BY CASE priority WHEN 'low' THEN 1 WHEN 'normal' THEN 2 WHEN 'high' THEN 3 WHEN 'urgent' THEN 4 ELSE 2 END"
	case "owner":
		q += " ORDER BY LOWER(owner)"
	case "status":
		q += " ORDER BY CASE LOWER(status) WHEN 'todo' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'done' THEN 3 ELSE 4 END"
	case "tags":
		q += " ORDER BY LOWER(tags)"
	case "created":
		q += " ORDER BY created_at"
	default:
		q += " ORDER BY due_at"
	}
	if opts.Order == "desc" {
		q += " DESC, id DESC"
	} else {
		q += " ASC, id ASC"
	}
	var rows *sql.Rows
	var err error
	if opts.Limit > 0 {
		q += " LIMIT ? OFFSET ?"
		args = append(args, opts.Limit, max(0, opts.Offset))
		rows, err = s.db.QueryContext(ctx, q, args...)
	} else {
		rows, err = s.db.QueryContext(ctx, q, args...)
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
		tags, err := ParseTagsJSON(tagsRaw)
		if err != nil {
			return nil, fmt.Errorf("parse tags for task %s: %w", t.ID, err)
		}
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
	current, err := s.GetTask(ctx, id)
	if err != nil {
		return nil, err
	}
	runBeforeConditionalUpdateHook()
	now := time.Now().UTC()
	res, err := s.db.ExecContext(ctx, `UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND updated_at = ?`, status, now, id, current.UpdatedAt.UTC())
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		if _, getErr := s.GetTask(ctx, id); errors.Is(getErr, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrConflict
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
	runBeforeConditionalUpdateHook()
	now := time.Now().UTC()
	res, err := s.db.ExecContext(ctx, `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, tags = ?, updated_at = ? WHERE id = ? AND updated_at = ?`,
		title, desc, status, priority, tagsJSON, now, id, current.UpdatedAt.UTC())
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		if _, getErr := s.GetTask(ctx, id); errors.Is(getErr, ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrConflict
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

