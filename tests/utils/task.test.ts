import * as fs from "node:fs/promises";
import path from "node:path";
import { getTasks, getOpenTasks, addTask, completeTask, getTaskUrgency } from "../../src/utils/task.ts";
import { GrindUserError } from "../../src/utils/errors.ts";
import type { Task, ProjectConfig } from "../../src/types/index.ts";

jest.mock("node:fs/promises");

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "test-project",
    idea: "test idea",
    time: [],
    billing: { roundTo: "quarter-hour", rate: 150 },
    ...overrides,
  };
}

describe("task utilities", () => {
  const workspaceRoot = "/home/user/grind";
  const projectName = "test-project";
  const configPath = path.join(workspaceRoot, projectName, "projects", projectName, ".project.json");
  const prevTZ = process.env.TZ;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    process.env.TZ = prevTZ;
  });

  describe("getTasks", () => {
    it("returns empty array when config has no tasks field", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig()));
      const result = await getTasks(workspaceRoot, projectName);
      expect(result).toEqual([]);
    });

    it("returns tasks array when config has tasks", async () => {
      const tasks: Task[] = [
        { id: 1, description: "do stuff", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
      ];
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig({ tasks })));
      const result = await getTasks(workspaceRoot, projectName);
      expect(result).toEqual(tasks);
    });

    it("returns empty array when config file not found", async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("ENOENT"));
      const result = await getTasks(workspaceRoot, projectName);
      expect(result).toEqual([]);
    });
  });

  describe("getOpenTasks", () => {
    it("returns only tasks where done === false", async () => {
      const tasks: Task[] = [
        { id: 1, description: "open", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
        { id: 2, description: "closed", done: true, createdAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-02T00:00:00.000Z" },
        { id: 3, description: "also open", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
      ];
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig({ tasks })));
      const result = await getOpenTasks(workspaceRoot, projectName);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
    });

    it("returns empty array when all tasks are done", async () => {
      const tasks: Task[] = [
        { id: 1, description: "done", done: true, createdAt: "2026-01-01T00:00:00.000Z" },
      ];
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig({ tasks })));
      const result = await getOpenTasks(workspaceRoot, projectName);
      expect(result).toEqual([]);
    });
  });

  describe("addTask", () => {
    it("adds task with ID 1 to a project with no existing tasks", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

      let writtenConfig: string = "";
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig()));
      (fs.writeFile as jest.Mock).mockImplementation((_p: string, content: string) => {
        writtenConfig = content;
        return Promise.resolve();
      });

      const result = await addTask(workspaceRoot, projectName, "fix bug");
      expect(result.id).toBe(1);
      expect(result.description).toBe("fix bug");
      expect(result.done).toBe(false);
      expect(result.createdAt).toBe("2026-06-15T12:00:00.000Z");

      const saved = JSON.parse(writtenConfig) as ProjectConfig;
      expect(saved.tasks).toHaveLength(1);
      expect(saved.tasks![0].id).toBe(1);
    });

    it("adds task with next sequential ID (existing IDs [1, 3] -> new ID is 4)", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

      const existingTasks: Task[] = [
        { id: 1, description: "a", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
        { id: 3, description: "b", done: true, createdAt: "2026-01-01T00:00:00.000Z" },
      ];
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig({ tasks: existingTasks })));
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await addTask(workspaceRoot, projectName, "new task");
      expect(result.id).toBe(4);
    });

    it("includes dueDate when provided", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

      let writtenConfig: string = "";
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig()));
      (fs.writeFile as jest.Mock).mockImplementation((_p: string, content: string) => {
        writtenConfig = content;
        return Promise.resolve();
      });

      const result = await addTask(workspaceRoot, projectName, "urgent task", "2026-06-20");
      expect(result.dueDate).toBe("2026-06-20");

      const saved = JSON.parse(writtenConfig) as ProjectConfig;
      expect(saved.tasks![0].dueDate).toBe("2026-06-20");
    });

    it("omits dueDate when not provided", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

      let writtenConfig: string = "";
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig()));
      (fs.writeFile as jest.Mock).mockImplementation((_p: string, content: string) => {
        writtenConfig = content;
        return Promise.resolve();
      });

      await addTask(workspaceRoot, projectName, "no due date");
      const saved = JSON.parse(writtenConfig) as ProjectConfig;
      expect(saved.tasks![0].dueDate).toBeUndefined();
    });

    it("throws GrindUserError when project config not found", async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("ENOENT"));

      await expect(addTask(workspaceRoot, projectName, "task")).rejects.toThrow(GrindUserError);
    });
  });

  describe("completeTask", () => {
    it("sets done = true on the target task", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-07-01T10:00:00.000Z"));

      const tasks: Task[] = [
        { id: 1, description: "task 1", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
      ];
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig({ tasks })));
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await completeTask(workspaceRoot, projectName, 1);
      expect(result.done).toBe(true);
      expect(result.completedAt).toBe("2026-07-01T10:00:00.000Z");
    });

    it("does not modify other tasks", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-07-01T10:00:00.000Z"));

      let writtenConfig: string = "";
      const tasks: Task[] = [
        { id: 1, description: "task 1", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
        { id: 2, description: "task 2", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
      ];
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig({ tasks })));
      (fs.writeFile as jest.Mock).mockImplementation((_p: string, content: string) => {
        writtenConfig = content;
        return Promise.resolve();
      });

      await completeTask(workspaceRoot, projectName, 1);

      const saved = JSON.parse(writtenConfig) as ProjectConfig;
      expect(saved.tasks![0].done).toBe(true);
      expect(saved.tasks![1].done).toBe(false);
      expect(saved.tasks![1].completedAt).toBeUndefined();
    });

    it("throws GrindUserError when task ID not found", async () => {
      const tasks: Task[] = [
        { id: 1, description: "task 1", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
      ];
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(makeConfig({ tasks })));

      await expect(completeTask(workspaceRoot, projectName, 99)).rejects.toThrow(GrindUserError);
    });

    it("throws GrindUserError when project config not found", async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("ENOENT"));

      await expect(completeTask(workspaceRoot, projectName, 1)).rejects.toThrow(GrindUserError);
    });
  });

  describe("getTaskUrgency", () => {
    function makeTask(overrides: Partial<Task>): Task {
      return {
        id: 1,
        description: "task",
        done: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
      };
    }

    // Local-noon instant so "today" resolves to 2026-06-15 in any timezone
    // (midday-UTC instants can cross midnight in far-east zones).
    const now = new Date(2026, 5, 15, 12);

    it("returns overdue when any task is past due", () => {
      const tasks = [makeTask({ dueDate: "2026-06-14" })];
      expect(getTaskUrgency(tasks, now)).toBe("overdue");
    });

    it("returns overdue when any task is due today and another is past due", () => {
      const tasks = [
        makeTask({ id: 1, dueDate: "2026-06-14" }),
        makeTask({ id: 2, dueDate: "2026-06-15" }),
      ];
      expect(getTaskUrgency(tasks, now)).toBe("overdue");
    });

    it("returns today when a task is due today but none are overdue", () => {
      const tasks = [makeTask({ dueDate: "2026-06-15" })];
      expect(getTaskUrgency(tasks, now)).toBe("today");
    });

    it("returns soon when tasks are due within 3 days but none today/overdue", () => {
      const tasks = [makeTask({ dueDate: "2026-06-17" })];
      expect(getTaskUrgency(tasks, now)).toBe("soon");
    });

    it("returns none when all tasks are 4+ days out or have no due date", () => {
      const tasks = [
        makeTask({ dueDate: "2026-06-20" }),
        makeTask({ id: 2, description: "no due" }),
      ];
      expect(getTaskUrgency(tasks, now)).toBe("none");
    });

    it("returns none for empty task list", () => {
      expect(getTaskUrgency([], now)).toBe("none");
    });

    it("ignores completed tasks", () => {
      const tasks = [makeTask({ dueDate: "2026-06-10", done: true })];
      expect(getTaskUrgency(tasks, now)).toBe("none");
    });

    it("uses the local date across a UTC-midnight boundary", () => {
      process.env.TZ = "America/Los_Angeles"; // UTC-7 in August
      // Local 2026-08-02 17:30 — in America/Los_Angeles this is 2026-08-03T00:30:00Z,
      // i.e. local today differs from the UTC date.
      const localNow = new Date(2026, 7, 2, 17, 30);

      expect(getTaskUrgency([makeTask({ dueDate: "2026-08-02" })], localNow)).toBe("today");
      expect(getTaskUrgency([makeTask({ dueDate: "2026-08-01" })], localNow)).toBe("overdue");
      expect(getTaskUrgency([makeTask({ dueDate: "2026-08-03" })], localNow)).toBe("soon");
    });
  });
});
