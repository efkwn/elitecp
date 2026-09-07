package main

import (
	"strings"
	"testing"
)

func TestBootstrapPythonPipeline(t *testing.T) {
	d := NewDockerManager(t.TempDir())
	b := Bot{
		ID:             "abc12345",
		Runtime:        "python",
		DependencyFile: "requirements.txt",
		MainFile:       "bot.py",
		InstallCommand: "python -m pip install -r {{dependency_file}}",
		Startup:        "python {{main_file}}",
	}
	script := d.bootstrapCommand(b)
	checks := []string{
		"/app/.elitecp/venv",
		". /app/.elitecp/venv/bin/activate",
		"python -m pip install -r 'requirements.txt'",
		"exec python 'bot.py'",
		"[1/3]",
		"[2/3]",
		"[3/3]",
	}
	for _, want := range checks {
		if !strings.Contains(script, want) {
			t.Fatalf("bootstrap script missing %q\n%s", want, script)
		}
	}
	if strings.Index(script, "Installing dependencies") > strings.Index(script, "Starting application") {
		t.Fatal("dependency installation must happen before startup")
	}
}

func TestRenderBotCommandQuotesFileNames(t *testing.T) {
	b := Bot{DependencyFile: "deps/requirements.txt", MainFile: "src/bot.py"}
	got := renderBotCommand("python {{main_file}} && cat {{dependency_file}}", b)
	if got != "python 'src/bot.py' && cat 'deps/requirements.txt'" {
		t.Fatalf("unexpected rendered command: %s", got)
	}
}

func TestRuntimeDefaults(t *testing.T) {
	py := defaultRuntime("python")
	if py.MainFile != "bot.py" || py.DependencyFile != "requirements.txt" || !strings.Contains(py.Startup, "{{main_file}}") {
		t.Fatalf("unexpected python defaults: %#v", py)
	}
	node := defaultRuntime("node")
	if node.MainFile != "index.js" || node.DependencyFile != "package.json" {
		t.Fatalf("unexpected node defaults: %#v", node)
	}
}
