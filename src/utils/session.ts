// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ProjectConfig, Session } from "../types/index.js";
import { getCurrentTimestamp, calculateDuration, roundTimeByStrategy } from "./time.js";

export function getActiveSession(config: ProjectConfig): Session | undefined {
  return config.time.find(s => s.end === null);
}

export function startSession(config: ProjectConfig): Session {
  const newSession: Session = {
    start: getCurrentTimestamp(),
    end: null,
    duration: 0,
    rounded: 0,
  };
  config.time.push(newSession);
  return newSession;
}

export function endSession(
  config: ProjectConfig,
  endTime?: string,
): Session | undefined {
  const session = getActiveSession(config);
  if (!session) return undefined;

  const effectiveEnd = endTime ?? getCurrentTimestamp();
  session.end = effectiveEnd;
  session.duration = calculateDuration(session.start, effectiveEnd);
  session.rounded = roundTimeByStrategy(session.duration, config.billing.roundTo);
  return session;
}

export function closeOrphanedSession(config: ProjectConfig): void {
  const activeSession = getActiveSession(config);
  if (activeSession) {
    activeSession.end = activeSession.start;
    activeSession.duration = 0;
    activeSession.rounded = 0;
  }
}
