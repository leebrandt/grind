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
 * Human-readable relative time (e.g., "3d ago", "2mo ago")
 */
export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Format an ISO date string as YYYY-MM-DD
 */
export function formatDate(isoString: string): string {
  return isoString.slice(0, 10);
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
