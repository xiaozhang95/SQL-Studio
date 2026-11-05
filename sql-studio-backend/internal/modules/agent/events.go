package agent

import model "sql-studio-backend/internal/model/agent"

// Streaming transport remains granular. Durable history keeps one text per phase.
func appendEvent(events []model.Event, e model.Event) []model.Event {
	if n := len(events); n > 0 && (e.Type == "reasoning_delta" || e.Type == "answer_delta") && events[n-1].Type == e.Type {
		e.Text = events[n-1].Text + e.Text
		events[n-1] = e
		return events
	}
	if e.Type == "answer" {
		start := len(events)
		for start > 0 && events[start-1].Type != "model_start" && events[start-1].Type != "user" && events[start-1].Type != "turn_end" {
			start--
		}
		kept := events[:start]
		for _, prior := range events[start:] {
			if prior.Type != "answer_delta" {
				kept = append(kept, prior)
			}
		}
		events = kept
	}
	return append(events, e)
}
