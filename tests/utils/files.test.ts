import * as fs from "node:fs/promises";
import { fileExists, getIdeaByNumber } from "../../src/utils/files.js";

jest.mock("node:fs/promises");

jest.mock("../../src/utils/workspace.js", () => ({
  findMainWorktree: jest.fn(),
}));
import { findMainWorktree } from "../../src/utils/workspace.js";

describe("fileExists", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return true when stat succeeds", async () => {
    (fs.stat as jest.Mock).mockResolvedValue(undefined);
    const result = await fileExists("/some/path");
    expect(result).toBe(true);
  });

  it("should return false when stat throws", async () => {
    (fs.stat as jest.Mock).mockRejectedValue(new Error("ENOENT"));
    const result = await fileExists("/nonexistent");
    expect(result).toBe(false);
  });
});

describe("getIdeaByNumber", () => {
  const mainWorktree = "/home/user/workspace/grind";

  beforeEach(() => {
    jest.clearAllMocks();
    (findMainWorktree as jest.Mock).mockResolvedValue(mainWorktree);
    (fs.readdir as jest.Mock).mockResolvedValue([
      "20240101000000.md",
      "20240102000000.md",
      "rejected-old-idea.md",
    ]);
    (fs.readFile as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith("20240101000000.md")) return Promise.resolve("First idea content");
      if (filePath.endsWith("20240102000000.md")) return Promise.resolve("Second idea content");
      return Promise.reject(new Error("not found"));
    });
  });

  it("should return the idea by 0-based index", async () => {
    const result = await getIdeaByNumber(0);
    expect(result).toEqual({ filename: "20240101000000.md", content: "First idea content" });
  });

  it("should return the second idea with index 1", async () => {
    const result = await getIdeaByNumber(1);
    expect(result).toEqual({ filename: "20240102000000.md", content: "Second idea content" });
  });

  it("should return null for out-of-range index", async () => {
    const result = await getIdeaByNumber(10);
    expect(result).toBeNull();
  });

  it("should return null for negative index", async () => {
    const result = await getIdeaByNumber(-1);
    expect(result).toBeNull();
  });

  it("should filter out rejected ideas by default", async () => {
    const result = await getIdeaByNumber(0);
    expect(result!.filename).not.toContain("rejected-");
  });

  it("should include rejected ideas when includeRejected is true", async () => {
    (fs.readdir as jest.Mock).mockResolvedValue([
      "20240101000000.md",
      "rejected-old-idea.md",
    ]);
    (fs.readFile as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith("20240101000000.md")) return Promise.resolve("Good idea");
      if (filePath.endsWith("rejected-old-idea.md")) return Promise.resolve("Rejected idea");
      return Promise.reject(new Error("not found"));
    });
    const result = await getIdeaByNumber(1, true);
    expect(result!.filename).toBe("rejected-old-idea.md");
    expect(result!.content).toBe("Rejected idea");
  });

  it("should return null when no main worktree found", async () => {
    (findMainWorktree as jest.Mock).mockResolvedValue(null);
    const result = await getIdeaByNumber(0);
    expect(result).toBeNull();
  });
});
