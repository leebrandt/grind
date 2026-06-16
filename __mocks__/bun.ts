const defaultResult = {
  stdout: Buffer.from(""),
  exitCode: 0,
};

export const $ = jest.fn().mockImplementation(() => ({
  nothrow: jest.fn().mockResolvedValue(defaultResult),
  quiet: jest.fn().mockResolvedValue(defaultResult),
}));
