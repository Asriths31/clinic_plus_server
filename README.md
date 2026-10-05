# Clinic Plus - Clinic Appointment Management System

Clinic Plus is a robust, full-stack appointment management system designed for clinics. It facilitates role-based access for Admins, Doctors, and Patients, ensuring secure and streamlined clinic operations.

## 🚀 Application Flow

1. **Authentication & Roles (RBAC)**: Users log in and receive a JWT. The system identifies them as an `ADMIN`, `DOCTOR`, or `PATIENT`.
2. **Patient Flow**: Patients can register, log in, view their upcoming appointments, and book new consultations. During booking, they are restricted from choosing past dates, Sundays (clinic is closed), or time slots that are already booked.
3. **Doctor Flow**: Doctors log in to view their specific schedule. They can see all patients assigned to them for the day and mark appointments as `COMPLETED` or `CANCELLED`.
4. **Admin Flow**: Admins have a bird's-eye view of the clinic through a dashboard. They can manage all patients, doctors, and appointments, including adding new doctors to the system.

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v16+)
- PostgreSQL installed and running

### 1. Database Setup
Ensure PostgreSQL is running. The application connects using the credentials defined in the `server/.env` file. The database handles the core logic for preventing double-booking using interval intersections.

### 2. Backend Setup (Server)
```bash
cd server
npm install
npm run dev
# Server runs on http://localhost:2000
```

### 3. Frontend Setup (Client)
```bash
cd client
npm install
npm run dev
# Client runs on http://localhost:5173
```

## 🔑 Admin Login Credentials

To access the administrative dashboard and oversee the entire clinic operations, use the following default credentials:

- **Email**: `admin@clinic.com`
- **Password**: `Admin@123`

---

## 📡 API Endpoints Reference

- **API URL**: `https://clinic-plus-server.onrender.com`

The backend exposes a RESTful API under the `/api` prefix. All protected routes require an `HttpOnly` cookie containing a valid JWT.

### Authentication Endpoints

*   **`POST /api/auth/login`**
    *   *Usage*: Authenticates a user and sets the JWT cookie.
    *   *Example Payload*: 
        ```json
        { "email": "admin@clinic.com", "password": "Admin@123" }
        ```
*   **`POST /api/auth/register`**
    *   *Usage*: Registers a new patient.
*   **`POST /api/auth/logout`**
    *   *Usage*: Clears the authentication cookie.
*   **`GET /api/auth/me`**
    *   *Usage*: Returns the currently authenticated user's profile and role.

### Appointment Endpoints

*   **`GET /api/appointments`**
    *   *Usage*: Fetches appointments. Allows query filtering (e.g., `?date=2026-10-12`). Admins see all, Patients/Doctors only see their own.
*   **`POST /api/appointments`**
    *   *Usage*: Books a new appointment. Rejects overlapping slots or Sundays.
    *   *Example Payload*:
        ```json
        {
          "appointmentDate": "2026-10-15",
          "startTime": "10:00",
          "endTime": "10:30",
          "reason": "Routine Checkup",
          "patientId": 1,
          "doctorId": 2
        }
        ```
*   **`PUT /api/appointments/:id`**
    *   *Usage*: Updates an appointment's status (e.g., from `SCHEDULED` to `COMPLETED`) or reschedules it.
*   **`DELETE /api/appointments/:id`**
    *   *Usage*: (Admin Only) Hard deletes an appointment.

### Doctor & Patient Endpoints

*   **`GET /api/doctors`**
    *   *Usage*: Returns a list of all doctors.
*   **`POST /api/doctors`**
    *   *Usage*: (Admin Only) Adds a new doctor to the clinic.
*   **`GET /api/patients`**
    *   *Usage*: (Admin & Doctor Only) Returns a list of registered patients.
