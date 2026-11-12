-- PS8: Smart Banking Assistant (PayWise) Complete Schema, Seed Data & Atomic RPC
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  kyc_level TEXT NOT NULL DEFAULT 'FULL'
);

CREATE TABLE IF NOT EXISTS transfer_limits (
  id SERIAL PRIMARY KEY,
  kyc_level TEXT UNIQUE NOT NULL,
  per_transfer_limit NUMERIC NOT NULL,
  daily_limit NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL,
  account_number TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  category TEXT NOT NULL,
  merchant TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_limit NUMERIC NOT NULL,
  alert_threshold_pct INTEGER NOT NULL DEFAULT 80,
  UNIQUE(customer_id, category)
);

-- Seed Customer & Limits
INSERT INTO customers (id, name, email, kyc_level)
VALUES ('B001', 'Rohan Iyer', 'rohan.iyer@example.com', 'FULL')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transfer_limits (kyc_level, per_transfer_limit, daily_limit)
VALUES
  ('BASIC', 25000, 50000),
  ('FULL', 200000, 500000)
ON CONFLICT (kyc_level) DO NOTHING;

-- Seed Accounts (Savings, Salary, and a Frozen Current Account for rule testing)
INSERT INTO accounts (id, customer_id, account_type, account_number, balance, status)
VALUES
  ('ACC-SAV-01', 'B001', 'savings', '918273645101', 145000, 'active'),
  ('ACC-SAL-02', 'B001', 'salary', '918273645202', 68500, 'active'),
  ('ACC-CUR-03', 'B001', 'current', '918273645303', 32000, 'frozen')
ON CONFLICT (id) DO NOTHING;

-- Seed Transactions
INSERT INTO transactions (account_id, amount, type, category, merchant, description, created_at)
VALUES
  ('ACC-SAL-02', 95000, 'credit', 'Salary', 'Acme Tech Pvt Ltd', 'Monthly Salary Credit', NOW() - INTERVAL '10 days'),
  ('ACC-SAL-02', 1450, 'debit', 'Food', 'Swiggy', 'Dinner order', NOW() - INTERVAL '8 days'),
  ('ACC-SAL-02', 2850, 'debit', 'Food', 'The Spice Room', 'Weekend family dinner', NOW() - INTERVAL '5 days'),
  ('ACC-SAL-02', 3200, 'debit', 'Shopping', 'Myntra', 'Apparel order', NOW() - INTERVAL '4 days'),
  ('ACC-SAV-01', 2400, 'debit', 'Utilities', 'BESCOM Power', 'Electricity bill', NOW() - INTERVAL '3 days'),
  ('ACC-SAL-02', 1800, 'debit', 'Travel', 'Uber India', 'Airport cab', NOW() - INTERVAL '2 days'),
  ('ACC-SAL-02', 920, 'debit', 'Food', 'Zomato', 'Lunch order', NOW() - INTERVAL '1 day');

-- Seed Budgets
INSERT INTO budgets (customer_id, category, monthly_limit, alert_threshold_pct)
VALUES
  ('B001', 'Food', 5000, 80),
  ('B001', 'Shopping', 4000, 75),
  ('B001', 'Utilities', 3500, 80)
ON CONFLICT (customer_id, category) DO NOTHING;

-- Atomic Transfer Function enforcing all PS8 Business Rules
CREATE OR REPLACE FUNCTION transfer_funds(
  p_customer_id TEXT,
  p_from_account_id TEXT,
  p_to_account_id TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT 'Self Account Transfer'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_acc RECORD;
  v_to_acc RECORD;
  v_kyc_level TEXT;
  v_limits RECORD;
  v_daily_spent NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer amount must be greater than zero.');
  END IF;

  IF p_from_account_id = p_to_account_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Source and destination accounts must be different.');
  END IF;

  SELECT * INTO v_from_acc FROM accounts WHERE id = p_from_account_id AND customer_id = p_customer_id FOR UPDATE;
  SELECT * INTO v_to_acc FROM accounts WHERE id = p_to_account_id AND customer_id = p_customer_id FOR UPDATE;

  IF NOT FOUND OR v_from_acc.id IS NULL OR v_to_acc.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or both accounts do not belong to customer.');
  END IF;

  IF v_from_acc.status = 'frozen' OR v_to_acc.status = 'frozen' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfers are blocked on frozen accounts.');
  END IF;

  IF v_from_acc.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance in source account.');
  END IF;

  SELECT kyc_level INTO v_kyc_level FROM customers WHERE id = p_customer_id;
  SELECT * INTO v_limits FROM transfer_limits WHERE kyc_level = v_kyc_level;

  IF v_limits.id IS NOT NULL THEN
    IF p_amount > v_limits.per_transfer_limit THEN
      RETURN jsonb_build_object('success', false, 'error', format('Exceeds per-transfer limit of ₹%s for %s KYC.', v_limits.per_transfer_limit, v_kyc_level));
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_daily_spent
    FROM transactions
    WHERE account_id = p_from_account_id
      AND type = 'debit'
      AND category = 'Transfer'
      AND created_at::date = CURRENT_DATE;

    IF (v_daily_spent + p_amount) > v_limits.daily_limit THEN
      RETURN jsonb_build_object('success', false, 'error', format('Exceeds daily transfer limit of ₹%s.', v_limits.daily_limit));
    END IF;
  END IF;

  UPDATE accounts SET balance = balance - p_amount WHERE id = p_from_account_id;
  UPDATE accounts SET balance = balance + p_amount WHERE id = p_to_account_id;

  INSERT INTO transactions (account_id, amount, type, category, merchant, description, created_at)
  VALUES
    (p_from_account_id, p_amount, 'debit', 'Transfer', 'Internal Transfer', p_note, NOW()),
    (p_to_account_id, p_amount, 'credit', 'Transfer', 'Internal Transfer', p_note, NOW());

  RETURN jsonb_build_object(
    'success', true,
    'transferred', p_amount,
    'from_new_balance', v_from_acc.balance - p_amount,
    'to_new_balance', v_to_acc.balance + p_amount
  );
END;
$$;
