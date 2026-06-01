-- Migration 005 — EB-S1 — Expense Manager
-- Run in: Supabase fundlens-prod SQL editor
-- Status: ⏳ Pending run
-- Note: user_id is TEXT (Firebase UID) matching profiles.id

-- ─────────────────────────────────────────────
-- TABLE 1: expense_payment_sources
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expense_payment_sources (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_name         TEXT        NOT NULL,
  source_type         TEXT        NOT NULL CHECK (source_type IN ('bank_account','credit_card','cash','upi_wallet','third_party')),
  last_four           TEXT,
  credit_limit        NUMERIC,
  billing_cycle_date  INTEGER,
  is_default          BOOLEAN     DEFAULT false,
  is_active           BOOLEAN     DEFAULT true,
  display_order       INTEGER     DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expense_payment_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eps_own_data" ON public.expense_payment_sources
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

-- ─────────────────────────────────────────────
-- TABLE 2: expense_categories
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_name         TEXT        NOT NULL,
  icon_code             TEXT        NOT NULL,
  colour_hex            TEXT        NOT NULL DEFAULT '#1A3C6E',
  budget_limit_monthly  NUMERIC,
  budget_limit_type     TEXT        DEFAULT 'monthly' CHECK (budget_limit_type IN ('monthly','weekly','yearly')),
  is_default            BOOLEAN     DEFAULT false,
  is_active             BOOLEAN     DEFAULT true,
  display_order         INTEGER     DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_own_data" ON public.expense_categories
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

-- ─────────────────────────────────────────────
-- TABLE 3: expense_recurring
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expense_recurring (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_name             TEXT        NOT NULL,
  recurring_type        TEXT        NOT NULL CHECK (recurring_type IN ('subscription','due')),
  amount                NUMERIC     NOT NULL,
  frequency             TEXT        NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  due_day               INTEGER,
  due_date_next         DATE,
  payment_source_id     UUID        REFERENCES public.expense_payment_sources(id) ON DELETE SET NULL,
  category_id           UUID        REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  reminder_days_before  INTEGER     DEFAULT 2,
  reminder_enabled      BOOLEAN     DEFAULT true,
  auto_log              BOOLEAN     DEFAULT false,
  is_active             BOOLEAN     DEFAULT true,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expense_recurring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "er_own_data" ON public.expense_recurring
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

-- ─────────────────────────────────────────────
-- TABLE 4: expense_transactions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expense_transactions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  txn_type              TEXT        NOT NULL CHECK (txn_type IN ('expense','income','transfer_in')),
  amount                NUMERIC     NOT NULL,
  category_id           UUID        REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  payment_source_id     UUID        REFERENCES public.expense_payment_sources(id) ON DELETE SET NULL,
  family_member         TEXT,
  txn_date              DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes                 TEXT,
  recurring_id          UUID        REFERENCES public.expense_recurring(id) ON DELETE SET NULL,
  is_reimbursable       BOOLEAN     DEFAULT false,
  reimbursement_status  TEXT        DEFAULT 'na' CHECK (reimbursement_status IN ('na','pending','received')),
  logged_by             TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "et_own_data" ON public.expense_transactions
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expense_txn_user_date   ON public.expense_transactions (user_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_txn_category    ON public.expense_transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_expense_recurring_user  ON public.expense_recurring (user_id, due_date_next);
