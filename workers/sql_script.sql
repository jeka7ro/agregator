create table if not exists delivery_zone_rules (
  id bigint primary key generated always as identity,
  name text,
  is_active boolean default true,
  schedule_times text[],
  schedule_days integer[],
  target_brands text[],
  target_cities text[],
  target_restaurants text[],
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table delivery_zone_configs add column if not exists custom_schedule_times text[];
alter table delivery_zone_configs add column if not exists custom_schedule_days integer[];
