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

    it("red when deadline within 7 days and no active session", async () => {
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
      expect(line).toContain(RED);
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

    it("deadline within 7 days + unbilled → red (deadline beats unbilled)", async () => {
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
      expect(line).toContain(RED);
      expect(line).not.toContain(YELLOW);
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

    it("deadline exactly 7 days away → red", async () => {
      // now = 2026-07-17T12:00:00Z (frozen)
      // deadline "2026-07-23" → code: new Date("2026-07-23T23:59:59Z")
      // diff = 6.5 days <= 7 ✓
      const config = makeConfig({
        name: "exact-seven",
        deadline: "2026-07-23",
      });
      mockCollectProjects.mockResolvedValue([makeProjectEntry(config)]);
      mockGetActiveSession.mockReturnValue(undefined);

      await status();

      const rawCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      const line = rawCalls.find((l: string) => l.includes("exact-seven"));
      expect(line).toContain(RED);
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
