package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestIsValidUUID(t *testing.T) {
	valid := "550e8400-e29b-41d4-a716-446655440000"
	if !isValidUUID(valid) {
		t.Fatalf("expected valid: %s", valid)
	}
	for _, bad := range []string{"", "nope", "550e8400-e29b-41d4-a716", "550e8400-e29b-41d4-a716-44665544000g"} {
		if isValidUUID(bad) {
			t.Fatalf("expected invalid: %q", bad)
		}
	}
}

func TestCorsOriginAllowed_EnvAllowlist(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com,https://staging.example.com")

	if !corsOriginAllowed("https://app.example.com") {
		t.Fatal("expected exact allowlist match")
	}
	if !corsOriginAllowed("https://staging.example.com") {
		t.Fatal("expected second origin")
	}
	if corsOriginAllowed("http://localhost:5173") {
		t.Fatal("localhost must not be allowed when CORS_ALLOWED_ORIGINS is set")
	}
	if corsOriginAllowed("https://evil.example") {
		t.Fatal("unexpected origin")
	}
}

func TestCorsOriginAllowed_DefaultDevOrigins(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	if !corsOriginAllowed("http://localhost:5173") {
		t.Fatal()
	}
	if !corsOriginAllowed("http://127.0.0.1:4173") {
		t.Fatal("vite preview / playwright base URL")
	}
}

func TestLoadAPITokensFromEnv(t *testing.T) {
	t.Setenv("API_AUTH_TOKENS", "token-a, token-b,,token-c")
	t.Setenv("API_AUTH_TOKEN", "single-token")
	tokens := loadAPITokensFromEnv()
	if len(tokens) != 4 {
		t.Fatalf("expected 4 tokens, got %d", len(tokens))
	}
	if tokens[0] != "token-a" || tokens[1] != "token-b" || tokens[2] != "token-c" || tokens[3] != "single-token" {
		t.Fatalf("unexpected token list: %#v", tokens)
	}
}

func TestTokenMatches(t *testing.T) {
	if !tokenMatches("b", []string{"a", "b", "c"}) {
		t.Fatal("expected match")
	}
	if tokenMatches("z", []string{"a", "b", "c"}) {
		t.Fatal("unexpected match")
	}
}

func TestParseCSVEnv(t *testing.T) {
	t.Setenv("API_AUTH_ALLOWED_ISSUERS", "issuer-a, issuer-b, ,issuer-c")
	got := parseCSVEnv("API_AUTH_ALLOWED_ISSUERS")
	if len(got) != 3 {
		t.Fatalf("expected 3 values, got %d", len(got))
	}
	if got[0] != "issuer-a" || got[1] != "issuer-b" || got[2] != "issuer-c" {
		t.Fatalf("unexpected parsed values: %#v", got)
	}
}

func TestContainsString(t *testing.T) {
	if !containsString([]string{"a", "b"}, "b") {
		t.Fatal("expected match")
	}
	if containsString([]string{"a", "b"}, "z") {
		t.Fatal("unexpected match")
	}
}

func TestExtractBearerToken(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/tasks", nil)
	if _, ok := extractBearerToken(req); ok {
		t.Fatal("expected no token")
	}
	req.Header.Set("Authorization", "Bearer abc")
	got, ok := extractBearerToken(req)
	if !ok || got != "abc" {
		t.Fatalf("unexpected token parse: ok=%v got=%q", ok, got)
	}
}

func TestValidateJWT(t *testing.T) {
	secret := "12345678901234567890123456789012"
	t.Setenv("JWT_HS256_SECRET", secret)
	t.Setenv("API_AUTH_ALLOWED_AUDIENCE", "task-api")
	t.Setenv("API_AUTH_ALLOWED_ISSUERS", "issuer-1")
	type claimsWithScope struct {
		jwt.RegisteredClaims
		Scope string `json:"scope"`
	}
	claims := claimsWithScope{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "issuer-1",
			Audience:  jwt.ClaimStrings{"task-api"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
		},
		Scope: "tasks:read",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	raw, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	claimsOut, err := validateJWT(raw, "production")
	if err != nil {
		t.Fatalf("expected valid jwt, got %v", err)
	}
	if !containsString(claimsOut.Scopes, "tasks:read") {
		t.Fatalf("expected scope in claims: %#v", claimsOut)
	}
}

func TestLoadOIDCConfigFromEnv(t *testing.T) {
	t.Setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
	t.Setenv("OIDC_AUDIENCE", "task-api")
	cfg, err := loadOIDCConfigFromEnv()
	if err != nil {
		t.Fatalf("expected config, got err: %v", err)
	}
	if cfg.issuerURL != "https://issuer.example.com" || cfg.audience != "task-api" {
		t.Fatalf("unexpected cfg: %#v", cfg)
	}
}

func TestLoadOIDCConfigFromEnv_FallbackAudience(t *testing.T) {
	t.Setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
	t.Setenv("OIDC_AUDIENCE", "")
	t.Setenv("API_AUTH_ALLOWED_AUDIENCE", "fallback-aud")
	cfg, err := loadOIDCConfigFromEnv()
	if err != nil {
		t.Fatalf("expected config, got err: %v", err)
	}
	if cfg.audience != "fallback-aud" {
		t.Fatalf("expected fallback audience, got %q", cfg.audience)
	}
}

func TestEnforceRequiredClaims(t *testing.T) {
	t.Setenv("API_AUTH_REQUIRED_SCOPES", "tasks:read,tasks:write")
	t.Setenv("API_AUTH_REQUIRED_ROLES", "caseworker")
	err := enforceRequiredClaims(&authClaims{
		Scopes: []string{"tasks:read", "tasks:write"},
		Roles:  []string{"caseworker"},
	}, httptest.NewRequest(http.MethodGet, "/api/tasks", nil))
	if err != nil {
		t.Fatalf("expected authorization success, got %v", err)
	}
}

func TestRequiredScopesForRequest(t *testing.T) {
	t.Setenv("API_AUTH_REQUIRED_SCOPES", "base:scope")
	t.Setenv("API_AUTH_REQUIRED_SCOPE_READ", "tasks:read")
	t.Setenv("API_AUTH_REQUIRED_SCOPE_WRITE", "tasks:write")
	readReq := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	writeReq := httptest.NewRequest(http.MethodPatch, "/api/tasks/abc", nil)
	readScopes := requiredScopesForRequest(readReq)
	writeScopes := requiredScopesForRequest(writeReq)
	if !containsString(readScopes, "base:scope") || !containsString(readScopes, "tasks:read") {
		t.Fatalf("unexpected read scopes: %#v", readScopes)
	}
	if !containsString(writeScopes, "base:scope") || !containsString(writeScopes, "tasks:write") {
		t.Fatalf("unexpected write scopes: %#v", writeScopes)
	}
}

func TestValidAuditFieldToken(t *testing.T) {
	if !validAuditFieldToken("dueAt") || !validAuditFieldToken("title") || !validAuditFieldToken("field_1") {
		t.Fatal("expected valid tokens")
	}
	if validAuditFieldToken("") || validAuditFieldToken("bad!") || validAuditFieldToken("a b") {
		t.Fatal("expected invalid")
	}
}

func TestEnsureMySQLParseTimeDSN(t *testing.T) {
	if got := ensureMySQLParseTimeDSN("user:pass@tcp(127.0.0.1:3306)/tasks"); got != "user:pass@tcp(127.0.0.1:3306)/tasks?parseTime=true" {
		t.Fatalf("unexpected: %q", got)
	}
	if got := ensureMySQLParseTimeDSN("user:pass@tcp(127.0.0.1:3306)/tasks?charset=utf8mb4"); got != "user:pass@tcp(127.0.0.1:3306)/tasks?charset=utf8mb4&parseTime=true" {
		t.Fatalf("unexpected: %q", got)
	}
	if got := ensureMySQLParseTimeDSN("user:pass@tcp(127.0.0.1:3306)/tasks?parseTime=true"); got != "user:pass@tcp(127.0.0.1:3306)/tasks?parseTime=true" {
		t.Fatalf("should not duplicate: %q", got)
	}
}

func TestExtractAuthClaimsFromMap(t *testing.T) {
	raw := map[string]any{
		"scope": "tasks:read tasks:write",
		"scp":   []any{"mobile"},
		"roles": []any{"caseworker"},
	}
	claims := extractAuthClaimsFromMap(raw)
	if !containsString(claims.Scopes, "tasks:read") || !containsString(claims.Scopes, "tasks:write") || !containsString(claims.Scopes, "mobile") {
		t.Fatalf("unexpected scopes: %#v", claims.Scopes)
	}
	if !containsString(claims.Roles, "caseworker") {
		t.Fatalf("unexpected roles: %#v", claims.Roles)
	}
}
