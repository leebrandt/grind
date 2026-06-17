// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { spawn } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { GrindSystemError } from "./errors.js";

export const EDITOR = process.env.EDITOR || process.env.VISUAL || "vi";

export function openEditor(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(EDITOR, [filePath], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new GrindSystemError(`Editor exited with code ${code}`));
      }
    });
    child.on("error", (err) => {
      reject(new GrindSystemError(`Failed to open editor: ${err.message}`, err));
    });
  });
}

export function openEditorDetached(filePath: string): Promise<void> {
  spawn(EDITOR, [filePath], { stdio: "inherit" });
  return Promise.resolve();
}

export async function editTempFile(prefix: string, initialContent?: string): Promise<string> {
  const tmpFile = path.join(tmpdir(), `${prefix}-${Date.now()}.md`);
  await writeFile(tmpFile, initialContent ?? "", "utf-8");
  try {
    await openEditor(tmpFile);
    return await readFile(tmpFile, "utf-8");
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}
