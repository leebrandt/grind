import { confirmOrExit } from "../../src/utils/prompts.js";
import { GrindUserError } from "../../src/utils/errors.js";

jest.mock("node:readline/promises", () => ({
  createInterface: jest.fn(),
}));

import { createInterface } from "node:readline/promises";

describe("confirmOrExit", () => {
  let mockRl: { question: jest.Mock; close: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRl = {
      question: jest.fn(),
      close: jest.fn(),
    };
    (createInterface as jest.Mock).mockReturnValue(mockRl);
  });

  it("should skip prompt and return when skip is true", async () => {
    await confirmOrExit("Proceed?", true);
    expect(createInterface).not.toHaveBeenCalled();
  });

  it("should create readline interface when skip is false", async () => {
    mockRl.question.mockResolvedValue("y");
    await confirmOrExit("Proceed?", false);
    expect(createInterface).toHaveBeenCalledTimes(1);
  });

  it("should prompt with the correct message", async () => {
    mockRl.question.mockResolvedValue("y");
    await confirmOrExit("Delete 3 files?", false);
    expect(mockRl.question).toHaveBeenCalledWith("Delete 3 files? (y/N) ");
  });

  it("should proceed when answer is y", async () => {
    mockRl.question.mockResolvedValue("y");
    await expect(confirmOrExit("Proceed?", false)).resolves.toBeUndefined();
  });

  it("should proceed when answer is yes", async () => {
    mockRl.question.mockResolvedValue("yes");
    await expect(confirmOrExit("Proceed?", false)).resolves.toBeUndefined();
  });

  it("should throw GrindUserError when answer is n", async () => {
    mockRl.question.mockResolvedValue("n");
    await expect(confirmOrExit("Proceed?", false)).rejects.toThrow(GrindUserError);
    await expect(confirmOrExit("Proceed?", false)).rejects.toThrow("Aborted.");
  });

  it("should throw GrindUserError when answer is empty", async () => {
    mockRl.question.mockResolvedValue("");
    await expect(confirmOrExit("Proceed?", false)).rejects.toThrow(GrindUserError);
    await expect(confirmOrExit("Proceed?", false)).rejects.toThrow("Aborted.");
  });

  it("should close readline interface after getting answer", async () => {
    mockRl.question.mockResolvedValue("y");
    await confirmOrExit("Proceed?", false);
    expect(mockRl.close).toHaveBeenCalledTimes(1);
  });
});
