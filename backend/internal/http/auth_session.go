package httpapi

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
)

const sessionCookieName = "dts_session"
const defaultUserBootstrapEnv = "AUTH_BOOTSTRAP_DEFAULT_USERS"

type userRole string

const (
	roleViewer userRole = "viewer"
	roleEditor userRole = "editor"
	roleAdmin  userRole = "admin"
)

type authUser struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	FirstName string    `json:"firstName"`
	LastName  string    `json:"lastName"`
	Role      userRole  `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type contextKey string

const currentUserContextKey contextKey = "current_user"

func (s *Server) ensureAuthSchema(ctx context.Context) error {
	if s.db == nil {
		return errors.New("auth schema requires SQL backend")
	}
	_, err := s.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	username TEXT NOT NULL UNIQUE,
	first_name TEXT NOT NULL DEFAULT '',
	last_name TEXT NOT NULL DEFAULT '',
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'viewer',
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMP NOT NULL,
	created_at TIMESTAMP NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit_logs (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	username TEXT NOT NULL,
	action TEXT NOT NULL,
	entity_type TEXT NOT NULL,
	entity_id TEXT NOT NULL,
	changed_fields TEXT NOT NULL DEFAULT '[]',
	before_json TEXT,
	after_json TEXT,
	raw_json TEXT NOT NULL,
	created_at TIMESTAMP NOT NULL
);`)
	if err != nil {
		return err
	}
	userIDType := "TEXT"
	if row := s.db.QueryRowContext(ctx, `
SELECT data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'id'
LIMIT 1
`); row != nil {
		var dt string
		if scanErr := row.Scan(&dt); scanErr == nil {
			switch strings.ToLower(strings.TrimSpace(dt)) {
			case "uuid":
				userIDType = "UUID"
			case "character varying", "varchar", "text":
				userIDType = "TEXT"
			case "character", "char":
				// MariaDB users.id is CHAR(36)
				userIDType = "CHAR(36)"
			}
		}
	}
	_, err = s.db.ExecContext(ctx, fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS password_resets (
	id %s PRIMARY KEY,
	user_id %s NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMP NOT NULL,
	created_at TIMESTAMP NOT NULL,
	used_at TIMESTAMP NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`, userIDType, userIDType))
	if err != nil {
		return err
	}
	// Best-effort forward-compatible columns for existing databases.
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT ''`)
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT ''`)
	if err := s.ensureDefaultUsers(ctx); err != nil {
		return err
	}
	return s.backfillDemoUserProfiles(ctx)
}

// backfillDemoUserProfiles sets first/last/display name for seeded QA accounts when columns were empty
// or when legacy short usernames (schen, …) are still stored.
func (s *Server) backfillDemoUserProfiles(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	type fix struct {
		email, first, last, display string
	}
	fixes := []fix{
		{"admin@example.gov", "Sarah", "Chen", "Sarah Chen"},
		{"editor@example.gov", "James", "Wilson", "James Wilson"},
		{"viewer@example.gov", "Priya", "Patel", "Priya Patel"},
	}
	for _, f := range fixes {
		_, err := s.db.ExecContext(ctx, `
UPDATE users SET first_name = ?, last_name = ?, username = ?
WHERE email = ? AND (
	TRIM(COALESCE(first_name, '')) = '' OR TRIM(COALESCE(last_name, '')) = '' OR username IN ('schen', 'jwilson', 'ppatel')
)`, f.first, f.last, f.display, f.email)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) shouldBootstrapDefaultUsers() bool {
	raw := strings.TrimSpace(os.Getenv(defaultUserBootstrapEnv))
	if raw != "" {
		normalized := strings.ToLower(raw)
		return normalized == "1" || normalized == "true" || normalized == "yes"
	}
	return !strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production")
}

func (s *Server) ensureDefaultUsers(ctx context.Context) error {
	if s.db == nil || !s.shouldBootstrapDefaultUsers() {
		return nil
	}
	// SQL API startup seeds accounts via seed.DemoUsersWithDriver (20 demo users + shared demo password).
	return nil
}

func roleLevel(role userRole) int {
	switch role {
	case roleAdmin:
		return 3
	case roleEditor:
		return 2
	default:
		return 1
	}
}

func parseUserRole(raw string) userRole {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "admin":
		return roleAdmin
	case "editor":
		return roleEditor
	default:
		return roleViewer
	}
}

func hasRoleAtLeast(user *authUser, min userRole) bool {
	if user == nil {
		return false
	}
	return roleLevel(user.Role) >= roleLevel(min)
}

func withSessionAuth(s *Server, required bool, minRole userRole, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := s.currentUserFromRequest(r)
		if err != nil {
			// Session lookup can fail transiently (e.g. driver TIMESTAMP scan quirks) or when a
			// stale cookie is present. Public routes (login, register, health) must still run so
			// users can sign in; treat lookup errors as "no session" instead of blocking the request.
			if !required {
				user = nil
			} else {
				writeErrorCode(w, http.StatusUnauthorized, "invalid session", "invalid_session")
				return
			}
		}
		if required && user == nil {
			writeErrorCode(w, http.StatusUnauthorized, "authentication required", "authentication_required")
			return
		}
		if user != nil && !hasRoleAtLeast(user, minRole) {
			writeErrorCode(w, http.StatusForbidden, "insufficient permissions", "insufficient_permissions")
			return
		}
		ctx := context.WithValue(r.Context(), currentUserContextKey, user)
		next(w, r.WithContext(ctx))
	}
}

func currentUserFromContext(ctx context.Context) *authUser {
	v := ctx.Value(currentUserContextKey)
	if v == nil {
		return nil
	}
	user, _ := v.(*authUser)
	return user
}

func sessionDuration() time.Duration {
	raw := strings.TrimSpace(os.Getenv("SESSION_TTL_HOURS"))
	if raw == "" {
		return 24 * time.Hour
	}
	var hours int
	if _, err := fmt.Sscanf(raw, "%d", &hours); err != nil || hours < 1 || hours > 24*30 {
		return 24 * time.Hour
	}
	return time.Duration(hours) * time.Hour
}

func (s *Server) currentUserFromRequest(r *http.Request) (*authUser, error) {
	if s.db == nil {
		return nil, nil
	}
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		if errors.Is(err, http.ErrNoCookie) {
			return nil, nil
		}
		return nil, err
	}
	tokenHash := hashToken(cookie.Value)
	row := s.db.QueryRowContext(r.Context(), `
SELECT u.id, u.email, u.username, u.role
     , u.first_name, u.last_name, u.created_at, u.updated_at
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = ? AND s.expires_at > ?
`, tokenHash, time.Now().UTC())
	var u authUser
	var role string
	var fn, ln sql.NullString
	if err := row.Scan(&u.ID, &u.Email, &u.Username, &role, &fn, &ln, &u.CreatedAt, &u.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	u.Role = parseUserRole(role)
	if fn.Valid {
		u.FirstName = fn.String
	}
	if ln.Valid {
		u.LastName = ln.String
	}
	return &u, nil
}

// auditActorFromOwner returns the authenticated user when present; otherwise tries to resolve a
// user row by task owner username so audit logs can be written for API calls without a session
// (e.g. bearer-token-only) when the owner matches a known account.
func (s *Server) auditActorFromOwner(ctx context.Context, user *authUser, ownerHint string) *authUser {
	if user != nil {
		return user
	}
	ownerHint = strings.TrimSpace(ownerHint)
	if ownerHint == "" || s.db == nil {
		return nil
	}
	row := s.db.QueryRowContext(ctx, `
SELECT id, email, username, first_name, last_name, role, created_at, updated_at
FROM users WHERE username = ?`, ownerHint)
	var u authUser
	var role string
	var fn, ln sql.NullString
	if err := row.Scan(&u.ID, &u.Email, &u.Username, &role, &fn, &ln, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil
	}
	u.Role = parseUserRole(role)
	if fn.Valid {
		u.FirstName = fn.String
	}
	if ln.Valid {
		u.LastName = ln.String
	}
	return &u
}

func (s *Server) issueSessionCookie(ctx context.Context, w http.ResponseWriter, userID string) error {
	if s.db == nil {
		return errors.New("session store unavailable")
	}
	rawToken, err := makeSessionToken()
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	expiry := now.Add(sessionDuration())
	_, err = s.db.ExecContext(ctx, `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`, uuid.New().String(), userID, hashToken(rawToken), expiry, now)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    rawToken,
		Path:     "/",
		Expires:  expiry,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production"),
	})
	return nil
}

func makeSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := argon2.IDKey([]byte(token), []byte("dts-session"), 1, 64*1024, 2, 32)
	return base64.RawStdEncoding.EncodeToString(sum)
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	sum := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	return base64.RawStdEncoding.EncodeToString(salt) + "." + base64.RawStdEncoding.EncodeToString(sum), nil
}

func verifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, ".")
	if len(parts) != 2 {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[0])
	if err != nil {
		return false
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[1])
	if err != nil {
		return false
	}
	got := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	return subtleConstantTimeEqual(got, want)
}

func subtleConstantTimeEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	var v byte
	for i := range a {
		v |= a[i] ^ b[i]
	}
	return v == 0
}
