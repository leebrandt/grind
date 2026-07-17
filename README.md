# grind

CLI tool for managing creative/technical projects from idea to publication.

## Installation

```bash
# Install dependencies
bun install

# Build to single binary
bun run build

# Move to PATH (optional)
sudo mv grind /usr/local/bin/
```

## Usage

```bash
# Initialize a workspace (in ~/work or similar)
cd ~/work
grind init
# Creates: .grind.repo.git/ (bare repo) + grind/ (main worktree)

# Clone an existing grind workspace from a remote
grind clone git@github.com:user/my-workspace.git
grind clone git@github.com:user/my-workspace.git my-dir  # Custom directory name

# Work from the main worktree
cd grind

# Create a new idea
grind new idea "My brilliant idea"

# List ideas for triage
grind list ideas              # or: grind ideas
grind list ideas -a           # Include rejected ideas
grind list ideas -r           # Show only rejected ideas

# Reject an idea
grind reject idea 2

# Prune rejected ideas (permanently delete)
grind prune ideas

# Create a project from an idea (use idea number from 'grind list ideas')
grind new project "rust-memory-management" 0 -t blog
# Creates: ~/work/rust-memory-management/ as a new worktree

# List projects
grind list projects           # or: grind projects

# Start working (starts timer, opens editor)
grind work rust-memory-management
grind work rust-memory-management -c  # Open code directory instead of project directory
grind work rust-memory-management -q  # Open editor without starting a timer
grind work rust-memory-management -s  # Save work (end timer, commit, push)

# Open editor without starting a timer
grind edit rust-memory-management       # Open project writing directory
grind edit idea 2                        # Open an idea file in $EDITOR

# Open code editor in project's code directory (no timer)
grind code rust-memory-management

# Cancel (abandon) a project
grind cancel rust-memory-management
grind cancel rust-memory-management -f  # Force even with uncommitted changes
grind cancel rust-memory-management -y  # Skip confirmation prompt

# Save work (stops timer, commits changes)
grind save rust-memory-management
grind save rust-memory-management -q  # Quick save with auto-generated commit message
grind save rust-memory-management -t 2.5  # Backfill: end session at start + 2.5h
grind save rust-memory-management -y  # Skip interactive commit (same as -q)

# Show project info
grind show rust-memory-management          # Print the idea
grind show rust-memory-management -s       # Show session details
grind show rust-memory-management -b       # Show billing summary
grind show rust-memory-management --config # Show raw config JSON

# Project dashboard (shows all projects with time, commits, issues)
grind status

# Generate invoice for unbilled sessions
grind invoice rust-memory-management

# Create issues/features on GitHub or GitLab (requires 'repo' config)
grind new issue my-project -m "Bug in login"       # Create issue
grind new feature my-project -m "Add dark mode"     # Create feature request
grind new issue my-project                          # Opens editor for message

# Publish project (merge to default branch)
grind publish rust-memory-management
grind publish rust-memory-management -d   # Also delete worktree (prompts for confirmation)
grind publish rust-memory-management -D   # Delete worktree and branch (prompts for confirmation)
grind publish rust-memory-management -D -y  # Skip confirmation prompt
grind publish rust-memory-management -u https://example.com/post  # Record publication URL

# Configuration
grind config -g billing.defaultRate 125   # Set workspace default rate
grind config -g billing.roundTo half-hour # Set workspace rounding
grind config -g projectTypes "blog,webapp,video,podcast"  # Override project types
grind config -g defaultBranch main        # Set custom default branch name
grind config billing.rate 85              # Set project-specific rate
grind config -p my-project repo git@github.com:owner/repo.git  # Set project repo
grind config -p my-project code src                          # Set code directory
grind config -p my-project longTerm true                      # Mark as long-running (shows ★)
grind config -g --list                    # Show workspace config
grind config --list                       # Show project config
```

## Project Structure

Uses git worktrees to isolate each project while sharing history:

```
~/work/                          # workspace root (run grind init here)
├── .grind.repo.git/             # bare repo (shared git database)
├── grind/                       # main worktree (default branch)
│   ├── .grind.json              # workspace config (billing defaults, defaultBranch, projectTypes, professional info)
│   ├── ideas/                   # timestamped markdown files
│   │   └── 20260125051508.md
│   └── projects/                # project configs (shared across worktrees)
│       ├── my-blog-post/
│       │   └── .project.json    # time tracking & billing config
│       └── cool-webapp/
│           └── .project.json
├── my-blog-post/                # project worktree (tracks "my-blog-post" branch)
│   └── projects/
│       └── my-blog-post/
│           └── post.md          # your work files here
└── cool-webapp/                 # another project worktree
    └── projects/
        └── cool-webapp/
            └── [project files]
```

Each project is a git worktree with its own branch, all sharing the same underlying repository.

## Config Files

### .grind.json (workspace defaults)

```json
{
  "billing": {
    "roundTo": "quarter-hour",
    "defaultRate": 150
  },
  "projectTypes": ["blog", "webapp", "video", "podcast", "saas"],
  "defaultBranch": "main",
  "my": {
    "name": "Jane Doe",
    "company": "Acme LLC",
    "address": "123 Main St",
    "phone": "555-1234",
    "email": "jane@acme.com",
    "taxId": "12-3456789"
  },
  "currency": "USD",
  "paymentTerms": "Net 30"
}
```

### .project.json

Located in `grind/projects/{project-name}/.project.json` and shared across all worktrees:

```json
{
  "name": "rust-memory-management",
  "type": "blog",
  "idea": "# Blog post about Rust\n\nExplaining memory management...",
  "time": [
    {
      "start": "2024-01-15T10:00:00Z",
      "end": "2024-01-15T11:30:00Z",
      "duration": 5400,
      "rounded": 5400,
      "invoiced": false
    }
  ],
  "billing": {
    "roundTo": "quarter-hour",
    "rate": 150
  },
  "client": {
    "contact": "John Smith",
    "company": "Client Corp",
    "address": "456 Oak Ave",
    "phone": "555-5678",
    "email": "john@clientcorp.com"
  },
  "repo": "git@github.com:owner/repo.git",
  "code": "src",
  "longTerm": false,
  "deadline": "2026-08-15",
  "publications": [
    {
      "url": "https://example.com/my-post",
      "publishedAt": "2024-01-20T10:00:00Z"
    }
  ]
}
```

## Project Types

Default types:
- `blog` - Blog posts and articles
- `webapp` - Web applications
- `video` - Video content
- `song` - Music/audio content
- `book` - Books and long-form writing
- `feature` - Feature development
- `issue` - Issue/bug fix

Override with `grind config -g projectTypes "custom,types,here"`

## Development

```bash
# Run in dev mode
bun run dev -- new idea "test"

# Type check
bun run typecheck

# Run tests
bun run test
```
