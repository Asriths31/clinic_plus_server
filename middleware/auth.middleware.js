import jwt from "jsonwebtoken";
import { AppError } from "./error.middleware.js";


export function decodeUser(req) {
  let token = null;

  if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  } else if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new AppError("Authentication required. Please log in to access this resource.", 401);
  }

  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("Your session has expired. Please log in again.", 401);
    }
    throw new AppError("Invalid authentication token. Please log in again.", 401);
  }
}

export function authenticateUser(req, res, next) {
  try {
    req.user = decodeUser(req);
    next();
  } catch (err) {
    next(err);
  }
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      throw new AppError("User authentication not found or role not specified.", 401);
    }

    const userRole = req.user.role.toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());

    if (!normalizedAllowed.includes(userRole)) {
      throw new AppError(
        `Access denied. Role '${req.user.role}' is not authorized to perform this action.`,
        403
      );
    }

    next();
  };
}
