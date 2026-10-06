import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../server.js";
import { AppError } from "../middleware/error.middleware.js";
import { decodeUser } from "../middleware/auth.middleware.js";

/**
 * Universal Login:
 * Authenticates Admin, Receptionist, Doctor, or Patient by email & password.
 * Issues a JWT token stored in an HTTP-Only cookie AND returns it in JSON response.
 */
export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  let user = null;
  let role = null;
  let userName = null;

  // 1. Check in 'users' table (Admin, Receptionist, Staff)
  const usersRes = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  if (usersRes.rows.length > 0) {
    user = usersRes.rows[0];
    role = user.role;
    userName = user.name;
  }

  // 2. Check in 'doctor' table
  if (!user) {
    const docRes = await pool.query(`SELECT * FROM doctor WHERE email = $1`, [email]);
    if (docRes.rows.length > 0) {
      user = docRes.rows[0];
      role = user.role || 'DOCTOR';
      userName = user.name;
    }
  }

  // 3. Check in 'patient' table
  if (!user) {
    const patRes = await pool.query(`SELECT * FROM patient WHERE email = $1`, [email]);
    if (patRes.rows.length > 0) {
      user = patRes.rows[0];
      role = user.role || 'PATIENT';
      userName = user.userName;
    }
  }

  if (!user || !user.password) {
    throw new AppError("Invalid email or password", 401);
  }

  // Verify password with bcrypt
  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  // Sign JWT Access Token
  const token = jwt.sign(
    {
      id: user.id,
      name: userName,
      email: user.email,
      role: role.toUpperCase()
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "24h" }
  );

  // Set HTTP-Only secure cookie
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  return res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user.id,
      name: userName,
      email: user.email,
      role: role.toUpperCase()
    }
  });
}

export async function register(req, res) {
  const { name, email, password, role = "PATIENT", phone, specialization, gender, dob, bloodGroup, isMarried, address } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }

  if (phone && !/^\d{10}$/.test(phone)) {
    throw new AppError("Phone number must be exactly 10 digits", 400);
  }

  const validRoles = ["ADMIN", "RECEPTIONIST", "DOCTOR", "PATIENT"];
  const normalizedRole = role.toUpperCase();
  if (!validRoles.includes(normalizedRole)) {
    throw new AppError(`Invalid role. Must be one of: ${validRoles.join(", ")}`, 400);
  }

  // Check if email is already taken across all tables
  const userCheck = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  const docCheck = await pool.query(`SELECT id FROM doctor WHERE email = $1`, [email]);
  const patCheck = await pool.query(`SELECT id FROM patient WHERE email = $1`, [email]);

  if (userCheck.rows.length > 0 || docCheck.rows.length > 0 || patCheck.rows.length > 0) {
    throw new AppError("An account with this email already exists", 409);
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  let createdUser = null;


  if (normalizedRole === "DOCTOR") {
      const user=decodeUser(req)

    if(user.role!=="ADMIN"){
       throw new AppError("Only Admin Can Create A Doctor",403)
    }

    const docRes = await pool.query(
      `INSERT INTO doctor(name, email, password, role, phone, specialization)
       VALUES($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, phone, specialization, "createdAt"`,
      [name, email, hashedPassword, normalizedRole, phone || null, specialization || "General Medicine"]
    );
    createdUser = docRes.rows[0];
  } else if (normalizedRole === "PATIENT") {
    const patRes = await pool.query(
      `INSERT INTO patient("userName", email, password, role, phone, gender, dob, "bloodGroup", "isMarried", address)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, "userName" as name, email, role, phone, gender, dob, "bloodGroup", "isMarried", address, "createdAt"`,
      [
        name,
        email,
        hashedPassword,
        normalizedRole,
        phone || null,
        gender || null,
        dob || null,
        bloodGroup || null,
        isMarried !== undefined ? isMarried : false,
        address || null
      ]
    );
    createdUser = patRes.rows[0];
  } else {
    // ADMIN or RECEPTIONIST
      const user=decodeUser(req)
    if(user.role!=="ADMIN"){
       throw new AppError("Only Admin Can Create A Doctor",403)
    }
    const staffRes = await pool.query(
      `INSERT INTO users(name, email, password, role, phone)
       VALUES($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, phone, "createdAt"`,
      [name, email, hashedPassword, normalizedRole, phone || null]
    );
    createdUser = staffRes.rows[0];
  }

  return res.status(201).json({
    success: true,
    message: "Account registered successfully",
    data: createdUser
  });
}

/**
 * Logout:
 * Clears the HTTP-Only cookie.
 */
export async function logout(req, res) {
 res.clearCookie("access_token", {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
});

  return res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
}

/**
 * Current user profile (from authenticated token).
 */
export async function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user
  });
}
