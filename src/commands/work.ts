/**
 * Start working on a project
 * gd work "project"
 *
 * - Starts a timer in .time.json
 * - Opens nvim on the project directory
 */
export async function work(project: string): Promise<void> {
  console.log(`TODO: Start work session on "${project}"`);
  console.log("  - Verify project exists in projects/");
  console.log("  - Read .time.json");
  console.log("  - Add new session with start timestamp");
  console.log("  - Write updated .time.json");
  console.log("  - Spawn nvim on project directory");
}
