import path from "path";
import { writeFile, unlink } from "node:fs/promises";
import { $ } from "bun";
import type { ProjectType, NewCommandOptions, ProjectConfig } from "../types/index.js";
import { getTimestampFilename } from "../utils/time.js";
import { ensureDir, getIdeaByNumber, fileExists } from "../utils/files.js";
import { findMainWorktree, getWorkspaceRoot } from "../utils/workspace.js";
import { gitAddWorktree, gitCommit, hasUncommittedChanges } from "../utils/git.js";
import { readGrindConfig } from "../utils/config.js";

/**
 * Create a new idea file
 * grind new idea "title" [-t type]
 */
export async function newIdea(
  title: string,
  options: NewCommandOptions
): Promise<void> {
  // Find the main worktree (grind/) from anywhere in the workspace
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Error: Not in a grind workspace. Run 'grind init' first.");
    process.exit(1);
  }
  
  const ideasDir = path.join(mainWorktree, "ideas");
  
  // Ensure ideas directory exists
  await ensureDir(ideasDir);
  
  // Generate timestamped filename
  const timestamp = getTimestampFilename();
  const filename = `${timestamp}.md`;
  const filepath = path.join(ideasDir, filename);
  
  // Create file with H1 heading
  await writeFile(filepath, `# ${title}\n`, "utf-8");

  // Commit immediately so project creation doesn't fail due to uncommitted changes
  await gitCommit(mainWorktree, `Add idea: ${title}`);

  console.log(`Created idea: ideas/${filename}`);
}

/**
 * Create a new project from an idea
 * grind new project "name" <idea-number> [-t type]
 */
export async function newProject(
  name: string,
  ideaNumber: string,
  options: NewCommandOptions
): Promise<void> {
  // Find main worktree first
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Error: Not in a grind workspace.");
    process.exit(1);
  }
  
  // Check for uncommitted changes FIRST - fail fast
  if (await hasUncommittedChanges(mainWorktree)) {
    console.error("Error: You have uncommitted changes in grind/. Please commit them first.");
    process.exit(1);
  }
  
  // Parse idea number
  const ideaIndex = parseInt(ideaNumber, 10);
  if (isNaN(ideaIndex)) {
    console.error("Error: Idea must be a number from 'grind list ideas'");
    process.exit(1);
  }
  
  // Get idea content
  const idea = await getIdeaByNumber(ideaIndex);
  if (!idea) {
    console.error(`Error: Idea #${ideaIndex} not found. Run 'grind list ideas' to see available ideas.`);
    process.exit(1);
  }
  
  // Read workspace config
  const grindConfig = await readGrindConfig(mainWorktree);
  
  // Find workspace root
  const workspaceRoot = await getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    console.error("Error: Not in a grind workspace.");
    process.exit(1);
  }
  
  const bareRepoPath = path.join(workspaceRoot, ".grind.repo.git");
  const worktreePath = path.join(workspaceRoot, name);
  
  // Check if worktree directory already exists
  if (await fileExists(worktreePath)) {
    console.error(`Error: Directory '${name}' already exists.`);
    process.exit(1);
  }
  
  // Step 1: Create .project.json in main worktree's projects/ folder
  console.log(`Creating project in grind/projects/${name}/...`);
  const projectFolderInMain = path.join(mainWorktree, "projects", name);
  await ensureDir(projectFolderInMain);
  
  const projectConfig: ProjectConfig = {
    name,
    idea: idea.content.trim(),
    time: [],
    billing: {
      roundTo: grindConfig.billing.roundTo,
      rate: grindConfig.billing.defaultRate
    }
  };
  
  const configPath = path.join(projectFolderInMain, ".project.json");
  await writeFile(configPath, JSON.stringify(projectConfig, null, 2), "utf-8");
  
  // Commit to main
  await gitCommit(mainWorktree, `Create project: ${name}`);
  
  // Step 2: Create worktree (inherits projects/{name}/.project.json from main)
  console.log(`Creating project worktree: ${name}/`);
  await gitAddWorktree(bareRepoPath, worktreePath, name);
  
  // Step 3: Delete the idea file from main worktree
  const ideaFilePath = path.join(mainWorktree, "ideas", idea.filename);
  await unlink(ideaFilePath);
  await gitCommit(mainWorktree, `Remove idea ${idea.filename} (now project ${name})`);
  
  console.log(`\nProject created: ${name}/`);
  console.log(`Working directory: ${name}/projects/${name}/`);
  console.log(`Branch: ${name}`);
  console.log(`\nNext: cd ${name}/projects/${name}`);
}
