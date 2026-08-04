import { journal } from "../../src/commands/journal.js";

const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockOpenEditorDetached = jest.fn().mockResolvedValue(undefined);

jest.mock("node:fs/promises", () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));
jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockResolvedValue({ mainWorktree: "/w/grind" }),
}));
jest.mock("../../src/utils/editor.js", () => ({
  openEditorDetached: (...args: unknown[]) => mockOpenEditorDetached(...args),
}));

describe("journal", () => {
  const prevTZ = process.env.TZ;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    process.env.TZ = "America/Los_Angeles"; // UTC-7 in August
    // Local 2026-08-02 17:30 — in America/Los_Angeles this is 2026-08-03T00:30:00Z,
    // i.e. local today differs from the UTC date.
    jest.setSystemTime(new Date(2026, 7, 2, 17, 30));
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env.TZ = prevTZ;
  });

  it("opens today's entry using the local date", async () => {
    await journal();

    expect(mockMkdir).toHaveBeenCalledWith("/w/grind/journal", { recursive: true });
    expect(mockOpenEditorDetached).toHaveBeenCalledWith("/w/grind/journal/2026-08-02.md");
  });
});
