package storage

import "encoding/json"

// TagsJSON marshals tags for storage. Returns "[]" for nil or empty slice.
func TagsJSON(tags []string) (string, error) {
	if len(tags) == 0 {
		return "[]", nil
	}
	b, err := json.Marshal(tags)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// ParseTagsJSON unmarshals tags from stored JSON. Returns nil for invalid or empty.
func ParseTagsJSON(s string) ([]string, error) {
	if s == "" || s == "[]" {
		return nil, nil
	}
	var out []string
	if err := json.Unmarshal([]byte(s), &out); err != nil {
		return nil, err
	}
	return out, nil
}

