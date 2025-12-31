/* eslint-disable no-undef */

const { asyncHandler } = require("../../src/utils/asyncHandler.js");

describe("asyncHandler - unit tests", () => {
  const makeReq = () => ({});
  const makeRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  const makeNext = () => jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("asyncHandler: calls handler successfully -> calls next", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    const handler = jest.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test("asyncHandler: handler throws error with code -> returns error response with code", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    const error = new Error("Test error");
    error.code = 400;

    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Test error",
    });
  });

  test("asyncHandler: handler throws error without code -> returns 500", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    const error = new Error("Server error");

    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Server error",
    });
  });

  test("asyncHandler: handler throws error without message -> returns default message", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    const error = {};

    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Something went wrong",
    });
  });
});

