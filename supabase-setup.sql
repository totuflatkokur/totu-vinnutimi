-- TótuOS Enterprise v3.0
-- Örugg uppfærsla. Eyðir EKKI gömlum gögnum.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chain text,
  route text,
  contact_name text,
  phone text,
  email text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_date date not null,
  customer_id uuid references customers(id),
  packs integer default 0,
  items integer default 0,
  status text default 'Skráð',
  note text,
  created_at timestamptz default now()
);

create table if not exists production_days (
  id uuid primary key default gen_random_uuid(),
  work_date date unique not null,
  target_packs integer default 0,
  dough_count integer default 0,
  baked_packs integer default 0,
  packed_packs integer default 0,
  loaded_trucks integer default 0,
  note text,
  created_at timestamptz default now()
);

alter table customers enable row level security;
alter table orders enable row level security;
alter table production_days enable row level security;

drop policy if exists "allow all customers" on customers;
drop policy if exists "allow all orders" on orders;
drop policy if exists "allow all production days" on production_days;

create policy "allow all customers" on customers for all using (true) with check (true);
create policy "allow all orders" on orders for all using (true) with check (true);
create policy "allow all production days" on production_days for all using (true) with check (true);

-- Gæti bætt við upphafsverslunum ef taflan er tóm.
insert into customers (name, chain, route)
select * from (values
('Smáratorg','Bónus','Reykjavík'),
('Norðlingaholt','Bónus','Reykjavík'),
('Skeifan','Hagkaup','Reykjavík'),
('Mjódd','Samkaup','Reykjavík'),
('Mosfellsbær','Bónus','Norður')
) as v(name, chain, route)
where not exists (select 1 from customers);
