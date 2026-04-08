package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/oauth2"
)

type oauthProviderConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	AuthURL      string
	TokenURL     string
	UserInfoURL  string
	Scopes       []string
}

func oauthEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func loadOAuthProviderConfig(provider string) (oauthProviderConfig, bool) {
	p := strings.ToLower(strings.TrimSpace(provider))
	switch p {
	case "github":
		cfg := oauthProviderConfig{
			ClientID:     oauthEnv("OAUTH_GITHUB_CLIENT_ID"),
			ClientSecret: oauthEnv("OAUTH_GITHUB_CLIENT_SECRET"),
			RedirectURL:  oauthEnv("OAUTH_GITHUB_REDIRECT_URL"),
			AuthURL:      firstNonEmpty(oauthEnv("OAUTH_GITHUB_AUTH_URL"), "https://github.com/login/oauth/authorize"),
			TokenURL:     firstNonEmpty(oauthEnv("OAUTH_GITHUB_TOKEN_URL"), "https://github.com/login/oauth/access_token"),
			UserInfoURL:  firstNonEmpty(oauthEnv("OAUTH_GITHUB_USERINFO_URL"), "https://api.github.com/user"),
			Scopes:       []string{"read:user", "user:email"},
		}
		return cfg, cfg.ClientID != "" && cfg.ClientSecret != "" && cfg.RedirectURL != "" && cfg.UserInfoURL != ""
	case "google":
		cfg := oauthProviderConfig{
			ClientID:     oauthEnv("OAUTH_GOOGLE_CLIENT_ID"),
			ClientSecret: oauthEnv("OAUTH_GOOGLE_CLIENT_SECRET"),
			RedirectURL:  oauthEnv("OAUTH_GOOGLE_REDIRECT_URL"),
			AuthURL:      firstNonEmpty(oauthEnv("OAUTH_GOOGLE_AUTH_URL"), "https://accounts.google.com/o/oauth2/v2/auth"),
			TokenURL:     firstNonEmpty(oauthEnv("OAUTH_GOOGLE_TOKEN_URL"), "https://oauth2.googleapis.com/token"),
			UserInfoURL:  firstNonEmpty(oauthEnv("OAUTH_GOOGLE_USERINFO_URL"), "https://openidconnect.googleapis.com/v1/userinfo"),
			Scopes:       []string{"openid", "email", "profile"},
		}
		return cfg, cfg.ClientID != "" && cfg.ClientSecret != "" && cfg.RedirectURL != "" && cfg.UserInfoURL != ""
	case "apple":
		cfg := oauthProviderConfig{
			ClientID:     oauthEnv("OAUTH_APPLE_CLIENT_ID"),
			ClientSecret: oauthEnv("OAUTH_APPLE_CLIENT_SECRET"),
			RedirectURL:  oauthEnv("OAUTH_APPLE_REDIRECT_URL"),
			AuthURL:      oauthEnv("OAUTH_APPLE_AUTH_URL"),
			TokenURL:     oauthEnv("OAUTH_APPLE_TOKEN_URL"),
			UserInfoURL:  oauthEnv("OAUTH_APPLE_USERINFO_URL"),
			Scopes:       []string{"name", "email"},
		}
		return cfg, cfg.ClientID != "" && cfg.ClientSecret != "" && cfg.RedirectURL != "" && cfg.AuthURL != "" && cfg.TokenURL != "" && cfg.UserInfoURL != ""
	default:
		return oauthProviderConfig{}, false
	}
}

func (s *Server) handleOAuthStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	provider := strings.TrimPrefix(r.URL.Path, "/api/auth/oauth/")
	provider = strings.TrimSuffix(provider, "/start")
	cfg, ok := loadOAuthProviderConfig(provider)
	if !ok {
		writeErrorCode(w, http.StatusServiceUnavailable, "oauth provider is not configured", "oauth_provider_misconfigured")
		return
	}
	state, err := makeSessionToken()
	if err != nil {
		writeErrorCode(w, http.StatusInternalServerError, "failed to initialize oauth state", "internal_error")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "dts_oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   600,
		SameSite: http.SameSiteLaxMode,
		Secure:   strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production"),
	})
	oCfg := &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Endpoint: oauth2.Endpoint{
			AuthURL:  cfg.AuthURL,
			TokenURL: cfg.TokenURL,
		},
		Scopes: cfg.Scopes,
	}
	redirectURL := oCfg.AuthCodeURL(state)
	if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("redirect")), "false") {
		writeJSON(w, http.StatusOK, map[string]string{
			"provider":    provider,
			"state":       state,
			"redirectUrl": redirectURL,
		})
		return
	}
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func (s *Server) handleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	provider := strings.TrimPrefix(r.URL.Path, "/api/auth/oauth/")
	provider = strings.TrimSuffix(provider, "/callback")
	cfg, ok := loadOAuthProviderConfig(provider)
	if !ok {
		writeErrorCode(w, http.StatusServiceUnavailable, "oauth provider is not configured", "oauth_provider_misconfigured")
		return
	}
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	stateCookie, _ := r.Cookie("dts_oauth_state")
	if stateCookie == nil || strings.TrimSpace(stateCookie.Value) == "" || stateCookie.Value != state {
		if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("redirect")), "false") {
			writeErrorCode(w, http.StatusBadRequest, "oauth state mismatch", "oauth_state_mismatch")
			return
		}
		http.Redirect(w, r, oauthFrontendRedirectURL("oauth_state_mismatch"), http.StatusFound)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "dts_oauth_state", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	if code == "" || state == "" {
		if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("redirect")), "false") {
			writeErrorCode(w, http.StatusBadRequest, "oauth callback requires code and state", "oauth_callback_invalid")
			return
		}
		http.Redirect(w, r, oauthFrontendRedirectURL("oauth_callback_invalid"), http.StatusFound)
		return
	}
	if errValue := strings.TrimSpace(r.URL.Query().Get("error")); errValue != "" {
		msg := errValue
		if desc := strings.TrimSpace(r.URL.Query().Get("error_description")); desc != "" {
			msg = msg + ": " + desc
		}
		if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("redirect")), "false") {
			writeErrorCode(w, http.StatusUnauthorized, msg, "oauth_provider_error")
			return
		}
		http.Redirect(w, r, oauthFrontendRedirectURL("oauth_provider_error"), http.StatusFound)
		return
	}
	oCfg := &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Endpoint: oauth2.Endpoint{
			AuthURL:  cfg.AuthURL,
			TokenURL: cfg.TokenURL,
		},
		Scopes: cfg.Scopes,
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	token, err := oCfg.Exchange(ctx, code)
	if err != nil {
		if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("redirect")), "false") {
			writeErrorCode(w, http.StatusUnauthorized, "oauth token exchange failed", "oauth_token_exchange_failed")
			return
		}
		http.Redirect(w, r, oauthFrontendRedirectURL("oauth_token_exchange_failed"), http.StatusFound)
		return
	}
	user, err := fetchOAuthUser(ctx, cfg.UserInfoURL, token.AccessToken)
	if err != nil {
		if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("redirect")), "false") {
			writeErrorCode(w, http.StatusUnauthorized, "oauth profile fetch failed", "oauth_profile_fetch_failed")
			return
		}
		http.Redirect(w, r, oauthFrontendRedirectURL("oauth_profile_fetch_failed"), http.StatusFound)
		return
	}
	if err := s.ensureAuthSchema(r.Context()); err != nil {
		writeErrorCode(w, http.StatusServiceUnavailable, "authentication is unavailable", "auth_unavailable")
		return
	}
	upserted, created, err := s.upsertOAuthUser(r.Context(), *user)
	if err != nil {
		if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("redirect")), "false") {
			writeErrorCode(w, http.StatusInternalServerError, "oauth user linkage failed", "oauth_user_link_failed")
			return
		}
		http.Redirect(w, r, oauthFrontendRedirectURL("oauth_user_link_failed"), http.StatusFound)
		return
	}
	if err := s.issueSessionCookie(r.Context(), w, upserted.ID); err != nil {
		if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("redirect")), "false") {
			writeErrorCode(w, http.StatusInternalServerError, "failed to create session", "internal_error")
			return
		}
		http.Redirect(w, r, oauthFrontendRedirectURL("oauth_session_failed"), http.StatusFound)
		return
	}
	if created {
		s.logAudit(r.Context(), upserted, "oauth_register", "user", upserted.ID, nil, auditUserPublicSnapshot(*upserted), []string{"email", "username", "firstName", "lastName", "role"})
	} else {
		s.logAudit(r.Context(), upserted, "oauth_login", "user", upserted.ID, nil, nil, []string{"session"})
	}
	if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("redirect")), "false") {
		writeJSON(w, http.StatusOK, upserted)
		return
	}
	http.Redirect(w, r, oauthFrontendRedirectURL("oauth_success"), http.StatusFound)
}

func isOAuthPath(path string) bool {
	if !strings.HasPrefix(path, "/api/auth/oauth/") {
		return false
	}
	return strings.HasSuffix(path, "/start") || strings.HasSuffix(path, "/callback")
}

func oauthProviderFromPath(path string) string {
	trimmed := strings.TrimPrefix(path, "/api/auth/oauth/")
	trimmed = strings.TrimSuffix(trimmed, "/start")
	trimmed = strings.TrimSuffix(trimmed, "/callback")
	return strings.TrimSpace(trimmed)
}

func validOAuthProvider(path string) bool {
	p := oauthProviderFromPath(path)
	return p == "github" || p == "google" || p == "apple"
}

func sanitizeRedirectURL(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return parsed.String()
}

func oauthFrontendRedirectURL(code string) string {
	base := sanitizeRedirectURL(oauthEnv("OAUTH_FRONTEND_REDIRECT_URL"))
	if base == "" {
		base = "http://localhost:5173/"
	}
	u, err := url.Parse(base)
	if err != nil {
		return "http://localhost:5173/?oauth=" + url.QueryEscape(code)
	}
	q := u.Query()
	q.Set("oauth", code)
	u.RawQuery = q.Encode()
	return u.String()
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func fetchOAuthUser(ctx context.Context, userInfoURL, accessToken string) (*authUser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, userInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return nil, fmt.Errorf("userinfo status %d", res.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	email := stringField(raw, "email")
	subject := firstNonEmpty(stringField(raw, "sub"), stringField(raw, "id"))
	if email == "" {
		email = firstNonEmpty(stringField(raw, "preferred_username"), stringField(raw, "login"))
		if email != "" && !strings.Contains(email, "@") {
			email += "@oauth.local"
		}
	}
	if email == "" && subject != "" {
		email = subject + "@oauth.local"
	}
	if email == "" {
		return nil, fmt.Errorf("missing oauth identity")
	}
	username := firstNonEmpty(stringField(raw, "name"), stringField(raw, "preferred_username"), stringField(raw, "login"), strings.Split(email, "@")[0])
	fullName := strings.TrimSpace(stringField(raw, "name"))
	firstName := ""
	lastName := ""
	if fullName != "" {
		parts := strings.Fields(fullName)
		firstName = parts[0]
		if len(parts) > 1 {
			lastName = strings.Join(parts[1:], " ")
		}
	}
	return &authUser{
		Email:    strings.ToLower(strings.TrimSpace(email)),
		Username: strings.TrimSpace(username),
		FirstName: firstName,
		LastName:  lastName,
		Role:     roleViewer,
	}, nil
}

func stringField(raw map[string]any, key string) string {
	v, _ := raw[key]
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func (s *Server) upsertOAuthUser(ctx context.Context, in authUser) (*authUser, bool, error) {
	var u authUser
	var role string
	row := s.db.QueryRowContext(ctx, `SELECT id, email, username, first_name, last_name, role, created_at, updated_at FROM users WHERE email = ?`, in.Email)
	if err := row.Scan(&u.ID, &u.Email, &u.Username, &u.FirstName, &u.LastName, &role, &u.CreatedAt, &u.UpdatedAt); err == nil {
		u.Role = parseUserRole(role)
		if in.Username != "" && in.Username != u.Username {
			_, _ = s.db.ExecContext(ctx, `UPDATE users SET username = ?, updated_at = ? WHERE id = ?`, in.Username, time.Now().UTC(), u.ID)
			u.Username = in.Username
		}
		return &u, false, nil
	}
	password, err := makeSessionToken()
	if err != nil {
		return nil, false, err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return nil, false, err
	}
	now := time.Now().UTC()
	id := uuid.New().String()
	firstName := strings.TrimSpace(in.FirstName)
	lastName := strings.TrimSpace(in.LastName)
	if firstName == "" {
		firstName = in.Username
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO users (id, email, username, first_name, last_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'viewer', ?, ?)`, id, in.Email, in.Username, firstName, lastName, hash, now, now)
	if err != nil {
		return nil, false, err
	}
	return &authUser{ID: id, Email: in.Email, Username: in.Username, FirstName: firstName, LastName: lastName, Role: roleViewer, CreatedAt: now, UpdatedAt: now}, true, nil
}
