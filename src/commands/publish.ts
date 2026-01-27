/**
 * Publish a file to site repos
 * grind publish "file"
 */
export async function publish(file: string): Promise<void> {
  console.log(`TODO: Publish file "${file}"`);
  console.log("  - Read .publish.json for site configuration");
  console.log("  - Copy file to configured site repo(s)");
  console.log("  - Update .publish.json with published URLs and timestamps");
  console.log("  - Commit changes in site repo");
}
