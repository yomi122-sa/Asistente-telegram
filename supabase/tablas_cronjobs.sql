-- TABLAS Y CRON JOBS
-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Tablas del sistema
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  due_date TEXT,
  materia TEXT,
  is_done BOOLEAN DEFAULT FALSE,
  notified_24h BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  remind_at TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notified_30m BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS alarms (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  alarm_at TIMESTAMP NOT NULL,
  notified BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  exam_date DATE NOT NULL
);

-- 3. Configuración de Cron Jobs
-- NOTA: Reemplazar <SUPABASE_ANON_KEY> <PROJECT_REF> 
SELECT cron.schedule(
  'minuto-a-minuto',
  '* * * * *',
  $$
  SELECT net.http_post(
      url:='https://<PROJECT_REF>.supabase.co/functions/v1/notifier',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SUPABASE_ANON_KEY>"}'::jsonb,
      body:='{"action": "check_alarms"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'resumen-diario',
  '0 13 * * *', -- 7:00 AM CST (UTC-6)
  $$
  SELECT net.http_post(
      url:='https://<PROJECT_REF>.supabase.co/functions/v1/notifier',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SUPABASE_ANON_KEY>"}'::jsonb,
      body:='{"action": "daily_digest"}'::jsonb
  );
  $$
);