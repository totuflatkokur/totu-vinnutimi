-- TótuOS Enterprise v3.1
-- Verkefni + Lager. Örugg uppfærsla, eyðir EKKI gömlum gögnum.

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  title text not null,
  description text,
  employee_id uuid references employees(id),
  status text default 'Opið',
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text,
  quantity numeric default 0,
  min_quantity numeric default 0,
  location text,
  note text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table tasks enable row level security;
alter table inventory_items enable row level security;

drop policy if exists "allow all tasks" on tasks;
drop policy if exists "allow all inventory items" on inventory_items;

create policy "allow all tasks" on tasks for all using (true) with check (true);
create policy "allow all inventory items" on inventory_items for all using (true) with check (true);

insert into tasks (task_date, title)
select current_date, title from (values
('Hnoða deig 1'),
('Baka fyrstu lotu'),
('Pakka fyrstu sendingu'),
('Hlaða bíl'),
('Þrífa vél eftir vinnu')
) as v(title)
where not exists (select 1 from tasks where task_date = current_date);

insert into inventory_items (name, unit, quantity, min_quantity)
select * from (values
('Hveiti','pokar',0,20),
('Salt','kg',0,10),
('Pökkunarplast','rúllur',0,5),
('Merkimiðar','rúllur',0,5),
('Brettaplast','rúllur',0,3)
) as v(name, unit, quantity, min_quantity)
where not exists (select 1 from inventory_items);
