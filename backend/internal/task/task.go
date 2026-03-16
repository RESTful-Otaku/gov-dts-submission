package task

import (
	"errors"
	"strings"
	"time"
)

// Status represents the lifecycle state of a task.
type Status string

const (
	StatusTodo       Status = "todo"
	StatusInProgress Status = "in_progress"
	StatusDone       Status = "done"
)

// ValidStatuses lists all supported task statuses.
var ValidStatuses = []Status{
	StatusTodo,
	StatusInProgress,
	StatusDone,
}

// Priority represents task priority.
type Priority string

const (
	PriorityLow    Priority = "low"
	PriorityNormal Priority = "normal"
	PriorityHigh   Priority = "high"
	PriorityUrgent Priority = "urgent"
)

// ValidPriorities lists all supported priorities.
var ValidPriorities = []Priority{
	PriorityLow,
	PriorityNormal,
	PriorityHigh,
	PriorityUrgent,
}

// Task represents a caseworker task.
type Task struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description *string   `json:"description,omitempty"`
	Status      Status    `json:"status"`
	Priority    Priority  `json:"priority"`
	Owner       string    `json:"owner,omitempty"`
	Tags        []string  `json:"tags,omitempty"`
	DueAt       time.Time `json:"dueAt"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// NewTaskInput captures the fields required to create a new task.
type NewTaskInput struct {
	Title       string
	Description *string
	Status      Status
	Priority    Priority
	Owner       string
	Tags        []string
	DueAt       time.Time
}

// UpdateTaskInput captures the fields that can be updated on an existing task.
// All fields are optional; only non-zero values are applied.
type UpdateTaskInput struct {
	Title       *string
	Description *string
	Status      *Status
	Priority    *Priority
	Tags        []string
}

const (
	MaxOwnerLen  = 255
	MaxTagLen    = 64
	MaxTagsCount = 20
)

var (
	ErrTitleRequired   = errors.New("title is required")
	ErrStatusInvalid   = errors.New("status is invalid")
	ErrDueAtInPast     = errors.New("due_at must not be in the past")
	ErrStatusRequired  = errors.New("status is required")
	ErrDueAtZero       = errors.New("due_at is required")
	ErrStatusNoChange  = errors.New("status is unchanged")
	ErrStatusEmpty     = errors.New("status cannot be empty")
	ErrUnknownStatus   = errors.New("unknown status")
	ErrPriorityInvalid = errors.New("priority is invalid")
	ErrOwnerTooLong    = errors.New("owner exceeds maximum length")
	ErrTagTooLong      = errors.New("tag exceeds maximum length")
	ErrTooManyTags     = errors.New("too many tags")
)

// ValidateNewTask ensures incoming data for creating a task is valid.
func ValidateNewTask(now time.Time, in NewTaskInput) error {
	if in.Title == "" {
		return ErrTitleRequired
	}
	if in.Status == "" {
		return ErrStatusRequired
	}
	if !isValidStatus(in.Status) {
		return ErrStatusInvalid
	}
	priority := in.Priority
	if priority == "" {
		priority = PriorityNormal
	}
	if !isValidPriority(priority) {
		return ErrPriorityInvalid
	}
	if len(in.Owner) > MaxOwnerLen {
		return ErrOwnerTooLong
	}
	if len(in.Tags) > MaxTagsCount {
		return ErrTooManyTags
	}
	for _, tag := range in.Tags {
		if len(tag) > MaxTagLen {
			return ErrTagTooLong
		}
	}
	if in.DueAt.IsZero() {
		return ErrDueAtZero
	}
	if in.DueAt.Before(now) {
		return ErrDueAtInPast
	}
	return nil
}

// ValidateStatusTransition validates updating a task's status.
func ValidateStatusTransition(current Status, next Status) error {
	if next == "" {
		return ErrStatusEmpty
	}
	if !isValidStatus(next) {
		return ErrUnknownStatus
	}
	if current == next {
		return ErrStatusNoChange
	}
	return nil
}

func isValidStatus(s Status) bool {
	for _, v := range ValidStatuses {
		if v == s {
			return true
		}
	}
	return false
}

func isValidPriority(p Priority) bool {
	for _, v := range ValidPriorities {
		if v == p {
			return true
		}
	}
	return false
}

// ValidateUpdateTask validates update input. Title if provided must be non-empty;
// priority if provided must be valid; tags are validated for count and length.
func ValidateUpdateTask(in *UpdateTaskInput) error {
	if in == nil {
		return nil
	}
	if in.Title != nil {
		if strings.TrimSpace(*in.Title) == "" {
			return ErrTitleRequired
		}
	}
	if in.Status != nil {
		if !isValidStatus(*in.Status) {
			return ErrStatusInvalid
		}
	}
	if in.Priority != nil {
		if !isValidPriority(*in.Priority) {
			return ErrPriorityInvalid
		}
	}
	if in.Tags != nil {
		if len(in.Tags) > MaxTagsCount {
			return ErrTooManyTags
		}
		for _, tag := range in.Tags {
			if len(tag) > MaxTagLen {
				return ErrTagTooLong
			}
		}
	}
	return nil
}

