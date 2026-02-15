import path from "node:path";
import { mkdir } from "node:fs/promises";
import { spawn } from "child_process";
import { requireWorkspace } from "../utils/workspace.js";

/**
 * Open today's journal entry in nvim
 * grind journal
 */
export async function journal(): Promise<void> {
  const { mainWorktree } = await requireWorkspace();

  const journalDir = path.join(mainWorktree, "journal");
  await mkdir(journalDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filePath = path.join(journalDir, `${today}.md`);

  const editor = spawn("nvim", [filePath], {
    stdio: "inherit",
  });

  editor.on("close", (code) => {
    if (code !== 0) {
      console.error(`Editor exited with code ${code}`);
    }
  });
}
