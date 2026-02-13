import { $ } from "bun";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { findMainWorktree, findBareRepo } from "../utils/workspace.js";
import { getCommitCount, getFirstCommitDate, getLastCommitDate } from "../utils/git.js";
import { timeAgo, formatDate } from "../utils/time.js";
import { parseRepoUrl } from "../utils/repo.js";
import type { ProjectConfig } from "../types/index.js";

const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

interface ProjectRow {
  name: string;
  startDate: string;
  hoursWorked: string;
  hoursBilled: string;
  issues: string;
  commits: string;
  lastSession: string;
  lastCommit: string;
  hasChanges: boolean;
  hasUnbilled: boolean;
  sortKey: number; // for sorting by last session date
}

async function getIssueCount(repo: string): Promise<string> {
  const info = parseRepoUrl(repo);
  if (!info) {
    // Try as owner/repo shorthand (assume GitHub)
    if (repo.includes("/") && !repo.includes(":") && !repo.includes("//")) {
      try {
        const result = await $`gh issue list --repo ${repo} --state open --json number`.quiet();
        const issues = JSON.parse(result.stdout.toString().trim());
        return String(issues.length);
      } catch {
        return "?";
      }
    }
    return "?";
  }

  try {
    if (info.platform === "github") {
      const result = await $`gh issue list --repo ${info.repo} --state open --json number`.quiet();
      const issues = JSON.parse(result.stdout.toString().trim());
      return String(issues.length);
    } else {
      const result = await $`glab issue list --repo ${info.repo} -O json`.quiet();
      const issues = JSON.parse(result.stdout.toString().trim());
      return String(Array.isArray(issues) ? issues.length : 0);
    }
  } catch {
    return "?";
  }
}

export async function status(): Promise<void> {
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Not in a grind workspace. Run 'grind init' first.");
    process.exit(1);
  }

  const bareRepo = await findBareRepo(process.cwd());
  if (!bareRepo) {
    console.error("Error: Could not find bare repo.");
    process.exit(1);
  }

  // Get active worktrees from git
  const result = await $`git -C ${bareRepo} worktree list --porcelain`.quiet();
  const output = result.stdout.toString();

  const workspaceRoot = path.dirname(bareRepo);
  const worktreeNames: string[] = [];
  for (const line of output.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    const worktreePath = line.replace("worktree ", "");
    const name = path.relative(workspaceRoot, worktreePath);
    if (name === "grind" || worktreePath === bareRepo) continue;
    worktreeNames.push(name);
  }

  // Load project configs
  const projects: { config: ProjectConfig; name: string; branch: string }[] = [];
  for (const name of worktreeNames) {
    const configPath = path.join(workspaceRoot, name, "projects", name, ".project.json");
    try {
      const content = await readFile(configPath, "utf-8");
      projects.push({ config: JSON.parse(content), name, branch: name });
    } catch {
      continue;
    }
  }

  if (projects.length === 0) {
    console.log("No active projects. Create one with: grind new project \"name\" <idea-number>");
    return;
  }

  // Build rows in parallel
  const rowPromises = projects.map(async ({ config, name, branch }): Promise<ProjectRow> => {
    // Git queries
    const worktreePath = path.join(workspaceRoot, name);
    const [commitCount, firstCommitDate, lastCommitDate, issueCount, hasChanges] = await Promise.all([
      getCommitCount(bareRepo, branch),
      getFirstCommitDate(bareRepo, branch),
      getLastCommitDate(bareRepo, branch),
      config.repo ? getIssueCount(config.repo) : Promise.resolve("—"),
      $`git -C ${worktreePath} status --porcelain`.quiet().then(r => r.stdout.toString().trim().length > 0).catch(() => false),
    ]);

    // Time calculations
    const totalSeconds = config.time.reduce((sum, s) => sum + s.rounded, 0);
    const billedSeconds = config.time.filter(s => s.invoiced).reduce((sum, s) => sum + s.rounded, 0);
    const totalHours = (totalSeconds / 3600).toFixed(1);
    const billedHours = (billedSeconds / 3600).toFixed(1);
    const hasUnbilled = totalSeconds > billedSeconds;

    // Last session
    const sessions = config.time;
    const lastSessionDate = sessions.length > 0 ? sessions[sessions.length - 1].start : null;
    const lastSessionDisplay = lastSessionDate ? timeAgo(new Date(lastSessionDate)) : "never";

    // Sort key: last session timestamp (0 for never)
    const sortKey = lastSessionDate ? new Date(lastSessionDate).getTime() : 0;

    return {
      name: config.name,
      startDate: firstCommitDate ? formatDate(firstCommitDate) : "—",
      hoursWorked: `${totalHours}h`,
      hoursBilled: `${billedHours}h`,
      issues: issueCount,
      commits: String(commitCount),
      lastSession: lastSessionDisplay,
      lastCommit: lastCommitDate ? timeAgo(new Date(lastCommitDate)) : "never",
      hasChanges,
      hasUnbilled,
      sortKey,
    };
  });

  const rows = await Promise.all(rowPromises);

  // Sort by last session ascending (most neglected first, never-worked at top)
  rows.sort((a, b) => {
    if (a.sortKey === 0 && b.sortKey === 0) return a.name.localeCompare(b.name);
    if (a.sortKey === 0) return -1;
    if (b.sortKey === 0) return 1;
    return a.sortKey - b.sortKey;
  });

  // Calculate column widths
  const cols = {
    name: Math.max("Project".length, ...rows.map(r => r.name.length)),
    startDate: Math.max("Started".length, ...rows.map(r => r.startDate.length)),
    hoursWorked: Math.max("Worked".length, ...rows.map(r => r.hoursWorked.length)),
    hoursBilled: Math.max("Billed".length, ...rows.map(r => r.hoursBilled.length)),
    issues: Math.max("Issues".length, ...rows.map(r => r.issues.length)),
    commits: Math.max("Commits".length, ...rows.map(r => r.commits.length)),
    lastSession: Math.max("Last Session".length, ...rows.map(r => r.lastSession.length)),
    lastCommit: Math.max("Last Commit".length, ...rows.map(r => r.lastCommit.length)),
  };

  // Header
  const header = `  ${"Project".padEnd(cols.name)}  ${"Started".padEnd(cols.startDate)}  ${"Worked".padStart(cols.hoursWorked)}  ${"Billed".padStart(cols.hoursBilled)}  ${"Issues".padStart(cols.issues)}  ${"Commits".padStart(cols.commits)}  ${"Last Session".padEnd(cols.lastSession)}  ${"Last Commit".padEnd(cols.lastCommit)}`;
  const divider = `  ${"─".repeat(cols.name)}  ${"─".repeat(cols.startDate)}  ${"─".repeat(cols.hoursWorked)}  ${"─".repeat(cols.hoursBilled)}  ${"─".repeat(cols.issues)}  ${"─".repeat(cols.commits)}  ${"─".repeat(cols.lastSession)}  ${"─".repeat(cols.lastCommit)}`;

  console.log(`${DIM}${header}${RESET}`);
  console.log(`${DIM}${divider}${RESET}`);

  for (const row of rows) {
    // Highlight: red = no sessions or uncommitted changes, green = unbilled hours
    const paddedName = row.name.padEnd(cols.name);
    let nameDisplay: string;
    if (row.sortKey === 0 || row.hasChanges) {
      nameDisplay = `${RED}${paddedName}${RESET}`;
    } else if (row.hasUnbilled) {
      nameDisplay = `${GREEN}${paddedName}${RESET}`;
    } else {
      nameDisplay = paddedName;
    }

    console.log(`  ${nameDisplay}  ${row.startDate.padEnd(cols.startDate)}  ${row.hoursWorked.padStart(cols.hoursWorked)}  ${row.hoursBilled.padStart(cols.hoursBilled)}  ${row.issues.padStart(cols.issues)}  ${row.commits.padStart(cols.commits)}  ${row.lastSession.padEnd(cols.lastSession)}  ${row.lastCommit.padEnd(cols.lastCommit)}`);
  }
}
