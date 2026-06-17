// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import * as fs from "node:fs/promises";
import * as childProcess from "node:child_process";

jest.mock("node:fs/promises");
jest.mock("node:child_process");

const mockWriteFile = fs.writeFile as jest.Mock;
const mockReadFile = fs.readFile as jest.Mock;
const mockUnlink = fs.unlink as jest.Mock;
const mockSpawn = childProcess.spawn as jest.Mock;

let mockOn: jest.Mock;

function setupHandlers(code: number) {
  mockOn.mockImplementation((event: string, handler: (arg: unknown) => void) => {
    if (event === "close") handler(code);
    return { on: mockOn };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOn = jest.fn();
  mockSpawn.mockReturnValue({ on: mockOn });
  setupHandlers(0);
  mockWriteFile.mockResolvedValue(undefined);
  mockReadFile.mockResolvedValue("hello world");
  mockUnlink.mockResolvedValue(undefined);
});

describe("EDITOR constant", () => {
  it("should resolve to the environment editor", async () => {
    const { EDITOR } = await import("../../src/utils/editor.js");
    expect(EDITOR).toBe(process.env.EDITOR || process.env.VISUAL || "vi");
  });
});

describe("openEditor", () => {
  it("should spawn the editor with the given file path", async () => {
    const { openEditor, EDITOR } = await import("../../src/utils/editor.js");
    await openEditor("/some/file.md");

    expect(mockSpawn).toHaveBeenCalledWith(EDITOR, ["/some/file.md"], { stdio: "inherit" });
  });

  it("should resolve when editor exits with code 0", async () => {
    const { openEditor } = await import("../../src/utils/editor.js");
    await expect(openEditor("/some/file.md")).resolves.toBeUndefined();
  });

  it("should reject when editor exits with non-zero code", async () => {
    setupHandlers(1);
    const { openEditor } = await import("../../src/utils/editor.js");
    await expect(openEditor("/some/file.md")).rejects.toThrow("Editor exited with code 1");
  });

  it("should reject on spawn error", async () => {
    mockOn.mockImplementation((event: string, handler: (err: Error) => void) => {
      if (event === "error") handler(new Error("ENOENT"));
      return { on: mockOn };
    });
    const { openEditor } = await import("../../src/utils/editor.js");
    await expect(openEditor("/some/file.md")).rejects.toThrow("Failed to open editor");
  });
});

describe("openEditorDetached", () => {
  it("should spawn the editor and return immediately", async () => {
    const { openEditorDetached, EDITOR } = await import("../../src/utils/editor.js");
    await openEditorDetached("/some/file.md");

    expect(mockSpawn).toHaveBeenCalledWith(EDITOR, ["/some/file.md"], { stdio: "inherit" });
  });

  it("should return a resolved promise", async () => {
    const { openEditorDetached } = await import("../../src/utils/editor.js");
    await expect(openEditorDetached("/some/file.md")).resolves.toBeUndefined();
  });
});

describe("editTempFile", () => {
  it("should create temp file, open editor, read back, and clean up", async () => {
    const { editTempFile } = await import("../../src/utils/editor.js");
    const result = await editTempFile("grind", "initial content");

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringMatching(/\/grind-\d+\.md$/),
      "initial content",
      "utf-8",
    );
    expect(mockSpawn).toHaveBeenCalled();
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\/grind-\d+\.md$/),
      "utf-8",
    );
    expect(mockUnlink).toHaveBeenCalledWith(
      expect.stringMatching(/\/grind-\d+\.md$/),
    );
    expect(result).toBe("hello world");
  });

  it("should clean up temp file on editor error", async () => {
    setupHandlers(1);
    const { editTempFile } = await import("../../src/utils/editor.js");
    await expect(editTempFile("grind", "content")).rejects.toThrow();
    expect(mockUnlink).toHaveBeenCalled();
  });

  it("should use empty string when no initial content provided", async () => {
    const { editTempFile } = await import("../../src/utils/editor.js");
    await editTempFile("test");

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      "",
      "utf-8",
    );
  });
});
