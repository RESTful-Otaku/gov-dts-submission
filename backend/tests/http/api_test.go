package httpapi_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	httpapi "github.com/j-m-harrison/dts-submission/internal/http"
	"github.com/j-m-harrison/dts-submission/internal/storage"
)

func newTestServer(t *testing.T) *http.ServeMux {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := storage.Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	s := httpapi.NewServer(db)
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)
	return mux
}

func TestHealthEndpoint(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestLiveEndpoint(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/live", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestReadyEndpoint(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/ready", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Status != "ready" {
		t.Fatalf("expected status ready, got %q", body.Status)
	}
}

func TestCreateAndGetTask(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	body := `{"title":"Test task","status":"todo","dueAt":"` + due + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected non-empty UUID id")
	}
	getReq := httptest.NewRequest(http.MethodGet, "/api/tasks/"+created.ID, nil)
	getRR := httptest.NewRecorder()
	mux.ServeHTTP(getRR, getReq)
	if getRR.Code != http.StatusOK {
		t.Fatalf("get expected 200, got %d", getRR.Code)
	}
}

func TestCreateTask_ValidationErrors(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	// missing title
	body := `{"title":"","status":"todo","dueAt":"` + due + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing title, got %d", rr.Code)
	}
	// past due
	past := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)
	body = `{"title":"x","status":"todo","dueAt":"` + past + `"}`
	req = httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for past dueAt, got %d", rr.Code)
	}
}

// Contract: list tasks returns 200 and JSON array (possibly empty).
func TestListTasks_Contract(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected application/json, got %q", ct)
	}
	var list []map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&list); err != nil {
		t.Fatalf("expected JSON array: %v", err)
	}
}

// Contract: get non-existent task returns 404 and error JSON.
func TestGetTask_NotFound_Contract(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks/00000000-0000-0000-0000-000000000001", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
	var errBody struct {
		Error string `json:"error"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&errBody); err != nil {
		t.Fatalf("decode error body: %v", err)
	}
	if errBody.Error == "" {
		t.Fatal("expected non-empty error message")
	}
}

// Contract: delete non-existent task returns 404.
func TestDeleteTask_NotFound_Contract(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/tasks/00000000-0000-0000-0000-000000000001", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
}

// Contract: PATCH with invalid status returns 400 and error JSON.
func TestUpdateTaskStatus_InvalidStatus_Contract(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	createBody := `{"title":"Contract task","status":"todo","dueAt":"` + due + `"}`
	createReq := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	createRR := httptest.NewRecorder()
	mux.ServeHTTP(createRR, createReq)
	if createRR.Code != http.StatusCreated {
		t.Fatalf("create expected 201, got %d", createRR.Code)
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(createRR.Body).Decode(&created); err != nil {
		t.Fatalf("decode created: %v", err)
	}

	patchBody := `{"status":"invalid_status"}`
	patchReq := httptest.NewRequest(http.MethodPatch, "/api/tasks/"+created.ID, strings.NewReader(patchBody))
	patchReq.Header.Set("Content-Type", "application/json")
	patchRR := httptest.NewRecorder()
	mux.ServeHTTP(patchRR, patchReq)
	if patchRR.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid status, got %d", patchRR.Code)
	}
	var errBody struct {
		Error string `json:"error"`
	}
	if err := json.NewDecoder(patchRR.Body).Decode(&errBody); err != nil {
		t.Fatalf("decode error body: %v", err)
	}
	if errBody.Error == "" {
		t.Fatal("expected non-empty error message")
	}
}

