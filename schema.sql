-- Union Vision Portal Database Schema
-- Run this in your Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  email TEXT,
  password TEXT NOT NULL,
  department TEXT,
  student_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,
  department TEXT NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Results table
CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, exam_id)
);

-- Insert default admin teacher
INSERT INTO users (id, name, role, email, password, department)
VALUES ('teacher-1', 'Admin Teacher', 'teacher', 'teacher@union.edu', 'password123', 'All')
ON CONFLICT (id) DO NOTHING;

-- Insert demo student
INSERT INTO users (id, name, role, student_id, password, department)
VALUES ('UNV-1001', 'Demo Student', 'student', 'UNV-1001', 'password123', 'Management')
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (optional but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Create policies (optional - adjust based on your security needs)
-- For now, allow all operations (you can restrict these later)
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations on exams" ON exams FOR ALL USING (true);
CREATE POLICY "Allow all operations on results" ON results FOR ALL USING (true);