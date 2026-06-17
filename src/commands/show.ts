import { readFile } from "node:fs/promises";
import { requireWorkspace } from "../utils/workspace.js";
import { readProjectConfig } from "../utils/config.js";
import { GrindUserError } from "../utils/errors.js";
import { getProjectIdeaFilePath } from "../utils/paths.js";

export interface ShowOptions {
  sessions?: boolean;
  billing?: boolean;
  config?: boolean;
}

export async function showProject(projectName: string, options: ShowOptions = {}): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  if (options.config) {
    const config = await readProjectConfig(workspaceRoot, projectName);
    if (!config) {
      throw new GrindUserError(`No project config found for ${projectName}`);
    }
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (options.sessions) {
    const config = await readProjectConfig(workspaceRoot, projectName);
    if (!config) {
      throw new GrindUserError(`No project config found for ${projectName}`);
    }
    if (config.time.length === 0) {
      console.log("No sessions recorded.");
      return;
    }
    for (const session of config.time) {
      const start = new Date(session.start).toLocaleString();
      const end = session.end ? new Date(session.end).toLocaleString() : "active";
      const hours = (session.duration / 3600).toFixed(2);
      const invoiced = session.invoiced ? " (invoiced)" : "";
      console.log(`${start} → ${end}  ${hours}h${invoiced}`);
    }
    return;
  }

  if (options.billing) {
    const config = await readProjectConfig(workspaceRoot, projectName);
    if (!config) {
      throw new GrindUserError(`No project config found for ${projectName}`);
    }
    const totalSeconds = config.time.reduce((sum, s) => sum + s.rounded, 0);
    const billedSeconds = config.time.filter((s) => s.invoiced).reduce((sum, s) => sum + s.rounded, 0);
    const totalHours = (totalSeconds / 3600).toFixed(2);
    const billedHours = (billedSeconds / 3600).toFixed(2);
    const unbilledHours = ((totalSeconds - billedSeconds) / 3600).toFixed(2);
    const rate = config.billing.rate;
    const totalAmount = (totalSeconds / 3600 * rate).toFixed(2);
    const billedAmount = (billedSeconds / 3600 * rate).toFixed(2);
    const unbilledAmount = ((totalSeconds - billedSeconds) / 3600 * rate).toFixed(2);
    console.log(`Sessions: ${config.time.length}`);
    console.log(`Total:    ${totalHours}h (${totalAmount})`);
    console.log(`Billed:   ${billedHours}h (${billedAmount})`);
    console.log(`Unbilled: ${unbilledHours}h (${unbilledAmount})`);
    console.log(`Rate:     ${rate}/hr`);
    return;
  }

  const ideaPath = getProjectIdeaFilePath(workspaceRoot, projectName);
  try {
    const content = await readFile(ideaPath, "utf-8");
    console.log(content);
  } catch {
    throw new GrindUserError(`No idea file found at ${ideaPath}`);
  }
}
