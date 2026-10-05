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
    const { appointmentDate, startTime, endTime, reason, patientId, doctorId } = req.body;

    // Validate required fields
    if (!appointmentDate || !startTime || !endTime || !patientId || !doctorId) {
        throw new AppError("appointmentDate, startTime, endTime, patientId, and doctorId are required", 400);
    }

    // Disallow Sundays (Clinic is closed)
    const dateObj = new Date(`${appointmentDate}T12:00:00`);
    if (dateObj.getDay() === 0) {
        throw new AppError("The clinic is closed on Sundays. Please select a date from Monday to Saturday.", 400);
    }

    // Validate start time < end time
    if (startTime >= endTime) {
        throw new AppError("Start time must be before end time", 400);
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
        appointmentDate,
        startTime,
        endTime,
        excludeId: 0
    });

    if (overlap) {
        throw new AppError(
            `Appointment conflicts with an existing appointment (${overlap.start_time} - ${overlap.end_time}). Please choose a different time slot.`,
            409
        );
    }

    const result = await pool.query(
        `INSERT INTO appointment("appointmentDate", start_time, end_time, status, reason, "patientId", "doctorId")
         VALUES($1::date, $2::time, $3::time, 'SCHEDULED', $4, $5, $6)
         RETURNING id, to_char("appointmentDate", 'YYYY-MM-DD') as "appointmentDate", start_time, end_time, status, reason, "patientId", "doctorId", "createdAt"`,
        [appointmentDate, startTime, endTime, reason || null, patientId, doctorId]
    );

    return res.status(201).json({ success: true, message: "Appointment created successfully", data: result.rows[0] });
}

export async function updateAppointment(req, res) {
    const { id } = req.params;
    const { appointmentDate, startTime, endTime, reason, status, patientId, doctorId } = req.body;

    // Check appointment exists
    const existing = await fetchAppointmentById(id);
    if (existing.rows.length === 0) {
        throw new AppError("Appointment not found", 404);
    }

    const current = existing.rows[0];

    // Use provided values or fall back to current
    const finalDate = appointmentDate || current.appointmentDate;
    const finalStartTime = startTime || current.start_time;
    const finalEndTime = endTime || current.end_time;
    const finalDoctorId = doctorId || current.doctorId;
    const finalPatientId = patientId || current.patientId;

    // Disallow Sundays (Clinic is closed)
    const updateDateObj = new Date(`${finalDate}T12:00:00`);
    if (updateDateObj.getDay() === 0) {
        throw new AppError("The clinic is closed on Sundays. Please select a date from Monday to Saturday.", 400);
    }

    // Validate start time < end time
    if (finalStartTime >= finalEndTime) {
        throw new AppError("Start time must be before end time", 400);
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
        appointmentDate: finalDate,
        startTime: finalStartTime,
        endTime: finalEndTime,
        excludeId: parseInt(id)
    });

    if (overlap) {
        throw new AppError(
            `Appointment conflicts with an existing appointment (${overlap.start_time} - ${overlap.end_time}). Please choose a different time slot.`,
            409
        );
    }

    const result = await pool.query(
        `UPDATE appointment
         SET "appointmentDate" = $1::date,
             start_time = $2::time,
             end_time = $3::time,
             reason = COALESCE($4, reason),
             status = COALESCE($5, status),
             "patientId" = $6,
             "doctorId" = $7
         WHERE id = $8
         RETURNING id, to_char("appointmentDate", 'YYYY-MM-DD') as "appointmentDate", start_time, end_time, status, reason, "patientId", "doctorId", "createdAt"`,
        [finalDate, finalStartTime, finalEndTime, reason, status, finalPatientId, finalDoctorId, id]
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
