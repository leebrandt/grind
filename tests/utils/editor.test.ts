let execSyncMock: jest.Mock;
let spawnMock: jest.Mock;
let writeFileMock: jest.Mock;
let readFileMock: jest.Mock;
let unlinkMock: jest.Mock;

jest.mock("node:child_process", () => {
  execSyncMock = jest.fn();
  spawnMock = jest.fn();
  return { execSync: execSyncMock, spawn: spawnMock };
});

jest.mock("node:fs/promises", () => {
  writeFileMock = jest.fn().mockResolvedValue(undefined);
  readFileMock = jest.fn().mockResolvedValue("");
  unlinkMock = jest.fn().mockResolvedValue(undefined);
  return { writeFile: writeFileMock, readFile: readFileMock, unlink: unlinkMock };
});

beforeAll(() => {
  process.env.EDITOR = "nvim";
});

describe("editor module", () => {
  let openEditor: (filePath: string) => Promise<void>;
  let openEditorDetached: (filePath: string) => Promise<void>;
  let editTempFile: (prefix: string, initialContent?: string) => Promise<string>;

  beforeAll(async () => {
    jest.resetModules();
    const mod = await import("../../src/utils/editor.js");
    openEditor = mod.openEditor;
    openEditorDetached = mod.openEditorDetached;
    editTempFile = mod.editTempFile;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    writeFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue("# Edited content\nfrom the temp file");
    unlinkMock.mockResolvedValue(undefined);
  });

  describe("openEditor", () => {
    it("should call execSync with editor binary and file path", async () => {
      execSyncMock.mockReturnValue("");
      await openEditor("/path/to/file.md");
      expect(execSyncMock).toHaveBeenCalledWith('"nvim" "/path/to/file.md"', { stdio: "inherit" });
    });

    it("should throw GrindSystemError when execSync fails", async () => {
      execSyncMock.mockImplementation(() => { throw new Error("editor error"); });
      await expect(openEditor("/path/to/file.md")).rejects.toThrow("Editor \"nvim\" exited with an error");
    });
  });

  describe("openEditorDetached", () => {
    it("should spawn editor with file path", async () => {
      spawnMock.mockReturnValue({ on: jest.fn() });
      await openEditorDetached("/path/to/file.md");
      expect(spawnMock).toHaveBeenCalledWith("nvim", ["/path/to/file.md"], { stdio: "inherit" });
    });

    it("should log on non-zero exit code", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      let closeHandler: (code: number) => void = () => {};
      spawnMock.mockReturnValue({
        on: jest.fn((event: string, handler: (code: number) => void) => {
          if (event === "close") closeHandler = handler;
        }),
      });
      await openEditorDetached("/path/to/file.md");
      closeHandler(1);
      expect(consoleSpy).toHaveBeenCalledWith("Editor exited with code 1");
      consoleSpy.mockRestore();
    });
  });

  describe("editTempFile", () => {
    it("should create temp file, open editor, read result, and clean up", async () => {
      execSyncMock.mockReturnValue("");
      const result = await editTempFile("grind-msg");
      expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining("grind-msg"), "", "utf-8");
      expect(readFileMock).toHaveBeenCalledWith(expect.stringContaining("grind-msg"), "utf-8");
      expect(unlinkMock).toHaveBeenCalledWith(expect.stringContaining("grind-msg"));
      expect(result).toBe("# Edited content\nfrom the temp file");
    });

    it("should write initial content when provided", async () => {
      execSyncMock.mockReturnValue("");
      await editTempFile("grind-msg", "initial draft");
      expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining("grind-msg"), "initial draft", "utf-8");
    });

    it("should clean up temp file on editor error", async () => {
      execSyncMock.mockImplementation(() => { throw new Error("editor failed"); });
      unlinkMock.mockRejectedValue(new Error("cleanup error"));
      await expect(editTempFile("grind-msg")).rejects.toThrow();
      expect(unlinkMock).toHaveBeenCalled();
    });
  });
});
