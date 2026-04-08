package httpapi

import (
	"bytes"
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/mail"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/go-sql-driver/mysql" // MariaDB backend (same wire protocol)
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/j-m-harrison/dts-submission/internal/config"
	"github.com/j-m-harrison/dts-submission/internal/logger"
	"github.com/j-m-harrison/dts-submission/internal/seed"
	"github.com/j-m-harrison/dts-submission/internal/storage"
	"github.com/j-m-harrison/dts-submission/internal/task"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/mattn/go-sqlite3"
)

// maxJSONRequestBytes caps JSON bodies for task mutations to limit allocation and parse cost.
const maxJSONRequestBytes = 1 << 20 // 1 MiB
const (
	defaultListTasksLimit = 50
	maxListTasksLimit     = 200
)

type listSortKey string
type listSortOrder string

const (
	listSortDue      listSortKey   = "due"
	listSortTitle    listSortKey   = "title"
	listSortPriority listSortKey   = "priority"
	listSortOwner    listSortKey   = "owner"
	listSortStatus   listSortKey   = "status"
	listSortTags     listSortKey   = "tags"
	listSortCreated  listSortKey   = "created"
	listOrderAsc     listSortOrder = "asc"
	listOrderDesc    listSortOrder = "desc"
)

type Server struct {
	store storage.Store
	db    *sql.DB
	dbDriver string
	// dbPing is an optional callback used by the readiness endpoint. For
	// SQL-backed stores this wraps (*sql.DB).PingContext; for Mongo-backed
	// stores it can wrap a mongo.Client.Ping call.
	dbPing func(ctx context.Context) error
}

type authRequest struct {
	Email     string `json:"email"`
	Username  string `json:"username"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Password  string `json:"password"`
}

type recoverRequest struct {
	Email string `json:"email"`
}

type resetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

type adminUserUpsertRequest struct {
	Email     string `json:"email"`
	Username  string `json:"username"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Password  string `json:"password"`
	Role      string `json:"role"`
}

type authClaims struct {
	Scopes []string
	Roles  []string
}

type listUsersResponse struct {
	Users []authUser `json:"users"`
	Total int        `json:"total"`
}

type auditLogRecord struct {
	ID            string    `json:"id"`
	UserID        string    `json:"userId"`
	Username      string    `json:"username"`
	Action        string    `json:"action"`
	EntityType    string    `json:"entityType"`
	EntityID      string    `json:"entityId"`
	ChangedFields []string  `json:"changedFields"`
	BeforeJSON    string    `json:"beforeJson,omitempty"`
	AfterJSON     string    `json:"afterJson,omitempty"`
	RawJSON       string    `json:"rawJson"`
	CreatedAt     time.Time `json:"createdAt"`
}

// NewServer constructs a Server backed by an SQL database. It preserves the
// existing behaviour of using a concrete *sql.DB for migrations, seeding, and
// readiness checks.
func NewServer(db *sql.DB) *Server {
	return NewServerWithDriver(db, strings.TrimSpace(os.Getenv("DB_DRIVER")))
}

// NewServerWithDriver constructs a Server backed by SQL and an explicit driver.
// Prefer this constructor so storage selection is not coupled to process env.
func NewServerWithDriver(db *sql.DB, driver string) *Server {
	return &Server{
		store: storage.NewStoreFromDBDriver(db, driver),
		db:    db,
		dbDriver: strings.ToLower(strings.TrimSpace(driver)),
		dbPing: func(ctx context.Context) error {
			if db == nil {
				return errors.New("nil db")
			}
			return db.PingContext(ctx)
		},
	}
}

func (s *Server) usesPostgresParams() bool {
	return s.dbDriver == "pgx" || s.dbDriver == "postgres"
}

func (s *Server) rebindQuery(q string) string {
	if !s.usesPostgresParams() || !strings.Contains(q, "?") {
		return q
	}
	var b strings.Builder
	b.Grow(len(q) + 8)
	arg := 1
	for i := 0; i < len(q); i++ {
		if q[i] == '?' {
			b.WriteString("$")
			b.WriteString(strconv.Itoa(arg))
			arg++
			continue
		}
		b.WriteByte(q[i])
	}
	return b.String()
}

func (s *Server) execDB(ctx context.Context, q string, args ...any) (sql.Result, error) {
	return s.db.ExecContext(ctx, s.rebindQuery(q), args...)
}

func (s *Server) queryDB(ctx context.Context, q string, args ...any) (*sql.Rows, error) {
	return s.db.QueryContext(ctx, s.rebindQuery(q), args...)
}

func (s *Server) queryRowDB(ctx context.Context, q string, args ...any) *sql.Row {
	return s.db.QueryRowContext(ctx, s.rebindQuery(q), args...)
}

// NewServerWithStore constructs a Server from an arbitrary Store implementation
// and an optional readiness check function. This enables MongoDB-backed
// deployments without coupling the HTTP layer directly to Mongo driver types.
func NewServerWithStore(store storage.Store, ping func(ctx context.Context) error) *Server {
	return &Server{
		store: store,
		db:    nil,
		dbPing: func(ctx context.Context) error {
			if ping == nil {
				return nil
			}
			return ping(ctx)
		},
	}
}

// BootstrapSQLAuthArtifacts creates auth-related SQL tables (users, sessions, audit_logs, …) when
// using an SQL-backed store. Task mutations write audit rows; this must run before the first mutation.
func (s *Server) BootstrapSQLAuthArtifacts(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	return s.ensureAuthSchema(ctx)
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	reg := func(pattern string, requiresToken bool, requiresSession bool, minRole userRole, h http.HandlerFunc) {
		handler := withSecurityHeaders(withCORS(h))
		handler = withSessionAuth(s, requiresSession, minRole, handler)
		if requiresToken {
			handler = withAPITokenAuth(handler)
		}
		mux.HandleFunc(pattern, handler)
	}
	reg("/api/health", false, false, roleViewer, s.handleHealth)
	reg("/api/live", false, false, roleViewer, s.handleLive)
	reg("/api/ready", false, false, roleViewer, s.handleReady)
	reg("/api/auth/register", false, false, roleViewer, s.handleAuthRegister)
	reg("/api/auth/login", false, false, roleViewer, s.handleAuthLogin)
	reg("/api/auth/logout", false, true, roleViewer, s.handleAuthLogout)
	reg("/api/auth/me", false, true, roleViewer, s.handleAuthMe)
	reg("/api/auth/recover", false, false, roleViewer, s.handleAuthRecover)
	reg("/api/auth/reset-password", false, false, roleViewer, s.handleAuthResetPassword)
	reg("/api/auth/oauth/", false, false, roleViewer, s.handleOAuthRoutes)
	reg("/api/users/display-names", false, true, roleEditor, s.handleUserDisplayNames)
	reg("/api/users", false, true, roleAdmin, s.handleUsersCollection)
	reg("/api/users/", false, true, roleAdmin, s.handleUsersItem)
	reg("/api/audit-logs", false, true, roleAdmin, s.handleAuditLogs)
	reg("/api/tasks", true, false, roleViewer, s.handleTasksCollection)
	reg("/api/tasks/", true, false, roleViewer, s.handleTaskItem)
}

func (s *Server) handleOAuthRoutes(w http.ResponseWriter, r *http.Request) {
	if !isOAuthPath(r.URL.Path) || !validOAuthProvider(r.URL.Path) {
		http.NotFound(w, r)
		return
	}
	if strings.HasSuffix(r.URL.Path, "/start") {
		s.handleOAuthStart(w, r)
		return
	}
	s.handleOAuthCallback(w, r)
}

// retryMigrate retries fn until success, ctx cancelled, or maxDuration elapsed.
// Logs once at start; no progress spam.
// ensureMySQLParseTimeDSN appends parseTime=true when missing so DATETIME columns scan into time.Time.
func ensureMySQLParseTimeDSN(dsn string) string {
	dsn = strings.TrimSpace(dsn)
	if dsn == "" {
		return dsn
	}
	lower := strings.ToLower(dsn)
	if strings.Contains(lower, "parsetime=") {
		return dsn
	}
	if strings.Contains(dsn, "?") {
		return dsn + "&parseTime=true"
	}
	return dsn + "?parseTime=true"
}

func retryMigrate(ctx context.Context, delay time.Duration, maxDuration time.Duration, fn func() error) error {
	deadline := time.Now().Add(maxDuration)
	var lastErr error
	logged := false
	for {
		if err := fn(); err == nil {
			return nil
		} else {
			lastErr = err
		}
		if time.Now().After(deadline) {
			return lastErr
		}
		if !logged {
			logger.Info("⏳ waiting for database (up to %s)...", maxDuration.Round(time.Second))
			logged = true
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}
}

func InitDatabase(ctx context.Context, dataDir string, cfg *config.AppConfig) (*sql.DB, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}

	driver := "sqlite3"
	dsn := ""
	if cfg != nil {
		driver = cfg.DBDriver
		dsn = cfg.DBDsn
	}
	if driver == "" {
		driver = strings.TrimSpace(os.Getenv("DB_DRIVER"))
		if driver == "" {
			driver = "sqlite3"
		}
	}
	if dsn == "" {
		dsn = strings.TrimSpace(os.Getenv("DB_DSN"))
	}
	if driver == "sqlite3" && dsn == "" {
		dbPath := filepath.Join(dataDir, "tasks.db")
		dsn = dbPath
	}

	// MariaDB uses driver "mysql"; sql.Open expects that name for the protocol
	sqlDriver := driver
	if driver == "mariadb" {
		sqlDriver = "mysql"
		mysql.SetLogger(log.New(io.Discard, "", 0)) // suppress "unexpected EOF" spam during retries
		// Required for scanning DATETIME/TIMESTAMP into time.Time (sessions + users joins).
		// Without this, session resolution returns a scan error and every request can fail with invalid_session.
		dsn = ensureMySQLParseTimeDSN(dsn)
	}
	db, err := sql.Open(sqlDriver, dsn)
	if err != nil {
		return nil, err
	}

	// Connection pool settings for remote DBs
	if driver == "mariadb" || driver == "pgx" || driver == "postgres" {
		db.SetConnMaxLifetime(5 * time.Minute)
		db.SetMaxIdleConns(2)
		db.SetMaxOpenConns(10)
	}

	switch driver {
	case "sqlite3":
		if err := storage.Migrate(ctx, db); err != nil {
			_ = db.Close()
			return nil, err
		}
	case "pgx", "postgres":
		if err := retryMigrate(ctx, 2*time.Second, 5*time.Minute, func() error {
			return storage.MigratePostgres(ctx, db)
		}); err != nil {
			_ = db.Close()
			return nil, err
		}
		logger.Info("✅ database connected")
	case "mariadb":
		if err := retryMigrate(ctx, 2*time.Second, 5*time.Minute, func() error {
			return storage.MigrateMariaDB(ctx, db)
		}); err != nil {
			_ = db.Close()
			return nil, err
		}
		logger.Info("✅ database connected")
	default:
		_ = db.Close()
		return nil, fmt.Errorf("unsupported DB_DRIVER %q", driver)
	}

	if shouldSeedDemoDataWithConfig(cfg) {
		logger.Info("🌱 seeding SQL database (driver=%s)", driver)

		if err := seed.DemoTasksWithDriver(ctx, db, driver); err != nil {
			_ = db.Close()
			return nil, err
		}
		if err := seed.DemoUsersWithDriver(ctx, db, driver); err != nil {
			_ = db.Close()
			return nil, err
		}
	}
	return db, nil
}

func shouldSeedDemoDataWithConfig(cfg *config.AppConfig) bool {
	// Explicit override always wins
	if v := strings.ToLower(strings.TrimSpace(os.Getenv("SEED_DEMO_TASKS"))); v != "" {
		return v == "1" || v == "true" || v == "yes"
	}

	// Fall back to config (NOT env)
	if cfg != nil {
		return strings.EqualFold(strings.TrimSpace(cfg.Env), "development")
	}

	return false
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// handleLive returns 200 if the process is running (liveness probe).
func (s *Server) handleLive(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
}

// handleReady returns 200 if the app can serve traffic (e.g. DB reachable).
func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if s.dbPing != nil {
		if err := s.dbPing(ctx); err != nil {
			logger.Error("ready check: db ping failed: %v", err)
			writeError(w, http.StatusServiceUnavailable, "database unavailable")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) handleTasksCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.listTasks(w, r)
	case http.MethodPost:
		s.createTask(w, r)
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	}
}

func validStrongPassword(password string) bool {
	if len(password) < 10 {
		return false
	}
	hasUpper := false
	hasNumber := false
	hasSpecial := false
	for _, r := range password {
		if r >= 'A' && r <= 'Z' {
			hasUpper = true
			continue
		}
		if r >= '0' && r <= '9' {
			hasNumber = true
			continue
		}
		if strings.ContainsRune("!@#$%^&*()_+-=[]{}|;:',.<>/?`~\\\"", r) {
			hasSpecial = true
		}
	}
	return hasUpper && hasNumber && hasSpecial
}

func validEmail(email string) bool {
	_, err := mail.ParseAddress(email)
	return err == nil
}

func isValidUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

func (s *Server) handleTaskItem(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/tasks/")
	if id == "" {
		http.NotFound(w, r)
		return
	}
	if !isValidUUID(id) {
		writeErrorCode(w, http.StatusBadRequest, "invalid task id", "invalid_task_id")
		return
	}
	switch r.Method {
	case http.MethodGet:
		s.getTask(w, r, id)
	case http.MethodPatch:
		s.updateTaskStatus(w, r, id)
	case http.MethodPut:
		s.updateTask(w, r, id)
	case http.MethodDelete:
		s.deleteTask(w, r, id)
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	}
}

type createTaskRequest struct {
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
	Status      string   `json:"status"`
	Priority    string   `json:"priority,omitempty"`
	Owner       string   `json:"owner,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	DueAt       string   `json:"dueAt"`
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

type updateTaskRequest struct {
	Title       *string  `json:"title,omitempty"`
	Description *string  `json:"description,omitempty"`
	Status      *string  `json:"status,omitempty"`
	Priority    *string  `json:"priority,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	user := currentUserFromContext(r.Context())
	if user != nil && !hasRoleAtLeast(user, roleEditor) {
		writeErrorCode(w, http.StatusForbidden, "insufficient permissions", "insufficient_permissions")
		return
	}
	var req createTaskRequest
	if !requireJSONBody(w, r, &req) {
		return
	}
	dueAt, err := time.Parse(time.RFC3339, req.DueAt)
	if err != nil {
		writeErrorCode(w, http.StatusBadRequest, "dueAt must be RFC3339 timestamp", "invalid_due_at")
		return
	}
	now := time.Now().UTC()
	priority := task.Priority(strings.TrimSpace(req.Priority))
	if priority == "" {
		priority = task.PriorityNormal
	}
	input := task.NewTaskInput{
		Title:       req.Title,
		Description: req.Description,
		Status:      task.Status(req.Status),
		Priority:    priority,
		Owner:       strings.TrimSpace(req.Owner),
		Tags:        req.Tags,
		DueAt:       dueAt,
	}
	if user != nil && input.Owner == "" {
		input.Owner = strings.TrimSpace(user.Username)
	}
	if err := task.ValidateNewTask(now, input); err != nil {
		writeDomainError(w, err)
		return
	}
	created, err := s.store.CreateTask(r.Context(), input)
	if err != nil {
		logger.Error("CreateTask error: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to create task")
		return
	}
	actor := s.auditActorFromOwner(r.Context(), user, created.Owner)
	s.logAudit(r.Context(), actor, "create", "task", created.ID, nil, created, createdTaskFieldNames(created))
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) listTasks(w http.ResponseWriter, r *http.Request) {
	opts, err := parseListOptions(r)
	if err != nil {
		writeErrorCode(w, http.StatusBadRequest, err.Error(), "invalid_pagination")
		return
	}
	tasks, err := s.store.ListTasks(r.Context(), opts)
	if err != nil {
		logger.Error("ListTasks error: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	writeJSON(w, http.StatusOK, tasks)
}

func parseListOptions(r *http.Request) (storage.ListOptions, error) {
	limit := defaultListTasksLimit
	offset := 0
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	status := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	priority := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("priority")))
	owner := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("owner")))
	tag := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("tag")))
	sortBy := listSortDue
	order := listOrderAsc
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > maxListTasksLimit {
			return storage.ListOptions{}, fmt.Errorf("limit must be an integer between 1 and %d", maxListTasksLimit)
		}
		limit = n
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("offset")); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 0 {
			return storage.ListOptions{}, errors.New("offset must be a non-negative integer")
		}
		offset = n
	}
	if status != "" && status != "todo" && status != "in_progress" && status != "done" {
		return storage.ListOptions{}, errors.New("status must be one of: todo, in_progress, done")
	}
	if priority != "" && priority != "low" && priority != "normal" && priority != "high" && priority != "urgent" {
		return storage.ListOptions{}, errors.New("priority must be one of: low, normal, high, urgent")
	}
	if raw := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("sort"))); raw != "" {
		switch listSortKey(raw) {
		case listSortDue, listSortTitle, listSortPriority, listSortOwner, listSortStatus, listSortTags, listSortCreated:
			sortBy = listSortKey(raw)
		default:
			return storage.ListOptions{}, errors.New("sort must be one of: due, title, priority, owner, status, tags, created")
		}
	}
	if raw := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("order"))); raw != "" {
		switch listSortOrder(raw) {
		case listOrderAsc, listOrderDesc:
			order = listSortOrder(raw)
		default:
			return storage.ListOptions{}, errors.New("order must be one of: asc, desc")
		}
	}
	return storage.ListOptions{
		Limit:    limit,
		Offset:   offset,
		Q:        q,
		Status:   status,
		Priority: priority,
		Owner:    owner,
		Tag:      tag,
		Sort:     string(sortBy),
		Order:    string(order),
	}, nil
}

func (s *Server) getTask(w http.ResponseWriter, r *http.Request, id string) {
	t, err := s.store.GetTask(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err, "task not found", "failed to retrieve task", "GetTask")
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (s *Server) updateTaskStatus(w http.ResponseWriter, r *http.Request, id string) {
	user := currentUserFromContext(r.Context())
	if user != nil && !hasRoleAtLeast(user, roleEditor) {
		writeErrorCode(w, http.StatusForbidden, "insufficient permissions", "insufficient_permissions")
		return
	}
	var req updateStatusRequest
	if !requireJSONBody(w, r, &req) {
		return
	}
	current, err := s.store.GetTask(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err, "task not found", "failed to retrieve task", "GetTask")
		return
	}
	nextStatus := task.Status(req.Status)
	if err := task.ValidateStatusTransition(current.Status, nextStatus); err != nil {
		writeDomainError(w, err)
		return
	}
	updated, err := s.store.UpdateTaskStatus(r.Context(), id, nextStatus)
	if err != nil {
		writeStoreErr(w, err, "task not found", "failed to update task status", "UpdateTaskStatus")
		return
	}
	actor := s.auditActorFromOwner(r.Context(), user, current.Owner)
	changed := taskAuditDiff(current, updated)
	s.logAudit(r.Context(), actor, "edit", "task", id, current, updated, changed)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) updateTask(w http.ResponseWriter, r *http.Request, id string) {
	user := currentUserFromContext(r.Context())
	if user != nil && !hasRoleAtLeast(user, roleEditor) {
		writeErrorCode(w, http.StatusForbidden, "insufficient permissions", "insufficient_permissions")
		return
	}
	var req updateTaskRequest
	if !requireJSONBody(w, r, &req) {
		return
	}
	input := &task.UpdateTaskInput{}
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		input.Title = &t
	}
	if req.Description != nil {
		input.Description = req.Description
	}
	if req.Status != nil {
		s := task.Status(strings.TrimSpace(*req.Status))
		if s != "" {
			input.Status = &s
		}
	}
	if req.Priority != nil {
		p := task.Priority(strings.TrimSpace(*req.Priority))
		if p != "" {
			input.Priority = &p
		}
	}
	if req.Tags != nil {
		input.Tags = req.Tags
	}
	if input.Title == nil && input.Description == nil && input.Status == nil && input.Priority == nil && input.Tags == nil {
		writeErrorCode(w, http.StatusBadRequest, "at least one of title, description, status, priority, or tags must be provided", "missing_update_fields")
		return
	}
	if err := task.ValidateUpdateTask(input); err != nil {
		writeDomainError(w, err)
		return
	}
	before, err := s.store.GetTask(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err, "task not found", "failed to retrieve task", "GetTask")
		return
	}
	updated, err := s.store.UpdateTask(r.Context(), id, input)
	if err != nil {
		writeStoreErr(w, err, "task not found", "failed to update task", "UpdateTask")
		return
	}
	actor := s.auditActorFromOwner(r.Context(), user, before.Owner)
	changed := taskAuditDiff(before, updated)
	s.logAudit(r.Context(), actor, "edit", "task", id, before, updated, changed)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request, id string) {
	user := currentUserFromContext(r.Context())
	if user != nil && !hasRoleAtLeast(user, roleEditor) {
		writeErrorCode(w, http.StatusForbidden, "insufficient permissions", "insufficient_permissions")
		return
	}
	before, err := s.store.GetTask(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err, "task not found", "failed to retrieve task", "GetTask")
		return
	}
	if err := s.store.DeleteTask(r.Context(), id); err != nil {
		writeStoreErr(w, err, "task not found", "failed to delete task", "DeleteTask")
		return
	}
	actor := s.auditActorFromOwner(r.Context(), user, before.Owner)
	s.logAudit(r.Context(), actor, "delete", "task", id, before, nil, nil)
	w.WriteHeader(http.StatusNoContent)
}

const systemAuditActorID = "00000000-0000-0000-0000-000000000000"

func auditUserPublicSnapshot(u authUser) map[string]any {
	return map[string]any{
		"id":        u.ID,
		"email":     u.Email,
		"username":  u.Username,
		"firstName": u.FirstName,
		"lastName":  u.LastName,
		"role":      string(u.Role),
	}
}

func changedUserProfileFields(before, after authUser) []string {
	var out []string
	if before.Email != after.Email {
		out = append(out, "email")
	}
	if before.Username != after.Username {
		out = append(out, "username")
	}
	if before.FirstName != after.FirstName {
		out = append(out, "firstName")
	}
	if before.LastName != after.LastName {
		out = append(out, "lastName")
	}
	if before.Role != after.Role {
		out = append(out, "role")
	}
	return out
}

func (s *Server) logAudit(ctx context.Context, user *authUser, action, entityType, entityID string, before any, after any, changedFields []string) {
	if s.db == nil {
		return
	}
	actor := user
	if actor == nil {
		actor = &authUser{ID: systemAuditActorID, Username: "system"}
	}
	beforeJSON := ""
	afterJSON := ""
	if before != nil {
		if b, err := json.Marshal(before); err == nil {
			beforeJSON = string(b)
		}
	}
	if after != nil {
		if b, err := json.Marshal(after); err == nil {
			afterJSON = string(b)
		}
	}
	rawObj := map[string]any{
		"action":        action,
		"entityType":    entityType,
		"entityId":      entityID,
		"changedFields": changedFields,
		"before":        jsonRawForAudit(beforeJSON),
		"after":         jsonRawForAudit(afterJSON),
	}
	rawJSON := "{}"
	if b, err := json.Marshal(rawObj); err == nil {
		rawJSON = string(b)
	}
	changedRaw := "[]"
	if b, err := json.Marshal(changedFields); err == nil {
		changedRaw = string(b)
	}
	if _, err := s.execDB(
		ctx,
		`INSERT INTO audit_logs (id, user_id, username, action, entity_type, entity_id, changed_fields, before_json, after_json, raw_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.New().String(),
		actor.ID,
		actor.Username,
		action,
		entityType,
		entityID,
		changedRaw,
		nullIfEmpty(beforeJSON),
		nullIfEmpty(afterJSON),
		rawJSON,
		time.Now().UTC(),
	); err != nil {
		logger.Error("audit log insert failed: %v", err)
	}
}

func nullIfEmpty(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func (s *Server) handleAuditLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	userID := strings.TrimSpace(r.URL.Query().Get("userId"))
	query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	fieldFilter := strings.TrimSpace(r.URL.Query().Get("field"))
	if fieldFilter != "" && !validAuditFieldToken(fieldFilter) {
		writeErrorCode(w, http.StatusBadRequest, "invalid field filter", "invalid_audit_field")
		return
	}
	sortBy := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("sort")))
	sortCol := "created_at"
	switch sortBy {
	case "username":
		sortCol = "username"
	case "action":
		sortCol = "action"
	case "changed_fields":
		sortCol = "changed_fields"
	case "created_at":
		sortCol = "created_at"
	default:
		sortCol = "created_at"
	}
	order := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("order")))
	if order != "ASC" {
		order = "DESC"
	}
	limit := 200
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 500 {
			limit = v
		}
	}
	where := " WHERE 1=1 "
	args := make([]any, 0, 8)
	if userID != "" {
		where += " AND user_id = ? "
		args = append(args, userID)
	}
	if fieldFilter != "" {
		where += " AND changed_fields LIKE ? "
		args = append(args, "%\""+fieldFilter+"\"%")
	}
	if query != "" {
		where += " AND (LOWER(username) LIKE ? OR LOWER(action) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(raw_json) LIKE ? OR LOWER(COALESCE(changed_fields, '')) LIKE ?) "
		pat := "%" + query + "%"
		args = append(args, pat, pat, pat, pat, pat)
	}
	sqlQ := `SELECT id, user_id, username, action, entity_type, entity_id, changed_fields, COALESCE(before_json, ''), COALESCE(after_json, ''), raw_json, created_at FROM audit_logs` + where + ` ORDER BY ` + sortCol + ` ` + order + ` LIMIT ?`
	args = append(args, limit)
	rows, err := s.queryDB(r.Context(), sqlQ, args...)
	if err != nil {
		writeErrorCode(w, http.StatusInternalServerError, "failed to list audit logs", "internal_error")
		return
	}
	defer rows.Close()
	out := make([]auditLogRecord, 0, limit)
	for rows.Next() {
		var rec auditLogRecord
		var changedRaw string
		if err := rows.Scan(&rec.ID, &rec.UserID, &rec.Username, &rec.Action, &rec.EntityType, &rec.EntityID, &changedRaw, &rec.BeforeJSON, &rec.AfterJSON, &rec.RawJSON, &rec.CreatedAt); err != nil {
			writeErrorCode(w, http.StatusInternalServerError, "failed to list audit logs", "internal_error")
			return
		}
		_ = json.Unmarshal([]byte(changedRaw), &rec.ChangedFields)
		out = append(out, rec)
	}
	writeJSON(w, http.StatusOK, out)
}

// handleUserDisplayNames returns usernames for task owner assignment (editors and above).
func (s *Server) handleUserDisplayNames(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	if err := s.ensureAuthSchema(r.Context()); err != nil {
		writeErrorCode(w, http.StatusServiceUnavailable, "authentication is unavailable", "auth_unavailable")
		return
	}
	rows, err := s.queryDB(r.Context(), `SELECT username FROM users ORDER BY LOWER(username)`)
	if err != nil {
		writeErrorCode(w, http.StatusInternalServerError, "failed to list display names", "internal_error")
		return
	}
	defer rows.Close()
	names := make([]string, 0, 32)
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			writeErrorCode(w, http.StatusInternalServerError, "failed to list display names", "internal_error")
			return
		}
		u = strings.TrimSpace(u)
		if u != "" {
			names = append(names, u)
		}
	}
	writeJSON(w, http.StatusOK, map[string][]string{"displayNames": names})
}

func (s *Server) handleAuthRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	if err := s.ensureAuthSchema(r.Context()); err != nil {
		writeErrorCode(w, http.StatusServiceUnavailable, "authentication is unavailable", "auth_unavailable")
		return
	}
	var req authRequest
	if !requireJSONBody(w, r, &req) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	username := strings.TrimSpace(req.Username)
	firstName := strings.TrimSpace(req.FirstName)
	lastName := strings.TrimSpace(req.LastName)
	password := strings.TrimSpace(req.Password)
	if email == "" {
		writeErrorCode(w, http.StatusBadRequest, "email is required", "email_required")
		return
	}
	if !validEmail(email) {
		writeErrorCode(w, http.StatusBadRequest, "email format is invalid", "invalid_email")
		return
	}
	if username == "" {
		writeErrorCode(w, http.StatusBadRequest, "display name is required", "username_required")
		return
	}
	if firstName == "" {
		writeErrorCode(w, http.StatusBadRequest, "first name is required", "first_name_required")
		return
	}
	if lastName == "" {
		writeErrorCode(w, http.StatusBadRequest, "last name is required", "last_name_required")
		return
	}
	if password == "" {
		writeErrorCode(w, http.StatusBadRequest, "password is required", "password_required")
		return
	}
	if len(password) < 10 {
		writeErrorCode(w, http.StatusBadRequest, "password must be at least 10 characters", "password_too_short")
		return
	}
	if !validStrongPassword(password) {
		writeErrorCode(w, http.StatusBadRequest, "password must include one uppercase letter, one number, and one special character", "password_weak")
		return
	}
	hash, err := hashPassword(password)
	if err != nil {
		writeErrorCode(w, http.StatusInternalServerError, "failed to create account", "internal_error")
		return
	}
	now := time.Now().UTC()
	id := uuid.New().String()
	_, err = s.execDB(r.Context(), `INSERT INTO users (id, email, username, first_name, last_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'viewer', ?, ?)`, id, email, username, firstName, lastName, hash, now, now)
	if err != nil {
		writeErrorCode(w, http.StatusConflict, "user already exists", "user_exists")
		return
	}
	created := authUser{ID: id, Email: email, Username: username, FirstName: firstName, LastName: lastName, Role: roleViewer, CreatedAt: now, UpdatedAt: now}
	s.logAudit(r.Context(), &created, "register", "user", id, nil, auditUserPublicSnapshot(created), []string{"email", "username", "firstName", "lastName", "role"})
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	if err := s.ensureAuthSchema(r.Context()); err != nil {
		writeErrorCode(w, http.StatusServiceUnavailable, "authentication is unavailable", "auth_unavailable")
		return
	}
	var req authRequest
	if !requireJSONBody(w, r, &req) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	password := strings.TrimSpace(req.Password)
	if email == "" {
		writeErrorCode(w, http.StatusBadRequest, "email is required", "email_required")
		return
	}
	if !validEmail(email) {
		writeErrorCode(w, http.StatusBadRequest, "email format is invalid", "invalid_email")
		return
	}
	if password == "" {
		writeErrorCode(w, http.StatusBadRequest, "password is required", "password_required")
		return
	}
	var u authUser
	var hash, role string
	row := s.queryRowDB(r.Context(), `SELECT id, email, username, first_name, last_name, role, created_at, updated_at, password_hash FROM users WHERE email = ?`, email)
	if err := row.Scan(&u.ID, &u.Email, &u.Username, &u.FirstName, &u.LastName, &role, &u.CreatedAt, &u.UpdatedAt, &hash); err != nil {
		s.logAudit(r.Context(), nil, "login_failed", "auth", email, nil, map[string]string{"reason": "unknown_user"}, nil)
		writeErrorCode(w, http.StatusUnauthorized, "invalid credentials", "invalid_credentials")
		return
	}
	if !verifyPassword(password, hash) && !verifySeedPasswordAlias(email, password, hash) {
		s.logAudit(r.Context(), nil, "login_failed", "auth", email, nil, map[string]string{"reason": "bad_password"}, nil)
		writeErrorCode(w, http.StatusUnauthorized, "invalid credentials", "invalid_credentials")
		return
	}
	u.Role = parseUserRole(role)
	if err := s.issueSessionCookie(r.Context(), w, u.ID); err != nil {
		writeErrorCode(w, http.StatusInternalServerError, "failed to create session", "internal_error")
		return
	}
	s.logAudit(r.Context(), &u, "login", "user", u.ID, nil, nil, []string{"session"})
	writeJSON(w, http.StatusOK, u)
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	if u := currentUserFromContext(r.Context()); u != nil {
		s.logAudit(r.Context(), u, "logout", "user", u.ID, nil, nil, []string{"session"})
	}
	cookie, err := r.Cookie(sessionCookieName)
	if err == nil && s.db != nil {
		_, _ = s.execDB(r.Context(), `DELETE FROM sessions WHERE token_hash = ?`, hashToken(cookie.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookieName, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	user := currentUserFromContext(r.Context())
	if user == nil {
		writeErrorCode(w, http.StatusUnauthorized, "authentication required", "authentication_required")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleAuthRecover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	if err := s.ensureAuthSchema(r.Context()); err != nil {
		writeErrorCode(w, http.StatusServiceUnavailable, "authentication is unavailable", "auth_unavailable")
		return
	}
	var req recoverRequest
	if !requireJSONBody(w, r, &req) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		writeErrorCode(w, http.StatusBadRequest, "email is required", "email_required")
		return
	}
	if !validEmail(email) {
		writeErrorCode(w, http.StatusBadRequest, "email format is invalid", "invalid_email")
		return
	}
	var userID string
	if err := s.queryRowDB(r.Context(), `SELECT id FROM users WHERE email = ?`, email).Scan(&userID); err == nil && strings.TrimSpace(userID) != "" {
		rawToken, tokenErr := makeSessionToken()
		if tokenErr == nil {
			now := time.Now().UTC()
			expiresAt := now.Add(30 * time.Minute)
			_, insErr := s.execDB(r.Context(), `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
				uuid.New().String(), userID, hashToken(rawToken), expiresAt, now)
			if insErr == nil {
				var uname string
				_ = s.queryRowDB(r.Context(), `SELECT username FROM users WHERE id = ?`, userID).Scan(&uname)
				s.logAudit(r.Context(), &authUser{ID: userID, Username: strings.TrimSpace(uname)}, "password_reset_request", "user", userID, nil, nil, nil)
			}
			if strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "development") {
				resetURL := oauthFrontendRedirectURL("password_reset_link_sent")
				if u, err := url.Parse(resetURL); err == nil {
					q := u.Query()
					q.Set("resetToken", rawToken)
					u.RawQuery = q.Encode()
					resetURL = u.String()
				}
				writeJSON(w, http.StatusAccepted, map[string]string{
					"status":   "accepted",
					"token":    rawToken,
					"resetUrl": resetURL,
				})
				return
			}
		}
	}
	// Return accepted regardless to avoid account enumeration.
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}

func (s *Server) handleAuthResetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	if err := s.ensureAuthSchema(r.Context()); err != nil {
		writeErrorCode(w, http.StatusServiceUnavailable, "authentication is unavailable", "auth_unavailable")
		return
	}
	var req resetPasswordRequest
	if !requireJSONBody(w, r, &req) {
		return
	}
	token := strings.TrimSpace(req.Token)
	newPassword := strings.TrimSpace(req.NewPassword)
	if token == "" {
		writeErrorCode(w, http.StatusBadRequest, "reset token is required", "reset_token_required")
		return
	}
	if newPassword == "" {
		writeErrorCode(w, http.StatusBadRequest, "new password is required", "new_password_required")
		return
	}
	if len(newPassword) < 10 {
		writeErrorCode(w, http.StatusBadRequest, "new password must be at least 10 characters", "new_password_too_short")
		return
	}
	if !validStrongPassword(newPassword) {
		writeErrorCode(w, http.StatusBadRequest, "new password must include one uppercase letter, one number, and one special character", "new_password_weak")
		return
	}
	var resetID, userID string
	row := s.queryRowDB(r.Context(), `SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`, hashToken(token), time.Now().UTC())
	if err := row.Scan(&resetID, &userID); err != nil {
		writeErrorCode(w, http.StatusBadRequest, "invalid or expired reset token", "invalid_reset_token")
		return
	}
	hash, err := hashPassword(newPassword)
	if err != nil {
		writeErrorCode(w, http.StatusInternalServerError, "failed to reset password", "internal_error")
		return
	}
	now := time.Now().UTC()
	_, err = s.execDB(r.Context(), `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, hash, now, userID)
	if err != nil {
		writeErrorCode(w, http.StatusInternalServerError, "failed to reset password", "internal_error")
		return
	}
	_, _ = s.execDB(r.Context(), `UPDATE password_resets SET used_at = ? WHERE id = ?`, now, resetID)
	_, _ = s.execDB(r.Context(), `DELETE FROM sessions WHERE user_id = ?`, userID)
	var ua authUser
	var rrole string
	if err := s.queryRowDB(r.Context(), `SELECT id, email, username, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ?`, userID).Scan(&ua.ID, &ua.Email, &ua.Username, &ua.FirstName, &ua.LastName, &rrole, &ua.CreatedAt, &ua.UpdatedAt); err == nil {
		ua.Role = parseUserRole(rrole)
		s.logAudit(r.Context(), &ua, "password_reset_complete", "user", userID, nil, nil, []string{"password"})
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "password_reset"})
}

// handleAdminUserPasswordReset issues a password reset token for another user (admin-only route).
func (s *Server) handleAdminUserPasswordReset(w http.ResponseWriter, r *http.Request, targetUserID string) {
	var exists int
	err := s.queryRowDB(r.Context(), `SELECT 1 FROM users WHERE id = ?`, targetUserID).Scan(&exists)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeErrorCode(w, http.StatusNotFound, "user not found", "user_not_found")
			return
		}
		writeErrorCode(w, http.StatusInternalServerError, "failed to look up user", "internal_error")
		return
	}
	rawToken, tokenErr := makeSessionToken()
	if tokenErr != nil {
		writeErrorCode(w, http.StatusInternalServerError, "failed to create reset token", "internal_error")
		return
	}
	now := time.Now().UTC()
	expiresAt := now.Add(30 * time.Minute)
	_, err = s.execDB(r.Context(), `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
		uuid.New().String(), targetUserID, hashToken(rawToken), expiresAt, now)
	if err != nil {
		writeErrorCode(w, http.StatusInternalServerError, "failed to store reset token", "internal_error")
		return
	}
	if admin := currentUserFromContext(r.Context()); admin != nil {
		s.logAudit(r.Context(), admin, "admin_password_reset_request", "user", targetUserID, nil, nil, nil)
	}
	msg := "A password reset link has been sent. The user should check their email inbox and follow the link to choose a new password."
	if strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "development") {
		resetURL := oauthFrontendRedirectURL("password_reset_link_sent")
		if u, perr := url.Parse(resetURL); perr == nil {
			q := u.Query()
			q.Set("resetToken", rawToken)
			u.RawQuery = q.Encode()
			resetURL = u.String()
		}
		writeJSON(w, http.StatusAccepted, map[string]string{
			"status":   "accepted",
			"message":  msg + " (Development: reset URL included for testing.)",
			"resetUrl": resetURL,
			"token":    rawToken,
		})
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "accepted", "message": msg})
}

func (s *Server) handleUsersCollection(w http.ResponseWriter, r *http.Request) {
	if err := s.ensureAuthSchema(r.Context()); err != nil {
		writeErrorCode(w, http.StatusServiceUnavailable, "authentication is unavailable", "auth_unavailable")
		return
	}
	switch r.Method {
	case http.MethodGet:
		q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
		roleFilter := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("role")))
		if roleFilter != "" && roleFilter != "viewer" && roleFilter != "editor" && roleFilter != "admin" {
			writeErrorCode(w, http.StatusBadRequest, "role filter must be viewer, editor, or admin", "invalid_user_role_filter")
			return
		}
		sortBy := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("sort")))
		sortCol := "created_at"
		switch sortBy {
		case "updated_at":
			sortCol = "updated_at"
		case "email":
			sortCol = "email"
		case "username", "display_name":
			sortCol = "username"
		case "first_name":
			sortCol = "first_name"
		case "last_name":
			sortCol = "last_name"
		case "role":
			sortCol = "role"
		case "created_at", "":
			sortCol = "created_at"
		default:
			writeErrorCode(w, http.StatusBadRequest, "invalid sort field", "invalid_user_sort")
			return
		}
		order := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("order")))
		if order != "ASC" {
			order = "DESC"
		}
		limit := 50
		if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
			if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 200 {
				limit = v
			} else {
				writeErrorCode(w, http.StatusBadRequest, "limit must be between 1 and 200", "invalid_pagination")
				return
			}
		}
		offset := 0
		if raw := strings.TrimSpace(r.URL.Query().Get("offset")); raw != "" {
			if v, err := strconv.Atoi(raw); err == nil && v >= 0 {
				offset = v
			} else {
				writeErrorCode(w, http.StatusBadRequest, "offset must be a non-negative integer", "invalid_pagination")
				return
			}
		}
		where := " WHERE 1=1 "
		args := make([]any, 0, 8)
		if q != "" {
			pat := "%" + q + "%"
			where += ` AND (LOWER(email) LIKE ? OR LOWER(username) LIKE ? OR LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ?) `
			args = append(args, pat, pat, pat, pat)
		}
		if roleFilter != "" {
			where += ` AND role = ? `
			args = append(args, roleFilter)
		}
		countQ := `SELECT COUNT(*) FROM users` + where
		var total int
		if err := s.queryRowDB(r.Context(), countQ, args...).Scan(&total); err != nil {
			writeErrorCode(w, http.StatusInternalServerError, "failed to list users", "internal_error")
			return
		}
		dataQ := `SELECT id, email, username, first_name, last_name, role, created_at, updated_at FROM users` + where +
			` ORDER BY ` + sortCol + ` ` + order + ` LIMIT ? OFFSET ?`
		args = append(args, limit, offset)
		rows, err := s.queryDB(r.Context(), dataQ, args...)
		if err != nil {
			writeErrorCode(w, http.StatusInternalServerError, "failed to list users", "internal_error")
			return
		}
		defer rows.Close()
		users := make([]authUser, 0, limit)
		for rows.Next() {
			var u authUser
			var role string
			if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.FirstName, &u.LastName, &role, &u.CreatedAt, &u.UpdatedAt); err != nil {
				writeErrorCode(w, http.StatusInternalServerError, "failed to list users", "internal_error")
				return
			}
			u.Role = parseUserRole(role)
			users = append(users, u)
		}
		writeJSON(w, http.StatusOK, listUsersResponse{Users: users, Total: total})
	case http.MethodPost:
		writeErrorCode(w, http.StatusForbidden, "creating users from the admin API is disabled", "user_creation_disabled")
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleUsersItem(w http.ResponseWriter, r *http.Request) {
	if err := s.ensureAuthSchema(r.Context()); err != nil {
		writeErrorCode(w, http.StatusServiceUnavailable, "authentication is unavailable", "auth_unavailable")
		return
	}
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/users/"), "/")
	if rest == "" {
		http.NotFound(w, r)
		return
	}
	parts := strings.Split(rest, "/")
	id := parts[0]
	if !isValidUUID(id) {
		writeErrorCode(w, http.StatusBadRequest, "invalid user id", "invalid_user_id")
		return
	}
	if len(parts) == 2 && parts[1] == "request-password-reset" {
		if r.Method != http.MethodPost {
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}
		s.handleAdminUserPasswordReset(w, r, id)
		return
	}
	if len(parts) != 1 {
		http.NotFound(w, r)
		return
	}
	switch r.Method {
	case http.MethodPut:
		var req adminUserUpsertRequest
		if !requireJSONBody(w, r, &req) {
			return
		}
		firstName := strings.TrimSpace(req.FirstName)
		lastName := strings.TrimSpace(req.LastName)
		email := strings.ToLower(strings.TrimSpace(req.Email))
		username := strings.TrimSpace(req.Username)
		if email == "" || !validEmail(email) {
			writeErrorCode(w, http.StatusBadRequest, "email format is invalid", "invalid_email")
			return
		}
		if username == "" {
			writeErrorCode(w, http.StatusBadRequest, "display name is required", "username_required")
			return
		}
		if firstName == "" {
			writeErrorCode(w, http.StatusBadRequest, "first name is required", "first_name_required")
			return
		}
		if lastName == "" {
			writeErrorCode(w, http.StatusBadRequest, "last name is required", "last_name_required")
			return
		}
		role := parseUserRole(req.Role)
		var before authUser
		var bRole string
		if err := s.queryRowDB(r.Context(), `SELECT id, email, username, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ?`, id).Scan(
			&before.ID, &before.Email, &before.Username, &before.FirstName, &before.LastName, &bRole, &before.CreatedAt, &before.UpdatedAt); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeErrorCode(w, http.StatusNotFound, "user not found", "user_not_found")
				return
			}
			writeErrorCode(w, http.StatusInternalServerError, "failed to look up user", "internal_error")
			return
		}
		before.Role = parseUserRole(bRole)
		now := time.Now().UTC()
		res, err := s.execDB(r.Context(), `UPDATE users SET email = ?, username = ?, first_name = ?, last_name = ?, role = ?, updated_at = ? WHERE id = ?`,
			email, username, firstName, lastName, string(role), now, id)
		if err != nil {
			writeErrorCode(w, http.StatusInternalServerError, "failed to update user", "internal_error")
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeErrorCode(w, http.StatusNotFound, "user not found", "user_not_found")
			return
		}
		after := authUser{ID: id, Email: email, Username: username, FirstName: firstName, LastName: lastName, Role: role, CreatedAt: before.CreatedAt, UpdatedAt: now}
		if admin := currentUserFromContext(r.Context()); admin != nil {
			s.logAudit(r.Context(), admin, "edit", "user", id, before, after, changedUserProfileFields(before, after))
		}
		writeJSON(w, http.StatusOK, after)
	case http.MethodDelete:
		var beforeDel authUser
		var dRole string
		if err := s.queryRowDB(r.Context(), `SELECT id, email, username, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ?`, id).Scan(
			&beforeDel.ID, &beforeDel.Email, &beforeDel.Username, &beforeDel.FirstName, &beforeDel.LastName, &dRole, &beforeDel.CreatedAt, &beforeDel.UpdatedAt); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeErrorCode(w, http.StatusNotFound, "user not found", "user_not_found")
				return
			}
			writeErrorCode(w, http.StatusInternalServerError, "failed to look up user", "internal_error")
			return
		}
		beforeDel.Role = parseUserRole(dRole)
		var admins int
		if err := s.queryRowDB(r.Context(), `SELECT COUNT(*) FROM users WHERE role = 'admin'`).Scan(&admins); err == nil && admins <= 1 {
			if beforeDel.Role == roleAdmin {
				writeErrorCode(w, http.StatusConflict, "cannot delete the last admin", "last_admin_delete_forbidden")
				return
			}
		}
		res, err := s.execDB(r.Context(), `DELETE FROM users WHERE id = ?`, id)
		if err != nil {
			writeErrorCode(w, http.StatusInternalServerError, "failed to delete user", "internal_error")
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeErrorCode(w, http.StatusNotFound, "user not found", "user_not_found")
			return
		}
		if admin := currentUserFromContext(r.Context()); admin != nil {
			s.logAudit(r.Context(), admin, "delete", "user", id, beforeDel, nil, nil)
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	}
}

type errorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func defaultErrorCodeForStatus(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "bad_request"
	case http.StatusUnauthorized:
		return "unauthorized"
	case http.StatusForbidden:
		return "forbidden"
	case http.StatusNotFound:
		return "not_found"
	case http.StatusConflict:
		return "conflict"
	case http.StatusUnsupportedMediaType:
		return "unsupported_media_type"
	case http.StatusRequestEntityTooLarge:
		return "request_too_large"
	case http.StatusServiceUnavailable:
		return "service_unavailable"
	case http.StatusInternalServerError:
		return "internal_error"
	default:
		return "error"
	}
}

func writeErrorCode(w http.ResponseWriter, status int, msg, code string) {
	if strings.TrimSpace(code) == "" {
		code = defaultErrorCodeForStatus(status)
	}
	writeJSON(w, status, errorResponse{Error: msg, Code: code})
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeErrorCode(w, status, msg, "")
}

func writeStoreErr(w http.ResponseWriter, err error, notFoundMsg, serverMsg, logPrefix string) {
	if errors.Is(err, storage.ErrNotFound) {
		writeErrorCode(w, http.StatusNotFound, notFoundMsg, "task_not_found")
		return
	}
	if errors.Is(err, storage.ErrConflict) {
		writeErrorCode(w, http.StatusConflict, "task was modified concurrently; reload and retry", "task_conflict")
		return
	}
	logger.Error("%s error: %v", logPrefix, err)
	writeErrorCode(w, http.StatusInternalServerError, serverMsg, "internal_error")
}

func writeDomainError(w http.ResponseWriter, err error) {
	switch err {
	case task.ErrTitleRequired, task.ErrStatusRequired, task.ErrStatusInvalid,
		task.ErrDueAtZero, task.ErrDueAtInPast, task.ErrStatusEmpty,
		task.ErrStatusNoChange, task.ErrUnknownStatus,
		task.ErrPriorityInvalid, task.ErrOwnerTooLong, task.ErrTagTooLong, task.ErrTooManyTags:
		writeErrorCode(w, http.StatusBadRequest, err.Error(), "validation_error")
	default:
		writeErrorCode(w, http.StatusInternalServerError, "validation failed", "validation_failed")
	}
}

// requireJSONBody reads a bounded JSON body with strict decoding (unknown fields rejected).
// It writes an error response and returns false on failure.
func requireJSONBody(w http.ResponseWriter, r *http.Request, dst any) bool {
	ct := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Type")))
	if ct == "" || !strings.Contains(ct, "application/json") {
		writeErrorCode(w, http.StatusUnsupportedMediaType, "Content-Type must be application/json", "unsupported_media_type")
		return false
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, maxJSONRequestBytes+1))
	_ = r.Body.Close()
	if err != nil {
		writeErrorCode(w, http.StatusBadRequest, "invalid request body", "invalid_request_body")
		return false
	}
	if len(body) > maxJSONRequestBytes {
		writeErrorCode(w, http.StatusRequestEntityTooLarge, "request body too large", "request_too_large")
		return false
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeErrorCode(w, http.StatusBadRequest, "invalid JSON payload", "invalid_json_payload")
		return false
	}
	if dec.More() {
		writeErrorCode(w, http.StatusBadRequest, "invalid JSON payload", "invalid_json_payload")
		return false
	}
	return true
}

func withSecurityHeaders(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()")
		w.Header().Set("Cache-Control", "no-store")
		next(w, r)
	}
}

// corsOriginAllowed returns whether the request Origin may receive CORS credentials/headers.
// If CORS_ALLOWED_ORIGINS is set (comma-separated exact origins), only those are allowed;
// otherwise local dev and mobile defaults apply.
func corsOriginAllowed(origin string) bool {
	if origin == "" {
		return false
	}
	if list := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")); list != "" {
		for _, part := range strings.Split(list, ",") {
			if strings.TrimSpace(part) == origin {
				return true
			}
		}
		return false
	}
	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if env != "" && env != "development" {
		// Fail closed outside development unless an explicit allowlist is configured.
		return false
	}
	// Dev + Capacitor + Android emulator defaults (include 127.0.0.1 for Vite preview / e2e).
	// "null" is denied by default and can be enabled explicitly for constrained runtimes.
	allowNullOrigin := strings.EqualFold(strings.TrimSpace(os.Getenv("CORS_ALLOW_NULL_ORIGIN")), "1") ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("CORS_ALLOW_NULL_ORIGIN")), "true") ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("CORS_ALLOW_NULL_ORIGIN")), "yes")
	return origin == "http://localhost:5173" ||
		(allowNullOrigin && origin == "null") ||
		strings.HasPrefix(origin, "capacitor://") ||
		strings.HasPrefix(origin, "https://localhost") ||
		strings.HasPrefix(origin, "http://10.0.2.2") ||
		strings.HasPrefix(origin, "http://localhost") ||
		strings.HasPrefix(origin, "http://127.0.0.1") ||
		strings.HasPrefix(origin, "http://[::1]")
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if corsOriginAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS")
		// Task endpoints may require bearer auth; preflight must allow Authorization.
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Audience, X-API-Issuer")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func withAPITokenAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
		requireAuth := env != "" && env != "development"
		if raw := strings.TrimSpace(os.Getenv("API_AUTH_REQUIRED")); raw != "" {
			v := strings.ToLower(raw)
			requireAuth = v == "1" || v == "true" || v == "yes"
		}
		if !requireAuth {
			next(w, r)
			return
		}

		presented, ok := extractBearerToken(r)
		if !ok {
			logger.Error("auth failed: missing bearer token method=%s path=%s", r.Method, r.URL.Path)
			writeErrorCode(w, http.StatusUnauthorized, "missing bearer token", "missing_bearer_token")
			return
		}

		mode := strings.ToLower(strings.TrimSpace(os.Getenv("API_AUTH_MODE")))
		if mode == "" {
			mode = "token"
		}
		switch mode {
		case "oidc":
			claims, err := validateOIDCToken(r.Context(), presented)
			if err != nil {
				logger.Error("auth failed: oidc validation error method=%s path=%s err=%v", r.Method, r.URL.Path, err)
				if errors.Is(err, errAuthMisconfigured) {
					writeErrorCode(w, http.StatusServiceUnavailable, "authentication is required but OIDC auth is misconfigured", "auth_misconfigured")
					return
				}
				writeErrorCode(w, http.StatusUnauthorized, "invalid bearer token", "invalid_bearer_token")
				return
			}
			if err := enforceRequiredClaims(claims, r); err != nil {
				logger.Error("auth failed: missing required claims method=%s path=%s err=%v", r.Method, r.URL.Path, err)
				writeErrorCode(w, http.StatusForbidden, "insufficient token permissions", "insufficient_permissions")
				return
			}
		case "jwt":
			claims, err := validateJWT(presented, env)
			if err != nil {
				logger.Error("auth failed: jwt validation error method=%s path=%s err=%v", r.Method, r.URL.Path, err)
				if errors.Is(err, errAuthMisconfigured) {
					writeErrorCode(w, http.StatusServiceUnavailable, "authentication is required but JWT auth is misconfigured", "auth_misconfigured")
					return
				}
				writeErrorCode(w, http.StatusUnauthorized, "invalid bearer token", "invalid_bearer_token")
				return
			}
			if err := enforceRequiredClaims(claims, r); err != nil {
				logger.Error("auth failed: missing required claims method=%s path=%s err=%v", r.Method, r.URL.Path, err)
				writeErrorCode(w, http.StatusForbidden, "insufficient token permissions", "insufficient_permissions")
				return
			}
		case "token":
			tokens := loadAPITokensFromEnv()
			if len(tokens) == 0 {
				writeErrorCode(w, http.StatusServiceUnavailable, "authentication is required but API_AUTH_TOKEN/API_AUTH_TOKENS is not configured", "auth_misconfigured")
				return
			}
			if env == "production" || env == "staging" {
				for _, token := range tokens {
					// Basic guardrail against weak shared secrets in production-like environments.
					if len(token) < 32 {
						writeErrorCode(w, http.StatusServiceUnavailable, "configured API auth token is too short; use at least 32 characters", "auth_misconfigured")
						return
					}
				}
			}
			if len(tokens) > 20 {
				writeErrorCode(w, http.StatusServiceUnavailable, "too many configured API auth tokens", "auth_misconfigured")
				return
			}
			if !tokenMatches(presented, tokens) {
				logger.Error("auth failed: invalid bearer token method=%s path=%s", r.Method, r.URL.Path)
				writeErrorCode(w, http.StatusUnauthorized, "invalid bearer token", "invalid_bearer_token")
				return
			}
			if expectedAud := strings.TrimSpace(os.Getenv("API_AUTH_ALLOWED_AUDIENCE")); expectedAud != "" {
				gotAud := strings.TrimSpace(r.Header.Get("X-API-Audience"))
				if gotAud == "" || gotAud != expectedAud {
					logger.Error("auth failed: invalid audience method=%s path=%s", r.Method, r.URL.Path)
					writeErrorCode(w, http.StatusUnauthorized, "invalid token audience", "invalid_token_audience")
					return
				}
			}
			if allowedIssuers := parseCSVEnv("API_AUTH_ALLOWED_ISSUERS"); len(allowedIssuers) > 0 {
				gotIssuer := strings.TrimSpace(r.Header.Get("X-API-Issuer"))
				if gotIssuer == "" || !containsString(allowedIssuers, gotIssuer) {
					logger.Error("auth failed: invalid issuer method=%s path=%s", r.Method, r.URL.Path)
					writeErrorCode(w, http.StatusUnauthorized, "invalid token issuer", "invalid_token_issuer")
					return
				}
			}
		default:
			writeErrorCode(w, http.StatusServiceUnavailable, "authentication mode is invalid", "invalid_auth_mode")
			return
		}
		next(w, r)
	}
}

var errAuthMisconfigured = errors.New("auth misconfigured")

func extractBearerToken(r *http.Request) (string, bool) {
	const prefix = "Bearer "
	got := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(got, prefix) {
		return "", false
	}
	presented := strings.TrimSpace(strings.TrimPrefix(got, prefix))
	if presented == "" {
		return "", false
	}
	return presented, true
}

type jwtClaims struct {
	jwt.RegisteredClaims
	Scope string   `json:"scope,omitempty"`
	Scp   []string `json:"scp,omitempty"`
	Roles []string `json:"roles,omitempty"`
}

func validateJWT(rawToken, env string) (*authClaims, error) {
	secret := strings.TrimSpace(os.Getenv("JWT_HS256_SECRET"))
	if secret == "" {
		return nil, errAuthMisconfigured
	}
	if (env == "production" || env == "staging") && len(secret) < 32 {
		return nil, errAuthMisconfigured
	}
	claims := &jwtClaims{}
	token, err := jwt.ParseWithClaims(rawToken, claims, func(token *jwt.Token) (any, error) {
		if token.Method == nil || token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing algorithm")
		}
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || token == nil || !token.Valid {
		return nil, fmt.Errorf("invalid jwt")
	}
	if expectedAud := strings.TrimSpace(os.Getenv("API_AUTH_ALLOWED_AUDIENCE")); expectedAud != "" {
		if !containsString([]string(claims.RegisteredClaims.Audience), expectedAud) {
			return nil, fmt.Errorf("invalid audience")
		}
	}
	if allowedIssuers := parseCSVEnv("API_AUTH_ALLOWED_ISSUERS"); len(allowedIssuers) > 0 && !containsString(allowedIssuers, claims.RegisteredClaims.Issuer) {
		return nil, fmt.Errorf("invalid issuer")
	}
	out := &authClaims{
		Scopes: append(parseScopeString(claims.Scope), claims.Scp...),
		Roles:  append([]string(nil), claims.Roles...),
	}
	return out, nil
}

type oidcConfig struct {
	issuerURL string
	audience  string
}

func loadOIDCConfigFromEnv() (*oidcConfig, error) {
	issuer := strings.TrimSpace(os.Getenv("OIDC_ISSUER_URL"))
	if issuer == "" {
		return nil, errAuthMisconfigured
	}
	aud := strings.TrimSpace(os.Getenv("OIDC_AUDIENCE"))
	if aud == "" {
		// Backward-compatible fallback to existing auth audience env var.
		aud = strings.TrimSpace(os.Getenv("API_AUTH_ALLOWED_AUDIENCE"))
	}
	if aud == "" {
		return nil, errAuthMisconfigured
	}
	return &oidcConfig{issuerURL: issuer, audience: aud}, nil
}

var (
	oidcVerifierMu  sync.Mutex
	oidcVerifier    *oidc.IDTokenVerifier
	oidcVerifierKey string
)

func getOIDCVerifier(ctx context.Context, cfg *oidcConfig) (*oidc.IDTokenVerifier, error) {
	key := cfg.issuerURL + "|" + cfg.audience
	oidcVerifierMu.Lock()
	defer oidcVerifierMu.Unlock()
	if oidcVerifier != nil && oidcVerifierKey == key {
		return oidcVerifier, nil
	}
	provider, err := oidc.NewProvider(ctx, cfg.issuerURL)
	if err != nil {
		return nil, errAuthMisconfigured
	}
	verifier := provider.Verifier(&oidc.Config{ClientID: cfg.audience})
	oidcVerifier = verifier
	oidcVerifierKey = key
	return verifier, nil
}

func validateOIDCToken(ctx context.Context, rawToken string) (*authClaims, error) {
	cfg, err := loadOIDCConfigFromEnv()
	if err != nil {
		return nil, err
	}
	oidcCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	verifier, err := getOIDCVerifier(oidcCtx, cfg)
	if err != nil {
		return nil, err
	}
	idToken, err := verifier.Verify(oidcCtx, rawToken)
	if err != nil {
		return nil, fmt.Errorf("invalid oidc token")
	}
	var raw map[string]any
	if err := idToken.Claims(&raw); err != nil {
		return nil, fmt.Errorf("invalid oidc claims")
	}
	return extractAuthClaimsFromMap(raw), nil
}

func enforceRequiredClaims(claims *authClaims, r *http.Request) error {
	requiredScopes := requiredScopesForRequest(r)
	requiredRoles := parseCSVEnv("API_AUTH_REQUIRED_ROLES")
	if len(requiredScopes) == 0 && len(requiredRoles) == 0 {
		return nil
	}
	if claims == nil {
		return fmt.Errorf("missing claims")
	}
	for _, need := range requiredScopes {
		if !containsString(claims.Scopes, need) {
			return fmt.Errorf("missing required scope")
		}
	}
	for _, need := range requiredRoles {
		if !containsString(claims.Roles, need) {
			return fmt.Errorf("missing required role")
		}
	}
	return nil
}

func requiredScopesForRequest(r *http.Request) []string {
	required := append([]string(nil), parseCSVEnv("API_AUTH_REQUIRED_SCOPES")...)
	if r == nil {
		return required
	}
	readScope := strings.TrimSpace(os.Getenv("API_AUTH_REQUIRED_SCOPE_READ"))
	writeScope := strings.TrimSpace(os.Getenv("API_AUTH_REQUIRED_SCOPE_WRITE"))
	if readScope == "" && writeScope == "" {
		return required
	}
	isTaskPath := r.URL != nil && strings.HasPrefix(r.URL.Path, "/api/tasks")
	if !isTaskPath {
		return required
	}
	switch r.Method {
	case http.MethodGet:
		if readScope != "" {
			required = append(required, readScope)
		}
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		if writeScope != "" {
			required = append(required, writeScope)
		}
	}
	return dedupeStrings(required)
}

func dedupeStrings(values []string) []string {
	if len(values) < 2 {
		return values
	}
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

func parseScopeString(scope string) []string {
	scope = strings.TrimSpace(scope)
	if scope == "" {
		return nil
	}
	return strings.Fields(scope)
}

func extractAuthClaimsFromMap(raw map[string]any) *authClaims {
	var scopes []string
	if v, ok := raw["scope"].(string); ok {
		scopes = append(scopes, parseScopeString(v)...)
	}
	if v, ok := raw["scp"].([]any); ok {
		for _, it := range v {
			if s, ok := it.(string); ok && strings.TrimSpace(s) != "" {
				scopes = append(scopes, s)
			}
		}
	}
	var roles []string
	if v, ok := raw["roles"].([]any); ok {
		for _, it := range v {
			if s, ok := it.(string); ok && strings.TrimSpace(s) != "" {
				roles = append(roles, s)
			}
		}
	}
	return &authClaims{Scopes: scopes, Roles: roles}
}

func loadAPITokensFromEnv() []string {
	var tokens []string
	if csv := strings.TrimSpace(os.Getenv("API_AUTH_TOKENS")); csv != "" {
		for _, item := range strings.Split(csv, ",") {
			t := strings.TrimSpace(item)
			if t != "" {
				tokens = append(tokens, t)
			}
		}
	}
	// Backward compatible single-token mode.
	if single := strings.TrimSpace(os.Getenv("API_AUTH_TOKEN")); single != "" {
		tokens = append(tokens, single)
	}
	return tokens
}

func tokenMatches(presented string, candidates []string) bool {
	for _, token := range candidates {
		if subtle.ConstantTimeCompare([]byte(presented), []byte(token)) == 1 {
			return true
		}
	}
	return false
}

func parseCSVEnv(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}
	var out []string
	for _, part := range strings.Split(raw, ",") {
		v := strings.TrimSpace(part)
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

func containsString(values []string, want string) bool {
	for _, v := range values {
		if v == want {
			return true
		}
	}
	return false
}
