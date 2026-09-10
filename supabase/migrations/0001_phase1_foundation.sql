create extension if not exists "pgcrypto";

create type user_role as enum ('COLLECTOR', 'RECYCLER', 'ADMIN');
create type authorization_status as enum ('PENDING', 'AUTHORIZED', 'REJECTED');

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique,
  role user_role not null,
  display_name text not null,
  phone text,
  email text not null,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on profiles(role);

create table collectors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id),
  locality text not null,
  preferred_language text not null default 'en',
  onboarding_complete boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recyclers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id),
  org_name text not null,
  authorization_id text not null,
  authorization_status authorization_status not null default 'PENDING',
  service_regions text[] not null default '{}',
  pickup_available boolean not null default true,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recyclers_authorization_status_idx on recyclers(authorization_status);

create table material_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  hazard_level text not null,
  handling_notes text not null,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table material_reference_prices (
  id uuid primary key default gen_random_uuid(),
  material_category_id uuid not null references material_categories(id),
  region_code text not null default 'DEMO-IN',
  price_per_kg numeric(10, 2) not null check (price_per_kg >= 0),
  currency text not null default 'INR',
  source_label text not null,
  effective_from date not null,
  effective_to date,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(material_category_id, region_code, effective_from)
);

create index material_reference_prices_lookup_idx on material_reference_prices(material_category_id, region_code);

create table safety_guides (
  id uuid primary key default gen_random_uuid(),
  material_category_id uuid not null references material_categories(id),
  title text not null,
  body text not null,
  icon text not null,
  severity text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index safety_guides_material_category_idx on safety_guides(material_category_id);