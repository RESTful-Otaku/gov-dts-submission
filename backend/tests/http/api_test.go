package httpapi_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/mattn/go-sqlite3"
	httpapi "github.com/j-m-harrison/dts-submission/internal/http"
	"github.com/j-m-harrison/dts-submission/internal/seed"
	"github.com/j-m-harrison/dts-submission/internal/storage"
	"github.com/j-m-harrison/dts-submission/internal/task"
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
	s := httpapi.NewServerWithDriver(db, "sqlite3")
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)
	ctx := context.Background()
	// Auth tables (users, audit_logs, …) are created on first auth handler; seed demo rows for integration tests.
	initReq := httptest.NewRequest(http.MethodPost, "/api/auth/recover", strings.NewReader(`{"email":"init@example.gov"}`))
	initReq.Header.Set("Content-Type", "application/json")
	mux.ServeHTTP(httptest.NewRecorder(), initReq)
	if err := seed.DemoUsersWithDriver(ctx, db, "sqlite3"); err != nil {
		t.Fatalf("seed demo users: %v", err)
	}
	if err := seed.DemoTasksWithDriver(ctx, db, "sqlite3"); err != nil {
		t.Fatalf("seed demo tasks: %v", err)
	}
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
	// whitespace-only title
	body = `{"title":"   ","status":"todo","dueAt":"` + due + `"}`
	req = httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for whitespace-only title, got %d", rr.Code)
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

func TestGetTask_InvalidUUID(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks/not-a-uuid", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestTasksCollection_MethodNotAllowed(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodPut, "/api/tasks", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestCORSPreflight_Options(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodOptions, "/api/tasks", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rr.Code)
	}
	if rr.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Fatal("expected Access-Control-Allow-Methods header")
	}
	if allow := rr.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(allow, "Authorization") {
		t.Fatalf("expected Authorization in Access-Control-Allow-Headers, got %q", allow)
	}
	if allow := rr.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(allow, "X-API-Audience") {
		t.Fatalf("expected X-API-Audience in Access-Control-Allow-Headers, got %q", allow)
	}
	if allow := rr.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(allow, "X-API-Issuer") {
		t.Fatalf("expected X-API-Issuer in Access-Control-Allow-Headers, got %q", allow)
	}
	if rr.Header().Get("X-Frame-Options") != "DENY" {
		t.Fatalf("expected security header X-Frame-Options, got %q", rr.Header().Get("X-Frame-Options"))
	}
	if rr.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("expected X-Content-Type-Options nosniff, got %q", rr.Header().Get("X-Content-Type-Options"))
	}
}

func TestCORS_NullOrigin_DeniedByDefault(t *testing.T) {
	t.Setenv("CORS_ALLOW_NULL_ORIGIN", "")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodOptions, "/api/tasks", nil)
	req.Header.Set("Origin", "null")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rr.Code)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected null origin to be denied by default, got %q", got)
	}
}

func TestCORS_NullOrigin_AllowedWhenExplicitlyEnabled(t *testing.T) {
	t.Setenv("CORS_ALLOW_NULL_ORIGIN", "true")

	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodOptions, "/api/tasks", nil)
	req.Header.Set("Origin", "null")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rr.Code)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "null" {
		t.Fatalf("expected Access-Control-Allow-Origin null, got %q", got)
	}
}

func TestCreateTask_InvalidJSON(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader("{not json"))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestCreateTask_InvalidDueAtFormat(t *testing.T) {
	mux := newTestServer(t)
	body := `{"title":"x","status":"todo","dueAt":"31-12-2026"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateTask_HappyPath(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	createBody := `{"title":"Original","status":"todo","dueAt":"` + due + `"}`
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
		t.Fatalf("decode: %v", err)
	}
	putBody := `{"title":"Renamed"}`
	putReq := httptest.NewRequest(http.MethodPut, "/api/tasks/"+created.ID, strings.NewReader(putBody))
	putReq.Header.Set("Content-Type", "application/json")
	putRR := httptest.NewRecorder()
	mux.ServeHTTP(putRR, putReq)
	if putRR.Code != http.StatusOK {
		t.Fatalf("put expected 200, got %d", putRR.Code)
	}
	var out map[string]interface{}
	if err := json.NewDecoder(putRR.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out["title"] != "Renamed" {
		t.Fatalf("expected title Renamed, got %v", out["title"])
	}
}

func TestUpdateTask_EmptyBody(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	createBody := `{"title":"x","status":"todo","dueAt":"` + due + `"}`
	createReq := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	createRR := httptest.NewRecorder()
	mux.ServeHTTP(createRR, createReq)
	var created struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(createRR.Body).Decode(&created)

	putReq := httptest.NewRequest(http.MethodPut, "/api/tasks/"+created.ID, strings.NewReader("{}"))
	putReq.Header.Set("Content-Type", "application/json")
	putRR := httptest.NewRecorder()
	mux.ServeHTTP(putRR, putReq)
	if putRR.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", putRR.Code)
	}
}

func TestPatchStatus_ValidTransition(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	createBody := `{"title":"Flow","status":"todo","dueAt":"` + due + `"}`
	createReq := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	createRR := httptest.NewRecorder()
	mux.ServeHTTP(createRR, createReq)
	var created struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(createRR.Body).Decode(&created)

	patchBody := `{"status":"in_progress"}`
	patchReq := httptest.NewRequest(http.MethodPatch, "/api/tasks/"+created.ID, strings.NewReader(patchBody))
	patchReq.Header.Set("Content-Type", "application/json")
	patchRR := httptest.NewRecorder()
	mux.ServeHTTP(patchRR, patchReq)
	if patchRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", patchRR.Code)
	}
	var out struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(patchRR.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Status != "in_progress" {
		t.Fatalf("expected in_progress, got %q", out.Status)
	}
}

func TestPatchStatus_SameStatus_Returns400(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	createBody := `{"title":"Same","status":"todo","dueAt":"` + due + `"}`
	createReq := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	createRR := httptest.NewRecorder()
	mux.ServeHTTP(createRR, createReq)
	var created struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(createRR.Body).Decode(&created)

	patchBody := `{"status":"todo"}`
	patchReq := httptest.NewRequest(http.MethodPatch, "/api/tasks/"+created.ID, strings.NewReader(patchBody))
	patchReq.Header.Set("Content-Type", "application/json")
	patchRR := httptest.NewRecorder()
	mux.ServeHTTP(patchRR, patchReq)
	if patchRR.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", patchRR.Code)
	}
}

func TestDeleteTask_Success_Returns204(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	createBody := `{"title":"rm","status":"todo","dueAt":"` + due + `"}`
	createReq := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	createRR := httptest.NewRecorder()
	mux.ServeHTTP(createRR, createReq)
	var created struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(createRR.Body).Decode(&created)

	delReq := httptest.NewRequest(http.MethodDelete, "/api/tasks/"+created.ID, nil)
	delRR := httptest.NewRecorder()
	mux.ServeHTTP(delRR, delReq)
	if delRR.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", delRR.Code)
	}
	if delRR.Body.Len() != 0 {
		t.Fatalf("expected empty body on 204")
	}
}

func TestCreateTask_MissingContentType(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	body := `{"title":"x","status":"todo","dueAt":"` + due + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415, got %d", rr.Code)
	}
}

func TestCreateTask_WrongContentType(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	body := `{"title":"x","status":"todo","dueAt":"` + due + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "text/plain")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415, got %d", rr.Code)
	}
}

func TestCreateTask_UnknownJSONField(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	body := `{"title":"x","status":"todo","dueAt":"` + due + `","evil":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown JSON fields, got %d", rr.Code)
	}
}

func TestCreateTask_BodyTooLarge(t *testing.T) {
	mux := newTestServer(t)
	body := strings.Repeat("x", 1<<20+1)
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d", rr.Code)
	}
}

func TestCreateTask_TrailingGarbageJSON(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	body := `{"title":"x","status":"todo","dueAt":"` + due + `"} ` + "\n" + `{}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for multiple JSON values, got %d", rr.Code)
	}
}

func TestListTasks_PaginationQueryParams(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(time.Hour)
	for i := 0; i < 3; i++ {
		body := `{"title":"Task ` + strconv.Itoa(i) + `","status":"todo","dueAt":"` + due.Add(time.Duration(i)*time.Hour).Format(time.RFC3339) + `"}`
		req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != http.StatusCreated {
			t.Fatalf("create expected 201, got %d", rr.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/tasks?limit=1&offset=1", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var list []map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&list); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 task with limit=1, got %d", len(list))
	}
}

func TestListTasks_InvalidLimit(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks?limit=0", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestListTasks_FilterSortQueryParams(t *testing.T) {
	mux := newTestServer(t)
	due := time.Now().UTC().Add(2 * time.Hour)
	cases := []string{
		`{"title":"Alpha review","status":"todo","priority":"high","owner":"Caseworker A","tags":["evidence"],"dueAt":"` + due.Add(3*time.Hour).Format(time.RFC3339) + `"}`,
		`{"title":"Beta hearing","status":"in_progress","priority":"normal","owner":"Caseworker B","tags":["hearing"],"dueAt":"` + due.Add(1*time.Hour).Format(time.RFC3339) + `"}`,
		`{"title":"Gamma evidence","status":"in_progress","priority":"urgent","owner":"Caseworker B","tags":["evidence"],"dueAt":"` + due.Add(2*time.Hour).Format(time.RFC3339) + `"}`,
	}
	for _, body := range cases {
		req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != http.StatusCreated {
			t.Fatalf("create expected 201, got %d", rr.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/tasks?status=in_progress&owner=caseworker%20b&tag=evidence&sort=title&order=desc", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var list []map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&list); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 filtered task, got %d", len(list))
	}
	if title, _ := list[0]["title"].(string); title != "Gamma evidence" {
		t.Fatalf("expected Gamma evidence, got %q", title)
	}
}

func TestListTasks_InvalidSortAndOrder(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks?sort=unknown", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid sort, got %d", rr.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/tasks?order=sideways", nil)
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid order, got %d", rr.Code)
	}
}

func TestTasksEndpoints_RequireBearerToken_OutsideDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_TOKEN", "12345678901234567890123456789012")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func TestTasksEndpoints_AcceptBearerToken_WhenConfigured(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_TOKEN", "12345678901234567890123456789012")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer 12345678901234567890123456789012")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestTasksEndpoints_AcceptBearerToken_FromTokenList(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_TOKENS", "12345678901234567890123456789012,abcdefghijklmnopqrstuvwxyz123456")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer abcdefghijklmnopqrstuvwxyz123456")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestTasksEndpoints_RejectShortToken_InProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_TOKEN", "short-token")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer short-token")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestTasksEndpoints_RequireAudience_WhenConfigured(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_TOKEN", "12345678901234567890123456789012")
	t.Setenv("API_AUTH_ALLOWED_AUDIENCE", "mobile-app")
	mux := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer 12345678901234567890123456789012")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without audience, got %d", rr.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer 12345678901234567890123456789012")
	req.Header.Set("X-API-Audience", "mobile-app")
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 with valid audience, got %d", rr.Code)
	}
}

func TestTasksEndpoints_RequireIssuer_WhenConfigured(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_TOKEN", "12345678901234567890123456789012")
	t.Setenv("API_AUTH_ALLOWED_ISSUERS", "issuer-a,issuer-b")
	mux := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer 12345678901234567890123456789012")
	req.Header.Set("X-API-Issuer", "issuer-x")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with wrong issuer, got %d", rr.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer 12345678901234567890123456789012")
	req.Header.Set("X-API-Issuer", "issuer-b")
	rr = httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 with valid issuer, got %d", rr.Code)
	}
}

func TestTasksEndpoints_AcceptJWT_WhenConfigured(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_MODE", "jwt")
	t.Setenv("JWT_HS256_SECRET", "12345678901234567890123456789012")
	t.Setenv("API_AUTH_ALLOWED_AUDIENCE", "task-api")
	t.Setenv("API_AUTH_ALLOWED_ISSUERS", "issuer-1")
	claims := jwt.RegisteredClaims{
		Issuer:    "issuer-1",
		Audience:  jwt.ClaimStrings{"task-api"},
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	raw, err := token.SignedString([]byte("12345678901234567890123456789012"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer "+raw)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestTasksEndpoints_RejectJWT_WhenRequiredScopeMissing(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_MODE", "jwt")
	t.Setenv("JWT_HS256_SECRET", "12345678901234567890123456789012")
	t.Setenv("API_AUTH_ALLOWED_AUDIENCE", "task-api")
	t.Setenv("API_AUTH_ALLOWED_ISSUERS", "issuer-1")
	t.Setenv("API_AUTH_REQUIRED_SCOPES", "tasks:write")
	claims := jwt.RegisteredClaims{
		Issuer:    "issuer-1",
		Audience:  jwt.ClaimStrings{"task-api"},
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	raw, err := token.SignedString([]byte("12345678901234567890123456789012"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer "+raw)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rr.Code)
	}
}

func TestTasksEndpoints_AcceptJWT_WhenRequiredScopePresent(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_MODE", "jwt")
	t.Setenv("JWT_HS256_SECRET", "12345678901234567890123456789012")
	t.Setenv("API_AUTH_ALLOWED_AUDIENCE", "task-api")
	t.Setenv("API_AUTH_ALLOWED_ISSUERS", "issuer-1")
	t.Setenv("API_AUTH_REQUIRED_SCOPES", "tasks:write")
	type scopedClaims struct {
		jwt.RegisteredClaims
		Scope string `json:"scope"`
	}
	claims := scopedClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "issuer-1",
			Audience:  jwt.ClaimStrings{"task-api"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
		},
		Scope: "tasks:write",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	raw, err := token.SignedString([]byte("12345678901234567890123456789012"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer "+raw)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestTasksEndpoints_RouteLevelScopes_ReadVsWrite(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_MODE", "jwt")
	t.Setenv("JWT_HS256_SECRET", "12345678901234567890123456789012")
	t.Setenv("API_AUTH_ALLOWED_AUDIENCE", "task-api")
	t.Setenv("API_AUTH_ALLOWED_ISSUERS", "issuer-1")
	t.Setenv("API_AUTH_REQUIRED_SCOPE_READ", "tasks:read")
	t.Setenv("API_AUTH_REQUIRED_SCOPE_WRITE", "tasks:write")
	type scopedClaims struct {
		jwt.RegisteredClaims
		Scope string `json:"scope"`
	}
	claims := scopedClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "issuer-1",
			Audience:  jwt.ClaimStrings{"task-api"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
		},
		Scope: "tasks:read",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	raw, err := token.SignedString([]byte("12345678901234567890123456789012"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	mux := newTestServer(t)

	// GET /api/tasks should pass with read scope.
	getReq := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	getReq.Header.Set("Authorization", "Bearer "+raw)
	getRR := httptest.NewRecorder()
	mux.ServeHTTP(getRR, getReq)
	if getRR.Code != http.StatusOK {
		t.Fatalf("expected GET 200, got %d", getRR.Code)
	}

	// POST /api/tasks should fail without write scope.
	postReq := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(`{"title":"Scoped task","status":"todo","dueAt":"2099-01-01T10:00:00Z"}`))
	postReq.Header.Set("Authorization", "Bearer "+raw)
	postReq.Header.Set("Content-Type", "application/json")
	postRR := httptest.NewRecorder()
	mux.ServeHTTP(postRR, postReq)
	if postRR.Code != http.StatusForbidden {
		t.Fatalf("expected POST 403, got %d", postRR.Code)
	}
}

func TestTasksEndpoints_RejectJWTMisconfiguration(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_MODE", "jwt")
	t.Setenv("JWT_HS256_SECRET", "")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer dummy")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestTasksEndpoints_RejectOIDCMisconfiguration(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_MODE", "oidc")
	t.Setenv("OIDC_ISSUER_URL", "")
	t.Setenv("OIDC_AUDIENCE", "")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer dummy")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

type alwaysConflictStore struct{}

func (alwaysConflictStore) CreateTask(context.Context, task.NewTaskInput) (*task.Task, error) {
	return nil, errors.New("not used")
}

func (alwaysConflictStore) GetTask(context.Context, string) (*task.Task, error) {
	return &task.Task{
		ID:        "550e8400-e29b-41d4-a716-446655440001",
		Title:     "existing",
		Status:    task.StatusTodo,
		Priority:  task.PriorityNormal,
		DueAt:     time.Now().UTC().Add(time.Hour),
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}, nil
}

func (alwaysConflictStore) ListTasks(context.Context, storage.ListOptions) ([]*task.Task, error) {
	return []*task.Task{}, nil
}

func (alwaysConflictStore) UpdateTaskStatus(context.Context, string, task.Status) (*task.Task, error) {
	return nil, storage.ErrConflict
}

func (alwaysConflictStore) UpdateTask(context.Context, string, *task.UpdateTaskInput) (*task.Task, error) {
	return nil, storage.ErrConflict
}

func (alwaysConflictStore) DeleteTask(context.Context, string) error {
	return nil
}

func TestUpdateTaskStatus_ConflictMapsTo409(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	s := httpapi.NewServerWithStore(alwaysConflictStore{}, nil)
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodPatch, "/api/tasks/550e8400-e29b-41d4-a716-446655440001", strings.NewReader(`{"status":"done"}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rr.Code)
	}
}