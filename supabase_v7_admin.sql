-- TótuOS Enterprise v7.0 Admin SQL Pack
-- Keyra í Supabase SQL Editor

create table if not exists time_entry_corrections (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid,
  employee_id uuid,
  old_clock_in timestamptz,
  old_clock_out timestamptz,
  new_clock_in timestamptz,
  new_clock_out timestamptz,
  reason text,
  corrected_by text,
  created_at timestamptz default now()
);

create or replace view monthly_employee_hours as
select
  e.id as employee_id,
  e.name as employee_name,
  date_trunc('month', t.clock_in)::date as month,
  count(t.id) filter (where t.clock_in is not null) as shift_count,
  round(
    coalesce(sum(
      case
        when t.clock_in is not null and t.clock_out is not null
        then extract(epoch from (t.clock_out - t.clock_in)) / 3600
        else 0
      end
    ), 0)::numeric,
    2
  ) as total_hours,
  max(t.clock_in) as last_shift,
  bool_or(t.clock_in is not null and t.clock_out is null) as is_working_now
from employees e
left join time_entries t on t.employee_id = e.id
group by e.id, e.name, date_trunc('month', t.clock_in);

create or replace view live_clock_status as
select
  e.id as employee_id,
  e.name as employee_name,
  t.id as time_entry_id,
  t.clock_in,
  t.clock_out,
  case
    when t.clock_in is not null and t.clock_out is null then true
    else false
  end as is_working_now
from employees e
left join lateral (
  select *
  from time_entries te
  where te.employee_id = e.id
  order by te.clock_in desc
  limit 1
) t on true;

create or replace view missing_clock_outs as
select
  t.id as time_entry_id,
  e.id as employee_id,
  e.name as employee_name,
  t.clock_in,
  now() as checked_at
from time_entries t
join employees e on e.id = t.employee_id
where t.clock_in is not null
  and t.clock_out is null;
