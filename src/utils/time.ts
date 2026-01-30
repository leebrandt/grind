import type { RoundTo } from "../types/index.js";

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Calculate duration in seconds between two ISO timestamps
 */
export function calculateDuration(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
}

/**
 * Round seconds based on rounding strategy
 */
export function roundTimeByStrategy(seconds: number, roundTo: RoundTo): number {
  switch (roundTo) {
    case "quarter-hour":
      return Math.ceil(seconds / 900) * 900;
    case "half-hour":
      return Math.ceil(seconds / 1800) * 1800;
    case "hour":
      return Math.ceil(seconds / 3600) * 3600;
  }
}

/**
 * Generate a timestamp string suitable for filenames
 * Format: YYYYMMDDHHmmss (e.g., 20260125143022)
 */
export function getTimestampFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}
