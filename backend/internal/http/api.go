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
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql" // MariaDB backend (same wire protocol)
	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/mattn/go-sqlite3"
	"github.com/j-m-harrison/dts-submission/internal/config"
	"github.com/j-m-harrison/dts-submission/internal/logger"
	"github.com/j-m-harrison/dts-submission/internal/seed"
	"github.com/j-m-harrison/dts-submission/internal/storage"
	"github.com/j-m-harrison/dts-submission/internal/task"
)

// maxJSONRequestBytes caps JSON bodies for task mutations to limit allocation and parse cost.
const maxJSONRequestBytes = 1 << 20 // 1 MiB
const (
	defaultListTasksLimit = 50
	maxListTasksLimit     = 200
)

type Server struct {
	store storage.Store
	db    *sql.DB
	// dbPing is an optional callback used by the readiness endpoint. For
	// SQL-backed stores this wraps (*sql.DB).PingContext; for Mongo-backed
	// stores it can wrap a mongo.Client.Ping call.
	dbPing func(ctx context.Context) error
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
		dbPing: func(ctx context.Context) error {
			if db == nil {
				return errors.New("nil db")
			}
			return db.PingContext(ctx)
		},
	}
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

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	reg := func(pattern string, requiresAuth bool, h http.HandlerFunc) {
		handler := withSecurityHeaders(withCORS(h))
		if requiresAuth {
			handler = withAPITokenAuth(handler)
		}
		mux.HandleFunc(pattern, handler)
	}
	reg("/api/health", false, s.handleHealth)
	reg("/api/live", false, s.handleLive)
	reg("/api/ready", false, s.handleReady)
	reg("/api/tasks", true, s.handleTasksCollection)
	reg("/api/tasks/", true, s.handleTaskItem)
}

// retryMigrate retries fn until success, ctx cancelled, or maxDuration elapsed.
// Logs once at start; no progress spam.
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
		writeError(w, http.StatusBadRequest, "invalid task id")
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
	var req createTaskRequest
	if !requireJSONBody(w, r, &req) {
		return
	}
	dueAt, err := time.Parse(time.RFC3339, req.DueAt)
	if err != nil {
		writeError(w, http.StatusBadRequest, "dueAt must be RFC3339 timestamp")
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
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) listTasks(w http.ResponseWriter, r *http.Request) {
	opts, err := parseListOptions(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
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
	return storage.ListOptions{Limit: limit, Offset: offset}, nil
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
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) updateTask(w http.ResponseWriter, r *http.Request, id string) {
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
		writeError(w, http.StatusBadRequest, "at least one of title, description, status, priority, or tags must be provided")
		return
	}
	if err := task.ValidateUpdateTask(input); err != nil {
		writeDomainError(w, err)
		return
	}
	updated, err := s.store.UpdateTask(r.Context(), id, input)
	if err != nil {
		writeStoreErr(w, err, "task not found", "failed to update task", "UpdateTask")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request, id string) {
	if err := s.store.DeleteTask(r.Context(), id); err != nil {
		writeStoreErr(w, err, "task not found", "failed to delete task", "DeleteTask")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type errorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}

func writeStoreErr(w http.ResponseWriter, err error, notFoundMsg, serverMsg, logPrefix string) {
	if errors.Is(err, storage.ErrNotFound) {
		writeError(w, http.StatusNotFound, notFoundMsg)
		return
	}
	logger.Error("%s error: %v", logPrefix, err)
	writeError(w, http.StatusInternalServerError, serverMsg)
}

func writeDomainError(w http.ResponseWriter, err error) {
	switch err {
	case task.ErrTitleRequired, task.ErrStatusRequired, task.ErrStatusInvalid,
		task.ErrDueAtZero, task.ErrDueAtInPast, task.ErrStatusEmpty,
		task.ErrStatusNoChange, task.ErrUnknownStatus,
		task.ErrPriorityInvalid, task.ErrOwnerTooLong, task.ErrTagTooLong, task.ErrTooManyTags:
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "validation failed")
	}
}

// requireJSONBody reads a bounded JSON body with strict decoding (unknown fields rejected).
// It writes an error response and returns false on failure.
func requireJSONBody(w http.ResponseWriter, r *http.Request, dst any) bool {
	ct := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Type")))
	if ct == "" || !strings.Contains(ct, "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, "Content-Type must be application/json")
		return false
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, maxJSONRequestBytes+1))
	_ = r.Body.Close()
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return false
	}
	if len(body) > maxJSONRequestBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
		return false
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return false
	}
	if dec.More() {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
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
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
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

		token := strings.TrimSpace(os.Getenv("API_AUTH_TOKEN"))
		if token == "" {
			writeError(w, http.StatusServiceUnavailable, "authentication is required but API_AUTH_TOKEN is not configured")
			return
		}

		const prefix = "Bearer "
		got := strings.TrimSpace(r.Header.Get("Authorization"))
		if !strings.HasPrefix(got, prefix) {
			writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		presented := strings.TrimSpace(strings.TrimPrefix(got, prefix))
		if subtle.ConstantTimeCompare([]byte(presented), []byte(token)) != 1 {
			writeError(w, http.StatusUnauthorized, "invalid bearer token")
			return
		}
		next(w, r)
	}
}

