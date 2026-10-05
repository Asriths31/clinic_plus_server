import { pool } from "../server.js"
import { AppError } from "../middleware/error.middleware.js"
import { fetchDoctorById, fetchDoctors } from "../services/db.js"
import bcrypt from "bcrypt"

export async function getDoctors(req, res) {
    const doctors = await fetchDoctors();
    return res.status(200).json({ message: "Doctors fetched successfully", data: doctors, success: true });
}

export async function getDoctorById(req, res) {
    const { id } = req.params;
    const result = await fetchDoctorById(id);

    if (result.rows.length === 0) { 
        throw new AppError("Doctor not found", 404);
    }

    return res.status(200).json({ success: true, message: "Doctor found", data: result.rows[0] });
}

export async function addDoctor(req, res) {
    const { name, email, phone, specialization, password } = req.body;

    if (!name || !email || !specialization) {
        throw new AppError("Name, email, and specialization are required", 400);
    }

    // Check email uniqueness across doctor, users, and patient tables
    const docCheck = await pool.query(`SELECT id FROM doctor WHERE email = $1`, [email]);
    const userCheck = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    const patCheck = await pool.query(`SELECT id FROM patient WHERE email = $1`, [email]);
    if (docCheck.rows.length > 0 || userCheck.rows.length > 0 || patCheck.rows.length > 0) {
        throw new AppError("An account with this email already exists", 409);
    }

    const doctorPassword = password ? bcrypt.hashSync(password, 10) : bcrypt.hashSync("Doctor@123", 10);

    const result = await pool.query(
        `INSERT INTO doctor (name, email, password, role, phone, specialization)
        VALUES($1, $2, $3, 'DOCTOR', $4, $5)
        RETURNING id, name, email, role, phone, specialization, "createdAt"`,
        [name, email, doctorPassword, phone || null, specialization]
    );

    return res.status(201).json({ success: true, message: "Doctor created successfully", data: result.rows[0] });
}

export async function updateDoctor(req, res) {
    const { id } = req.params;
    const { name, email, phone, specialization, password } = req.body;

    const existing = await fetchDoctorById(id);
    if (existing.rows.length === 0) {
        throw new AppError("Doctor not found", 404);
    }

    // Check email uniqueness (exclude current doctor)
    if (email) {
        const emailCheck = await pool.query(
            `SELECT id FROM doctor WHERE email = $1 AND id != $2`, [email, id]
        );
        if (emailCheck.rows.length > 0) {
            throw new AppError("Another doctor with this email already exists", 409);
        }
    }

    let hashedPassword = null;
    if (password) {
        hashedPassword = bcrypt.hashSync(password, 10);
    }

    const result = await pool.query(
        `UPDATE doctor
         SET name = COALESCE($1, name),
             email = COALESCE($2, email),
             phone = COALESCE($3, phone),
             specialization = COALESCE($4, specialization),
             password = COALESCE($5, password)
         WHERE id = $6
         RETURNING id, name, email, role, phone, specialization, "createdAt"`,
        [name || null, email || null, phone || null, specialization || null, hashedPassword, id]
    );

    return res.status(200).json({ success: true, message: "Doctor updated successfully", data: result.rows[0] });
}

export async function deleteDoctor(req, res) {
    const { id } = req.params;

    const existing = await fetchDoctorById(id);
    if (existing.rows.length === 0) {
        throw new AppError("Doctor not found", 404);
    }

    await pool.query(`DELETE FROM appointment WHERE "doctorId" = $1`, [id]);
    await pool.query(`DELETE FROM doctor WHERE id = $1`, [id]);

    return res.status(200).json({ success: true, message: "Doctor deleted successfully" });
}

export async function createDoctorLeave(req, res) {
    const { doctorId, startDate, endDate, reason } = req.body;
    const result = await pool.query(`
            INSERT INTO doctor_leaves (doctor_id, start_date, end_date, reason)
            VALUES($1, $2, $3, $4)
        `, [doctorId, startDate, endDate, reason]);
    if (result.rowCount === 1) {
        return res.status(201).json({ success: true, message: "Leave applied successfully" });
    }
}
