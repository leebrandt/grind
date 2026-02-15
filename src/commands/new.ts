// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { $ } from "bun";
import type { NewCommandOptions, ProjectConfig } from "../types/index.js";
import { getTimestampFilename } from "../utils/time.js";
import { getIdeaByNumber, fileExists } from "../utils/files.js";
import { requireWorkspace } from "../utils/workspace.js";
import { gitAddWorktree, gitCommit, hasUncommittedChanges } from "../utils/git.js";
import { readGrindConfig } from "../utils/config.js";
import { parseRepoUrl } from "../utils/repo.js";
import { listIdeas } from "./list.js";

/**
 * Open editor to get a message from the user
 */
async function getMessageFromEditor(prompt: string): Promise<string | null> {
  const tmpFile = path.join(tmpdir(), `grind-${Date.now()}.md`);
  await writeFile(tmpFile, `\n# ${prompt} (lines starting with # are ignored)\n`, "utf-8");

  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  execSync(`${editor} ${tmpFile}`, { stdio: "inherit" });

  const content = await readFile(tmpFile, "utf-8");
  await unlink(tmpFile);

  const message = content
    .split("\n")
    .filter(line => !line.startsWith("#"))
    .join("\n")
    .trim();

  return message || null;
}

/**
 * Create a new idea file
 * grind new idea "title"
 */
export async function newIdea(
  title: string
): Promise<void> {
  const { mainWorktree } = await requireWorkspace();
  
  const ideasDir = path.join(mainWorktree, "ideas");
  
  // Ensure ideas directory exists
  await mkdir(ideasDir, { recursive: true });
  
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
  const { workspaceRoot, mainWorktree } = await requireWorkspace();

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
  await mkdir(projectFolderInMain, { recursive: true });
  
  const projectConfig: ProjectConfig = {
    name,
    ...(options.type && { type: options.type }),
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
  
  // Copy the original idea into the project worktree
  await writeFile(path.join(worktreePath, "the-idea.md"), idea.content, "utf-8");

  // Step 3: Delete the idea file from main worktree
  const ideaFilePath = path.join(mainWorktree, "ideas", idea.filename);
  await unlink(ideaFilePath);
  await gitCommit(mainWorktree, `Remove idea ${idea.filename} (now project ${name})`);
  
  console.log(`\nProject created: ${name}/`);
  console.log(`Working directory: ${name}/projects/${name}/`);
  console.log(`Branch: ${name}`);
  console.log(`\nNext: cd ${name}/projects/${name}`);

  // Relist remaining ideas
  console.log("\nRemaining ideas:");
  await listIdeas();
}

/**
 * Create a new idea and GitHub issue
 * grind new issue <project> [-m "message"]
 */
export async function newIssue(
  projectName: string,
  options: { message?: string }
): Promise<void> {
  let message = options.message;
  if (!message) {
    message = await getMessageFromEditor("Enter issue title above") ?? undefined;
    if (!message) {
      console.error("Aborted: no message provided.");
      process.exit(1);
    }
  }
  await newRepoIssue(projectName, message, "ISSUE");
}

/**
 * Create a new idea and feature request on GitHub or GitLab
 * grind new feature <project> [-m "message"]
 */
export async function newFeature(
  projectName: string,
  options: { message?: string }
): Promise<void> {
  let message = options.message;
  if (!message) {
    message = await getMessageFromEditor("Enter feature title above") ?? undefined;
    if (!message) {
      console.error("Aborted: no message provided.");
      process.exit(1);
    }
  }
  await newRepoIssue(projectName, message, "FEATURE");
}

async function newRepoIssue(
  projectName: string,
  message: string,
  prefix: string
): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  // Read project config from project worktree ({workspace}/{project}/projects/{project}/.project.json)
  const configPath = path.join(workspaceRoot, projectName, "projects", projectName, ".project.json");
  let projectConfig: ProjectConfig;
  try {
    const content = await readFile(configPath, "utf-8");
    projectConfig = JSON.parse(content);
  } catch {
    console.error(`Error: Project '${projectName}' not found.`);
    process.exit(1);
  }
  if (!projectConfig.repo) {
    console.error(`Error: No 'repo' configured for project '${projectName}'.`);
    console.error(`Set it with: grind config -p ${projectName} repo git@github.com:owner/repo.git`);
    process.exit(1);
  }

  const repoInfo = parseRepoUrl(projectConfig.repo);
  if (!repoInfo) {
    console.error(`Error: Unrecognized repo URL: ${projectConfig.repo}`);
    console.error("Expected GitHub or GitLab URL, e.g.:");
    console.error("  git@github.com:owner/repo.git");
    console.error("  git@gitlab.com:owner/repo.git");
    console.error("  https://github.com/owner/repo");
    process.exit(1);
  }

  const title = `[${prefix}]: ${message}`;

  let issueUrl: string;
  if (repoInfo.platform === "github") {
    const result = await $`gh issue create --repo ${repoInfo.repo} --title ${title} --body " "`.quiet();
    issueUrl = result.stdout.toString().trim();
  } else {
    const result = await $`glab issue create --repo ${repoInfo.repo} --title ${title} --description " "`.quiet();
    issueUrl = result.stdout.toString().trim();
  }

  console.log(`Created issue: ${issueUrl}`);
}
