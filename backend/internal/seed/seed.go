package seed

import (
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"

	"github.com/j-m-harrison/dts-submission/internal/logger"
	"github.com/j-m-harrison/dts-submission/internal/storage"
	"github.com/j-m-harrison/dts-submission/internal/task"
)

// DemoTasks inserts demo tasks if the store is empty.
func DemoTasks(ctx context.Context, db *sql.DB) error {
	return DemoTasksStore(ctx, storage.NewStoreFromDB(db))
}

// DemoTasksWithDriver inserts demo tasks using an explicit SQL driver for store
// selection. Prefer this in startup paths to avoid implicit env coupling.
func DemoTasksWithDriver(ctx context.Context, db *sql.DB, driver string) error {
	return DemoTasksStore(ctx, storage.NewStoreFromDBDriver(db, driver))
}

// DemoTasksStore inserts demo tasks if the given store is empty.
// This enables seeding for non-SQL backends (e.g. MongoDB) while sharing the
// same demo dataset.
func DemoTasksStore(ctx context.Context, store storage.Store) error {
	existing, err := store.ListTasks(ctx, storage.ListOptions{})
	if err != nil {
		return err
	}
	existingTitles := make(map[string]struct{}, len(existing))
	for _, t := range existing {
		if t == nil {
			continue
		}
		existingTitles[t.Title] = struct{}{}
	}

	now := time.Now().UTC()
	subjects := []string{
		"Bundle", "Hearing", "Disclosure", "Correspondence", "Listing",
		"Case review", "Directions", "Compliance", "Mediation", "Appeal prep",
	}
	adminOwners := []string{"Sarah Chen", "Morgan Blake"}
	editorOwners := []string{
		"James Wilson", "Alex Rivera", "Jordan Matthews", "Casey Nguyen",
		"Riley Foster", "Sam Okonkwo", "Taylor Brooks", "Quinn Mitchell",
	}
	statuses := []task.Status{task.StatusTodo, task.StatusInProgress, task.StatusDone}
	priorities := []task.Priority{task.PriorityLow, task.PriorityNormal, task.PriorityHigh, task.PriorityUrgent}

	type tmpl struct {
		Title       string
		Description string
		Status      task.Status
		Priority    task.Priority
		Owner       string
		Tags        []string
		DueDays     int
	}
	templates := make([]tmpl, 0, 120)
	for i := 0; i < 120; i++ {
		subject := subjects[i%len(subjects)]
		n := i + 1
		var owner string
		if i < 12 {
			owner = adminOwners[i%len(adminOwners)]
		} else {
			owner = editorOwners[(i-12)%len(editorOwners)]
		}
		tagSlug := strings.ToLower(strings.ReplaceAll(subject, " ", "-"))
		templates = append(templates, tmpl{
			Title:       fmt.Sprintf("%s — casework item %d", subject, n),
			Description: fmt.Sprintf("Demonstration task %d for dev/staging builds.", n),
			Status:      statuses[i%len(statuses)],
			Priority:    priorities[i%len(priorities)],
			Owner:       owner,
			Tags:        []string{"demo", "seed", tagSlug},
			DueDays:     (i % 90) + 1,
		})
	}

	seeded := 0
	for _, tmpl := range templates {
		if _, ok := existingTitles[tmpl.Title]; ok {
			continue
		}
		dueAt := now.AddDate(0, 0, tmpl.DueDays)
		dueAt = time.Date(dueAt.Year(), dueAt.Month(), dueAt.Day(), 9, 0, 0, 0, time.UTC)
		for !dueAt.After(now) {
			dueAt = dueAt.AddDate(0, 0, 1)
		}
		desc := tmpl.Description
		in := task.NewTaskInput{
			Title:       tmpl.Title,
			Description: &desc,
			Status:      tmpl.Status,
			Priority:    tmpl.Priority,
			Owner:       tmpl.Owner,
			Tags:        tmpl.Tags,
			DueAt:       dueAt,
		}
		if err := task.ValidateNewTask(now, in); err != nil {
			return err
		}
		if _, err := store.CreateTask(ctx, in); err != nil {
			return err
		}
		seeded++
	}
	if seeded > 0 {
		logger.Info("seeded %d demo tasks", seeded)
	}
	return nil
}

func passwordHashForSeed(password string) string {
	salt := []byte("dts-seed-static-salt")
	sum := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	return base64.RawStdEncoding.EncodeToString(salt) + "." + base64.RawStdEncoding.EncodeToString(sum)
}

func DemoUsersWithDriver(ctx context.Context, db *sql.DB, driver string) error {
	now := time.Now().UTC()
	demoPass := "DemoPass123!"
	sharedHash := passwordHashForSeed(demoPass)
	seedUsers := []struct {
		ID       string
		Email    string
		First    string
		Last     string
		Username string
		Role     string
	}{
		{ID: "10000000-0001-4000-8000-000000000001", Email: "admin@example.gov", First: "Sarah", Last: "Chen", Username: "Sarah Chen", Role: "admin"},
		{ID: "10000000-0001-4000-8000-000000000002", Email: "admin.morgan@example.gov", First: "Morgan", Last: "Blake", Username: "Morgan Blake", Role: "admin"},
		{ID: "10000000-0001-4000-8000-000000000003", Email: "editor@example.gov", First: "James", Last: "Wilson", Username: "James Wilson", Role: "editor"},
		{ID: "10000000-0001-4000-8000-000000000004", Email: "editor.alex@example.gov", First: "Alex", Last: "Rivera", Username: "Alex Rivera", Role: "editor"},
		{ID: "10000000-0001-4000-8000-000000000005", Email: "editor.jordan@example.gov", First: "Jordan", Last: "Matthews", Username: "Jordan Matthews", Role: "editor"},
		{ID: "10000000-0001-4000-8000-000000000006", Email: "editor.casey@example.gov", First: "Casey", Last: "Nguyen", Username: "Casey Nguyen", Role: "editor"},
		{ID: "10000000-0001-4000-8000-000000000007", Email: "editor.riley@example.gov", First: "Riley", Last: "Foster", Username: "Riley Foster", Role: "editor"},
		{ID: "10000000-0001-4000-8000-000000000008", Email: "editor.sam@example.gov", First: "Sam", Last: "Okonkwo", Username: "Sam Okonkwo", Role: "editor"},
		{ID: "10000000-0001-4000-8000-000000000009", Email: "editor.taylor@example.gov", First: "Taylor", Last: "Brooks", Username: "Taylor Brooks", Role: "editor"},
		{ID: "10000000-0001-4000-8000-00000000000a", Email: "editor.quinn@example.gov", First: "Quinn", Last: "Mitchell", Username: "Quinn Mitchell", Role: "editor"},
		{ID: "10000000-0001-4000-8000-00000000000b", Email: "viewer@example.gov", First: "Priya", Last: "Patel", Username: "Priya Patel", Role: "viewer"},
		{ID: "10000000-0001-4000-8000-00000000000c", Email: "viewer.jamie@example.gov", First: "Jamie", Last: "Chen", Username: "Jamie Chen", Role: "viewer"},
		{ID: "10000000-0001-4000-8000-00000000000d", Email: "viewer.robin@example.gov", First: "Robin", Last: "Ellis", Username: "Robin Ellis", Role: "viewer"},
		{ID: "10000000-0001-4000-8000-00000000000e", Email: "viewer.dana@example.gov", First: "Dana", Last: "Singh", Username: "Dana Singh", Role: "viewer"},
		{ID: "10000000-0001-4000-8000-00000000000f", Email: "viewer.lee@example.gov", First: "Lee", Last: "Garcia", Username: "Lee Garcia", Role: "viewer"},
		{ID: "10000000-0001-4000-8000-000000000010", Email: "viewer.avery@example.gov", First: "Avery", Last: "Moore", Username: "Avery Moore", Role: "viewer"},
		{ID: "10000000-0001-4000-8000-000000000011", Email: "viewer.drew@example.gov", First: "Drew", Last: "Thompson", Username: "Drew Thompson", Role: "viewer"},
		{ID: "10000000-0001-4000-8000-000000000012", Email: "viewer.remy@example.gov", First: "Remy", Last: "Clarke", Username: "Remy Clarke", Role: "viewer"},
		{ID: "10000000-0001-4000-8000-000000000013", Email: "viewer.sky@example.gov", First: "Sky", Last: "Patel", Username: "Sky Patel", Role: "viewer"},
		{ID: "10000000-0001-4000-8000-000000000014", Email: "viewer.jordanf@example.gov", First: "Jordan", Last: "Fox", Username: "Jordan Fox", Role: "viewer"},
	}
	seeded := 0
	selectQuery := `SELECT COUNT(*) FROM users WHERE email = ? OR username = ?`
	insertQuery := `
INSERT INTO users (id, email, username, first_name, last_name, password_hash, role, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`
	if driver == "pgx" || driver == "postgres" {
		selectQuery = `SELECT COUNT(*) FROM users WHERE email = $1 OR username = $2`
		insertQuery = `
INSERT INTO users (id, email, username, first_name, last_name, password_hash, role, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`
	}
	for _, u := range seedUsers {
		var exists int
		if err := db.QueryRowContext(ctx, selectQuery, u.Email, u.Username).Scan(&exists); err != nil {
			return err
		}
		if exists > 0 {
			continue
		}
		_, err := db.ExecContext(ctx, insertQuery, u.ID, u.Email, u.Username, u.First, u.Last, sharedHash, u.Role, now, now)
		if err != nil {
			return fmt.Errorf("seed user %s: %w", u.Email, err)
		}
		seeded++
	}
	if seeded > 0 {
		logger.Info("seeded %d demo users", seeded)
	}
	return nil
}
