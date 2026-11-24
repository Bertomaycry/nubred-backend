export const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    const status = Number.isInteger(error.code) ? error.code : 500;
    res.status(status).json({
      success: false,
      message: error.message ?? "Something went wrong",
    });
  }
};
