-- Tótu Stimpilklukka v1 SQL
-- Keyra í Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin_hash text,
  pin_code text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  employee_name text,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  total_minutes integer,
  paid_minutes integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);

CREATE OR REPLACE VIEW monthly_employee_hours AS
SELECT
  e.id AS employee_id,
  e.name AS employee_name,
  DATE_TRUNC('month', t.clock_in)::date AS month,
  COUNT(t.id) FILTER (WHERE t.clock_out IS NOT NULL) AS shift_count,
  ROUND(
    COALESCE(
      SUM(
        CASE
          WHEN t.clock_out IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.clock_out - t.clock_in)) / 3600
          ELSE 0
        END
      ),
      0
    )::numeric,
    2
  ) AS total_hours,
  MAX(t.clock_in) AS last_shift,
  BOOL_OR(t.clock_in IS NOT NULL AND t.clock_out IS NULL) AS is_working_now
FROM employees e
LEFT JOIN time_entries t ON t.employee_id = e.id
GROUP BY e.id, e.name, DATE_TRUNC('month', t.clock_in)
ORDER BY e.name;

CREATE OR REPLACE VIEW live_clock_status AS
SELECT
  e.id AS employee_id,
  e.name AS employee_name,
  t.id AS time_entry_id,
  t.clock_in,
  t.clock_out,
  CASE WHEN t.clock_in IS NOT NULL AND t.clock_out IS NULL THEN true ELSE false END AS is_working_now
FROM employees e
LEFT JOIN LATERAL (
  SELECT *
  FROM time_entries te
  WHERE te.employee_id = e.id
  ORDER BY te.clock_in DESC
  LIMIT 1
) t ON true
ORDER BY e.name;

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_public_access ON employees;
CREATE POLICY employees_public_access
ON employees
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS time_entries_public_access ON time_entries;
CREATE POLICY time_entries_public_access
ON time_entries
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON time_entries TO anon, authenticated;
GRANT SELECT ON monthly_employee_hours TO anon, authenticated;
GRANT SELECT ON live_clock_status TO anon, authenticated;
