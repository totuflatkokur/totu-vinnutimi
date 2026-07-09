-- Tótu Vinnutími PRO v1.3
-- PIN innskráning starfsmanna. Eyðir EKKI gögnum.

alter table employees add column if not exists national_id text;
alter table employees add column if not exists employee_no text;
alter table employees add column if not exists hourly_rate numeric default 0;
alter table employees add column if not exists active boolean default true;
alter table employees add column if not exists pin_code text;

alter table time_entries add column if not exists paid_minutes integer;
alter table time_entries add column if not exists skipped_break_minutes integer default 0;
alter table time_entries add column if not exists first_coffee boolean default false;
alter table time_entries add column if not exists second_coffee boolean default false;
alter table time_entries add column if not exists lunch boolean default false;
alter table time_entries add column if not exists break_minutes integer default 0;
alter table time_entries add column if not exists manual boolean default false;
alter table time_entries add column if not exists absence_type text;

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

insert into app_settings (key, value) values
('first_coffee_minutes', '15'),
('second_coffee_minutes', '15'),
('lunch_minutes', '30'),
('overtime_after_hours_day', '8')
on conflict (key) do nothing;

update employees
set pin_code = '1234'
where pin_code is null or pin_code = '';
