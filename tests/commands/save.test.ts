import { save } from "../../src/commands/save.js";

jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockResolvedValue({
    workspaceRoot: "/home/user/workspace",
  }),
}));
jest.mock("../../src/utils/config.js", () => ({
  readProjectConfig: jest
    .fn()
    .mockResolvedValue({
      name: "test-project",
      idea: "Test",
      time: [],
      billing: { roundTo: "quarter-hour", rate: 150 },
    }),
  writeProjectConfig: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/utils/session.js", () => ({
  getActiveSession: jest.fn().mockReturnValue(null),
  endSession: jest.fn().mockReturnValue(undefined),
}));
jest.mock("../../src/utils/git.js", () => ({
  gitCommit: jest.fn().mockResolvedValue(undefined),
  gitCommitInteractive: jest.fn().mockResolvedValue(undefined),
  hasUncommittedChanges: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../src/utils/prompts.js");

import { confirmOrExit } from "../../src/utils/prompts.js";
import { gitCommitInteractive, gitCommit } from "../../src/utils/git.js";

describe("save", () => {
  const projectName = "test-project";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should auto-commit with generated message when yes flag is true", async () => {
    await save(projectName, { yes: true });
    expect(gitCommitInteractive).not.toHaveBeenCalled();
    expect(gitCommit).toHaveBeenCalledTimes(1);
    expect(gitCommit).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("Save"),
    );
  });

  it("should open interactive commit when no quiet or yes flag", async () => {
    await save(projectName);
    expect(gitCommitInteractive).toHaveBeenCalledTimes(1);
    expect(gitCommit).not.toHaveBeenCalled();
  });
});
