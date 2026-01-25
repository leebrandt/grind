import { readFile, writeFile } from "node:fs/promises";

/**
 * Read and parse a JSON file with type safety
 */
export async function readJson<T>(path: string): Promise<T | null> {
  // TODO: Read and parse JSON file
  console.log(`TODO: readJson(${path})`);
  return null;
}

/**
 * Write data to a JSON file with pretty formatting
 */
export async function writeJson<T>(path: string, data: T): Promise<void> {
  // TODO: Write JSON file
  console.log(`TODO: writeJson(${path})`);
}

/**
 * Read JSON file or return default if not exists
 */
export async function readJsonOrDefault<T>(
  path: string,
  defaultValue: T
): Promise<T> {
  // TODO: Read or return default
  console.log(`TODO: readJsonOrDefault(${path})`);
  return defaultValue;
}
