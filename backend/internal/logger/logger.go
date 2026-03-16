package logger

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"
)

// JSON writes a single JSON object to stdout when LOG_JSON=true.
func JSON(level, msg string, keysAndValues ...interface{}) {
	obj := map[string]interface{}{
		"time":  time.Now().UTC().Format(time.RFC3339),
		"level": level,
		"msg":   msg,
	}
	for i := 0; i+1 < len(keysAndValues); i += 2 {
		if k, ok := keysAndValues[i].(string); ok {
			obj[k] = keysAndValues[i+1]
		}
	}
	_ = json.NewEncoder(os.Stdout).Encode(obj)
}

// IsJSON returns true if LOG_JSON is set to a truthy value.
func IsJSON() bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("LOG_JSON")))
	return v == "1" || v == "true" || v == "yes"
}

func formatMsg(format string, args ...interface{}) string {
	if len(args) == 0 {
		return format
	}
	return fmt.Sprintf(format, args...)
}

// Info logs an info-level message.
func Info(format string, args ...interface{}) {
	msg := formatMsg(format, args...)
	if IsJSON() {
		JSON("info", msg)
		return
	}
	log.Print(msg)
}

// Error logs an error-level message.
func Error(format string, args ...interface{}) {
	msg := formatMsg(format, args...)
	if IsJSON() {
		JSON("error", msg)
		return
	}
	log.Print("ERROR: " + msg)
}

