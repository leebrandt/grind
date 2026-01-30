import path from "path";
import { spawn } from "child_process";
import { findMainWorktree } from "../utils/workspace.js";
import { ensureDir } from "../utils/files.js";

/**
 * Open today's journal entry in nvim
 * grind journal
 */
export async function journal(): Promise<void> {
  const mainWorktree = await findMainWorktree(process.cwd());
  if (!mainWorktree) {
    console.error("Error: Not in a grind workspace.");
    process.exit(1);
  }

  const journalDir = path.join(mainWorktree, "journal");
  await ensureDir(journalDir);

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
