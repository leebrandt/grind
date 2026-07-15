import { Task, ProjectConfig } from "../../src/types/index.js";

describe("Task interface", () => {
  it("should construct a minimal task", () => {
    const task: Task = {
      id: 1,
      description: "Write tests",
      done: false,
      createdAt: "2025-01-15T10:00:00.000Z",
    };
    expect(task.id).toBe(1);
    expect(task.description).toBe("Write tests");
    expect(task.done).toBe(false);
    expect(task.createdAt).toBe("2025-01-15T10:00:00.000Z");
  });

  it("should construct a task with optional fields", () => {
    const task: Task = {
      id: 2,
      description: "Deploy app",
      done: true,
      createdAt: "2025-01-15T10:00:00.000Z",
      completedAt: "2025-01-15T14:00:00.000Z",
      dueDate: "2025-01-20",
    };
    expect(task.completedAt).toBe("2025-01-15T14:00:00.000Z");
    expect(task.dueDate).toBe("2025-01-20");
  });
});

describe("ProjectConfig with tasks", () => {
  const baseConfig: ProjectConfig = {
    name: "my-project",
    type: "webapp",
    idea: "Build a cool thing",
    time: [],
    billing: { roundTo: "quarter-hour", rate: 100 },
  };

  it("should satisfy interface without tasks", () => {
    expect(baseConfig).toBeDefined();
    expect(baseConfig.tasks).toBeUndefined();
  });

  it("should satisfy interface with a tasks array", () => {
    const config: ProjectConfig = {
      ...baseConfig,
      tasks: [
        {
          id: 1,
          description: "Set up repo",
          done: true,
          createdAt: "2025-01-15T10:00:00.000Z",
          completedAt: "2025-01-15T10:30:00.000Z",
        },
        {
          id: 2,
          description: "Write README",
          done: false,
          createdAt: "2025-01-15T11:00:00.000Z",
          dueDate: "2025-01-17",
        },
      ],
    };
    expect(config.tasks).toHaveLength(2);
    expect(config.tasks![0].done).toBe(true);
    expect(config.tasks![1].done).toBe(false);
  });
});
