// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
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
import { GrindUserError } from "../utils/errors.js";
import { getIdeasDirPath, getBareRepoPath, getProjectWorktreePath, getProjectConfigDirPath, getProjectConfigPath } from "../utils/paths.js";
import { editTempFile } from "../utils/editor.js";

async function getMessageFromEditor(prompt: string): Promise<string | null> {
  const content = await editTempFile("grind", `\n# ${prompt} (lines starting with # are ignored)\n`);

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
  title?: string
): Promise<void> {
  const { mainWorktree } = await requireWorkspace();

  const ideasDir = getIdeasDirPath(mainWorktree);
  await mkdir(ideasDir, { recursive: true });

  let fileContent: string;
  let commitTitle: string;

  if (title) {
    fileContent = `# ${title}\n`;
    commitTitle = title;
  } else {
    const editorContent = await getMessageFromEditor("First line is the title; add detail below");
    if (!editorContent) {
      console.log("Aborted.");
      return;
    }
    const lines = editorContent.split("\n");
    commitTitle = lines[0].trim();
    const body = lines.slice(1).join("\n").trim();
    fileContent = `# ${commitTitle}\n` + (body ? `\n${body}\n` : "");
  }

  const timestamp = getTimestampFilename();
  const filename = `${timestamp}.md`;
  const filepath = path.join(ideasDir, filename);

  await writeFile(filepath, fileContent, "utf-8");
  await gitCommit(mainWorktree, `Add idea: ${commitTitle}`);
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
    throw new GrindUserError("You have uncommitted changes in grind/. Please commit them first.");
  }
  
  const ideaIndex = parseInt(ideaNumber, 10);
  if (isNaN(ideaIndex)) {
    throw new GrindUserError("Idea must be a number from 'grind list ideas'");
  }
  
  const idea = await getIdeaByNumber(ideaIndex);
  if (!idea) {
    throw new GrindUserError(`Idea #${ideaIndex} not found. Run 'grind list ideas' to see available ideas.`);
  }
  
  // Read workspace config
  const grindConfig = await readGrindConfig(mainWorktree);

  const bareRepoPath = getBareRepoPath(workspaceRoot);
  const worktreePath = getProjectWorktreePath(workspaceRoot, name);
  
  // Check if worktree directory already exists
  if (await fileExists(worktreePath)) {
    throw new GrindUserError(`Directory '${name}' already exists.`);
  }
  
  // Step 1: Create .project.json in main worktree's projects/ folder
  console.log(`Creating project in grind/projects/${name}/...`);
  const projectFolderInMain = getProjectConfigDirPath(mainWorktree, name);
  await mkdir(projectFolderInMain, { recursive: true });
  
  const projectConfig: ProjectConfig = {
    name,
    type: options.type,
    idea: idea.content.trim(),
    time: [],
    billing: {
      roundTo: grindConfig.billing.roundTo,
      rate: grindConfig.billing.defaultRate
    }
  };
  
  const configPath = path.join(projectFolderInMain, ".project.json");
  await writeFile(configPath, JSON.stringify(projectConfig, null, 2), "utf-8");
  await writeFile(path.join(projectFolderInMain, "the-idea.md"), idea.content, "utf-8");

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
      throw new GrindUserError("Aborted: no message provided.");
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
      throw new GrindUserError("Aborted: no message provided.");
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

  const configPath = getProjectConfigPath(workspaceRoot, projectName);
  let projectConfig: ProjectConfig;
  try {
    const content = await readFile(configPath, "utf-8");
    projectConfig = JSON.parse(content);
  } catch {
    throw new GrindUserError(`Project '${projectName}' not found.`);
  }
  if (!projectConfig.repo) {
    throw new GrindUserError(
      `No 'repo' configured for project '${projectName}'.\n` +
      `Set it with: grind config -p ${projectName} repo git@github.com:owner/repo.git`
    );
  }

  const repoInfo = parseRepoUrl(projectConfig.repo);
  if (!repoInfo) {
    throw new GrindUserError(
      `Unrecognized repo URL: ${projectConfig.repo}\n` +
      "Expected GitHub or GitLab URL, e.g.:\n" +
      "  git@github.com:owner/repo.git\n" +
      "  git@gitlab.com:owner/repo.git\n" +
      "  https://github.com/owner/repo"
    );
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
