package storage

import (
	"reflect"
	"testing"
)

func TestTagsJSON_Empty(t *testing.T) {
	s, err := TagsJSON(nil)
	if err != nil || s != "[]" {
		t.Fatalf("got %q err %v", s, err)
	}
	s, err = TagsJSON([]string{})
	if err != nil || s != "[]" {
		t.Fatalf("got %q err %v", s, err)
	}
}

func TestTagsJSON_ParseTagsJSON_RoundTrip(t *testing.T) {
	tags := []string{"a", "b", "c"}
	raw, err := TagsJSON(tags)
	if err != nil {
		t.Fatal(err)
	}
	out, err := ParseTagsJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(out, tags) {
		t.Fatalf("got %#v", out)
	}
}

func TestParseTagsJSON_EdgeCases(t *testing.T) {
	for _, in := range []string{"", "[]"} {
		out, err := ParseTagsJSON(in)
		if err != nil || out != nil {
			t.Fatalf("in %q: out %#v err %v", in, out, err)
		}
	}
}

func TestParseTagsJSON_InvalidJSON(t *testing.T) {
	_, err := ParseTagsJSON("{")
	if err == nil {
		t.Fatal("expected error")
	}
}
