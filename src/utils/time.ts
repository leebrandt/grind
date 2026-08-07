// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

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
 * Parse a human-friendly duration string into hours (decimal).
 * Accepts: "5", "5h", "1.5h", "90m", "1h30m". Returns null if invalid.
 */
export function parseDuration(input: string): number | null {
  const value = input.trim();
  if (!value) return null;

  const hoursMinutes = /^(\d+(?:\.\d+)?)h\s*(\d+(?:\.\d+)?)m$/i.exec(value);
  if (hoursMinutes) {
    return Number(hoursMinutes[1]) + Number(hoursMinutes[2]) / 60;
  }

  const minutes = /^(\d+(?:\.\d+)?)m$/i.exec(value);
  if (minutes) {
    return Number(minutes[1]) / 60;
  }

  const hours = /^(\d+(?:\.\d+)?)h$/i.exec(value);
  if (hours) {
    return Number(hours[1]);
  }

  const plain = /^\d+(?:\.\d+)?$/.exec(value);
  if (plain) {
    return Number(plain[0]);
  }

  return null;
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

/**
 * Current (or given) date as a local-timezone YYYY-MM-DD string.
 * Unlike toISOString().slice(0, 10), this uses local getters, so the result
 * matches the user's clock, not UTC.
 */
export function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Long-form date header, e.g. "Tuesday, August 4, 2026".
 * Input is a YYYY-MM-DD string. Non-matching input is returned as-is.
 */
export function formatLongDate(dateString: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return dateString;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
