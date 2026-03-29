export const $ = jest.fn().mockImplementation(() => ({
  nothrow: jest.fn().mockResolvedValue({
    stdout: Buffer.from(""),
    exitCode: 0,
  }),
}));
