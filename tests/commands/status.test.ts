// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { status } from "../../src/commands/status.js";
import { DIM, RED, GREEN, YELLOW, WHITE, RESET } from "../../src/utils/colors.js";
import type { ProjectConfig } from "../../src/types/index.js";

// Mock modules
jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockResolvedValue({
    workspaceRoot: "/test/workspace",
    bareRepo: "/test/workspace/.grind.repo.git",
  }),
}));

const mockCollectProjects = jest.fn();
jest.mock("../../src/utils/project.js", () => ({
  collectProjects: (...args: unknown[]) => mockCollectProjects(...args),
}));

jest.mock("../../src/utils/git.js", () => ({
  getCommitCount: jest.fn().mockResolvedValue(5),
  getLastCommitDate: jest.fn().mockResolvedValue("2026-07-10T12:00:00Z"),
}));

jest.mock("../../src/utils/task.js", () => ({
  getOpenTasks: jest.fn().mockResolvedValue([]),
  getTaskUrgency: jest.fn().mockReturnValue("none"),
}));

const mockGetActiveSession = jest.fn();
jest.mock("../../src/utils/session.js", () => ({
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
}));

jest.mock("../../src/utils/time.js", () => ({
  timeAgo: jest.fn().mockReturnValue("2d ago"),
}));

// Helper to strip ANSI codes
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "test-project",
    idea: "Test idea",
    time: [],
    billing: { roundTo: "quarter-hour", rate: 150 },
    ...overrides,
  };
}

function makeProjectEntry(config: ProjectConfig) {
  return {
    name: config.name,
    worktreePath: `/test/workspace/${config.name}`,
    config,
  };
}

describe("status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    mockGetActiveSession.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Priority tests (single project each) ──

  describe("color priority", () => {
    it("green when project has an active session", async () => {
      const config = makeConfig({
        name: "active-proj",
        time: [{ start: "2026-07-15T10:00:00Z", end: null, duration: 0, rounded: 0 }],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue({ start: "2026-07-15T10:00:00Z", end: null, duration: 0, rounded: 0 });

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("active-proj"));
      expect(line).toContain(GREEN);
      expect(line).not.toContain(RED);
      expect(line).not.toContain(YELLOW);
    });

    it("yellow when deadline within 7 days and no active session", async () => {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 3);
      const deadlineStr = deadline.toISOString().slice(0, 10);

      const config = makeConfig({
        name: "deadline-proj",
        deadline: deadlineStr,
        time: [{ start: "2026-07-10T10:00:00Z", end: "2026-07-10T11:00:00Z", duration: 3600, rounded: 3600 }],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("deadline-proj"));
      expect(line).toContain(YELLOW);
      expect(line).not.toContain(RED);
      expect(line).not.toContain(GREEN);
    });

    it("red when deadline is overdue and no active session", async () => {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() - 2);
      const deadlineStr = deadline.toISOString().slice(0, 10);

      const config = makeConfig({
        name: "overdue-proj",
        deadline: deadlineStr,
        time: [{ start: "2026-07-01T10:00:00Z", end: "2026-07-01T11:00:00Z", duration: 3600, rounded: 3600 }],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("overdue-proj"));
      expect(line).toContain(RED);
    });

    it("yellow when unbilled time and no active session, no deadline", async () => {
      const config = makeConfig({
        name: "unbilled-proj",
        time: [{ start: "2026-07-10T10:00:00Z", end: "2026-07-10T11:00:00Z", duration: 3600, rounded: 3600 }],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("unbilled-proj"));
      expect(line).toContain(YELLOW);
      expect(line).not.toContain(GREEN);
      expect(line).not.toContain(RED);
    });

    it("white when no active, no deadline, no unbilled", async () => {
      const config = makeConfig({
        name: "idle-proj",
        time: [
          { start: "2026-07-10T10:00:00Z", end: "2026-07-10T11:00:00Z", duration: 3600, rounded: 3600, invoiced: true },
        ],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("idle-proj"));
      expect(line).toContain(WHITE);
      expect(line).not.toContain(GREEN);
      expect(line).not.toContain(RED);
      expect(line).not.toContain(YELLOW);
    });
  });

  // ── Priority override tests ──

  describe("priority overrides", () => {
    it("active + deadline within 7 days → green (active wins)", async () => {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 3);
      const deadlineStr = deadline.toISOString().slice(0, 10);

      const config = makeConfig({
        name: "active-deadline",
        deadline: deadlineStr,
        time: [{ start: "2026-07-15T10:00:00Z", end: null, duration: 0, rounded: 0 }],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue({ start: "2026-07-15T10:00:00Z", end: null, duration: 0, rounded: 0 });

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("active-deadline"));
      expect(line).toContain(GREEN);
      expect(line).not.toContain(RED);
    });

    it("active + unbilled → green (active wins)", async () => {
      const config = makeConfig({
        name: "active-unbilled",
        time: [{ start: "2026-07-15T10:00:00Z", end: null, duration: 0, rounded: 0 }],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue({ start: "2026-07-15T10:00:00Z", end: null, duration: 0, rounded: 0 });

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("active-unbilled"));
      expect(line).toContain(GREEN);
      expect(line).not.toContain(YELLOW);
    });

    it("deadline within 7 days + unbilled → yellow (deadline and unbilled both yellow)", async () => {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 2);
      const deadlineStr = deadline.toISOString().slice(0, 10);

      const config = makeConfig({
        name: "deadline-unbilled",
        deadline: deadlineStr,
        time: [{ start: "2026-07-10T10:00:00Z", end: "2026-07-10T11:00:00Z", duration: 3600, rounded: 3600 }],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("deadline-unbilled"));
      expect(line).toContain(YELLOW);
      expect(line).not.toContain(RED);
      expect(line).not.toContain(GREEN);
    });
  });

  // ── Edge cases ──

  describe("edge cases", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-07-17T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("no deadline set → not red, falls through to yellow or white", async () => {
      const config = makeConfig({
        name: "no-deadline",
        time: [{ start: "2026-07-10T10:00:00Z", end: "2026-07-10T11:00:00Z", duration: 3600, rounded: 3600 }],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("no-deadline"));
      expect(line).not.toContain(RED);
    });

    it("deadline exactly 7 days away → yellow", async () => {
      // now = 2026-07-17T12:00:00Z (frozen)
      // deadline "2026-07-23" → code: new Date("2026-07-23T23:59:59Z")
      // diff = 6.5 days, 0 <= diff <= 7 → soon ✓
      const config = makeConfig({
        name: "exact-seven",
        deadline: "2026-07-23",
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("exact-seven"));
      expect(line).toContain(YELLOW);
      expect(line).not.toContain(RED);
    });

    it("deadline 8 days away → not red", async () => {
      // now = 2026-07-17T12:00:00Z (frozen)
      // deadline "2026-07-24" → code: new Date("2026-07-24T23:59:59Z")
      // diff = 7.5 days > 7
      const config = makeConfig({
        name: "eight-days",
        deadline: "2026-07-24",
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("eight-days"));
      expect(line).not.toContain(RED);
    });

    it("deadline in the past (overdue) → red", async () => {
      // now = 2026-07-17T12:00:00Z (frozen)
      // deadline "2026-07-16" → code: new Date("2026-07-16T23:59:59Z")
      // diff = negative → overdue
      const config = makeConfig({
        name: "past-deadline",
        deadline: "2026-07-16",
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("past-deadline"));
      expect(line).toContain(RED);
    });

    it("deadline 2 days ago → red (overdue)", async () => {
      // now = 2026-07-17T12:00:00Z (frozen)
      // deadline "2026-07-15" → code: new Date("2026-07-15T23:59:59Z")
      // diff = negative → overdue
      const config = makeConfig({
        name: "two-days-overdue",
        deadline: "2026-07-15",
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("two-days-overdue"));
      expect(line).toContain(RED);
      expect(line).not.toContain(GREEN);
    });

    it("deadline in 3 days → yellow (soon)", async () => {
      // now = 2026-07-17T12:00:00Z (frozen)
      // deadline "2026-07-20" → code: new Date("2026-07-20T23:59:59Z")
      // diff = 3.5 days, 0 <= diff <= 7 → soon
      const config = makeConfig({
        name: "three-days",
        deadline: "2026-07-20",
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("three-days"));
      expect(line).toContain(YELLOW);
      expect(line).not.toContain(RED);
    });

    it("deadline in 10 days → no deadline color, white when invoiced", async () => {
      // now = 2026-07-17T12:00:00Z (frozen)
      // deadline "2026-07-27" → code: new Date("2026-07-27T23:59:59Z")
      // diff = 10.5 days → neither overdue nor soon
      const config = makeConfig({
        name: "ten-days",
        deadline: "2026-07-27",
        time: [
          { start: "2026-07-10T10:00:00Z", end: "2026-07-10T11:00:00Z", duration: 3600, rounded: 3600, invoiced: true },
        ],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("ten-days"));
      expect(line).toContain(WHITE);
      expect(line).not.toContain(RED);
      expect(line).not.toContain(YELLOW);
    });

    it("active project stays green even when overdue", async () => {
      // now = 2026-07-17T12:00:00Z (frozen)
      // deadline "2026-07-15" → overdue, but active session → green wins
      const config = makeConfig({
        name: "active-overdue",
        deadline: "2026-07-15",
        time: [{ start: "2026-07-17T10:00:00Z", end: null, duration: 0, rounded: 0 }],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue({ start: "2026-07-17T10:00:00Z", end: null, duration: 0, rounded: 0 });

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("active-overdue"));
      expect(line).toContain(GREEN);
      expect(line).not.toContain(RED);
      expect(line).not.toContain(YELLOW);
    });
  });

  // ── Formatting tests ──

  describe("formatting", () => {
    it("long-term prefix ★ preserved before colored name", async () => {
      const config = makeConfig({
        name: "long-term-proj",
        longTerm: true,
        time: [],
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("long-term-proj"));
      expect(line).toContain("★ ");
      expect(line).toContain(WHITE);
    });

    it("header and divider wrapped in DIM", async () => {
      const config = makeConfig({ name: "dim-test", time: [] });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      // First two console.log calls are header and divider
      expect(rawCalls[0]).toMatch(new RegExp(`^\\x1b\\[2m.*\\x1b\\[0m$`));
      expect(rawCalls[1]).toMatch(new RegExp(`^\\x1b\\[2m.*\\x1b\\[0m$`));
    });
  });

  // ── Sort order tests ──

  describe("sort order by hours worked", () => {
    it("sorts projects by total hours worked descending", async () => {
      const proj2h = makeConfig({
        name: "two-hours",
        time: [{ start: "2026-07-01T10:00:00Z", end: "2026-07-01T12:00:00Z", duration: 7200, rounded: 7200 }],
      });
      const proj5h = makeConfig({
        name: "five-hours",
        time: [{ start: "2026-07-01T10:00:00Z", end: "2026-07-01T15:00:00Z", duration: 18000, rounded: 18000 }],
      });
      const proj8h = makeConfig({
        name: "eight-hours",
        time: [{ start: "2026-07-01T10:00:00Z", end: "2026-07-01T18:00:00Z", duration: 28800, rounded: 28800 }],
      });
      // Pass in ascending hours order to prove sort is working
      mockCollectProjects.mockResolvedValue([
        makeProjectEntry(proj2h),
        makeProjectEntry(proj5h),
        makeProjectEntry(proj8h),
      ]);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const projectLines = rawCalls.filter((l: string) =>
        l.includes("eight-hours") || l.includes("five-hours") || l.includes("two-hours"),
      );
      expect(projectLines).toHaveLength(3);

      const eightIdx = projectLines.findIndex((l: string) => l.includes("eight-hours"));
      const fiveIdx = projectLines.findIndex((l: string) => l.includes("five-hours"));
      const twoIdx = projectLines.findIndex((l: string) => l.includes("two-hours"));
      expect(eightIdx).toBeLessThan(fiveIdx);
      expect(fiveIdx).toBeLessThan(twoIdx);
    });

    it("alphabetical tiebreak when hours are equal", async () => {
      const projA = makeConfig({
        name: "alpha-project",
        time: [{ start: "2026-07-01T10:00:00Z", end: "2026-07-01T15:00:00Z", duration: 18000, rounded: 18000 }],
      });
      const projB = makeConfig({
        name: "bravo-project",
        time: [{ start: "2026-07-01T10:00:00Z", end: "2026-07-01T15:00:00Z", duration: 18000, rounded: 18000 }],
      });
      // Pass in reverse alphabetical order to prove sort is working
      mockCollectProjects.mockResolvedValue([
        makeProjectEntry(projB),
        makeProjectEntry(projA),
      ]);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const projectLines = rawCalls.filter((l: string) =>
        l.includes("alpha-project") || l.includes("bravo-project"),
      );
      expect(projectLines).toHaveLength(2);

      const alphaIdx = projectLines.findIndex((l: string) => l.includes("alpha-project"));
      const bravoIdx = projectLines.findIndex((l: string) => l.includes("bravo-project"));
      expect(alphaIdx).toBeLessThan(bravoIdx);
    });

    it("zero hours projects fall to bottom", async () => {
      const proj5h = makeConfig({
        name: "has-hours",
        time: [{ start: "2026-07-01T10:00:00Z", end: "2026-07-01T15:00:00Z", duration: 18000, rounded: 18000 }],
      });
      const proj0h = makeConfig({
        name: "no-hours",
        time: [],
      });
      // Pass zero-hours first to prove sort is working
      mockCollectProjects.mockResolvedValue([
        makeProjectEntry(proj0h),
        makeProjectEntry(proj5h),
      ]);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const projectLines = rawCalls.filter((l: string) =>
        l.includes("has-hours") || l.includes("no-hours"),
      );
      expect(projectLines).toHaveLength(2);

      const hasHoursIdx = projectLines.findIndex((l: string) => l.includes("has-hours"));
      const noHoursIdx = projectLines.findIndex((l: string) => l.includes("no-hours"));
      expect(hasHoursIdx).toBeLessThan(noHoursIdx);
    });

    it("no last-session dependency — hours determine order, not recency", async () => {
      const proj10h = makeConfig({
        name: "big-project",
        time: [{ start: "2026-07-01T10:00:00Z", end: "2026-07-01T20:00:00Z", duration: 36000, rounded: 36000 }],
      });
      const proj1h = makeConfig({
        name: "tiny-project",
        time: [{ start: "2026-07-16T10:00:00Z", end: "2026-07-16T11:00:00Z", duration: 3600, rounded: 3600 }],
      });
      // Pass low-hours recent project first
      mockCollectProjects.mockResolvedValue([
        makeProjectEntry(proj1h),
        makeProjectEntry(proj10h),
      ]);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const projectLines = rawCalls.filter((l: string) =>
        l.includes("big-project") || l.includes("tiny-project"),
      );
      expect(projectLines).toHaveLength(2);

      const bigIdx = projectLines.findIndex((l: string) => l.includes("big-project"));
      const tinyIdx = projectLines.findIndex((l: string) => l.includes("tiny-project"));
      expect(bigIdx).toBeLessThan(tinyIdx);
    });
  });

  // ── Empty state ──

  describe("empty state", () => {
    it("should print message when no projects exist", async () => {
      mockCollectProjects.mockResolvedValue([]);
      await status();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("No active projects"),
      );
    });
  });
});
