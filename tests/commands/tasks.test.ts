import { listAllTasks, listProjectTasks, addTaskToProject, completeProjectTask } from "../../src/commands/tasks.js";
import { GrindUserError } from "../../src/utils/errors.js";

const mockReadProjectConfig = jest.fn();
const mockWriteProjectConfig = jest.fn().mockResolvedValue(undefined);
const mockGetOpenTasks = jest.fn();
const mockGetTasks = jest.fn();
const mockAddTask = jest.fn();
const mockCompleteTask = jest.fn();
const mockParseDate = jest.fn();
const mockCollectProjects = jest.fn();

jest.mock("../../src/utils/workspace.js", () => ({
  requireWorkspace: jest.fn().mockResolvedValue({
    workspaceRoot: "/home/user/workspace",
  }),
}));
jest.mock("../../src/utils/config.js", () => ({
  readProjectConfig: (...args: unknown[]) => mockReadProjectConfig(...args),
  writeProjectConfig: (...args: unknown[]) => mockWriteProjectConfig(...args),
}));
jest.mock("../../src/utils/task.js", () => ({
  getOpenTasks: (...args: unknown[]) => mockGetOpenTasks(...args),
  getTasks: (...args: unknown[]) => mockGetTasks(...args),
  addTask: (...args: unknown[]) => mockAddTask(...args),
  completeTask: (...args: unknown[]) => mockCompleteTask(...args),
}));
jest.mock("../../src/utils/dates.js", () => ({
  parseDate: (...args: unknown[]) => mockParseDate(...args),
}));
jest.mock("../../src/utils/project.js", () => ({
  collectProjects: (...args: unknown[]) => mockCollectProjects(...args),
}));

const baseConfig = {
  name: "test-project",
  idea: "Test",
  time: [],
  billing: { roundTo: "quarter-hour", rate: 150 },
  tasks: [],
};

describe("tasks commands", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    mockReadProjectConfig.mockResolvedValue(baseConfig);
    mockCollectProjects.mockResolvedValue([]);
    mockGetOpenTasks.mockResolvedValue([]);
    mockGetTasks.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("listAllTasks", () => {
    it("shows empty state when no projects have tasks", async () => {
      mockCollectProjects.mockResolvedValue([
        { name: "project-a", config: baseConfig, worktreePath: "/path/a" },
      ]);
      await listAllTasks({});
      expect(console.log).toHaveBeenCalledWith("All caught up! No open tasks.");
    });

    it("prints table with tasks from multiple projects", async () => {
      mockCollectProjects.mockResolvedValue([
        { name: "project-a", config: baseConfig, worktreePath: "/path/a" },
        { name: "project-b", config: { ...baseConfig, name: "project-b" }, worktreePath: "/path/b" },
      ]);
      mockGetOpenTasks.mockImplementation(async (_root: string, name: string) => {
        if (name === "project-a") {
          return [
            { id: 1, description: "Fix bug", done: false, createdAt: "2025-01-01T00:00:00Z", dueDate: "2025-07-20" },
          ];
        }
        return [
          { id: 2, description: "Add feature", done: false, createdAt: "2025-01-01T00:00:00Z" },
        ];
      });

      await listAllTasks({});

      const calls = (console.log as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls.some(c => typeof c === "string" && c.includes("Fix bug"))).toBe(true);
      expect(calls.some(c => typeof c === "string" && c.includes("Add feature"))).toBe(true);
      expect(calls.some(c => typeof c === "string" && c.includes("project-a"))).toBe(true);
      expect(calls.some(c => typeof c === "string" && c.includes("project-b"))).toBe(true);
    });

    it("sorts tasks by due date soonest first", async () => {
      mockCollectProjects.mockResolvedValue([
        { name: "project-a", config: baseConfig, worktreePath: "/path/a" },
      ]);
      mockGetOpenTasks.mockResolvedValue([
        { id: 1, description: "Later task", done: false, createdAt: "2025-01-01T00:00:00Z", dueDate: "2025-12-01" },
        { id: 2, description: "Sooner task", done: false, createdAt: "2025-01-01T00:00:00Z", dueDate: "2025-07-01" },
        { id: 3, description: "No date task", done: false, createdAt: "2025-01-01T00:00:00Z" },
      ]);

      await listAllTasks({});

      const calls = (console.log as jest.Mock).mock.calls.map(c => c[0]);
      const taskLines = calls.filter((c: string) => c.includes("Sooner task") || c.includes("Later task") || c.includes("No date task"));
      const soonerIdx = taskLines.findIndex((c: string) => c.includes("Sooner task"));
      const laterIdx = taskLines.findIndex((c: string) => c.includes("Later task"));
      const noDateIdx = taskLines.findIndex((c: string) => c.includes("No date task"));
      expect(soonerIdx).toBeLessThan(laterIdx);
      expect(laterIdx).toBeLessThan(noDateIdx);
    });

    it("includes completed tasks with -a flag", async () => {
      mockCollectProjects.mockResolvedValue([
        { name: "project-a", config: baseConfig, worktreePath: "/path/a" },
      ]);
      mockGetTasks.mockResolvedValue([
        { id: 1, description: "Done task", done: true, createdAt: "2025-01-01T00:00:00Z", completedAt: "2025-01-02T00:00:00Z" },
        { id: 2, description: "Open task", done: false, createdAt: "2025-01-01T00:00:00Z" },
      ]);

      await listAllTasks({ all: true });

      const calls = (console.log as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls.some(c => typeof c === "string" && c.includes("Done task"))).toBe(true);
      expect(calls.some(c => typeof c === "string" && c.includes("Open task"))).toBe(true);
    });

    it("does not include completed tasks without -a flag", async () => {
      mockCollectProjects.mockResolvedValue([
        { name: "project-a", config: baseConfig, worktreePath: "/path/a" },
      ]);
      mockGetOpenTasks.mockResolvedValue([
        { id: 2, description: "Open task", done: false, createdAt: "2025-01-01T00:00:00Z" },
      ]);
      mockGetTasks.mockResolvedValue([
        { id: 1, description: "Done task", done: true, createdAt: "2025-01-01T00:00:00Z", completedAt: "2025-01-02T00:00:00Z" },
        { id: 2, description: "Open task", done: false, createdAt: "2025-01-01T00:00:00Z" },
      ]);

      await listAllTasks({});

      expect(mockGetOpenTasks).toHaveBeenCalled();
      expect(mockGetTasks).not.toHaveBeenCalled();
      const calls = (console.log as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls.some(c => typeof c === "string" && c.includes("Done task"))).toBe(false);
    });
  });

  describe("listProjectTasks", () => {
    it("prints table with tasks for one project", async () => {
      mockGetOpenTasks.mockResolvedValue([
        { id: 1, description: "Fix bug", done: false, createdAt: "2025-01-01T00:00:00Z" },
      ]);

      await listProjectTasks("test-project", {});

      const calls = (console.log as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls.some(c => typeof c === "string" && c.includes("Fix bug"))).toBe(true);
    });

    it("shows empty state with add hint", async () => {
      await listProjectTasks("test-project", {});

      expect(console.log).toHaveBeenCalledWith(
        'No open tasks. Add one with: grind tasks add test-project "My task"',
      );
    });

    it("throws GrindUserError for nonexistent project", async () => {
      mockReadProjectConfig.mockResolvedValue(null);

      await expect(listProjectTasks("nonexistent", {})).rejects.toThrow(GrindUserError);
    });
  });

  describe("addTaskToProject", () => {
    it("adds task with due date", async () => {
      mockParseDate.mockReturnValue("2025-07-20");
      mockAddTask.mockResolvedValue({ id: 1, description: "Fix bug", done: false, createdAt: "2025-01-01T00:00:00Z", dueDate: "2025-07-20" });

      await addTaskToProject("test-project", "Fix bug", { due: "2025-07-20" });

      expect(mockParseDate).toHaveBeenCalledWith("2025-07-20");
      expect(mockAddTask).toHaveBeenCalledWith(
        "/home/user/workspace",
        "test-project",
        "Fix bug",
        "2025-07-20",
      );
      expect(console.log).toHaveBeenCalledWith("✓ Task 1 added: Fix bug");
    });

    it("adds task without due date", async () => {
      mockAddTask.mockResolvedValue({ id: 1, description: "Fix bug", done: false, createdAt: "2025-01-01T00:00:00Z" });

      await addTaskToProject("test-project", "Fix bug", {});

      expect(mockParseDate).not.toHaveBeenCalled();
      expect(mockAddTask).toHaveBeenCalledWith(
        "/home/user/workspace",
        "test-project",
        "Fix bug",
        undefined,
      );
    });

    it("throws for nonexistent project", async () => {
      mockReadProjectConfig.mockResolvedValue(null);

      await expect(addTaskToProject("nonexistent", "Fix bug", {})).rejects.toThrow(GrindUserError);
    });

    it("throws for invalid date format", async () => {
      mockParseDate.mockImplementation(() => {
        throw new GrindUserError('Unparseable date: "invalid"');
      });

      await expect(addTaskToProject("test-project", "Fix bug", { due: "invalid" })).rejects.toThrow(GrindUserError);
    });
  });

  describe("completeProjectTask", () => {
    it("marks task done", async () => {
      mockCompleteTask.mockResolvedValue({ id: 3, description: "Fix bug", done: true, createdAt: "2025-01-01T00:00:00Z", completedAt: "2025-01-02T00:00:00Z" });

      await completeProjectTask("test-project", "3");

      expect(mockCompleteTask).toHaveBeenCalledWith("/home/user/workspace", "test-project", 3);
      expect(console.log).toHaveBeenCalledWith("✓ Task 3 completed");
    });

    it("throws for non-numeric ID", async () => {
      await expect(completeProjectTask("test-project", "abc")).rejects.toThrow(GrindUserError);
    });

    it("throws for nonexistent project", async () => {
      mockReadProjectConfig.mockResolvedValue(null);

      await expect(completeProjectTask("nonexistent", "1")).rejects.toThrow(GrindUserError);
    });

    it("throws for nonexistent task ID", async () => {
      mockCompleteTask.mockImplementation(() => {
        throw new GrindUserError('Task #99 not found in project "test-project"');
      });

      await expect(completeProjectTask("test-project", "99")).rejects.toThrow(GrindUserError);
    });
  });
});
