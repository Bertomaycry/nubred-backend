/* eslint-disable no-undef */

jest.mock("../../src/models/user.model.js", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const User = jest.requireMock("../../src/models/user.model.js").default;
const { jwtVerify } = require("../../src/middlewares/auth.middleware.js");

describe("auth.middleware.js - unit tests", () => {
  const makeReq = (headers = {}) => ({
    headers: { authorization: headers.authorization },
  });
  const makeRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  const makeNext = () => jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    if (!process.env.ACCESS_TOKEN_SECRET_KEY) {
      process.env.ACCESS_TOKEN_SECRET_KEY = "test-secret-key";
    }
  });

  test("jwtVerify: no Authorization header -> 401", async () => {
    const req = makeReq({});
    const res = makeRes();
    const next = makeNext();

    await jwtVerify(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Token not provided",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("jwtVerify: Authorization header without Bearer prefix -> 401", async () => {
    const req = makeReq({ authorization: "Invalid token123" });
    const res = makeRes();
    const next = makeNext();

    await jwtVerify(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Token not provided",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("jwtVerify: Authorization header with lowercase bearer -> 401", async () => {
    const req = makeReq({ authorization: "bearer token123" });
    const res = makeRes();
    const next = makeNext();

    await jwtVerify(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Token not provided",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("jwtVerify: Authorization header with empty token -> 401", async () => {
    const req = makeReq({ authorization: "Bearer " });
    const res = makeRes();
    const next = makeNext();

    await jwtVerify(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Token not provided",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("jwtVerify: valid token and user found -> calls next", async () => {
    const mockUser = { _id: "user123", email: "test@example.com" };
    const decoded = { id: "user123" };

    jwt.verify.mockReturnValue(decoded);
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const req = makeReq({ authorization: "Bearer valid-token" });
    const res = makeRes();
    const next = makeNext();

    await jwtVerify(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith(
      "valid-token",
      process.env.ACCESS_TOKEN_SECRET_KEY
    );
    expect(User.findById).toHaveBeenCalledWith("user123");
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("jwtVerify: valid token but user not found -> 401", async () => {
    const decoded = { id: "user123" };

    jwt.verify.mockReturnValue(decoded);
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const req = makeReq({ authorization: "Bearer valid-token" });
    const res = makeRes();
    const next = makeNext();

    await jwtVerify(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith(
      "valid-token",
      process.env.ACCESS_TOKEN_SECRET_KEY
    );
    expect(User.findById).toHaveBeenCalledWith("user123");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "User not found",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("jwtVerify: invalid token -> 401", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const req = makeReq({ authorization: "Bearer invalid-token" });
    const res = makeRes();
    const next = makeNext();

    await jwtVerify(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith(
      "invalid-token",
      process.env.ACCESS_TOKEN_SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Please login to access this resource",
    });
    expect(next).not.toHaveBeenCalled();
  });
});

