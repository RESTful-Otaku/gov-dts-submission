package task

import (
	"strings"
	"testing"
	"time"
)

func TestValidateNewTask(t *testing.T) {
	now := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
	future := now.Add(time.Hour)
	desc := "d"

	t.Run("valid minimal", func(t *testing.T) {
		err := ValidateNewTask(now, NewTaskInput{
			Title:  "OK",
			Status: StatusTodo,
			DueAt:  future,
		})
		if err != nil {
			t.Fatalf("expected nil, got %v", err)
		}
	})

	t.Run("empty title", func(t *testing.T) {
		err := ValidateNewTask(now, NewTaskInput{Title: "", Status: StatusTodo, DueAt: future})
		if err != ErrTitleRequired {
			t.Fatalf("want ErrTitleRequired, got %v", err)
		}
	})

	t.Run("empty status", func(t *testing.T) {
		err := ValidateNewTask(now, NewTaskInput{Title: "x", Status: "", DueAt: future})
		if err != ErrStatusRequired {
			t.Fatalf("want ErrStatusRequired, got %v", err)
		}
	})

	t.Run("invalid status", func(t *testing.T) {
		err := ValidateNewTask(now, NewTaskInput{Title: "x", Status: "nope", DueAt: future})
		if err != ErrStatusInvalid {
			t.Fatalf("want ErrStatusInvalid, got %v", err)
		}
	})

	t.Run("invalid priority", func(t *testing.T) {
		err := ValidateNewTask(now, NewTaskInput{
			Title: "x", Status: StatusTodo, Priority: "mega", DueAt: future,
		})
		if err != ErrPriorityInvalid {
			t.Fatalf("want ErrPriorityInvalid, got %v", err)
		}
	})

	t.Run("due in past", func(t *testing.T) {
		past := now.Add(-time.Minute)
		err := ValidateNewTask(now, NewTaskInput{Title: "x", Status: StatusTodo, DueAt: past})
		if err != ErrDueAtInPast {
			t.Fatalf("want ErrDueAtInPast, got %v", err)
		}
	})

	t.Run("zero due", func(t *testing.T) {
		err := ValidateNewTask(now, NewTaskInput{Title: "x", Status: StatusTodo, DueAt: time.Time{}})
		if err != ErrDueAtZero {
			t.Fatalf("want ErrDueAtZero, got %v", err)
		}
	})

	t.Run("owner too long", func(t *testing.T) {
		err := ValidateNewTask(now, NewTaskInput{
			Title: "x", Status: StatusTodo, DueAt: future,
			Owner: strings.Repeat("a", MaxOwnerLen+1),
		})
		if err != ErrOwnerTooLong {
			t.Fatalf("want ErrOwnerTooLong, got %v", err)
		}
	})

	t.Run("too many tags", func(t *testing.T) {
		tags := make([]string, MaxTagsCount+1)
		for i := range tags {
			tags[i] = "t"
		}
		err := ValidateNewTask(now, NewTaskInput{
			Title: "x", Status: StatusTodo, DueAt: future, Tags: tags,
		})
		if err != ErrTooManyTags {
			t.Fatalf("want ErrTooManyTags, got %v", err)
		}
	})

	t.Run("tag too long", func(t *testing.T) {
		err := ValidateNewTask(now, NewTaskInput{
			Title: "x", Status: StatusTodo, DueAt: future,
			Tags:  []string{strings.Repeat("x", MaxTagLen+1)},
		})
		if err != ErrTagTooLong {
			t.Fatalf("want ErrTagTooLong, got %v", err)
		}
	})

	t.Run("defaults priority to normal when empty", func(t *testing.T) {
		err := ValidateNewTask(now, NewTaskInput{
			Title: "x", Status: StatusTodo, Priority: "", DueAt: future, Description: &desc,
		})
		if err != nil {
			t.Fatalf("expected nil, got %v", err)
		}
	})
}

func TestValidateStatusTransition(t *testing.T) {
	t.Run("empty next", func(t *testing.T) {
		if err := ValidateStatusTransition(StatusTodo, ""); err != ErrStatusEmpty {
			t.Fatalf("want ErrStatusEmpty, got %v", err)
		}
	})
	t.Run("unknown next", func(t *testing.T) {
		if err := ValidateStatusTransition(StatusTodo, "bogus"); err != ErrUnknownStatus {
			t.Fatalf("want ErrUnknownStatus, got %v", err)
		}
	})
	t.Run("no change", func(t *testing.T) {
		if err := ValidateStatusTransition(StatusTodo, StatusTodo); err != ErrStatusNoChange {
			t.Fatalf("want ErrStatusNoChange, got %v", err)
		}
	})
	t.Run("valid change", func(t *testing.T) {
		if err := ValidateStatusTransition(StatusTodo, StatusInProgress); err != nil {
			t.Fatal(err)
		}
	})
}

func TestValidateUpdateTask(t *testing.T) {
	t.Run("nil input", func(t *testing.T) {
		if err := ValidateUpdateTask(nil); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("empty title trim", func(t *testing.T) {
		s := "   "
		err := ValidateUpdateTask(&UpdateTaskInput{Title: &s})
		if err != ErrTitleRequired {
			t.Fatalf("want ErrTitleRequired, got %v", err)
		}
	})
	t.Run("invalid status", func(t *testing.T) {
		s := Status("bad")
		err := ValidateUpdateTask(&UpdateTaskInput{Status: &s})
		if err != ErrStatusInvalid {
			t.Fatalf("want ErrStatusInvalid, got %v", err)
		}
	})
	t.Run("invalid priority", func(t *testing.T) {
		p := Priority("nope")
		err := ValidateUpdateTask(&UpdateTaskInput{Priority: &p})
		if err != ErrPriorityInvalid {
			t.Fatalf("want ErrPriorityInvalid, got %v", err)
		}
	})
}
