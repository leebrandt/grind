import { showProject } from "../../src/commands/show.js";
import { GrindUserError } from "../../src/utils/errors.js";
import { readFile } from "node:fs/promises";

jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockResolvedValue({
    workspaceRoot: "/home/user/workspace",
  }),
}));
jest.mock("../../src/utils/config.js", () => ({
  readProjectConfig: jest.fn(),
}));
jest.mock("node:fs/promises");

import { readProjectConfig } from "../../src/utils/config.js";

const sampleConfig = {
  name: "test-project",
  idea: "A test project",
  time: [
    { start: "2024-01-15T10:00:00Z", end: "2024-01-15T11:30:00Z", duration: 5400, rounded: 5400, invoiced: false },
    { start: "2024-01-16T14:00:00Z", end: "2024-01-16T15:00:00Z", duration: 3600, rounded: 3600, invoiced: true },
  ],
  billing: { roundTo: "quarter-hour", rate: 150 },
};

describe("showProject", () => {
  const projectName = "test-project";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("default (show idea file)", () => {
    it("should print idea file content when it exists", async () => {
      (readFile as jest.Mock).mockResolvedValue("This is the idea content");
      await showProject(projectName);
      expect(console.log).toHaveBeenCalledWith("This is the idea content");
    });

    it("should throw GrindUserError when idea file does not exist", async () => {
      (readFile as jest.Mock).mockRejectedValue(new Error("ENOENT"));
      await expect(showProject(projectName)).rejects.toThrow(GrindUserError);
      await expect(showProject(projectName)).rejects.toThrow("No idea file found");
    });
  });

  describe("--config flag", () => {
    it("should print the project config as JSON", async () => {
      (readProjectConfig as jest.Mock).mockResolvedValue(sampleConfig);
      await showProject(projectName, { config: true });
      expect(console.log).toHaveBeenCalledWith(JSON.stringify(sampleConfig, null, 2));
    });

    it("should throw when no config exists", async () => {
      (readProjectConfig as jest.Mock).mockResolvedValue(null);
      await expect(showProject(projectName, { config: true })).rejects.toThrow(GrindUserError);
    });
  });

  describe("--sessions flag", () => {
    it("should print each session with duration", async () => {
      (readProjectConfig as jest.Mock).mockResolvedValue(sampleConfig);
      await showProject(projectName, { sessions: true });
      expect(console.log).toHaveBeenCalledTimes(2);
    });

    it("should say no sessions recorded when time is empty", async () => {
      (readProjectConfig as jest.Mock).mockResolvedValue({ ...sampleConfig, time: [] });
      await showProject(projectName, { sessions: true });
      expect(console.log).toHaveBeenCalledWith("No sessions recorded.");
    });

    it("should throw when no config exists", async () => {
      (readProjectConfig as jest.Mock).mockResolvedValue(null);
      await expect(showProject(projectName, { sessions: true })).rejects.toThrow(GrindUserError);
    });
  });

  describe("--billing flag", () => {
    it("should print billing summary with totals", async () => {
      (readProjectConfig as jest.Mock).mockResolvedValue(sampleConfig);
      await showProject(projectName, { billing: true });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Sessions: 2"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Total:"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Billed:"));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Unbilled:"));
    });

    it("should throw when no config exists", async () => {
      (readProjectConfig as jest.Mock).mockResolvedValue(null);
      await expect(showProject(projectName, { billing: true })).rejects.toThrow(GrindUserError);
    });
  });
});
