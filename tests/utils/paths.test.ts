import path from "node:path";
import {
  getMainWorktreePath,
  getBareRepoPath,
  getGrindConfigPath,
  getProjectConfigPath,
  getMainProjectConfigPath,
  getProjectIdeaFilePath,
  getProjectWorktreePath,
  getProjectFilesPath,
  getIdeasDirPath,
  getJournalDirPath,
  getProjectsDirPath,
  getProjectDirInMainPath,
  getInvoiceDirPath,
} from "../../src/utils/paths.ts";

const workspaceRoot = "/home/user/work";
const mainWorktree = path.join(workspaceRoot, "grind");
const projectName = "my-project";

describe("getMainWorktreePath", () => {
  it("returns workspaceRoot/grind", () => {
    expect(getMainWorktreePath(workspaceRoot)).toBe("/home/user/work/grind");
  });
});

describe("getBareRepoPath", () => {
  it("returns workspaceRoot/.grind.repo.git", () => {
    expect(getBareRepoPath(workspaceRoot)).toBe("/home/user/work/.grind.repo.git");
  });
});

describe("getGrindConfigPath", () => {
  it("returns mainWorktree/.grind.json", () => {
    expect(getGrindConfigPath(mainWorktree)).toBe("/home/user/work/grind/.grind.json");
  });
});

describe("getProjectConfigPath", () => {
  it("returns project config path under main worktree (single source of truth)", () => {
    expect(getProjectConfigPath(workspaceRoot, projectName)).toBe(
      "/home/user/work/grind/projects/my-project/.project.json"
    );
  });
});

describe("getMainProjectConfigPath", () => {
  it("returns project config path under main worktree", () => {
    expect(getMainProjectConfigPath(mainWorktree, projectName)).toBe(
      "/home/user/work/grind/projects/my-project/.project.json"
    );
  });
});

describe("getProjectIdeaFilePath", () => {
  it("returns the-idea.md path under main worktree", () => {
    expect(getProjectIdeaFilePath(workspaceRoot, projectName)).toBe(
      "/home/user/work/grind/projects/my-project/the-idea.md"
    );
  });
});

describe("getProjectWorktreePath", () => {
  it("returns project worktree path", () => {
    expect(getProjectWorktreePath(workspaceRoot, projectName)).toBe(
      "/home/user/work/my-project"
    );
  });
});

describe("getProjectFilesPath", () => {
  it("returns project files directory", () => {
    expect(getProjectFilesPath(workspaceRoot, projectName)).toBe(
      "/home/user/work/my-project/projects/my-project"
    );
  });
});

describe("getIdeasDirPath", () => {
  it("returns ideas directory under main worktree", () => {
    expect(getIdeasDirPath(mainWorktree)).toBe("/home/user/work/grind/ideas");
  });
});

describe("getJournalDirPath", () => {
  it("returns journal directory under main worktree", () => {
    expect(getJournalDirPath(mainWorktree)).toBe("/home/user/work/grind/journal");
  });
});

describe("getProjectsDirPath", () => {
  it("returns projects directory under main worktree", () => {
    expect(getProjectsDirPath(mainWorktree)).toBe("/home/user/work/grind/projects");
  });
});

describe("getProjectDirInMainPath", () => {
  it("returns project directory under main worktree's projects", () => {
    expect(getProjectDirInMainPath(mainWorktree, projectName)).toBe(
      "/home/user/work/grind/projects/my-project"
    );
  });
});

describe("getInvoiceDirPath", () => {
  it("returns invoice directory with timestamp", () => {
    expect(getInvoiceDirPath(mainWorktree, projectName, "2026-01-27T14-30-15")).toBe(
      "/home/user/work/grind/projects/my-project/invoices/2026-01-27T14-30-15"
    );
  });
});
