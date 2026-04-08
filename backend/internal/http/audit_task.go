package httpapi

import (
	"encoding/json"
	"sort"
	"strings"

	"github.com/j-m-harrison/dts-submission/internal/task"
)

// validAuditFieldToken restricts ?field= for audit log filtering (letters, digits, underscore).
func validAuditFieldToken(s string) bool {
	if s == "" || len(s) > 64 {
		return false
	}
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' {
			continue
		}
		return false
	}
	return true
}

func jsonRawForAudit(jsonStr string) json.RawMessage {
	if strings.TrimSpace(jsonStr) == "" {
		return json.RawMessage("null")
	}
	return json.RawMessage(jsonStr)
}

func taskDescriptionEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return strings.TrimSpace(*a) == strings.TrimSpace(*b)
}

func tagsEqualForAudit(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	aa := append([]string(nil), a...)
	bb := append([]string(nil), b...)
	sort.Strings(aa)
	sort.Strings(bb)
	for i := range aa {
		if aa[i] != bb[i] {
			return false
		}
	}
	return true
}

func taskAuditDiff(before, after *task.Task) []string {
	if before == nil || after == nil {
		return nil
	}
	var out []string
	if before.Title != after.Title {
		out = append(out, "title")
	}
	if !taskDescriptionEqual(before.Description, after.Description) {
		out = append(out, "description")
	}
	if before.Status != after.Status {
		out = append(out, "status")
	}
	if before.Priority != after.Priority {
		out = append(out, "priority")
	}
	if !tagsEqualForAudit(before.Tags, after.Tags) {
		out = append(out, "tags")
	}
	if !before.DueAt.Equal(after.DueAt) {
		out = append(out, "dueAt")
	}
	return out
}

func createdTaskFieldNames(t *task.Task) []string {
	if t == nil {
		return nil
	}
	out := []string{"title", "status", "priority", "owner", "dueAt"}
	if t.Description != nil && strings.TrimSpace(*t.Description) != "" {
		out = append(out, "description")
	}
	if len(t.Tags) > 0 {
		out = append(out, "tags")
	}
	return out
}
