import { pool } from "../server.js";
import { AppError } from "../middleware/error.middleware.js";
import {
    checkAppointmentOverlap,
    checkDoctorExists,
    checkPatientExists,
    fetchAppointments,
    fetchAppointmentById
} from "../services/db.js";
import { decodeUser } from "../middleware/auth.middleware.js";


export async function getAppointments(req, res) {
    const { date } = req.query;
    const user = decodeUser(req);
    
    let patientId = user.role === "PATIENT" ? user.id : null;
    let doctorId = user.role === "DOCTOR" ? user.id : null;
    
    const result = await fetchAppointments(date || null, patientId, doctorId);
    return res.status(200).json({ success: true, message: "Appointments fetched successfully", data: result });
}

export async function getAppointmentById(req, res) {
    const { id } = req.params;
    const result = await fetchAppointmentById(id);

    if (result.rows.length === 0) {
        throw new AppError("Appointment not found", 404);
    }

    return res.status(200).json({ success: true, message: "Appointment found", data: result.rows[0] });
}

export async function createAppointment(req, res) {
    const { startTime, endTime, reason, patientId, doctorId } = req.body;

    // Validate required fields
    if (!startTime || !endTime || !patientId || !doctorId) {
        throw new AppError("startTime, endTime, patientId, and doctorId are required", 400);
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError("Invalid startTime or endTime", 400);
    }

    // Validate start time < end time
    if (start >= end) {
        throw new AppError("Start time must be before end time", 400);
    }

    // Format start time in Asia/Kolkata timezone to check for Sunday
    const startFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        weekday: "long"
    });
    const weekday = startFormatter.format(start);

    // Disallow Sundays (Clinic is closed)
    if (weekday === "Sunday") {
        throw new AppError("The clinic is closed on Sundays. Please select a date from Monday to Saturday.", 400);
    }

    // Check patient exists
    const patientExists = await checkPatientExists(patientId);
    if (!patientExists) {
        throw new AppError("Patient not found. Please select a valid patient.", 404);
    }

    // Check doctor exists
    const doctorExists = await checkDoctorExists(doctorId);
    if (!doctorExists) {
        throw new AppError("Doctor not found. Please select a valid doctor.", 404);
    }

    // Check for overlapping appointments for the same doctor
    const overlap = await checkAppointmentOverlap({
        doctorId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        excludeId: 0
    });

    if (overlap) {
        throw new AppError(
            `Appointment conflicts with an existing appointment. Please choose a different time slot.`,
            409
        );
    }

    const result = await pool.query(
        `INSERT INTO appointment("startTime", "endTime", status, reason, "patientId", "doctorId")
         VALUES($1::timestamptz, $2::timestamptz, 'SCHEDULED', $3, $4, $5)
         RETURNING id, "startTime", "endTime", status, reason, "patientId", "doctorId", "createdAt"`,
        [start.toISOString(), end.toISOString(), reason || null, patientId, doctorId]
    );

    return res.status(201).json({ success: true, message: "Appointment created successfully", data: result.rows[0] });
}

export async function updateAppointment(req, res) {
    const { id } = req.params;
    const { startTime, endTime, reason, status, patientId, doctorId } = req.body;

    // Check appointment exists
    const existing = await fetchAppointmentById(id);
    if (existing.rows.length === 0) {
        throw new AppError("Appointment not found", 404);
    }

    const current = existing.rows[0];

    // Use provided values or fall back to current
    const finalStartTime = startTime || current.startTime;
    const finalEndTime = endTime || current.endTime;
    const finalDoctorId = doctorId || current.doctorId;
    const finalPatientId = patientId || current.patientId;

    const start = new Date(finalStartTime);
    const end = new Date(finalEndTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError("Invalid startTime or endTime", 400);
    }

    // Validate start time < end time
    if (start >= end) {
        throw new AppError("Start time must be before end time", 400);
    }

    // Format start time in Asia/Kolkata timezone to check for Sunday
    const startFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        weekday: "long"
    });
    const weekday = startFormatter.format(start);

    // Disallow Sundays (Clinic is closed)
    if (weekday === "Sunday") {
        throw new AppError("The clinic is closed on Sundays. Please select a date from Monday to Saturday.", 400);
    }

    // Check patient exists
    const patientExists = await checkPatientExists(finalPatientId);
    if (!patientExists) {
        throw new AppError("Patient not found. Please select a valid patient.", 404);
    }

    // Check doctor exists
    const doctorExists = await checkDoctorExists(finalDoctorId);
    if (!doctorExists) {
        throw new AppError("Doctor not found. Please select a valid doctor.", 404);
    }

    // Check for overlapping appointments (exclude this appointment itself)
    const overlap = await checkAppointmentOverlap({
        doctorId: finalDoctorId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        excludeId: parseInt(id)
    });

    if (overlap) {
        throw new AppError(
            `Appointment conflicts with an existing appointment. Please choose a different time slot.`,
            409
        );
    }

    const result = await pool.query(
        `UPDATE appointment
         SET "startTime" = $1::timestamptz,
             "endTime" = $2::timestamptz,
             reason = COALESCE($3, reason),
             status = COALESCE($4, status),
             "patientId" = $5,
             "doctorId" = $6
         WHERE id = $7
         RETURNING id, "startTime", "endTime", status, reason, "patientId", "doctorId", "createdAt"`,
        [start.toISOString(), end.toISOString(), reason, status, finalPatientId, finalDoctorId, id]
    );

    return res.status(200).json({ success: true, message: "Appointment updated successfully", data: result.rows[0] });
}

export async function deleteAppointment(req, res) {
    const { id } = req.params;

    const existing = await fetchAppointmentById(id);
    if (existing.rows.length === 0) {
        throw new AppError("Appointment not found", 404);
    }

    await pool.query(`DELETE FROM appointment WHERE id = $1`, [id]);

    return res.status(200).json({ success: true, message: "Appointment deleted successfully" });
}
