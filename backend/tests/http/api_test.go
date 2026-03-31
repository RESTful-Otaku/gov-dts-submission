package httpapi_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
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
	s := httpapi.NewServerWithDriver(db, "sqlite3")
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

func TestTasksEndpoints_RequireBearerToken_OutsideDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_AUTH_TOKEN", "secret-token")
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
	t.Setenv("API_AUTH_TOKEN", "secret-token")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	req.Header.Set("Authorization", "Bearer secret-token")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}