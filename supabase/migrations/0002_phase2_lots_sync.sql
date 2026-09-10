create type lot_status as enum (
  'DRAFT', 'CAPTURED', 'VERIFYING', 'VERIFIED', 'LISTED', 'OFFERS_RECEIVED',
  'OFFER_ACCEPTED', 'HANDOVER_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'RECEIVED',
  'WEIGHT_VERIFIED', 'PAYMENT_CONFIRMED', 'PROCESSING', 'RECYCLING_EVIDENCE_ADDED',
  'CLOSED', 'FLAGGED', 'REJECTED', 'CANCELLED', 'DISPUTED'
);

create type lot_condition as enum ('WORKING', 'PARTIALLY_WORKING', 'NOT_WORKING', 'DAMAGED', 'SCRAP', 'UNKNOWN');
create type pickup_preference as enum ('RECYCLER_PICKUP', 'COLLECTOR_DROPOFF', 'EITHER');

create table lots (
  id uuid primary key default gen_random_uuid(),
  collector_id uuid not null references collectors(id),
  status lot_status not null default 'DRAFT',
  title text not null,
  description text,
  estimated_weight_kg numeric(10, 2),
  verified_weight_kg numeric(10, 2),
  condition_grade lot_condition,
  trust_score numeric(5, 2),
  fair_low numeric(10, 2),
  fair_mid numeric(10, 2),
  fair_high numeric(10, 2),
  currency text not null default 'INR',
  region_code text not null default 'DEMO-IN',
  city_area text,
  pin_code text,
  pickup_preference pickup_preference,
  listed_at timestamptz,
  closed_at timestamptz,
  client_draft_id text not null,
  is_demo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(collector_id, client_draft_id)
);

create index lots_collector_idx on lots(collector_id);
create index lots_status_idx on lots(status);

create table lot_items (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references lots(id),
  material_category_id uuid not null references material_categories(id),
  quantity numeric(10, 2) not null check (quantity > 0),
  quantity_unit text not null default 'pieces',
  estimated_weight_kg numeric(10, 2) not null check (estimated_weight_kg > 0),
  condition_grade lot_condition not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lot_items_lot_idx on lot_items(lot_id);
create index lot_items_material_idx on lot_items(material_category_id);

create table lot_images (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references lots(id),
  uploader_profile_id uuid not null references profiles(id),
  storage_path text not null,
  capture_source text not null,
  angle_label text not null,
  sha256_hash text,
  perceptual_hash text,
  width integer,
  height integer,
  bytes integer not null check (bytes > 0),
  mime_type text not null,
  captured_at timestamptz,
  uploaded_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lot_images_lot_idx on lot_images(lot_id);
create index lot_images_perceptual_hash_idx on lot_images(perceptual_hash);
create unique index lot_images_sha256_active_idx on lot_images(sha256_hash) where is_active and sha256_hash is not null;

create table trace_events (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references lots(id),
  actor_profile_id uuid references profiles(id),
  event_type text not null,
  from_status lot_status,
  to_status lot_status,
  message text not null,
  payload_json jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  idempotency_key text
);

create index trace_events_lot_occurred_idx on trace_events(lot_id, occurred_at);
create unique index trace_events_lot_idempotency_idx on trace_events(lot_id, idempotency_key) where idempotency_key is not null;

create table sync_mutations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  client_mutation_id text not null,
  command_type text not null,
  request_hash text,
  response_json jsonb,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, client_mutation_id)
);