package main

import "testing"

func TestReadEnvDefault(t *testing.T) {
	t.Setenv("HTTP_PORT", "9191")
	if got := readEnvDefault("HTTP_PORT", "8080"); got != "9191" {
		t.Fatalf("got %q", got)
	}
	t.Setenv("HTTP_PORT", "")
	if got := readEnvDefault("HTTP_PORT", "8080"); got != "8080" {
		t.Fatalf("empty env: got %q want default", got)
	}
	t.Setenv("CUSTOM_KEY", "x")
	if got := readEnvDefault("CUSTOM_KEY", "def"); got != "x" {
		t.Fatalf("got %q", got)
	}
	if got := readEnvDefault("UNSET_KEY_XYZ", "fallback"); got != "fallback" {
		t.Fatalf("got %q", got)
	}
}
