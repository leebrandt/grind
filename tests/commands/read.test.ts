import { readJournal } from "../../src/commands/read.js";
import { readdir, readFile } from "node:fs/promises";

jest.mock("node:fs/promises");
jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockResolvedValue({ mainWorktree: "/w/grind" }),
}));

describe("readJournal", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("prints every journal entry oldest first with long-form date headers", async () => {
    (readdir as jest.Mock).mockResolvedValue(["2026-08-03.md", "2026-08-04.md"]);
    (readFile as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith("2026-08-03.md")) return Promise.resolve("Monday entry.");
      return Promise.resolve("Wrote the spec.\n\nDone.\n");
    });

    await readJournal({});

    const expected =
      "─── Monday, August 3, 2026 ───\n\n" +
      "Monday entry.\n\n" +
      "─── Tuesday, August 4, 2026 ───\n\n" +
      "Wrote the spec.\n\nDone.\n";

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(expected);
  });

  it("prints newest first when reverse is set", async () => {
    (readdir as jest.Mock).mockResolvedValue(["2026-08-03.md", "2026-08-04.md"]);
    (readFile as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith("2026-08-03.md")) return Promise.resolve("Monday entry.");
      return Promise.resolve("Wrote the spec.\n\nDone.\n");
    });

    await readJournal({ reverse: true });

    const expected =
      "─── Tuesday, August 4, 2026 ───\n\n" +
      "Wrote the spec.\n\nDone.\n\n\n" +
      "─── Monday, August 3, 2026 ───\n\n" +
      "Monday entry.";

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(expected);
  });

  it("does not emit ANSI escape codes", async () => {
    (readdir as jest.Mock).mockResolvedValue(["2026-08-03.md", "2026-08-04.md"]);
    (readFile as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith("2026-08-03.md")) return Promise.resolve("Monday entry.");
      return Promise.resolve("Wrote the spec.\n\nDone.\n");
    });

    await readJournal({});

    const output = (consoleLogSpy.mock.calls[0] as string[])[0];
    expect(output).not.toContain("\x1b[");
  });

  it("prints nothing when the journal is empty", async () => {
    (readdir as jest.Mock).mockResolvedValue([]);

    await expect(readJournal({})).resolves.toBeUndefined();

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("prints the date header for an empty entry file", async () => {
    (readdir as jest.Mock).mockResolvedValue(["2026-08-03.md"]);
    (readFile as jest.Mock).mockResolvedValue("");

    await readJournal({});

    const expected = "─── Monday, August 3, 2026 ───\n\n";
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(expected);
  });
});
