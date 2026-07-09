DROP VIEW IF EXISTS monthly_employee_hours CASCADE;
DROP VIEW IF EXISTS live_clock_status CASCADE;
DROP VIEW IF EXISTS missing_clock_outs CASCADE;

CREATE VIEW monthly_employee_hours AS
SELECT
  e.id AS employee_id,
  e.name AS employee_name,
  DATE_TRUNC('month', t.clock_in)::date AS month,
  COUNT(t.id) AS shift_count,
  ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(t.clock_out, now()) - t.clock_in)) / 3600),0)::numeric,2) AS total_hours,
  MAX(t.clock_in) AS last_shift,
  BOOL_OR(t.clock_in IS NOT NULL AND t.clock_out IS NULL) AS is_working_now
FROM employees e
LEFT JOIN time_entries t ON t.employee_id = e.id
GROUP BY e.id, e.name, DATE_TRUNC('month', t.clock_in)
ORDER BY employee_name;

CREATE VIEW live_clock_status AS
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

CREATE VIEW missing_clock_outs AS
SELECT
  t.id AS time_entry_id,
  e.id AS employee_id,
  e.name AS employee_name,
  t.clock_in,
  now() AS checked_at
FROM time_entries t
JOIN employees e ON e.id = t.employee_id
WHERE t.clock_in IS NOT NULL
  AND t.clock_out IS NULL;

GRANT SELECT ON monthly_employee_hours TO anon;
GRANT SELECT ON monthly_employee_hours TO authenticated;
GRANT SELECT ON live_clock_status TO anon;
GRANT SELECT ON live_clock_status TO authenticated;
GRANT SELECT ON missing_clock_outs TO anon;
GRANT SELECT ON missing_clock_outs TO authenticated;
