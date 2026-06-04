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

// MariaDBStore implements Store using MariaDB.
type MariaDBStore struct {
	db *sql.DB
}

func NewMariaDBStore(db *sql.DB) *MariaDBStore {
	return &MariaDBStore{db: db}
}

// MigrateMariaDB applies the MariaDB schema with UUID primary keys.
// If the tasks table exists with legacy BIGINT id, it is recreated (data is lost).
func MigrateMariaDB(ctx context.Context, db *sql.DB) error {
	var dataType string
	row := db.QueryRowContext(ctx, "SELECT data_type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='tasks' AND column_name='id'")
	if err := row.Scan(&dataType); err == nil && dataType == "bigint" {
		if !allowDestructiveMigrations() {
			return destructiveMigrationBlockedError("mariadb")
		}
		if _, err := db.ExecContext(ctx, "DROP TABLE tasks"); err != nil {
			return err
		}
	}
	const createTasks = `
CREATE TABLE IF NOT EXISTS tasks (
	id CHAR(36) NOT NULL PRIMARY KEY,
	title VARCHAR(255) NOT NULL,
	description TEXT NULL,
	status VARCHAR(32) NOT NULL,
	priority VARCHAR(32) NOT NULL DEFAULT 'normal',
	owner VARCHAR(255) NOT NULL DEFAULT '',
	tags JSON NOT NULL DEFAULT (JSON_ARRAY()),
	due_at DATETIME(6) NOT NULL,
	created_at DATETIME(6) NOT NULL,
	updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;`
	const createUsers = `
CREATE TABLE IF NOT EXISTS users (
	id CHAR(36) NOT NULL PRIMARY KEY,
	email VARCHAR(255) NOT NULL UNIQUE,
	username VARCHAR(255) NOT NULL UNIQUE,
	first_name VARCHAR(255) NOT NULL DEFAULT '',
	last_name VARCHAR(255) NOT NULL DEFAULT '',
	password_hash TEXT NOT NULL,
	role VARCHAR(16) NOT NULL DEFAULT 'viewer',
	created_at DATETIME(6) NOT NULL,
	updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;`
	const createSessions = `
CREATE TABLE IF NOT EXISTS sessions (
	id CHAR(36) NOT NULL PRIMARY KEY,
	user_id CHAR(36) NOT NULL,
	token_hash TEXT NOT NULL,
	expires_at DATETIME(6) NOT NULL,
	created_at DATETIME(6) NOT NULL,
	UNIQUE KEY uniq_sessions_token_hash (token_hash(191)),
	CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
`
	if _, err := db.ExecContext(ctx, createTasks); err != nil {
		return err
	}
	if _, err := db.ExecContext(ctx, createUsers); err != nil {
		return err
	}
	_, err := db.ExecContext(ctx, createSessions)
	return err
}

func (s *MariaDBStore) CreateTask(ctx context.Context, in task.NewTaskInput) (*task.Task, error) {
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

func (s *MariaDBStore) GetTask(ctx context.Context, id string) (*task.Task, error) {
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
		return nil, err
	}
	t.Tags = tags
	t.DueAt = t.DueAt.UTC()
	t.CreatedAt = t.CreatedAt.UTC()
	t.UpdatedAt = t.UpdatedAt.UTC()
	return &t, nil
}

func (s *MariaDBStore) ListTasks(ctx context.Context, opts ListOptions) ([]*task.Task, error) {
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
		conds = append(conds, "LOWER(CONCAT(title, ' ', COALESCE(description,''), ' ', status, ' ', priority, ' ', owner, ' ', tags)) LIKE ?")
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

func (s *MariaDBStore) UpdateTaskStatus(ctx context.Context, id string, status task.Status) (*task.Task, error) {
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

func (s *MariaDBStore) UpdateTask(ctx context.Context, id string, in *task.UpdateTaskInput) (*task.Task, error) {
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

func (s *MariaDBStore) DeleteTask(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

