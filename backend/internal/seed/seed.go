package seed

import (
	"context"
	"database/sql"
	"math/rand"
	"time"

	"github.com/j-m-harrison/dts-submission/internal/logger"
	"github.com/j-m-harrison/dts-submission/internal/storage"
	"github.com/j-m-harrison/dts-submission/internal/task"
)

// DemoTasks inserts demo tasks if the store is empty.
func DemoTasks(ctx context.Context, db *sql.DB) error {
	return DemoTasksStore(ctx, storage.NewStoreFromDB(db))
}

// DemoTasksStore inserts demo tasks if the given store is empty.
// This enables seeding for non-SQL backends (e.g. MongoDB) while sharing the
// same demo dataset.
func DemoTasksStore(ctx context.Context, store storage.Store) error {
	existing, err := store.ListTasks(ctx)
	if err != nil {
		return err
	}
	existingTitles := make(map[string]struct{}, len(existing))
	for _, t := range existing {
		if t == nil {
			continue
		}
		existingTitles[t.Title] = struct{}{}
	}

	now := time.Now().UTC()
	type tmpl struct {
		Title       string
		Description string
		Status      task.Status
		Priority    task.Priority
		Owner       string
		Tags        []string
		DueDays     int
	}

	templates := []tmpl{
		{"Review case bundle", "Check evidence and witness statements before the hearing.", task.StatusTodo, task.PriorityHigh, "Sarah Chen", []string{"evidence", "bundle", "hearing"}, 0},
		{"Prepare hearing notes", "Summarise key points and authorities for the judge.", task.StatusInProgress, task.PriorityNormal, "James Wilson", []string{"hearing", "judge", "notes"}, 1},
		{"Chase respondent response", "Email respondent's solicitor for outstanding response.", task.StatusTodo, task.PriorityNormal, "Sarah Chen", []string{"correspondence", "respondent", "deadline"}, 2},
		{"Draft order", "Prepare draft order for judge approval.", task.StatusInProgress, task.PriorityHigh, "James Wilson", []string{"draft", "order", "judge"}, 3},
		{"Update case management system", "Enter latest hearing outcome and next steps.", task.StatusDone, task.PriorityLow, "Priya Patel", []string{"cms", "admin", "data-entry"}, 0},
		{"Schedule case conference", "Arrange case conference and send invites.", task.StatusTodo, task.PriorityNormal, "Sarah Chen", []string{"conference", "listing", "diary"}, 5},
		{"Review safeguarding concerns", "Review safeguarding notes and escalate if needed.", task.StatusInProgress, task.PriorityUrgent, "James Wilson", []string{"safeguarding", "compliance", "escalation"}, 1},
		{"Send directions to parties", "Issue standard directions and file copy.", task.StatusTodo, task.PriorityNormal, "Priya Patel", []string{"directions", "correspondence", "filing"}, 4},
		{"Prepare summary for judge", "Create one-page case summary for pre-reading.", task.StatusTodo, task.PriorityHigh, "Sarah Chen", []string{"summary", "hearing", "pre-reading"}, 6},
		{"Check compliance with previous order", "Confirm parties have complied with directions.", task.StatusInProgress, task.PriorityNormal, "Priya Patel", []string{"compliance", "directions", "follow-up"}, 7},
		{"File correspondence", "File recent correspondence to digital case file.", task.StatusDone, task.PriorityLow, "James Wilson", []string{"filing", "admin", "correspondence"}, 8},
		{"List case for review", "Ensure 4-week review is listed and parties notified.", task.StatusTodo, task.PriorityNormal, "Sarah Chen", []string{"listing", "review", "diary"}, 10},
		{"Confirm interpreter booking", "Check interpreter confirmed and parties informed.", task.StatusTodo, task.PriorityHigh, "James Wilson", []string{"interpreter", "hearing", "accessibility"}, 9},
		{"Update hearing bundle index", "Update index after new documents received.", task.StatusInProgress, task.PriorityNormal, "Priya Patel", []string{"bundle", "hearing", "index"}, 12},
		{"Arrange remote hearing link", "Send video link and joining instructions to parties.", task.StatusTodo, task.PriorityNormal, "Sarah Chen", []string{"remote", "hearing", "video"}, 11},
		{"Chase expert report", "Follow up with expert for draft report.", task.StatusInProgress, task.PriorityNormal, "James Wilson", []string{"expert", "evidence", "report"}, 14},
		{"Record adjournment reasons", "Enter adjournment reasons into case system.", task.StatusDone, task.PriorityLow, "Priya Patel", []string{"admin", "hearing", "adjournment"}, 8},
		{"Close legacy paper file", "Confirm closed and archived; update records.", task.StatusDone, task.PriorityLow, "Sarah Chen", []string{"archive", "admin", "closure"}, 13},
		{"Check disclosure compliance", "Ensure disclosure has been complied with.", task.StatusTodo, task.PriorityNormal, "James Wilson", []string{"disclosure", "compliance", "audit"}, 18},
		{"Send reminder to applicant", "Remind applicant of upcoming deadline.", task.StatusTodo, task.PriorityNormal, "Priya Patel", []string{"correspondence", "deadline", "reminder"}, 20},
		{"Prepare chronology", "Draft timeline of events for the bundle.", task.StatusInProgress, task.PriorityHigh, "Sarah Chen", []string{"chronology", "bundle", "timeline"}, 21},
		{"Update contact details", "Verify and update parties' contact details.", task.StatusDone, task.PriorityLow, "James Wilson", []string{"admin", "contacts", "data"}, 15},
		{"Confirm attendance of witnesses", "Check witness attendance and availability.", task.StatusTodo, task.PriorityNormal, "Sarah Chen", []string{"witnesses", "hearing", "attendance"}, 24},
		{"Redact sensitive information", "Redact documents where required before disclosure.", task.StatusInProgress, task.PriorityHigh, "James Wilson", []string{"redaction", "disclosure", "gdpr"}, 22},
		{"Upload audio recording", "Upload hearing recording to case file.", task.StatusDone, task.PriorityLow, "Priya Patel", []string{"audio", "admin", "recording"}, 16},
		{"Prepare directions questionnaire", "Review and file directions questionnaire.", task.StatusTodo, task.PriorityNormal, "Sarah Chen", []string{"questionnaire", "directions", "forms"}, 28},
		{"Flag urgent cases", "Mark cases for priority handling and allocation.", task.StatusInProgress, task.PriorityUrgent, "James Wilson", []string{"urgent", "allocation", "triage"}, 17},
		{"Review pending applications", "Scan and triage new applications.", task.StatusTodo, task.PriorityNormal, "Priya Patel", []string{"applications", "triage", "intake"}, 19},
		{"Notify parties of decision", "Send written decision and appeal rights.", task.StatusDone, task.PriorityNormal, "Sarah Chen", []string{"decision", "correspondence", "appeal-rights"}, 30},
		{"Quality check case file", "Run quality checklist and fix any gaps.", task.StatusInProgress, task.PriorityNormal, "James Wilson", []string{"quality", "compliance", "audit"}, 35},
		{"Liaise with legal team", "Discuss merits and next steps with legal.", task.StatusTodo, task.PriorityHigh, "Priya Patel", []string{"legal", "strategy", "advisory"}, 42},
		{"Request extension of time", "Consider and draft extension request if needed.", task.StatusTodo, task.PriorityNormal, "Sarah Chen", []string{"deadline", "directions", "extension"}, 45},
		{"Prepare cost summary", "Draft summary of costs for assessment.", task.StatusInProgress, task.PriorityLow, "James Wilson", []string{"costs", "assessment", "billing"}, 50},
		{"Arrange mediation", "Contact mediation service and propose dates.", task.StatusTodo, task.PriorityNormal, "Sarah Chen", []string{"mediation", "listing", "adr"}, 56},
		{"Finalise appeal bundle", "Compile and index appeal bundle for filing.", task.StatusTodo, task.PriorityHigh, "James Wilson", []string{"appeal", "bundle", "index"}, 60},
		{"Chase outstanding disclosure", "Follow up on any outstanding disclosure items.", task.StatusInProgress, task.PriorityNormal, "Priya Patel", []string{"disclosure", "compliance", "follow-up"}, 70},
		{"Pre-hearing review", "Complete pre-hearing review and checklist.", task.StatusTodo, task.PriorityNormal, "Sarah Chen", []string{"hearing", "review", "checklist"}, 77},
		{"Close case and archive", "Final closure and archive once all steps complete.", task.StatusTodo, task.PriorityLow, "James Wilson", []string{"archive", "closure", "completion"}, 84},
	}

	rnd := rand.New(rand.NewSource(now.UnixNano()))
	rnd.Shuffle(len(templates), func(i, j int) { templates[i], templates[j] = templates[j], templates[i] })

	seeded := 0
	for _, tmpl := range templates {
		if _, ok := existingTitles[tmpl.Title]; ok {
			continue
		}
		dueAt := now.AddDate(0, 0, tmpl.DueDays)
		dueAt = time.Date(dueAt.Year(), dueAt.Month(), dueAt.Day(), 9, 0, 0, 0, time.UTC)
		for !dueAt.After(now) {
			dueAt = dueAt.AddDate(0, 0, 1)
		}
		desc := tmpl.Description
		in := task.NewTaskInput{
			Title:       tmpl.Title,
			Description: &desc,
			Status:      tmpl.Status,
			Priority:    tmpl.Priority,
			Owner:       tmpl.Owner,
			Tags:        tmpl.Tags,
			DueAt:       dueAt,
		}
		if err := task.ValidateNewTask(now, in); err != nil {
			return err
		}
		if _, err := store.CreateTask(ctx, in); err != nil {
			return err
		}
		seeded++
	}
	if seeded > 0 {
		logger.Info("seeded %d demo tasks", seeded)
	}
	return nil
}

