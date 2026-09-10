-- 0004_sprint_c_settlement_recycling.sql
-- Schema additions for Sprint C: Payments, Processing Records, and Recycling Evidence.

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  lot_id TEXT NOT NULL REFERENCES lots(id) ON DELETE RESTRICT,
  collector_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recycler_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  method TEXT NOT NULL DEFAULT 'SIMULATED_DIRECT_PAYMENT',
  reference_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processing_records (
  id TEXT PRIMARY KEY,
  lot_id TEXT NOT NULL REFERENCES lots(id) ON DELETE RESTRICT,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  recycler_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  facility_name TEXT NOT NULL,
  method TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recycling_evidence (
  id TEXT PRIMARY KEY,
  lot_id TEXT NOT NULL REFERENCES lots(id) ON DELETE RESTRICT,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  recycler_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  facility_name TEXT NOT NULL,
  recovery_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  residual_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (residual_percentage >= 0 AND residual_percentage <= 100),
  certificate_number TEXT NOT NULL,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_demo BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_collector_id ON payments(collector_id);
CREATE INDEX IF NOT EXISTS idx_processing_records_transaction_id ON processing_records(transaction_id);
CREATE INDEX IF NOT EXISTS idx_recycling_evidence_transaction_id ON recycling_evidence(transaction_id);
