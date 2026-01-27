import path from "path";
import { spawn } from "child_process";
import { getWorkspaceRoot } from "../utils/workspace.js";
import { readProjectConfig, writeProjectConfig, fileExists } from "../utils/files.js";
import { getCurrentTimestamp } from "../utils/time.js";
import type { Session } from "../types/index.js";

/**
 * Start working on a project
 * grind work "project-name"
 */
export async function workStart(projectName: string): Promise<void> {
  // Find workspace root
  const workspaceRoot = await getWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    console.error("Error: Not in a grind workspace.");
    process.exit(1);
  }
  
  // Verify project worktree exists
  const worktreePath = path.join(workspaceRoot, projectName);
  if (!(await fileExists(worktreePath))) {
    console.error(`Error: Project '${projectName}' does not exist.`);
    process.exit(1);
  }
  
  // Read project config
  const config = await readProjectConfig(workspaceRoot, projectName);
  if (!config) {
    console.error(`Error: Could not read .project.json for '${projectName}'.`);
    process.exit(1);
  }
  
  // Check for active session and auto-close with 0 duration if found
  const activeSession = config.time.find(s => s.end === null);
  if (activeSession) {
    console.log(`Warning: Found unclosed session. Auto-closing with 0 duration.`);
    activeSession.end = activeSession.start;
    activeSession.duration = 0;
    activeSession.rounded = 0;
  }
  
  // Add new session
  const newSession: Session = {
    start: getCurrentTimestamp(),
    end: null,
    duration: 0,
    rounded: 0
  };
  
  config.time.push(newSession);
  
  // Write updated config
  await writeProjectConfig(workspaceRoot, projectName, config);
  
  console.log(`Started work session on '${projectName}'`);
  console.log(`Time started: ${newSession.start}`);
  
  // Open editor in project directory
  const projectDir = path.join(worktreePath, "projects", projectName);
  //console.log(`Opening editor at: ${projectDir}`);
  // Note: There is no 'console.cd'. Remove this call; just set cwd in spawn.
  
  // Spawn nvim
  const editor = spawn("nvim", ["."], {
    cwd: projectDir,
    stdio: "inherit"
  });
  
  editor.on("close", (code) => {
    if (code !== 0) {
      console.error(`Editor exited with code ${code}`);
    }
  });
}

