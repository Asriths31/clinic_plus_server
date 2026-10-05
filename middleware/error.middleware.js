

export class AppError extends Error {
  statusCode;
  isOperational;

  constructor(
    message,
    statusCode = 500
  ) {
    super(message);

    this.statusCode = statusCode; 
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err,
  req,
  res,
  next
) => {

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
};



export const asyncHandler = (fn) => {
  return (
    req,
    res,
    next
  ) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};