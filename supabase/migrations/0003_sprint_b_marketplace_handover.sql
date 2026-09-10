-- Sprint B Migration: Recycler Marketplace, Offers, Transactions, and Handover

create type offer_status as enum (
  'PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'
);

create type transaction_status as enum (
  'CREATED', 'HANDOVER_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'RECEIVED',
  'WEIGHT_VERIFIED', 'CLOSED', 'DISPUTED', 'CANCELLED'
);

-- Offers table: Recycler proposals on LISTED / OFFERS_RECEIVED lots
create table offers (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references lots(id),
  recycler_id uuid not null references recyclers(id),
  price_per_kg numeric(10, 2) not null check (price_per_kg > 0),
  price_total numeric(10, 2) not null check (price_total > 0),
  currency text not null default 'INR',
  pickup_option text not null default 'RECYCLER_PICKUP',
  note text,
  status offer_status not null default 'PENDING',
  anomaly_level text not null default 'NORMAL',
  anomaly_message text,
  expires_at timestamptz,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index offers_lot_idx on offers(lot_id);
create index offers_recycler_idx on offers(recycler_id);
create index offers_status_idx on offers(status);

-- Uniqueness constraint: exactly one ACCEPTED offer per lot
create unique index unique_accepted_offer_per_lot on offers(lot_id) where (status = 'ACCEPTED');

-- Transactions table: Commercial agreement formed upon offer acceptance
create table transactions (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references lots(id),
  offer_id uuid not null unique references offers(id),
  collector_id uuid not null references collectors(id),
  recycler_id uuid not null references recyclers(id),
  agreed_price_per_kg numeric(10, 2) not null check (agreed_price_per_kg > 0),
  declared_weight_snapshot numeric(10, 2) not null check (declared_weight_snapshot > 0),
  provisional_estimated_total numeric(10, 2) not null check (provisional_estimated_total > 0),
  verified_weight_kg numeric(10, 2),
  final_amount numeric(10, 2),
  currency text not null default 'INR',
  status transaction_status not null default 'CREATED',
  accepted_at timestamptz not null default now(),
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_collector_idx on transactions(collector_id);
create index transactions_recycler_idx on transactions(recycler_id);
create index transactions_status_idx on transactions(status);

-- Handover records table: Logistics coordination, QR credentials, and custody transfer
create table handover_records (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references transactions(id),
  scheduled_at timestamptz not null,
  pickup_address text not null,
  pickup_window text,
  handover_method text not null default 'RECYCLER_PICKUP',
  qr_token text not null unique,
  qr_token_hash text not null,
  pickup_confirmed_at timestamptz,
  received_at timestamptz,
  receiver_profile_id uuid references profiles(id),
  status text not null default 'SCHEDULED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index handover_qr_token_idx on handover_records(qr_token);
create index handover_qr_hash_idx on handover_records(qr_token_hash);

-- Extend lots table with commercial settlement fields
alter table lots add column if not exists final_amount numeric(10, 2);
