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

# Work from the main worktree
cd grind

# Create a new idea
grind new idea "My brilliant idea"
grind new idea "Blog post about Rust" -t blog

# List ideas for triage
grind list ideas

# Create a project from an idea (use idea number from 'grind list ideas')
grind new project "rust-memory-management" 0 -t blog
# Creates: ~/work/rust-memory-management/ as a new worktree

# Start working (starts timer, opens nvim)
grind work rust-memory-management

# Save work (stops timer, commits changes)
grind save rust-memory-management

# Review/finalize with LLM (future)
grind review post.md
grind finalize post.md

# Publish to site repos (future)
grind publish post.md

# Trigger promo workflow (future)
grind promo rust-memory-management

# Configuration
grind config -g billing.defaultRate 125   # Set workspace default rate
grind config -g billing.roundTo half-hour # Set workspace rounding
grind config billing.rate 85              # Set project-specific rate
grind config -g --list                    # Show workspace config
grind config --list                       # Show project config
```

## Project Structure

Uses git worktrees to isolate each project while sharing history:

```
~/work/                          # workspace root (run grind init here)
├── .grind.repo.git/             # bare repo (shared git database)
├── grind/                       # main worktree (tracks "main" branch)
│   ├── .grind.json              # workspace config (billing defaults)
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
  }
}
```

### .project.json

Located in `grind/projects/{project-name}/.project.json` and shared across all worktrees:

```json
{
  "name": "rust-memory-management",
  "idea": "# Blog post about Rust\n\nExplaining memory management...",
  "time": [
    {
      "start": "2024-01-15T10:00:00Z",
      "end": "2024-01-15T11:30:00Z",
      "duration": 5400,
      "rounded": 5400
    }
  ],
  "billing": {
    "roundTo": "quarter-hour",
    "rate": 150
  }
}
```

### .publish.json

(Future feature - not yet implemented)

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
