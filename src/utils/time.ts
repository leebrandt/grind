import type { BillingConfig, RoundTo } from "../types/index.js";

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
  const hours = seconds / 3600;
  
  switch (roundTo) {
    case "quarter-hour":
      return Math.ceil(hours * 4) / 4 * 3600;
    case "half-hour":
      return Math.ceil(hours * 2) / 2 * 3600;
    case "hour":
      return Math.ceil(hours) * 3600;
  }
}

/**
 * Round seconds to the nearest quarter hour (15 min = 900 sec)
 */
export function roundToQuarterHour(seconds: number): number {
  const quarterHour = 900;
  return Math.ceil(seconds / quarterHour) * quarterHour;
}

/**
 * Round seconds to the nearest half hour (30 min = 1800 sec)
 */
export function roundToHalfHour(seconds: number): number {
  const halfHour = 1800;
  return Math.ceil(seconds / halfHour) * halfHour;
}

/**
 * Round seconds to the nearest hour (60 min = 3600 sec)
 */
export function roundToHour(seconds: number): number {
  const hour = 3600;
  return Math.ceil(seconds / hour) * hour;
}

/**
 * Round seconds based on billing config
 */
export function roundTime(seconds: number, config: BillingConfig): number {
  switch (config.roundTo) {
    case "quarter-hour":
      return roundToQuarterHour(seconds);
    case "half-hour":
      return roundToHalfHour(seconds);
    case "hour":
      return roundToHour(seconds);
    default:
      return roundToQuarterHour(seconds);
  }
}

/**
 * Convert seconds to hours (decimal)
 */
export function secondsToHours(seconds: number): number {
  return seconds / 3600;
}

/**
 * Format duration as human-readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
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
