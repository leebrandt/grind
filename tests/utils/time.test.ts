import {
  calculateDuration,
  roundTimeByStrategy,
  timeAgo,
  formatDate,
  getTimestampFilename,
  toLocalDateString,
  parseDuration,
} from "../../src/utils/time.js";

describe("calculateDuration", () => {
  it("should return correct seconds between two timestamps", () => {
    const result = calculateDuration("2024-01-15T10:00:00Z", "2024-01-15T11:30:00Z");
    expect(result).toBe(5400);
  });

  it("should return 0 for same timestamps", () => {
    const result = calculateDuration("2024-01-15T10:00:00Z", "2024-01-15T10:00:00Z");
    expect(result).toBe(0);
  });

  it("should handle multi-day durations", () => {
    const result = calculateDuration("2024-01-15T10:00:00Z", "2024-01-17T10:00:00Z");
    expect(result).toBe(172800);
  });

  it("should floor fractional seconds", () => {
    const result = calculateDuration("2024-01-15T10:00:00.500Z", "2024-01-15T10:00:01.200Z");
    expect(result).toBe(0);
  });
});

describe("roundTimeByStrategy", () => {
  it("should round up to nearest quarter hour", () => {
    expect(roundTimeByStrategy(1, "quarter-hour")).toBe(900);
    expect(roundTimeByStrategy(900, "quarter-hour")).toBe(900);
    expect(roundTimeByStrategy(901, "quarter-hour")).toBe(1800);
    expect(roundTimeByStrategy(3599, "quarter-hour")).toBe(3600);
  });

  it("should round up to nearest half hour", () => {
    expect(roundTimeByStrategy(1, "half-hour")).toBe(1800);
    expect(roundTimeByStrategy(1800, "half-hour")).toBe(1800);
    expect(roundTimeByStrategy(1801, "half-hour")).toBe(3600);
  });

  it("should round up to nearest hour", () => {
    expect(roundTimeByStrategy(1, "hour")).toBe(3600);
    expect(roundTimeByStrategy(3600, "hour")).toBe(3600);
    expect(roundTimeByStrategy(3601, "hour")).toBe(7200);
  });

  it("should handle zero seconds", () => {
    expect(roundTimeByStrategy(0, "quarter-hour")).toBe(0);
    expect(roundTimeByStrategy(0, "half-hour")).toBe(0);
    expect(roundTimeByStrategy(0, "hour")).toBe(0);
  });
});

describe("timeAgo", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("should return 'just now' for less than 60 seconds", () => {
    expect(timeAgo(new Date("2024-06-15T11:59:59Z"))).toBe("just now");
  });

  it("should return minutes for < 60 minutes", () => {
    expect(timeAgo(new Date("2024-06-15T11:55:00Z"))).toBe("5m ago");
  });

  it("should return hours for < 24 hours", () => {
    expect(timeAgo(new Date("2024-06-15T10:00:00Z"))).toBe("2h ago");
  });

  it("should return days for < 30 days", () => {
    expect(timeAgo(new Date("2024-06-10T12:00:00Z"))).toBe("5d ago");
  });

  it("should return months for < 12 months", () => {
    expect(timeAgo(new Date("2024-03-15T12:00:00Z"))).toBe("3mo ago");
  });

  it("should return years for >= 12 months", () => {
    expect(timeAgo(new Date("2023-06-15T12:00:00Z"))).toBe("1y ago");
  });
});

describe("formatDate", () => {
  it("should return YYYY-MM-DD from ISO string", () => {
    expect(formatDate("2024-01-15T10:00:00Z")).toBe("2024-01-15");
  });

  it("should handle string with no time component", () => {
    expect(formatDate("2024-12-25")).toBe("2024-12-25");
  });
});

describe("parseDuration", () => {
  it("parses bare decimal hours", () => {
    expect(parseDuration("5")).toBe(5);
    expect(parseDuration("2.5")).toBe(2.5);
  });

  it("parses hours with h suffix", () => {
    expect(parseDuration("5h")).toBe(5);
    expect(parseDuration("1.5h")).toBe(1.5);
    expect(parseDuration("8h")).toBe(8);
  });

  it("parses minutes with m suffix", () => {
    expect(parseDuration("90m")).toBe(1.5);
    expect(parseDuration("30m")).toBe(0.5);
  });

  it("parses combined hours and minutes", () => {
    expect(parseDuration("1h30m")).toBe(1.5);
    expect(parseDuration("1h 30m")).toBe(1.5);
  });

  it("is case-insensitive for suffixes", () => {
    expect(parseDuration("5H")).toBe(5);
    expect(parseDuration("90M")).toBe(1.5);
  });

  it("returns null for invalid input", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("1x")).toBeNull();
    expect(parseDuration("h")).toBeNull();
    expect(parseDuration("  ")).toBeNull();
  });
});

describe("getTimestampFilename", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-06-15T14:30:22Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should return a 14-digit string", () => {
    const result = getTimestampFilename();
    expect(result).toMatch(/^\d{14}$/);
  });

  it("should start with the current year", () => {
    const result = getTimestampFilename();
    expect(result.startsWith("2024")).toBe(true);
  });
});

describe("toLocalDateString", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("formats a local-time constructor date with zero-padded month", () => {
    expect(toLocalDateString(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("formats a local-time constructor date in mid-year", () => {
    expect(toLocalDateString(new Date(2026, 6, 4))).toBe("2026-07-04");
  });

  it("formats a local-time constructor date at year end", () => {
    expect(toLocalDateString(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("uses the current date when no argument is given", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 3, 9));
    expect(toLocalDateString()).toBe("2026-04-09");
  });
});
