import { parseDate } from "../../src/utils/dates";
import { GrindUserError } from "../../src/utils/errors";

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-15T12:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("parseDate", () => {
  describe("relative — today/tomorrow", () => {
    it("today", () => expect(parseDate("today")).toBe("2026-07-15"));
    it("tomorrow", () => expect(parseDate("tomorrow")).toBe("2026-07-16"));
  });

  describe("relative — days", () => {
    it("3d", () => expect(parseDate("3d")).toBe("2026-07-18"));
    it("3days", () => expect(parseDate("3days")).toBe("2026-07-18"));
    it("1d", () => expect(parseDate("1d")).toBe("2026-07-16"));
  });

  describe("relative — weeks", () => {
    it("1w", () => expect(parseDate("1w")).toBe("2026-07-22"));
    it("1week", () => expect(parseDate("1week")).toBe("2026-07-22"));
    it("2w", () => expect(parseDate("2w")).toBe("2026-07-29"));
  });

  describe("absolute — MMDD", () => {
    it("0720", () => expect(parseDate("0720")).toBe("2026-07-20"));
    it("1225", () => expect(parseDate("1225")).toBe("2026-12-25"));
    it("0101", () => expect(parseDate("0101")).toBe("2026-01-01"));
  });

  describe("absolute — MMDDYY", () => {
    it("072026", () => expect(parseDate("072026")).toBe("2026-07-20"));
    it("122525", () => expect(parseDate("122525")).toBe("2025-12-25"));
  });

  describe("absolute — YYYYMMDD", () => {
    it("20260720", () => expect(parseDate("20260720")).toBe("2026-07-20"));
  });

  describe("absolute — ISO", () => {
    it("2026-07-20", () => expect(parseDate("2026-07-20")).toBe("2026-07-20"));
  });

  describe("error cases", () => {
    it("banana — unparseable", () => {
      expect(() => parseDate("banana")).toThrow(GrindUserError);
    });
    it("1340 — invalid month", () => {
      expect(() => parseDate("1340")).toThrow(GrindUserError);
    });
    it("0230 — invalid day for Feb", () => {
      expect(() => parseDate("0230")).toThrow(GrindUserError);
    });
    it("empty string", () => {
      expect(() => parseDate("")).toThrow(GrindUserError);
    });
  });

  describe("case insensitivity", () => {
    it("Tomorrow", () => expect(parseDate("Tomorrow")).toBe("2026-07-16"));
    it("3DAYS", () => expect(parseDate("3DAYS")).toBe("2026-07-18"));
  });

  describe("leading/trailing whitespace", () => {
    it(" tomorrow ", () => expect(parseDate(" tomorrow ")).toBe("2026-07-16"));
  });
});
