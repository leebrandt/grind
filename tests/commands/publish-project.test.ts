import { publishProject } from "../../src/commands/publish-project.js";
import { GrindUserError } from "../../src/utils/errors.js";

jest.mock("bun");
jest.mock("node:fs/promises");
jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockResolvedValue({
    workspaceRoot: "/home/user/workspace",
    mainWorktree: "/home/user/workspace/grind",
    bareRepo: "/home/user/workspace/.grind.repo.git",
  }),
}));
jest.mock("../../src/utils/files.js", () => ({
  fileExists: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../src/utils/git.js", () => ({
  getDefaultBranch: jest.fn().mockResolvedValue("main"),
  hasUncommittedChanges: jest.fn().mockResolvedValue(false),
  gitDeleteRemoteBranch: jest.fn().mockResolvedValue(true),
  formatShellError: jest.fn().mockReturnValue(""),
  stageFiles: jest.fn().mockResolvedValue(undefined),
  commitOnly: jest.fn().mockResolvedValue(undefined),
  switchBranch: jest.fn().mockResolvedValue(undefined),
  mergeBranch: jest.fn().mockResolvedValue(undefined),
  removeWorktree: jest.fn().mockResolvedValue(undefined),
  deleteLocalBranch: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../src/utils/config.js", () => ({
  readGrindConfig: jest.fn().mockResolvedValue({}),
  readProjectConfig: jest.fn().mockResolvedValue({
    name: "test-project",
    status: "active",
    time: [],
    billing: { roundTo: "quarter-hour", rate: 150 },
  }),
  writeProjectConfig: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/utils/prompts.js");

import { confirmOrExit } from "../../src/utils/prompts.js";

const mock$ = jest.requireMock("bun").$ as jest.Mock;

describe("publishProject", () => {
  const projectName = "test-project";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    mock$.mockImplementation(() => ({
      nothrow: jest.fn().mockResolvedValue({
        stdout: Buffer.from(""),
        exitCode: 0,
      }),
      quiet: jest.fn().mockResolvedValue({
        stdout: Buffer.from(""),
        exitCode: 0,
      }),
    }));
  });

  it("should skip confirmation on delete when yes flag is true", async () => {
    await publishProject(projectName, {
      deleteWorktree: true,
      yes: true,
    });
    expect(confirmOrExit).toHaveBeenCalledWith(expect.any(String), true);
  });

  it("should call confirmOrExit on delete when yes flag is false", async () => {
    (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
    await publishProject(projectName, {
      deleteWorktree: true,
      yes: false,
    });
    expect(confirmOrExit).toHaveBeenCalledTimes(1);
  });

  it("should call confirmOrExit with correct delete prompt", async () => {
    (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
    await publishProject(projectName, {
      deleteWorktree: true,
    });
    expect(confirmOrExit).toHaveBeenCalledWith(
      expect.stringContaining("Delete worktree for 'test-project'?"),
      false,
    );
  });

  it("should not prompt for confirmation when not deleting", async () => {
    await publishProject(projectName);
    expect(confirmOrExit).not.toHaveBeenCalled();
  });

  it("should mention branch deletion in prompt when -D is used", async () => {
    (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
    await publishProject(projectName, {
      deleteBranch: true,
    });
    expect(confirmOrExit).toHaveBeenCalledWith(
      expect.stringContaining("also delete the branch"),
      false,
    );
  });
});
