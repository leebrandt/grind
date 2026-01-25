# grind (gd)

CLI tool for managing creative/technical projects from idea to publication.

## Installation

```bash
# Install dependencies
bun install

# Build to single binary
bun run build

# Move to PATH (optional)
sudo mv gd /usr/local/bin/
```

## Usage

```bash
# Initialize a workspace (in ~/work or similar)
cd ~/work
gd init
# Creates: .grind.repo.git/ (bare repo) + grind/ (main worktree)

# Work from the main worktree
cd grind

# Create a new idea
gd new idea "My brilliant idea"
gd new idea "Blog post about Rust" -t blog

# List ideas for triage
gd list ideas

# Create a project (creates sibling worktree)
gd new project "rust-memory-management" -t blog
# Creates: ~/work/rust-memory-management/ as a new worktree

# Start working (starts timer, opens nvim)
cd ../rust-memory-management
gd work

# Save work (stops timer, commits changes)
gd save

# Review/finalize with LLM (future)
gd review post.md
gd finalize post.md

# Publish to site repos
gd publish post.md

# Trigger promo workflow
gd promo

# Configuration
gd config -g billing.defaultRate 125   # Set workspace default rate
gd config -g billing.roundTo half-hour # Set workspace rounding
gd config billing.rate 85              # Set project-specific rate
gd config -g --list                    # Show workspace config
gd config --list                       # Show project config
```

## Project Structure

Uses git worktrees to isolate each project while sharing history:

```
~/work/                          # workspace root (run gd init here)
├── .grind.repo.git/             # bare repo (shared git database)
├── grind/                       # main worktree (tracks "main" branch)
│   ├── .grind.json              # workspace config (billing defaults)
│   └── ideas/                   # timestamped markdown files
│       └── 20260125-my-idea.md
├── my-blog-post/                # project worktree (tracks "my-blog-post" branch)
│   ├── .time.json               # time tracking
│   ├── .publish.json            # publishing metadata
│   └── post.md
└── cool-webapp/                 # another project worktree
    ├── .time.json
    ├── .publish.json
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
  }
}
```

### .publish.json

```json
{
  "projectType": "blog",
  "slug": "auto-generated-from-title",
  "sites": {
    "hip": { "url": "", "publishedAt": "" },
    "gmh": { "url": "", "publishedAt": "" }
  }
}
```

### .time.json

```json
{
  "sessions": [
    { "start": "2024-01-15T10:00:00Z", "end": "2024-01-15T11:30:00Z", "duration": 5400, "rounded": 5400 }
  ],
  "totalSeconds": 5400,
  "billableHours": 1.5,
  "billing": {
    "roundTo": "quarter-hour",
    "rate": 200
  }
}
```

## Project Types

- `blog` - Blog posts and articles
- `webapp` - Web applications
- `video` - Video content
- `song` - Music/audio content

## Development

```bash
# Run in dev mode
bun run dev -- new idea "test"

# Type check
bun run typecheck
```
