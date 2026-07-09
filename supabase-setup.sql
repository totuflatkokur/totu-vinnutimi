-- Tótu Vinnutími PRO v2.1
-- Örugg PIN uppfærsla. Eyðir EKKI gömlum gögnum.

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean default true,
  national_id text,
  employee_no text,
  pin_code text,
  pin_hash text,
  must_change_pin boolean default false,
  hourly_rate numeric default 0,
  created_at timestamptz default now()
);

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  employee_name text not null,
  clock_in timestamptz,
  clock_out timestamptz,
  total_minutes integer,
  paid_minutes integer,
  skipped_break_minutes integer default 0,
  note text,
  first_coffee boolean default false,
  second_coffee boolean default false,
  lunch boolean default false,
  break_minutes integer default 0,
  manual boolean default false,
  absence_type text,
  created_at timestamptz default now()
);

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table employees add column if not exists active boolean default true;
alter table employees add column if not exists national_id text;
alter table employees add column if not exists employee_no text;
alter table employees add column if not exists pin_code text;
alter table employees add column if not exists pin_hash text;
alter table employees add column if not exists must_change_pin boolean default false;
alter table employees add column if not exists hourly_rate numeric default 0;

alter table time_entries add column if not exists paid_minutes integer;
alter table time_entries add column if not exists skipped_break_minutes integer default 0;
alter table time_entries add column if not exists first_coffee boolean default false;
alter table time_entries add column if not exists second_coffee boolean default false;
alter table time_entries add column if not exists lunch boolean default false;
alter table time_entries add column if not exists break_minutes integer default 0;
alter table time_entries add column if not exists manual boolean default false;
alter table time_entries add column if not exists absence_type text;

insert into app_settings (key, value) values
('first_coffee_minutes', '15'),
('second_coffee_minutes', '15'),
('lunch_minutes', '30'),
('overtime_after_hours_day', '8')
on conflict (key) do nothing;

update employees
set pin_code = '1234',
    must_change_pin = true
where (pin_code is null or pin_code = '')
  and (pin_hash is null or pin_hash = '');

alter table employees enable row level security;
alter table time_entries enable row level security;
alter table app_settings enable row level security;

drop policy if exists "allow read employees" on employees;
drop policy if exists "allow insert employees" on employees;
drop policy if exists "allow update employees" on employees;
drop policy if exists "allow delete employees" on employees;
drop policy if exists "allow read time entries" on time_entries;
drop policy if exists "allow insert time entries" on time_entries;
drop policy if exists "allow update time entries" on time_entries;
drop policy if exists "allow delete time entries" on time_entries;
drop policy if exists "allow read settings" on app_settings;
drop policy if exists "allow insert settings" on app_settings;
drop policy if exists "allow update settings" on app_settings;

create policy "allow read employees" on employees for select using (true);
create policy "allow insert employees" on employees for insert with check (true);
create policy "allow update employees" on employees for update using (true) with check (true);
create policy "allow delete employees" on employees for delete using (true);

create policy "allow read time entries" on time_entries for select using (true);
create policy "allow insert time entries" on time_entries for insert with check (true);
create policy "allow update time entries" on time_entries for update using (true) with check (true);
create policy "allow delete time entries" on time_entries for delete using (true);

create policy "allow read settings" on app_settings for select using (true);
create policy "allow insert settings" on app_settings for insert with check (true);
create policy "allow update settings" on app_settings for update using (true) with check (true);
