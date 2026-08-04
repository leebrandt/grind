import { configSet, configList, resolveProjectArg } from "../../src/commands/config.js";
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
      await configSet("deadline", "2026-08-15", "test-project", {});
      expect(mockWriteProjectConfig).toHaveBeenCalledWith(
        expect.any(String),
        "test-project",
        expect.objectContaining({ deadline: "2026-08-15" }),
      );
    });

    it("should accept Dec 31", async () => {
      await configSet("deadline", "2026-12-31", "test-project", {});
      expect(mockWriteProjectConfig).toHaveBeenCalledWith(
        expect.any(String),
        "test-project",
        expect.objectContaining({ deadline: "2026-12-31" }),
      );
    });

    it("should reject MM-DD-YYYY format", async () => {
      await expect(configSet("deadline", "08-15-2026", "test-project", {})).rejects.toThrow(GrindUserError);
      await expect(configSet("deadline", "08-15-2026", "test-project", {})).rejects.toThrow("YYYY-MM-DD");
    });

    it("should reject non-date strings", async () => {
      await expect(configSet("deadline", "not-a-date", "test-project", {})).rejects.toThrow(GrindUserError);
    });

    it("should reject invalid month", async () => {
      await expect(configSet("deadline", "2026-13-01", "test-project", {})).rejects.toThrow(GrindUserError);
    });

    it("should reject invalid day", async () => {
      await expect(configSet("deadline", "2026-02-30", "test-project", {})).rejects.toThrow(GrindUserError);
    });

    it("should write to global config when projectName is null", async () => {
      await configSet("currency", "USD", null, {});
      expect(mockWriteGrindConfig).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ currency: "USD" }),
      );
    });
  });

  describe("configList with deadline", () => {
    it("should display deadline when set", async () => {
      mockReadProjectConfig.mockResolvedValue({
        ...baseConfig,
        deadline: "2026-08-15",
      });
      await configList("test-project", {});
      expect(console.log).toHaveBeenCalledWith("deadline = 2026-08-15");
    });

    it("should not display deadline when not set", async () => {
      mockReadProjectConfig.mockResolvedValue({ ...baseConfig });
      await configList("test-project", {});
      const calls = (console.log as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls).not.toContainEqual(expect.stringContaining("deadline"));
    });
  });
});

describe("resolveProjectArg", () => {
  it("should return the positional project when only positional is set", () => {
    expect(resolveProjectArg("my-project", undefined, false)).toBe("my-project");
  });

  it("should return the -p/--project flag when only the flag is set", () => {
    expect(resolveProjectArg(undefined, "my-project", false)).toBe("my-project");
  });

  it("should return the value when both forms are set to the same value", () => {
    expect(resolveProjectArg("my-project", "my-project", false)).toBe("my-project");
  });

  it("should throw GrindUserError when both forms are set to different values", () => {
    let error: GrindUserError | undefined;
    try {
      resolveProjectArg("positional-project", "flag-project", false);
    } catch (e) {
      error = e as GrindUserError;
    }
    expect(error).toBeInstanceOf(GrindUserError);
    expect(error?.message).toContain("positional-project");
    expect(error?.message).toContain("flag-project");
    expect(error?.exitCode).toBe(1);
  });

  it("should throw GrindUserError when -p/--project is combined with -g/--global", () => {
    let error: GrindUserError | undefined;
    try {
      resolveProjectArg(undefined, "my-project", true);
    } catch (e) {
      error = e as GrindUserError;
    }
    expect(error).toBeInstanceOf(GrindUserError);
    expect(error?.message).toBe("Cannot use -p/--project with -g/--global");
    expect(error?.exitCode).toBe(1);
  });

  it("should return undefined when no project and not global", () => {
    expect(resolveProjectArg(undefined, undefined, false)).toBeUndefined();
  });
});
