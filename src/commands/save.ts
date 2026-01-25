/**
 * Save work on a project
 * gd save "project"
 *
 * - Stops the timer
 * - Commits changes
 * - Logs time to .time.json
 */
export async function save(project: string): Promise<void> {
  console.log(`TODO: Save work session on "${project}"`);
  console.log("  - Verify project exists in projects/");
  console.log("  - Read .time.json");
  console.log("  - Find active session (one without end time)");
  console.log("  - Calculate duration and round to billing increment");
  console.log("  - Update session with end time, duration, rounded");
  console.log("  - Update totalSeconds and billableHours");
  console.log("  - Write updated .time.json");
  console.log("  - Git add all changes");
  console.log("  - Git commit with timestamp message");
}
