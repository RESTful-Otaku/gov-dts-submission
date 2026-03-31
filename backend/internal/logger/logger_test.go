package logger

import (
	"encoding/json"
	"os"
	"testing"
)

func TestIsJSON(t *testing.T) {
	cases := []struct {
		env   string
		want  bool
		unset bool
	}{
		{unset: true, want: false},
		{env: "", want: false},
		{env: "0", want: false},
		{env: "false", want: false},
		{env: "TRUE", want: true},
		{env: "true", want: true},
		{env: "1", want: true},
		{env: "yes", want: true},
	}
	for _, tc := range cases {
		if tc.unset {
			t.Setenv("LOG_JSON", "")
		} else {
			t.Setenv("LOG_JSON", tc.env)
		}
		if got := IsJSON(); got != tc.want {
			t.Fatalf("LOG_JSON=%q: got %v want %v", tc.env, got, tc.want)
		}
	}
}

func TestJSON_LogLineShape(t *testing.T) {
	oldOut := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = w
	JSON("error", "oops", "code", 500)
	_ = w.Close()
	os.Stdout = oldOut

	var payload map[string]interface{}
	if err := json.NewDecoder(r).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	_ = r.Close()
	if payload["level"] != "error" || payload["msg"] != "oops" {
		t.Fatalf("payload: %+v", payload)
	}
	if payload["code"].(float64) != 500 {
		t.Fatalf("code: %v", payload["code"])
	}
}

func TestFormatMsg(t *testing.T) {
	if formatMsg("plain") != "plain" {
		t.Fatal()
	}
	if formatMsg("v=%d", 42) != "v=42" {
		t.Fatal()
	}
}
