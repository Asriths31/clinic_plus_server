import { pool } from "../server.js";

// ==================== Patient Services ====================

export async function fetchPatients() {
  const result = await pool.query(
    `SELECT id, "userName", email, phone, gender, dob, "bloodGroup", "isMarried", address, "createdAt"
     FROM patient
     ORDER BY "createdAt" DESC`
  );
  return result.rows;
}

export async function fetchPatientById(id) {
  const result = await pool.query(
    `SELECT id, "userName", email, phone, gender, dob, "bloodGroup", "isMarried", address, "createdAt"
     FROM patient WHERE id = $1`, [id]
  );
  return result;
}

// ==================== Doctor Services ====================

export async function fetchDoctors() {
  const result = await pool.query(
    `SELECT id, name, email, phone, specialization, "createdAt"
     FROM doctor
     ORDER BY "createdAt" DESC`
  );
  return result.rows;
}

export async function fetchDoctorById(id) {
  const result = await pool.query(
    `SELECT id, name, email, phone, specialization, "createdAt"
     FROM doctor WHERE id = $1`, [id]
  );
  return result;
}

// ==================== Appointment Services ====================

export async function fetchAppointments(dateFilter, patientId, doctorId) {
  let query = `
    SELECT a.id, a."startTime", a."endTime", a.status, a.reason,
           a."patientId", a."doctorId", a."createdAt",
           p."userName" as patient_name, p.email as patient_email,
           d.name as doctor_name, d.specialization as doctor_specialization
    FROM appointment a
    JOIN patient p ON a."patientId" = p.id
    JOIN doctor d ON a."doctorId" = d.id
    WHERE 1=1
  `;
  const params = [];

  if (dateFilter) {
    params.push(dateFilter);
    query += ` AND (a."startTime" AT TIME ZONE 'Asia/Kolkata')::date = $${params.length}::date`;
  }
  
  if (patientId) {
    params.push(patientId);
    query += ` AND a."patientId" = $${params.length}`;
  }
  
  if (doctorId) {
    params.push(doctorId);
    query += ` AND a."doctorId" = $${params.length}`;
  }

  query += ` ORDER BY a."startTime" DESC`;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function fetchAppointmentById(id) {
  const result = await pool.query(`
    SELECT a.id, a."startTime", a."endTime", a.status, a.reason,
           a."patientId", a."doctorId", a."createdAt",
           p."userName" as patient_name, p.email as patient_email,
           d.name as doctor_name, d.specialization as doctor_specialization
    FROM appointment a
    JOIN patient p ON a."patientId" = p.id
    JOIN doctor d ON a."doctorId" = d.id
    WHERE a.id = $1
  `, [id]);
  return result;
}

/**
 * Proper interval overlap detection.
 * Two intervals [A_start, A_end) and [B_start, B_end) overlap
 * when A_start < B_end AND A_end > B_start.
 *
 * excludeId is used during UPDATE to avoid conflicting with itself.
 */
export async function checkAppointmentOverlap({ doctorId, startTime, endTime, excludeId = 0 }) {
  const query = `
    SELECT id, "startTime", "endTime"
    FROM appointment
    WHERE "doctorId" = $1
      AND status != 'CANCELLED'
      AND id != $2
      AND ("startTime" - interval '15 minutes' < $4::timestamptz AND "endTime" + interval '15 minutes' > $3::timestamptz)
    LIMIT 1
  `;
  const result = await pool.query(query, [doctorId, excludeId, startTime, endTime]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function checkDoctorExists(id) {
  const result = await pool.query(`SELECT id FROM doctor WHERE id = $1`, [id]);
  return result.rows.length > 0;
}

export async function checkPatientExists(id) {
  const result = await pool.query(`SELECT id FROM patient WHERE id = $1`, [id]);
  return result.rows.length > 0;
}

// ==================== Dashboard Stats ====================

export async function fetchDashboardStats() {
  const patients = await pool.query(`SELECT COUNT(*) as count FROM patient`);
  const doctors = await pool.query(`SELECT COUNT(*) as count FROM doctor`);
  const appointments = await pool.query(
    `SELECT COUNT(*) as count FROM appointment WHERE status = 'SCHEDULED' AND "startTime" >= NOW()`
  );
  return {
    totalPatients: parseInt(patients.rows[0].count),
    totalDoctors: parseInt(doctors.rows[0].count),
    upcomingAppointments: parseInt(appointments.rows[0].count)
  };
}
