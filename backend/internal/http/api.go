package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
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

type Server struct {
	store storage.Store
	db    *sql.DB
}

func NewServer(db *sql.DB) *Server {
	return &Server{store: storage.NewStoreFromDB(db), db: db}
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/health", withCORS(s.handleHealth))
	mux.HandleFunc("/api/live", withCORS(s.handleLive))
	mux.HandleFunc("/api/ready", withCORS(s.handleReady))
	mux.HandleFunc("/api/tasks", withCORS(s.handleTasksCollection))
	mux.HandleFunc("/api/tasks/", withCORS(s.handleTaskItem))
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

	if err := seed.DemoTasks(ctx, db); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
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
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database not configured")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.db.PingContext(ctx); err != nil {
		logger.Error("ready check: db ping failed: %v", err)
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
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
	tasks, err := s.store.ListTasks(r.Context())
	if err != nil {
		logger.Error("ListTasks error: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	writeJSON(w, http.StatusOK, tasks)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
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

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		// Allow web dev (localhost:5173), Capacitor (capacitor://, https://localhost), emulator (10.0.2.2), and null
		allowed := origin == "http://localhost:5173" ||
			origin == "null" ||
			strings.HasPrefix(origin, "capacitor://") ||
			strings.HasPrefix(origin, "https://localhost") ||
			strings.HasPrefix(origin, "http://10.0.2.2") ||
			strings.HasPrefix(origin, "http://localhost")
		if allowed && origin != "" {
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

