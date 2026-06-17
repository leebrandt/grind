import { GrindError, GrindUserError, GrindSystemError } from "../../src/utils/errors.js";

describe("GrindError", () => {
  it("should set message and default exit code 1", () => {
    const err = new GrindError("Something went wrong");
    expect(err.message).toBe("Something went wrong");
    expect(err.exitCode).toBe(1);
    expect(err.name).toBe("GrindError");
  });

  it("should accept a custom exit code", () => {
    const err = new GrindError("Custom exit", 42);
    expect(err.exitCode).toBe(42);
  });

  it("should accept an optional cause", () => {
    const cause = new Error("underlying issue");
    const err = new GrindError("Wrapper error", 1, cause);
    expect(err.cause).toBe(cause);
  });

  it("should be instanceof Error", () => {
    const err = new GrindError("test");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("GrindUserError", () => {
  it("should set message, exitCode 1, and correct name", () => {
    const err = new GrindUserError("User did something wrong");
    expect(err.message).toBe("User did something wrong");
    expect(err.exitCode).toBe(1);
    expect(err.name).toBe("GrindUserError");
  });

  it("should be instance of GrindError and Error", () => {
    const err = new GrindUserError("test");
    expect(err).toBeInstanceOf(GrindError);
    expect(err).toBeInstanceOf(Error);
  });

  it("should accept an optional cause", () => {
    const cause = new Error("validation failed");
    const err = new GrindUserError("Invalid input", cause);
    expect(err.cause).toBe(cause);
  });
});

describe("GrindSystemError", () => {
  it("should set message, exitCode 2, and correct name", () => {
    const err = new GrindSystemError("System failure");
    expect(err.message).toBe("System failure");
    expect(err.exitCode).toBe(2);
    expect(err.name).toBe("GrindSystemError");
  });

  it("should be instance of GrindError and Error", () => {
    const err = new GrindSystemError("test");
    expect(err).toBeInstanceOf(GrindError);
    expect(err).toBeInstanceOf(Error);
  });

  it("should accept an optional cause", () => {
    const cause = new Error("disk full");
    const err = new GrindSystemError("IO error", cause);
    expect(err.cause).toBe(cause);
  });
});
