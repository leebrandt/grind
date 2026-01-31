import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { findMainWorktree } from "../utils/workspace.js";
import type { ProjectConfig } from "../types/index.js";

/**
 * List all idea files for triage
 * grind list ideas [-a|--all] [-r|--rejected]
 */
export async function listIdeas(options?: {
  all?: boolean;
  rejected?: boolean;
}): Promise<void> {
  // Find main worktree
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Error: Not in a grind workspace.");
    process.exit(1);
  }
  
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
    const title = content.replace(/^#\s*/, "").trim(); // Remove leading # and whitespace
    
    // Add [REJECTED] prefix for rejected ideas
    const isRejected = files[i].startsWith("rejected-");
    const prefix = isRejected ? "[REJECTED] " : "";
    
    console.log(`${i}. ${prefix}${title}`);
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * List all projects with summary info
 * grind list projects
 */
export async function listProjects(): Promise<void> {
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Error: Not in a grind workspace.");
    process.exit(1);
  }

  const projectsDir = path.join(mainWorktree, "projects");

  let entries: string[];
  try {
    entries = await readdir(projectsDir);
  } catch {
    console.log("No projects yet. Create one with: grind new project \"name\" <idea-number>");
    return;
  }

  // Filter to directories that contain a .project.json
  const projects: { config: ProjectConfig; dir: string }[] = [];
  for (const entry of entries) {
    const configPath = path.join(projectsDir, entry, ".project.json");
    try {
      const content = await readFile(configPath, "utf-8");
      projects.push({ config: JSON.parse(content), dir: entry });
    } catch {
      continue;
    }
  }

  if (projects.length === 0) {
    console.log("No projects yet. Create one with: grind new project \"name\" <idea-number>");
    return;
  }

  // Sort by last worked ascending (most neglected first), never-worked at top
  projects.sort((a, b) => {
    const aLast = a.config.time.length > 0 ? a.config.time[a.config.time.length - 1].start : null;
    const bLast = b.config.time.length > 0 ? b.config.time[b.config.time.length - 1].start : null;
    if (!aLast && !bLast) return a.dir.localeCompare(b.dir);
    if (!aLast) return -1;
    if (!bLast) return 1;
    return new Date(aLast).getTime() - new Date(bLast).getTime();
  });

  // Calculate column widths
  const nameWidth = Math.max(...projects.map(p => p.config.name.length));
  const typeWidth = Math.max(...projects.map(p => (p.config.type || "—").length));

  for (const { config } of projects) {
    const name = config.name.padEnd(nameWidth);
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

    console.log(`  ${name}  ${type}  ${hoursDisplay.padEnd(24)}  ${String(sessions).padStart(2)} sessions  ${lastWorked}`);
  }
}
