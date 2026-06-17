import { pruneIdeas } from "../../src/commands/prune.js";

jest.mock("node:fs/promises");
jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockResolvedValue({
    mainWorktree: "/home/user/workspace/grind",
  }),
}));
jest.mock("../../src/utils/git.js", () => ({
  gitCommit: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/utils/prompts.js");

import * as fs from "node:fs/promises";
import { confirmOrExit } from "../../src/utils/prompts.js";

describe("pruneIdeas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    (fs.readdir as jest.Mock).mockResolvedValue([
      "rejected-wrong.md",
      "rejected-bad.md",
      "good-idea.md",
    ]);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
  });

  it("should skip confirmation when yes flag is true", async () => {
    await pruneIdeas({ yes: true });
    expect(confirmOrExit).toHaveBeenCalledWith(expect.any(String), true);
  });

  it("should call confirmOrExit when yes flag is false", async () => {
    (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
    await pruneIdeas({ yes: false });
    expect(confirmOrExit).toHaveBeenCalledTimes(1);
  });

  it("should call confirmOrExit with correct prompt when no flag", async () => {
    (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
    await pruneIdeas();
    expect(confirmOrExit).toHaveBeenCalledWith(
      "Delete 2 rejected idea(s)?",
      false,
    );
  });

  it("should delete files and commit when confirmed", async () => {
    (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
    await pruneIdeas();
    expect(fs.unlink).toHaveBeenCalledTimes(2);
  });

  it("should not proceed when no rejected ideas exist", async () => {
    (fs.readdir as jest.Mock).mockResolvedValue(["good-idea.md"]);
    await pruneIdeas();
    expect(confirmOrExit).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});
