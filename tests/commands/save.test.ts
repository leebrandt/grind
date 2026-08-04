import { save } from "../../src/commands/save.js";
import { GrindUserError } from "../../src/utils/errors.js";

const mockReadProjectConfig = jest.fn();
const mockWriteProjectConfig = jest.fn().mockResolvedValue(undefined);
const mockGetActiveSession = jest.fn();
const mockEndSession = jest.fn();
const mockGitCommit = jest.fn().mockResolvedValue(undefined);
const mockGitCommitInteractive = jest.fn().mockResolvedValue(undefined);
const mockHasUncommittedChanges = jest.fn().mockResolvedValue(true);
const mockGetRemoteUrl = jest.fn().mockResolvedValue(null);
const mockPushWorkspace = jest.fn().mockResolvedValue(undefined);

jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockResolvedValue({
    workspaceRoot: "/home/user/workspace",
    mainWorktree: "/home/user/workspace/grind",
    bareRepo: "/home/user/workspace/.grind.repo.git",
  }),
}));
jest.mock("../../src/utils/config.js", () => ({
  readProjectConfig: (...args: unknown[]) => mockReadProjectConfig(...args),
  writeProjectConfig: (...args: unknown[]) => mockWriteProjectConfig(...args),
  readGrindConfig: jest.fn().mockResolvedValue({}),
}));
jest.mock("../../src/utils/session.js", () => ({
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
  endSession: (...args: unknown[]) => mockEndSession(...args),
}));
jest.mock("../../src/utils/git.js", () => ({
  gitCommit: (...args: unknown[]) => mockGitCommit(...args),
  gitCommitInteractive: (...args: unknown[]) => mockGitCommitInteractive(...args),
  hasUncommittedChanges: (...args: unknown[]) => mockHasUncommittedChanges(...args),
  getRemoteUrl: (...args: unknown[]) => mockGetRemoteUrl(...args),
  pushWorkspace: (...args: unknown[]) => mockPushWorkspace(...args),
  getDefaultBranch: jest.fn().mockResolvedValue("main"),
  formatShellError: jest.fn().mockReturnValue(""),
}));
jest.mock("../../src/utils/prompts.js");

const baseConfig = {
  name: "test-project",
  idea: "Test",
  time: [],
  billing: { roundTo: "quarter-hour", rate: 150 },
};

describe("save", () => {
  const projectName = "test-project";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    mockReadProjectConfig.mockResolvedValue(baseConfig);
    mockGetActiveSession.mockReturnValue(null);
    mockEndSession.mockReturnValue(undefined);
    mockGetRemoteUrl.mockResolvedValue(null);
    mockPushWorkspace.mockClear();
  });

  describe("push behavior", () => {
    it("should push when no remote or --no-push not given", async () => {
      mockGetRemoteUrl.mockResolvedValue("git@github.com:user/repo.git");
      await save(projectName, { quiet: true });
      expect(mockPushWorkspace).toHaveBeenCalledTimes(1);
    });

    it("should skip push when --no-push given (push: false)", async () => {
      mockGetRemoteUrl.mockResolvedValue("git@github.com:user/repo.git");
      await save(projectName, { quiet: true, push: false });
      expect(mockPushWorkspace).not.toHaveBeenCalled();
    });
  });

  describe("auto-commit behavior", () => {
    it("should auto-commit with generated message when yes flag is true", async () => {
      await save(projectName, { yes: true });
      expect(mockGitCommitInteractive).not.toHaveBeenCalled();
      expect(mockGitCommit).toHaveBeenCalledTimes(1);
      expect(mockGitCommit).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("Save"),
      );
    });

    it("should open interactive commit when no quiet or yes flag", async () => {
      await save(projectName);
      expect(mockGitCommitInteractive).toHaveBeenCalledTimes(1);
      expect(mockGitCommit).not.toHaveBeenCalled();
    });
  });

  describe("backfill time (-t flag and positional [hours])", () => {
    it("should throw GrindUserError when -t is not a positive number", async () => {
      await expect(save(projectName, { time: "0" })).rejects.toThrow(GrindUserError);
      await expect(save(projectName, { time: "0" })).rejects.toThrow(
        "Backfill time must be a positive duration",
      );
    });

    it("should throw GrindUserError when -t is negative", async () => {
      await expect(save(projectName, { time: "-1" })).rejects.toThrow(GrindUserError);
    });

    it("should throw GrindUserError when -t is NaN", async () => {
      await expect(save(projectName, { time: "abc" })).rejects.toThrow(GrindUserError);
    });

    it("should calculate endTime based on active session start and -t hours", async () => {
      mockGetActiveSession.mockReturnValue({
        start: "2024-01-15T10:00:00Z",
        end: null,
        duration: 0,
        rounded: 0,
      });
      mockEndSession.mockReturnValue({
        start: "2024-01-15T10:00:00Z",
        end: "2024-01-15T12:30:00Z",
        duration: 9000,
        rounded: 9000,
      });
      await save(projectName, { time: "2.5" });
      expect(mockEndSession).toHaveBeenCalledWith(
        expect.any(Object),
        "2024-01-15T12:30:00.000Z",
      );
    });

    it("should accept positional [hours] like the -t flag", async () => {
      mockGetActiveSession.mockReturnValue({
        start: "2024-01-15T10:00:00Z",
        end: null,
        duration: 0,
        rounded: 0,
      });
      mockEndSession.mockReturnValue({
        start: "2024-01-15T10:00:00Z",
        end: "2024-01-15T15:00:00Z",
        duration: 18000,
        rounded: 18000,
      });
      await save(projectName, { hours: "5" });
      expect(mockEndSession).toHaveBeenCalledWith(
        expect.any(Object),
        "2024-01-15T15:00:00.000Z",
      );
    });

    it("should parse combined h+m format for positional [hours]", async () => {
      mockGetActiveSession.mockReturnValue({
        start: "2024-01-15T10:00:00Z",
        end: null,
        duration: 0,
        rounded: 0,
      });
      mockEndSession.mockReturnValue({
        start: "2024-01-15T10:00:00Z",
        end: "2024-01-15T11:30:00Z",
        duration: 5400,
        rounded: 5400,
      });
      await save(projectName, { hours: "1h30m" });
      expect(mockEndSession).toHaveBeenCalledWith(
        expect.any(Object),
        "2024-01-15T11:30:00.000Z",
      );
    });

    it("should throw for invalid positional [hours]", async () => {
      await expect(save(projectName, { hours: "banana" })).rejects.toThrow(GrindUserError);
      await expect(save(projectName, { hours: "banana" })).rejects.toThrow(
        "Backfill time must be a positive duration",
      );
    });

    it("should throw when both positional [hours] and -t are given", async () => {
      await expect(save(projectName, { hours: "5", time: "5" })).rejects.toThrow(
        GrindUserError,
      );
      await expect(save(projectName, { hours: "5", time: "5" })).rejects.toThrow(
        "Cannot combine positional [hours] with the -t flag",
      );
    });

    it("should still save when -t is given but no active session", async () => {
      mockGetActiveSession.mockReturnValue(null);
      await save(projectName, { time: "1" });
      expect(mockEndSession).toHaveBeenCalled();
    });

    it("should warn when -t is given but no active session, and still commit/push", async () => {
      mockGetActiveSession.mockReturnValue(null);
      mockGetRemoteUrl.mockResolvedValue("git@github.com:user/repo.git");
      await save(projectName, { time: "1", quiet: true });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          "ignored — no active session found to backfill for 'test-project'",
        ),
      );
      expect(mockGitCommit).toHaveBeenCalledTimes(1);
      expect(mockPushWorkspace).toHaveBeenCalledTimes(1);
    });

    it("should not print the -t warning when -t is not given", async () => {
      mockGetActiveSession.mockReturnValue(null);
      await save(projectName, { quiet: true });

      const logCalls = (console.log as jest.Mock).mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls.some((l: string) => l.includes("ignored"))).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should throw when project config cannot be read", async () => {
      mockReadProjectConfig.mockResolvedValue(null);
      await expect(save(projectName)).rejects.toThrow(GrindUserError);
      await expect(save(projectName)).rejects.toThrow(
        "Could not read .project.json for 'test-project'",
      );
    });
  });
});
