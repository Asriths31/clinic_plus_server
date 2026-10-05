import { pool } from "../server.js"
import bcrypt from "bcrypt"
import { fetchPatientById, fetchPatients } from "../services/db.js"
import { AppError } from "../middleware/error.middleware.js"


import jwt from "jsonwebtoken";

export async function patientLogin(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new AppError("Please provide email and password", 400);
    }
    const result = await pool.query(`SELECT * FROM patient where email=$1`, [email]);
    const patient = result.rows[0];
    if (!patient || !patient.password) {
        throw new AppError("Please Check The Details Correctly", 401);
    }
    const isPasswordMatch = bcrypt.compareSync(password, patient.password);
    if (!isPasswordMatch) {
        throw new AppError("Please Check The Details Correctly", 401);
    }

    const token = jwt.sign(
        {
            id: patient.id,
            name: patient.userName,
            email: patient.email,
            role: (patient.role || "PATIENT").toUpperCase()
        },
        process.env.JWT_ACCESS_SECRET || "default_jwt_secret_clinic",
        { expiresIn: "24h" }
    );

    res.cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000
    });

    const safePatient = { ...patient };
    delete safePatient.password;

    return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        data: safePatient
    });
}

export async function getPatients(req, res) {
    const patients = await fetchPatients();
    return res.status(200).json({ success: true, message: "Patients fetched successfully", data: patients });
}

export async function addPatient(req, res) {
    const { userName, phone, email, password, bloodGroup, isMarried, dob, gender, address } = req.body;

    if (!userName || !email) {
        throw new AppError("Name and email are required", 400);
    }

    // Check if email already exists
    const existing = await pool.query(`SELECT id FROM patient WHERE email = $1`, [email]);
    if (existing.rows.length > 0) {
        throw new AppError("A patient with this email already exists", 409);
    }

    let hashedPassword = null;
    if (password) {
        const genSalt = 10;
        hashedPassword = bcrypt.hashSync(password, genSalt);
    }

    const result = await pool.query(
        `INSERT INTO patient("userName", email, password, "bloodGroup", "isMarried", dob, phone, gender, address)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, "userName", email, phone, gender, dob, "bloodGroup", "isMarried", address, "createdAt"`,
        [userName, email, hashedPassword, bloodGroup || null, isMarried || false, dob || null, phone || null, gender || null, address || null]
    );

    return res.status(201).json({ success: true, message: "Patient created successfully", data: result.rows[0] });
}

export async function getPatientById(req, res) {
    const { id } = req.params;
    const result = await fetchPatientById(id);
    if (result.rows.length === 0) {
        throw new AppError("Patient not found", 404);
    }
    return res.status(200).json({ success: true, message: "Patient found", data: result.rows[0] });
}

export async function updatePatient(req, res) {
    const { id } = req.params;
    const { userName, phone, email, bloodGroup, isMarried, dob, gender, address } = req.body;

    // Check patient exists
    const existing = await fetchPatientById(id);
    if (existing.rows.length === 0) {
        throw new AppError("Patient not found", 404);
    }

    // Check email uniqueness (exclude current patient)
    if (email) {
        const emailCheck = await pool.query(
            `SELECT id FROM patient WHERE email = $1 AND id != $2`, [email, id]
        );
        if (emailCheck.rows.length > 0) {
            throw new AppError("Another patient with this email already exists", 409);
        }
    }

    const result = await pool.query(
        `UPDATE patient
         SET "userName" = COALESCE($1, "userName"),
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             "bloodGroup" = COALESCE($4, "bloodGroup"),
             "isMarried" = COALESCE($5, "isMarried"),
             dob = COALESCE($6, dob),
             gender = COALESCE($7, gender),
             address = COALESCE($8, address)
         WHERE id = $9
         RETURNING id, "userName", email, phone, gender, dob, "bloodGroup", "isMarried", address, "createdAt"`,
        [
            userName || null,
            phone || null,
            email || null,
            bloodGroup || null,
            isMarried !== undefined ? isMarried : null,
            dob || null,
            gender || null,
            address || null,
            id
        ]
    );

    return res.status(200).json({ success: true, message: "Patient updated successfully", data: result.rows[0] });
}

export async function deletePatient(req, res) {
    const { id } = req.params;

    const existing = await fetchPatientById(id);
    if (existing.rows.length === 0) {
        throw new AppError("Patient not found", 404);
    }

    // Delete related appointments first, then the patient
    await pool.query(`DELETE FROM appointment WHERE "patientId" = $1`, [id]);
    await pool.query(`DELETE FROM patient WHERE id = $1`, [id]);

    return res.status(200).json({ success: true, message: "Patient deleted successfully" });
}