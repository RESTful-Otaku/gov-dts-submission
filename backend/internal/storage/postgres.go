package storage

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/j-m-harrison/dts-submission/internal/task"
)

// PostgresStore implements Store using PostgreSQL. It assumes the standard
// database/sql compatible Postgres driver (pgx or lib/pq).
type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

// MigratePostgres applies the PostgreSQL schema with UUID primary keys.
// If the tasks table exists with legacy BIGINT id, it is recreated (data is lost).
func MigratePostgres(ctx context.Context, db *sql.DB) error {
	var dataType string
	row := db.QueryRowContext(ctx, "SELECT data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='tasks' AND column_name='id'")
	if err := row.Scan(&dataType); err == nil && dataType == "bigint" {
		if !allowDestructiveMigrations() {
			return destructiveMigrationBlockedError("postgres")
		}
		if _, err := db.ExecContext(ctx, "DROP TABLE tasks"); err != nil {
			return err
		}
	}
	const q = `
CREATE TABLE IF NOT EXISTS tasks (
	id UUID PRIMARY KEY,
	title TEXT NOT NULL,
	description TEXT,
	status TEXT NOT NULL,
	priority TEXT NOT NULL DEFAULT 'normal',
	owner TEXT NOT NULL DEFAULT '',
	tags TEXT NOT NULL DEFAULT '[]',
	due_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
	id UUID PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	username TEXT NOT NULL UNIQUE,
	first_name TEXT NOT NULL DEFAULT '',
	last_name TEXT NOT NULL DEFAULT '',
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'viewer',
	created_at TIMESTAMPTZ NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	id UUID PRIMARY KEY,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL
);
`
	_, err := db.ExecContext(ctx, q)
	return err
}

func (s *PostgresStore) CreateTask(ctx context.Context, in task.NewTaskInput) (*task.Task, error) {
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
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

func (s *PostgresStore) GetTask(ctx context.Context, id string) (*task.Task, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, title, description, status, priority, owner, tags, due_at, created_at, updated_at
		FROM tasks WHERE id = $1
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
		return nil, err
	}
	t.Tags = tags
	t.DueAt = t.DueAt.UTC()
	t.CreatedAt = t.CreatedAt.UTC()
	t.UpdatedAt = t.UpdatedAt.UTC()
	return &t, nil
}

func (s *PostgresStore) ListTasks(ctx context.Context, opts ListOptions) ([]*task.Task, error) {
	q := `
		SELECT id, title, description, status, priority, owner, tags, due_at, created_at, updated_at
		FROM tasks
	`
	conds := make([]string, 0, 5)
	args := make([]any, 0, 8)
	nextArg := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if opts.Status != "" {
		conds = append(conds, "LOWER(status) = "+nextArg(opts.Status))
	}
	if opts.Priority != "" {
		conds = append(conds, "LOWER(priority) = "+nextArg(opts.Priority))
	}
	if opts.Owner != "" {
		conds = append(conds, "LOWER(owner) LIKE "+nextArg("%"+opts.Owner+"%"))
	}
	if opts.Tag != "" {
		conds = append(conds, "LOWER(tags) LIKE "+nextArg("%"+opts.Tag+"%"))
	}
	if opts.Q != "" {
		conds = append(conds, "LOWER(title || ' ' || COALESCE(description,'') || ' ' || status || ' ' || priority || ' ' || owner || ' ' || tags) LIKE "+nextArg("%"+opts.Q+"%"))
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
		q += " LIMIT " + nextArg(opts.Limit) + " OFFSET " + nextArg(max(0, opts.Offset))
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
			return nil, err
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

func (s *PostgresStore) UpdateTaskStatus(ctx context.Context, id string, status task.Status) (*task.Task, error) {
	current, err := s.GetTask(ctx, id)
	if err != nil {
		return nil, err
	}
	runBeforeConditionalUpdateHook()
	now := time.Now().UTC()
	res, err := s.db.ExecContext(ctx, `UPDATE tasks SET status = $1, updated_at = $2 WHERE id = $3 AND updated_at = $4`, status, now, id, current.UpdatedAt.UTC())
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

func (s *PostgresStore) UpdateTask(ctx context.Context, id string, in *task.UpdateTaskInput) (*task.Task, error) {
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
	res, err := s.db.ExecContext(ctx, `UPDATE tasks SET title = $1, description = $2, status = $3, priority = $4, tags = $5, updated_at = $6 WHERE id = $7 AND updated_at = $8`,
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

func (s *PostgresStore) DeleteTask(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

