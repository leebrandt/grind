// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { DIM, RED, RESET } from "../utils/colors.js";
import { timeAgo } from "../utils/time.js";
import { collectProjects } from "../utils/project.js";
import type { ProjectConfig } from "../types/index.js";
import type { ProjectEntry } from "../utils/project.js";

/**
 * List all idea files for triage
 * grind list ideas [-a|--all] [-r|--rejected]
 */
export async function listIdeas(options?: {
  all?: boolean;
  rejected?: boolean;
}): Promise<void> {
  const { mainWorktree } = await requireWorkspace();

  const ideasDir = path.join(mainWorktree, "ideas");

  // Get all files, sorted by filename (chronological)
  let files = await readdir(ideasDir);
  files.sort(); // Timestamp filenames sort chronologically

  // Filter based on options
  if (options?.rejected) {
    // Show only rejected ideas
    files = files.filter(file => file.startsWith("rejected-"));
  } else if (!options?.all) {
    // Default: show only non-rejected ideas
    files = files.filter(file => !file.startsWith("rejected-"));
  }
  // If options.all is true, show all files (no filtering)

  if (files.length === 0) {
    if (options?.rejected) {
      console.log("No rejected ideas.");
    } else {
      console.log("No ideas yet. Create one with: grind new idea \"Your idea\"");
    }
    return;
  }

  // Display numbered list
  for (let i = 0; i < files.length; i++) {
    const filepath = path.join(ideasDir, files[i]);
    const content = await readFile(filepath, "utf-8");
    const firstHeading = content.split("\n").find(line => line.startsWith("#"));
    const title = firstHeading ? firstHeading.replace(/^#+\s*/, "").trim() : "(no title)";

    // Add [REJECTED] prefix for rejected ideas
    const isRejected = files[i].startsWith("rejected-");
    const prefix = isRejected ? "[REJECTED] " : "";

    console.log(`${i}. ${prefix}${title}`);
  }
}

/**
 * List active projects (those with a current worktree)
 * grind list projects
 */
export async function listProjects(): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  // Collect active project worktrees with their configs
  const allProjects = await collectProjects(workspaceRoot);
  const projects = allProjects.filter((p): p is ProjectEntry & { config: ProjectConfig } => p.config !== null);

  if (projects.length === 0) {
    console.log("No active projects. Create one with: grind new project \"name\" <idea-number>");
    return;
  }

  // Sort by last worked ascending (most neglected first), never-worked at top
  projects.sort((a, b) => {
    const aLast = a.config.time.length > 0 ? a.config.time[a.config.time.length - 1].start : null;
    const bLast = b.config.time.length > 0 ? b.config.time[b.config.time.length - 1].start : null;
    if (!aLast && !bLast) return a.name.localeCompare(b.name);
    if (!aLast) return -1;
    if (!bLast) return 1;
    return new Date(aLast).getTime() - new Date(bLast).getTime();
  });

  // Calculate column widths (account for header labels)
  const nameWidth = Math.max("Project".length, ...projects.map(p => p.config.name.length));
  const typeWidth = Math.max("Type".length, ...projects.map(p => (p.config.type || "—").length));
  const hoursWidth = 24;
  const sessionsWidth = 10;

  const header = `  ${"Project".padEnd(nameWidth)}  ${"Type".padEnd(typeWidth)}  ${"Hours".padEnd(hoursWidth)}  ${"Sessions".padStart(sessionsWidth)}  Last Worked`;
  const divider = `  ${"─".repeat(nameWidth)}  ${"─".repeat(typeWidth)}  ${"─".repeat(hoursWidth)}  ${"─".repeat(sessionsWidth)}  ${"─".repeat(11)}`;
  console.log(`${DIM}${header}${RESET}`);
  console.log(`${DIM}${divider}${RESET}`);

  for (const { config } of projects) {
    // Check for unsaved work (session with start but no end)
    const hasOpenSession = config.time.some(s => s.end === null);

    const prefix = config.longTerm ? "★ " : "  ";
    const displayName = hasOpenSession
      ? `${prefix}${RED}${config.name.padEnd(nameWidth)}${RESET}`
      : `${prefix}${config.name.padEnd(nameWidth)}`;
    const type = (config.type || "—").padEnd(typeWidth);

    const totalSeconds = config.time.reduce((sum, s) => sum + s.rounded, 0);
    const unbilledSeconds = config.time.filter(s => !s.invoiced).reduce((sum, s) => sum + s.rounded, 0);
    const totalHours = (totalSeconds / 3600).toFixed(1);
    const unbilledHours = (unbilledSeconds / 3600).toFixed(1);

    const sessions = config.time.length;
    const lastSession = sessions > 0 ? config.time[sessions - 1].start : null;
    const lastWorked = lastSession ? timeAgo(new Date(lastSession)) : "never";

    const hoursDisplay = unbilledSeconds > 0
      ? `${totalHours}h (${unbilledHours}h unbilled)`
      : `${totalHours}h`;

    console.log(`${displayName}  ${type}  ${hoursDisplay.padEnd(hoursWidth)}  ${String(sessions).padStart(sessionsWidth)}  ${lastWorked}`);
  }
}
