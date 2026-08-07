import { listJournalEntries, readJournalEntry } from "../../src/utils/journal.js";
import { readdir, readFile } from "node:fs/promises";

jest.mock("node:fs/promises");

describe("listJournalEntries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns filenames sorted chronologically regardless of readdir order", async () => {
    (readdir as jest.Mock).mockResolvedValue([
      "2026-08-04.md",
      "2026-08-01.md",
      "2026-08-03.md",
    ]);

    const result = await listJournalEntries("/w/grind/journal");

    expect(result).toEqual([
      "2026-08-01.md",
      "2026-08-03.md",
      "2026-08-04.md",
    ]);
    expect(readdir).toHaveBeenCalledWith("/w/grind/journal");
  });

  it("returns [] when readdir rejects with ENOENT", async () => {
    const error = new Error("ENOENT") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    (readdir as jest.Mock).mockRejectedValue(error);

    await expect(listJournalEntries("/w/grind/journal")).resolves.toEqual([]);
  });

  it("propagates non-ENOENT readdir errors", async () => {
    const error = new Error("EACCES") as NodeJS.ErrnoException;
    error.code = "EACCES";
    (readdir as jest.Mock).mockRejectedValue(error);

    await expect(listJournalEntries("/w/grind/journal")).rejects.toThrow("EACCES");
  });
});

describe("readJournalEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves with file content read from journalDir/filename", async () => {
    (readFile as jest.Mock).mockResolvedValue("Wrote the spec.\n\nDone.\n");

    const result = await readJournalEntry("/w/grind/journal", "2026-08-04.md");

    expect(result).toBe("Wrote the spec.\n\nDone.\n");
    expect(readFile).toHaveBeenCalledWith("/w/grind/journal/2026-08-04.md", "utf-8");
  });
});
