// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import path from "node:path";
import { readFile } from "node:fs/promises";
import { $ } from "bun";
import { requireWorkspace } from "../utils/workspace.js";
import { fileExists } from "../utils/files.js";
import type { ProjectConfig } from "../types/index.js";

const N8N_WEBHOOK_URL = "https://gandalf.local:5678/webhook-test/promote";

export async function promoteProject(projectName: string): Promise<void> {
  const { workspaceRoot, mainWorktree } = await requireWorkspace();

  const projectWorktreeConfigPath = path.join(
    workspaceRoot,
    projectName,
    "projects",
    projectName,
    ".project.json",
  );

  const mainWorktreeConfigPath = path.join(
    mainWorktree,
    "projects",
    projectName,
    ".project.json",
  );

  let configPath: string;

  if (await fileExists(projectWorktreeConfigPath)) {
    configPath = projectWorktreeConfigPath;
  } else if (await fileExists(mainWorktreeConfigPath)) {
    configPath = mainWorktreeConfigPath;
  } else {
    console.error(`Error: Project '${projectName}' not found.`);
    process.exit(1);
  }

  const configContent = await readFile(configPath, "utf-8");
  const config: ProjectConfig = JSON.parse(configContent);

  if (!config.publications || config.publications.length === 0) {
    console.error(`Error: Project '${projectName}' has no publication URLs.`);
    process.exit(1);
  }

  const publicationUrl = config.publications[0].url;

  console.log(`Triggering promotion for '${projectName}'...`);
  console.log(`Using publication URL: ${publicationUrl}`);

  const payload = JSON.stringify({ url: publicationUrl });

  const { stdout, exitCode } = await $`curl -k -s -w "\\n%{http_code}" -X POST "${N8N_WEBHOOK_URL}" -H "Content-Type: application/json" -d '${payload}'`.nothrow();

  const stdoutStr = stdout.toString();
  const lines = stdoutStr.trim().split("\n");
  const statusCode = lines.pop();
  const responseBody = lines.join("\n");

  if (exitCode !== 0) {
    console.error("Error: Could not reach n8n server.");
    process.exit(1);
  }

  const httpStatus = parseInt(statusCode || "0", 10);
  if (httpStatus < 200 || httpStatus >= 300) {
    console.error(`Error: n8n webhook failed: ${responseBody || `HTTP ${httpStatus}`}`);
    process.exit(1);
  }

  console.log("\nn8n response:");
  try {
    console.log(JSON.stringify(JSON.parse(responseBody), null, 2));
  } catch {
    console.log(responseBody || "(empty response)");
  }
}
