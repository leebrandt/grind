import type { ProjectConfig } from "../../src/types/index.js";
import {
  getActiveSession,
  startSession,
  endSession,
  closeOrphanedSession,
} from "../../src/utils/session.js";

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "test-project",
    idea: "Test idea",
    time: [],
    billing: { roundTo: "quarter-hour", rate: 150 },
    ...overrides,
  };
}

describe("getActiveSession", () => {
  it("should return undefined when no sessions exist", () => {
    const config = makeConfig();
    expect(getActiveSession(config)).toBeUndefined();
  });

  it("should return undefined when all sessions have ended", () => {
    const config = makeConfig({
      time: [
        { start: "2024-01-15T10:00:00Z", end: "2024-01-15T11:00:00Z", duration: 3600, rounded: 3600 },
      ],
    });
    expect(getActiveSession(config)).toBeUndefined();
  });

  it("should return the session with end === null", () => {
    const active = { start: "2024-01-15T12:00:00Z", end: null, duration: 0, rounded: 0 };
    const config = makeConfig({
      time: [
        { start: "2024-01-15T10:00:00Z", end: "2024-01-15T11:00:00Z", duration: 3600, rounded: 3600 },
        active,
      ],
    });
    expect(getActiveSession(config)).toBe(active);
  });
});

describe("startSession", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should add a new session to config.time with end: null", () => {
    const config = makeConfig();
    const session = startSession(config);
    expect(config.time).toHaveLength(1);
    expect(session.start).toBe("2024-06-15T12:00:00.000Z");
    expect(session.end).toBeNull();
    expect(session.duration).toBe(0);
    expect(session.rounded).toBe(0);
  });

  it("should append session to existing time array", () => {
    const existing = { start: "2024-01-15T10:00:00Z", end: "2024-01-15T11:00:00Z", duration: 3600, rounded: 3600 };
    const config = makeConfig({ time: [existing] });
    startSession(config);
    expect(config.time).toHaveLength(2);
    expect(config.time[1].end).toBeNull();
  });
});

describe("endSession", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-06-15T14:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should return undefined when no active session", () => {
    const config = makeConfig();
    expect(endSession(config)).toBeUndefined();
  });

  it("should end the active session and calculate duration", () => {
    const config = makeConfig({
      time: [{ start: "2024-06-15T12:00:00Z", end: null, duration: 0, rounded: 0 }],
      billing: { roundTo: "quarter-hour", rate: 150 },
    });
    const session = endSession(config);
    expect(session).toBeDefined();
    expect(session!.end).toBe("2024-06-15T14:00:00.000Z");
    expect(session!.duration).toBe(7200);
    expect(session!.rounded).toBe(7200);
  });

  it("should use provided endTime when given", () => {
    const config = makeConfig({
      time: [{ start: "2024-06-15T10:00:00Z", end: null, duration: 0, rounded: 0 }],
    });
    const session = endSession(config, "2024-06-15T12:30:00Z");
    expect(session!.end).toBe("2024-06-15T12:30:00Z");
    expect(session!.duration).toBe(9000);
  });

  it("should round by the config billing strategy", () => {
    const config = makeConfig({
      time: [{ start: "2024-06-15T12:00:00Z", end: null, duration: 0, rounded: 0 }],
      billing: { roundTo: "half-hour", rate: 150 },
    });
    const session = endSession(config, "2024-06-15T12:31:00Z");
    expect(session!.duration).toBe(1860);
    expect(session!.rounded).toBe(3600);
  });
});

describe("closeOrphanedSession", () => {
  it("should set end/duration/rounded to zero when active session exists", () => {
    const config = makeConfig({
      time: [{ start: "2024-06-15T10:00:00Z", end: null, duration: 0, rounded: 0 }],
    });
    closeOrphanedSession(config);
    const session = config.time[0];
    expect(session.end).toBe(session.start);
    expect(session.duration).toBe(0);
    expect(session.rounded).toBe(0);
  });

  it("should do nothing when no active session exists", () => {
    const config = makeConfig();
    expect(() => closeOrphanedSession(config)).not.toThrow();
  });
});
