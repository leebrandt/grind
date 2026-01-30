import path from "path";
import { mkdir, writeFile } from "node:fs/promises";
import type { GrindConfig } from "../types/index.js";
import { gitInit, gitInitialCommit, gitAddWorktree, gitCommit } from "../utils/git.js";
import { fileExists } from "../utils/files.js";

/**
 * Default workspace configuration
 */
export const DEFAULT_GRIND_CONFIG: GrindConfig = {
  billing: {
    roundTo: "quarter-hour",
    defaultRate: 150,
  },
};

/**
 * Initialize a grind workspace
 * grind init
 *
 * Creates:
 * - .grind.repo.git/ (bare repository)
 * - grind/ (main worktree on "main" branch)
 *   - ideas/
 *   - .grind.json
 */
export async function init(): Promise<void> {
  const cwd = process.cwd();
  const bareRepoPath = path.join(cwd, ".grind.repo.git");
  const mainWorktreePath = path.join(cwd, "grind");

  // Check if already initialized
  if (await fileExists(bareRepoPath)) {
    console.error("Error: Grind workspace already initialized (.grind.repo.git exists)");
    process.exit(1);
  }

  // 1. Create bare repo
  console.log("Creating bare repository...");
  await gitInit(bareRepoPath);

  // 2. Create initial commit (required for worktrees)
  console.log("Creating initial commit...");
  await gitInitialCommit(bareRepoPath);

  // 3. Add main worktree
  console.log("Creating main worktree (grind/)...");
  await gitAddWorktree(bareRepoPath, mainWorktreePath, "main");

  // 4. Create structure in main worktree
  console.log("Setting up workspace structure...");
  await mkdir(path.join(mainWorktreePath, "ideas"), { recursive: true });
  await mkdir(path.join(mainWorktreePath, "projects"), { recursive: true });
  await writeFile(
    path.join(mainWorktreePath, ".grind.json"),
    JSON.stringify(DEFAULT_GRIND_CONFIG, null, 2),
    "utf-8"
  );

  // 5. Commit the structure
  console.log("Committing initial structure...");
  await gitCommit(mainWorktreePath, "Initialize grind workspace");

  console.log("\n--> grind workspace initialized <--");
  console.log(`\nWorkspace root: ${cwd}`);
  console.log(`Bare repo:      ${bareRepoPath}`);
  console.log(`Main worktree:  ${mainWorktreePath}`);
  console.log(`\nNext: cd grind && grind new idea "My first idea"`);
}
