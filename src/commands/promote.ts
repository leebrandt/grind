// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { $ } from "bun";
import { requireWorkspace } from "../utils/workspace.js";
import { GrindUserError, GrindSystemError } from "../utils/errors.js";
import { resolveProjectConfig } from "../utils/config.js";

const N8N_WEBHOOK_URL = "https://gandalf.local:5678/webhook-test/promote";

export async function promoteProject(projectName: string): Promise<void> {
  const { workspaceRoot } = await requireWorkspace();

  const result = await resolveProjectConfig(workspaceRoot, projectName);
  if (!result) {
    throw new GrindUserError(`Project '${projectName}' not found.`);
  }
  const { config } = result;

  if (!config.publications || config.publications.length === 0) {
    throw new GrindUserError(`Project '${projectName}' has no publication URLs.`);
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
    throw new GrindSystemError("Could not reach n8n server.");
  }

  const httpStatus = parseInt(statusCode || "0", 10);
  if (httpStatus < 200 || httpStatus >= 300) {
    throw new GrindSystemError(`n8n webhook failed: ${responseBody || `HTTP ${httpStatus}`}`);
  }

  console.log("\nn8n response:");
  try {
    console.log(JSON.stringify(JSON.parse(responseBody), null, 2));
  } catch {
    console.log(responseBody || "(empty response)");
  }
}
