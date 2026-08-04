// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { execSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { GrindSystemError } from "./errors.js";

const editorBinary = process.env.EDITOR || process.env.VISUAL || "vi";

export async function openEditor(filePath: string): Promise<void> {
  try {
    execSync(`"${editorBinary}" "${filePath}"`, { stdio: "inherit" });
  } catch (err) {
    throw new GrindSystemError(
      `Editor "${editorBinary}" exited with an error`,
      err instanceof Error ? err : undefined,
    );
  }
}

export function openEditorDetached(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const editor = spawn(editorBinary, [filePath], { stdio: "inherit" });

    editor.on("error", (err) => {
      reject(
        new GrindSystemError(
          `Failed to launch editor "${editorBinary}"`,
          err instanceof Error ? err : undefined,
        ),
      );
    });

    editor.on("close", (code) => {
      if (code !== 0) {
        console.error(`Editor exited with code ${code}`);
      }
      resolve();
    });
  });
}

export async function editTempFile(
  prefix: string,
  initialContent?: string,
): Promise<string> {
  const tmpFile = path.join(tmpdir(), `${prefix}-${Date.now()}.md`);

  try {
    await writeFile(tmpFile, initialContent ?? "", "utf-8");
    execSync(`"${editorBinary}" "${tmpFile}"`, { stdio: "inherit" });
    return await readFile(tmpFile, "utf-8");
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}
