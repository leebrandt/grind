import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function confirmOrExit(prompt: string, skip: boolean): Promise<void> {
  if (skip) return;

  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  const answer = await rl.question(`${prompt} (y/N) `);
  rl.close();

  if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }
}
