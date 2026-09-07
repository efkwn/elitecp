package main

import "testing"

func TestCPUPercent(t *testing.T) {
	got := cpuPercent(cpuTimes{idle: 40, total: 100}, cpuTimes{idle: 60, total: 200})
	if got != 80 {
		t.Fatalf("cpuPercent = %v, want 80", got)
	}
}

func TestPercentClamp(t *testing.T) {
	if got := percent(50, 200); got != 25 {
		t.Fatalf("percent = %v, want 25", got)
	}
	if got := percent(300, 200); got != 100 {
		t.Fatalf("percent clamp = %v, want 100", got)
	}
}
