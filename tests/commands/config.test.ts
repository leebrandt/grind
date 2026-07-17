import { configSet, configList } from "../../src/commands/config.js";
import { GrindUserError } from "../../src/utils/errors.js";

const mockReadProjectConfig = jest.fn();
const mockWriteProjectConfig = jest.fn().mockResolvedValue(undefined);
const mockReadGrindConfig = jest.fn();
const mockWriteGrindConfig = jest.fn().mockResolvedValue(undefined);

jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockResolvedValue({
    workspaceRoot: "/home/user/workspace",
    mainWorktree: "/home/user/workspace/grind",
  }),
  getCurrentProjectName: jest.fn().mockResolvedValue("test-project"),
}));
jest.mock("../../src/utils/config.js", () => ({
  readProjectConfig: (...args: unknown[]) => mockReadProjectConfig(...args),
  writeProjectConfig: (...args: unknown[]) => mockWriteProjectConfig(...args),
  readGrindConfig: (...args: unknown[]) => mockReadGrindConfig(...args),
  writeGrindConfig: (...args: unknown[]) => mockWriteGrindConfig(...args),
}));

const baseConfig = {
  name: "test-project",
  idea: "Test",
  time: [],
  billing: { roundTo: "quarter-hour", rate: 150 },
};

describe("config command — deadline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    mockReadProjectConfig.mockResolvedValue({ ...baseConfig });
    mockReadGrindConfig.mockResolvedValue({
      billing: { roundTo: "quarter-hour", defaultRate: 150 },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("configSet with deadline", () => {
    it("should accept a valid YYYY-MM-DD date", async () => {
      await configSet("deadline", "2026-08-15", {});
      expect(mockWriteProjectConfig).toHaveBeenCalledWith(
        expect.any(String),
        "test-project",
        expect.objectContaining({ deadline: "2026-08-15" }),
      );
    });

    it("should accept Dec 31", async () => {
      await configSet("deadline", "2026-12-31", {});
      expect(mockWriteProjectConfig).toHaveBeenCalledWith(
        expect.any(String),
        "test-project",
        expect.objectContaining({ deadline: "2026-12-31" }),
      );
    });

    it("should reject MM-DD-YYYY format", async () => {
      await expect(configSet("deadline", "08-15-2026", {})).rejects.toThrow(GrindUserError);
      await expect(configSet("deadline", "08-15-2026", {})).rejects.toThrow("YYYY-MM-DD");
    });

    it("should reject non-date strings", async () => {
      await expect(configSet("deadline", "not-a-date", {})).rejects.toThrow(GrindUserError);
    });

    it("should reject invalid month", async () => {
      await expect(configSet("deadline", "2026-13-01", {})).rejects.toThrow(GrindUserError);
    });

    it("should reject invalid day", async () => {
      await expect(configSet("deadline", "2026-02-30", {})).rejects.toThrow(GrindUserError);
    });
  });

  describe("configList with deadline", () => {
    it("should display deadline when set", async () => {
      mockReadProjectConfig.mockResolvedValue({
        ...baseConfig,
        deadline: "2026-08-15",
      });
      await configList({});
      expect(console.log).toHaveBeenCalledWith("deadline = 2026-08-15");
    });

    it("should not display deadline when not set", async () => {
      mockReadProjectConfig.mockResolvedValue({ ...baseConfig });
      await configList({});
      const calls = (console.log as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls).not.toContainEqual(expect.stringContaining("deadline"));
    });
  });
});
