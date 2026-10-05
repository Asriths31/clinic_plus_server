import { Router } from "express";
import { asyncHandler } from "./middleware/error.middleware.js";
import { authenticateUser, authorizeRoles } from "./middleware/auth.middleware.js";
import { getCurrentUser, login, logout, register } from "./controllers/auth.controller.js";
import { addDoctor, createDoctorLeave, deleteDoctor, getDoctorById, getDoctors, updateDoctor } from "./controllers/doctor.controller.js";
import { addPatient, deletePatient, getPatientById, getPatients, patientLogin, updatePatient } from "./controllers/patient.controller.js";
import { createAppointment, deleteAppointment, getAppointmentById, getAppointments, updateAppointment } from "./controllers/appointments.controller.js";
import { getDashboardStats } from "./controllers/dashboard.controller.js";

export const router = Router();
export const authRouter=Router()

//-------------------- Authentication Routes ------------------------------------
authRouter.post("/login", asyncHandler(login));
authRouter.post("/register", asyncHandler(register));
authRouter.post("/logout", asyncHandler(logout));
authRouter.get("/me", asyncHandler(authenticateUser), asyncHandler(getCurrentUser));
authRouter.post("/patientLogin", asyncHandler(patientLogin)); // Backward compatible

//-------------------- RBAC Demonstration & Verification Routes -----------------
// Admin-only route (Doctors deletion, system configuration)
router.get(
    "/admin-only",
    asyncHandler(authenticateUser),
    authorizeRoles("ADMIN"),
    (req, res) => {
        res.json({
            success: true,
            message: "Welcome Admin! Access granted to Admin-level resources.",
            user: req.user
        });
    }
);

// Staff-only route (Admin & Receptionist for patient intake & appointment bookings)
router.get(
    "/staff-only",
    asyncHandler(authenticateUser),
    authorizeRoles("ADMIN", "RECEPTIONIST"),
    (req, res) => {
        res.json({
            success: true,
            message: "Welcome Staff member! Access granted to Staff resources.",
            user: req.user
        });
    }
);

// Doctor-only route (Medical notes, doctor schedule)
router.get(
    "/doctor-only",
    asyncHandler(authenticateUser),
    authorizeRoles("DOCTOR"),
    (req, res) => {
        res.json({
            success: true,
            message: "Welcome Doctor! Access granted to Doctor portal.",
            user: req.user
        });
    }
);

//-------------------- Dashboard Routes ------------------------------------
router.get("/dashboard/stats", asyncHandler(getDashboardStats));

//-------------------- Doctor Routes ---------------------------------------

router.get("/doctors", asyncHandler(getDoctors));


router.use("/doctors",authorizeRoles("DOCTOR","ADMIN"))
router.get("/doctors/:id", asyncHandler(getDoctorById));
router.post("/doctors", asyncHandler(addDoctor));
router.put("/doctors/:id", asyncHandler(updateDoctor));
router.delete("/doctors/:id", asyncHandler(deleteDoctor));
router.post("/applyLeave", asyncHandler(createDoctorLeave));

//-------------------- Patient Routes --------------------------------------
router.get("/patients", asyncHandler(getPatients));

router.use("/patients",authorizeRoles("PATIENT","ADMIN"))
router.get("/patients/:id", asyncHandler(getPatientById));
router.post("/patients", asyncHandler(addPatient));
router.put("/patients/:id", asyncHandler(updatePatient));
router.delete("/patients/:id", asyncHandler(deletePatient));

//-------------------- Appointment Routes ----------------------------------
router.get("/appointments",authorizeRoles("ADMIN","PATIENT","DOCTOR"), asyncHandler(getAppointments));
router.get("/appointments/:id",authorizeRoles("ADMIN","DOCTOR","PATIENT"), asyncHandler(getAppointmentById));
router.post("/appointments",authorizeRoles("ADMIN","PATIENT"), asyncHandler(createAppointment));
router.put("/appointments/:id",authorizeRoles("ADMIN","DOCTOR"), asyncHandler(updateAppointment));
router.delete("/appointments/:id",authorizeRoles("ADMIN"), asyncHandler(deleteAppointment));
