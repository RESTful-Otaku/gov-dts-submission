package httpapi

import "testing"

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
