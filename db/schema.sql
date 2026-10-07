-- ============================================================
-- Clinic Appointment Management System — Database Schema
-- Run: psql -U postgres -d Clinic -f db/schema.sql
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================

-- Users table for Admin, Receptionist, Staff accounts
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'RECEPTIONIST', -- 'ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'
  phone VARCHAR(50),
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Patient table
CREATE TABLE IF NOT EXISTS patient (
  id SERIAL PRIMARY KEY,
  "userName" VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  role VARCHAR(50) DEFAULT 'PATIENT',
  "bloodGroup" VARCHAR(20),
  "isMarried" BOOLEAN DEFAULT false,
  dob TIMESTAMP,
  phone VARCHAR(20),
  gender VARCHAR(20),
  address TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Doctor table
CREATE TABLE IF NOT EXISTS doctor (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  role VARCHAR(50) DEFAULT 'DOCTOR',
  phone VARCHAR(20),
  specialization VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Appointment table
CREATE TABLE IF NOT EXISTS appointment (
  id SERIAL PRIMARY KEY,
  "startTime" TIMESTAMPTZ NOT NULL,
  "endTime" TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'SCHEDULED',
  reason TEXT,
  "patientId" INTEGER NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
  "doctorId" INTEGER NOT NULL REFERENCES doctor(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Doctor leaves table (existing feature)
CREATE TABLE IF NOT EXISTS doctor_leaves (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES doctor(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'PENDING',
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Ensure all missing columns and constraints exist
-- ============================================================
DO $$
BEGIN
  -- Patient columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient' AND column_name='phone') THEN
    ALTER TABLE patient ADD COLUMN phone VARCHAR(20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient' AND column_name='gender') THEN
    ALTER TABLE patient ADD COLUMN gender VARCHAR(20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient' AND column_name='address') THEN
    ALTER TABLE patient ADD COLUMN address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient' AND column_name='role') THEN
    ALTER TABLE patient ADD COLUMN role VARCHAR(50) DEFAULT 'PATIENT';
  END IF;

  -- Relax legacy Prisma constraints on patient
  ALTER TABLE patient ALTER COLUMN "bloodGroup" DROP NOT NULL;
  ALTER TABLE patient ALTER COLUMN "dob" DROP NOT NULL;
  ALTER TABLE patient ALTER COLUMN "isMarried" DROP NOT NULL;

  -- Doctor columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctor' AND column_name='password') THEN
    ALTER TABLE doctor ADD COLUMN password VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctor' AND column_name='role') THEN
    ALTER TABLE doctor ADD COLUMN role VARCHAR(50) DEFAULT 'DOCTOR';
  END IF;

  -- Appointment columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointment' AND column_name='startTime') THEN
    ALTER TABLE appointment ADD COLUMN "startTime" TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointment' AND column_name='endTime') THEN
    ALTER TABLE appointment ADD COLUMN "endTime" TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointment' AND column_name='reason') THEN
    ALTER TABLE appointment ADD COLUMN reason TEXT;
  END IF;
END $$;

-- ============================================================
-- Indexes for appointment conflict detection & date search
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appointment_doctor_startTime ON appointment ("doctorId", "startTime");
CREATE INDEX IF NOT EXISTS idx_appointment_startTime ON appointment ("startTime");
CREATE INDEX IF NOT EXISTS idx_appointment_patient ON appointment ("patientId");
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_doctor_email ON doctor (email);
CREATE INDEX IF NOT EXISTS idx_patient_email ON patient (email);
