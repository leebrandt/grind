import { cancelProject } from "../../src/commands/cancel.js";
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
  fileExists: jest.fn().mockImplementation((p: string) =>
    Promise.resolve(p.includes("test-project")),
  ),
}));
jest.mock("../../src/utils/git.js", () => ({
  gitCommit: jest.fn().mockResolvedValue(undefined),
  removeProject: jest.fn().mockResolvedValue({
    worktreeRemoved: true,
    localDeleted: true,
    remoteDeleted: true,
  }),
  formatShellError: jest.fn().mockReturnValue(""),
}));
jest.mock("../../src/utils/config.js", () => ({
  readProjectConfig: jest.fn().mockResolvedValue({ name: "test-project", status: "active" }),
  writeProjectConfig: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/utils/prompts.js");

import { confirmOrExit } from "../../src/utils/prompts.js";
import { fileExists } from "../../src/utils/files.js";
import { removeProject } from "../../src/utils/git.js";

describe("cancelProject", () => {
  const projectName = "test-project";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should skip confirmation when yes flag is true", async () => {
    await cancelProject(projectName, { yes: true });
    expect(confirmOrExit).toHaveBeenCalledWith(expect.any(String), true);
  });

  it("should call confirmOrExit when yes flag is false", async () => {
    (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
    await cancelProject(projectName, { yes: false });
    expect(confirmOrExit).toHaveBeenCalledTimes(1);
  });

  it("should call confirmOrExit with correct prompt when no flag", async () => {
    (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
    await cancelProject(projectName);
    expect(confirmOrExit).toHaveBeenCalledWith(
      expect.stringContaining("Cancel project 'test-project'?"),
      false,
    );
  });

  it("should use --force for worktree removal when -f is passed", async () => {
    (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
    await cancelProject(projectName, { force: true, yes: true });
    expect(removeProject).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      projectName,
      { force: true, deleteRemote: true },
    );
  });

  it("should throw when project worktree does not exist", async () => {
    (fileExists as jest.Mock).mockResolvedValue(false);
    await expect(cancelProject("nonexistent")).rejects.toThrow(GrindUserError);
  });
});
