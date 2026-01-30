import { $ } from "bun";
import { findBareRepo } from "../utils/workspace.js";

export async function status(): Promise<void> {
  const bareRepo = await findBareRepo(process.cwd());
  if (!bareRepo) {
    console.error("Not in a grind workspace. Run 'grind init' first.");
    process.exit(1);
  }

  const result = await $`git -C ${bareRepo} worktree list --porcelain`.quiet();
  const output = result.stdout.toString().trim();

  // Parse porcelain output into worktree entries
  const entries = output.split("\n\n").filter(Boolean);

  for (const entry of entries) {
    const lines = entry.split("\n");
    const worktreeLine = lines.find((l) => l.startsWith("worktree "));
    const branchLine = lines.find((l) => l.startsWith("branch "));
    const isBare = lines.some((l) => l === "bare");

    if (isBare || !worktreeLine) continue;

    const worktreePath = worktreeLine.replace("worktree ", "");
    const branch = branchLine
      ? branchLine.replace("branch refs/heads/", "")
      : "detached";

    console.log(`[${branch}]`);

    const gitStatus = await $`git -C ${worktreePath} status`.quiet();
    console.log(gitStatus.stdout.toString().trimEnd().replace(/^/gm, "  "));
    console.log();
  }
}
