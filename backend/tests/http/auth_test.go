package httpapi_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAuth_RegisterLoginMe_AndViewerCannotCreateTask(t *testing.T) {
	mux := newTestServer(t)

	registerReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(`{"email":"viewer1@example.gov","firstName":"Viewer","lastName":"One","username":"viewer1","password":"StrongPass123!"}`))
	registerReq.Header.Set("Content-Type", "application/json")
	registerRR := httptest.NewRecorder()
	mux.ServeHTTP(registerRR, registerReq)
	if registerRR.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", registerRR.Code)
	}

	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"email":"viewer1@example.gov","password":"StrongPass123!"}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	mux.ServeHTTP(loginRR, loginReq)
	if loginRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", loginRR.Code)
	}
	cookies := loginRR.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie")
	}

	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.AddCookie(cookies[0])
	meRR := httptest.NewRecorder()
	mux.ServeHTTP(meRR, meReq)
	if meRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", meRR.Code)
	}
	var me struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(meRR.Body).Decode(&me); err != nil {
		t.Fatalf("decode me: %v", err)
	}
	if me.Role != "viewer" {
		t.Fatalf("expected viewer role, got %q", me.Role)
	}

	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	createReq := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(`{"title":"Blocked","status":"todo","dueAt":"`+due+`"}`))
	createReq.Header.Set("Content-Type", "application/json")
	createReq.AddCookie(cookies[0])
	createRR := httptest.NewRecorder()
	mux.ServeHTTP(createRR, createReq)
	if createRR.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", createRR.Code)
	}
}

func TestAuth_EditorCanListDisplayNames(t *testing.T) {
	mux := newTestServer(t)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"email":"editor@example.gov","password":"DemoPass123!"}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	mux.ServeHTTP(loginRR, loginReq)
	if loginRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", loginRR.Code)
	}
	cookies := loginRR.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie")
	}
	req := httptest.NewRequest(http.MethodGet, "/api/users/display-names", nil)
	req.AddCookie(cookies[0])
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var body struct {
		DisplayNames []string `json:"displayNames"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.DisplayNames) < 1 {
		t.Fatalf("expected display names, got %v", body.DisplayNames)
	}
}

func TestAuth_EditorCreateTask_UsesOwnerFromBody(t *testing.T) {
	mux := newTestServer(t)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"email":"editor@example.gov","password":"DemoPass123!"}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	mux.ServeHTTP(loginRR, loginReq)
	if loginRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", loginRR.Code)
	}
	cookies := loginRR.Result().Cookies()
	due := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	createBody := `{"title":"Owned","status":"todo","dueAt":"` + due + `","owner":"Priya Patel"}`
	createReq := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	createReq.AddCookie(cookies[0])
	createRR := httptest.NewRecorder()
	mux.ServeHTTP(createRR, createReq)
	if createRR.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", createRR.Code, createRR.Body.String())
	}
	var created struct {
		Owner string `json:"owner"`
	}
	if err := json.NewDecoder(createRR.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if created.Owner != "Priya Patel" {
		t.Fatalf("expected owner Priya Patel, got %q", created.Owner)
	}
}

func TestAuth_ViewerCannotListUsers(t *testing.T) {
	mux := newTestServer(t)

	registerReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(`{"email":"viewer2@example.gov","firstName":"Viewer","lastName":"Two","username":"viewer2","password":"StrongPass123!"}`))
	registerReq.Header.Set("Content-Type", "application/json")
	registerRR := httptest.NewRecorder()
	mux.ServeHTTP(registerRR, registerReq)
	if registerRR.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", registerRR.Code)
	}

	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"email":"viewer2@example.gov","password":"StrongPass123!"}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	mux.ServeHTTP(loginRR, loginReq)
	if loginRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", loginRR.Code)
	}
	cookies := loginRR.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie")
	}

	usersReq := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	usersReq.AddCookie(cookies[0])
	usersRR := httptest.NewRecorder()
	mux.ServeHTTP(usersRR, usersReq)
	if usersRR.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", usersRR.Code)
	}
}

func TestOAuthStart_MisconfiguredProvider(t *testing.T) {
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/github/start", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestOAuthStart_ConfiguredProviderReturnsRedirectURL(t *testing.T) {
	t.Setenv("OAUTH_GITHUB_CLIENT_ID", "gh-client")
	t.Setenv("OAUTH_GITHUB_CLIENT_SECRET", "gh-secret")
	t.Setenv("OAUTH_GITHUB_REDIRECT_URL", "http://localhost:8080/api/auth/oauth/github/callback")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/github/start?redirect=false", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var body struct {
		RedirectURL string `json:"redirectUrl"`
		State       string `json:"state"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.RedirectURL == "" || body.State == "" {
		t.Fatalf("expected redirectUrl and state, got %#v", body)
	}
}

func TestOAuthCallback_Success_JSONMode(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"tok123","token_type":"Bearer"}`))
	}))
	defer tokenSrv.Close()
	userSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer tok123" {
			http.Error(w, "bad token", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"sub":"g-1","email":"oauth-user@example.gov","name":"OAuth User"}`))
	}))
	defer userSrv.Close()

	t.Setenv("OAUTH_GOOGLE_CLIENT_ID", "g-client")
	t.Setenv("OAUTH_GOOGLE_CLIENT_SECRET", "g-secret")
	t.Setenv("OAUTH_GOOGLE_REDIRECT_URL", "http://localhost:8080/api/auth/oauth/google/callback")
	t.Setenv("OAUTH_GOOGLE_TOKEN_URL", tokenSrv.URL)
	t.Setenv("OAUTH_GOOGLE_USERINFO_URL", userSrv.URL)
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/callback?code=abc&state=xyz&redirect=false", nil)
	req.AddCookie(&http.Cookie{Name: "dts_oauth_state", Value: "xyz"})
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Email != "oauth-user@example.gov" {
		t.Fatalf("unexpected body %#v", body)
	}
}

func TestOAuthCallback_RedirectsToFrontendWhenConfigured(t *testing.T) {
	t.Setenv("OAUTH_GOOGLE_CLIENT_ID", "g-client")
	t.Setenv("OAUTH_GOOGLE_CLIENT_SECRET", "g-secret")
	t.Setenv("OAUTH_GOOGLE_REDIRECT_URL", "http://localhost:8080/api/auth/oauth/google/callback")
	t.Setenv("OAUTH_FRONTEND_REDIRECT_URL", "http://localhost:5173/auth")
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"tok123","token_type":"Bearer"}`))
	}))
	defer tokenSrv.Close()
	userSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"sub":"g-1","email":"oauth-user2@example.gov","name":"OAuth User 2"}`))
	}))
	defer userSrv.Close()
	t.Setenv("OAUTH_GOOGLE_TOKEN_URL", tokenSrv.URL)
	t.Setenv("OAUTH_GOOGLE_USERINFO_URL", userSrv.URL)
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/callback?code=abc&state=xyz", nil)
	req.AddCookie(&http.Cookie{Name: "dts_oauth_state", Value: "xyz"})
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusFound {
		t.Fatalf("expected 302, got %d", rr.Code)
	}
	loc := rr.Header().Get("Location")
	if !strings.Contains(loc, "oauth=oauth_success") {
		t.Fatalf("expected oauth status in redirect, got %q", loc)
	}
	if len(rr.Result().Cookies()) == 0 {
		t.Fatal("expected session cookie")
	}
}

func TestOAuthCallback_StateMismatch(t *testing.T) {
	t.Setenv("OAUTH_GOOGLE_CLIENT_ID", "g-client")
	t.Setenv("OAUTH_GOOGLE_CLIENT_SECRET", "g-secret")
	t.Setenv("OAUTH_GOOGLE_REDIRECT_URL", "http://localhost:8080/api/auth/oauth/google/callback")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/google/callback?code=abc&state=xyz&redirect=false", nil)
	req.AddCookie(&http.Cookie{Name: "dts_oauth_state", Value: "other"})
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "oauth_state_mismatch") {
		t.Fatalf("unexpected response body: %s", rr.Body.String())
	}
}

func TestOAuthStart_SetsStateCookie(t *testing.T) {
	t.Setenv("OAUTH_GITHUB_CLIENT_ID", "gh-client")
	t.Setenv("OAUTH_GITHUB_CLIENT_SECRET", "gh-secret")
	t.Setenv("OAUTH_GITHUB_REDIRECT_URL", "http://localhost:8080/api/auth/oauth/github/callback")
	mux := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/oauth/github/start?redirect=false", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	found := false
	for _, c := range rr.Result().Cookies() {
		if c.Name == "dts_oauth_state" && c.Value != "" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected dts_oauth_state cookie, got %s", fmt.Sprint(rr.Result().Cookies()))
	}
}

func TestAuth_RecoverAndResetPassword_Success(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	mux := newTestServer(t)

	registerReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(`{"email":"recover@example.gov","firstName":"Recover","lastName":"User","username":"recover.user","password":"OldPass123!"}`))
	registerReq.Header.Set("Content-Type", "application/json")
	registerRR := httptest.NewRecorder()
	mux.ServeHTTP(registerRR, registerReq)
	if registerRR.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", registerRR.Code)
	}

	recoverReq := httptest.NewRequest(http.MethodPost, "/api/auth/recover", strings.NewReader(`{"email":"recover@example.gov"}`))
	recoverReq.Header.Set("Content-Type", "application/json")
	recoverRR := httptest.NewRecorder()
	mux.ServeHTTP(recoverRR, recoverReq)
	if recoverRR.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", recoverRR.Code)
	}
	var recoverBody struct {
		Token    string `json:"token"`
		ResetURL string `json:"resetUrl"`
	}
	if err := json.NewDecoder(recoverRR.Body).Decode(&recoverBody); err != nil {
		t.Fatalf("decode recover: %v", err)
	}
	if strings.TrimSpace(recoverBody.Token) == "" {
		t.Fatal("expected non-empty recover token in development mode")
	}
	if !strings.Contains(recoverBody.ResetURL, "resetToken=") {
		t.Fatalf("expected resetUrl to contain resetToken, got %q", recoverBody.ResetURL)
	}

	resetReq := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password", strings.NewReader(fmt.Sprintf(`{"token":"%s","newPassword":"NewPass123!"}`, recoverBody.Token)))
	resetReq.Header.Set("Content-Type", "application/json")
	resetRR := httptest.NewRecorder()
	mux.ServeHTTP(resetRR, resetReq)
	if resetRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resetRR.Code)
	}

	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"email":"recover@example.gov","password":"NewPass123!"}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	mux.ServeHTTP(loginRR, loginReq)
	if loginRR.Code != http.StatusOK {
		t.Fatalf("expected login with new password to succeed, got %d", loginRR.Code)
	}
}
