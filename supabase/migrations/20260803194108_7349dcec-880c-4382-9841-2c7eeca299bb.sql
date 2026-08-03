ALTER TABLE public.iso_wholesale_prices
  ADD COLUMN IF NOT EXISTS rt_price_mwh numeric,
  ADD COLUMN IF NOT EXISTS spread_pct numeric,
  ADD COLUMN IF NOT EXISTS load_mw numeric,
  ADD COLUMN IF NOT EXISTS load_at timestamptz;