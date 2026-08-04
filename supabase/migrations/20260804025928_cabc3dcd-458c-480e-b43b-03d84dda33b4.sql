CREATE TABLE public.target_lists (
  period_id text PRIMARY KEY,
  generated_at timestamptz NOT NULL,
  next_refresh_at timestamptz NOT NULL,
  items jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.target_lists TO anon, authenticated;
GRANT ALL ON public.target_lists TO service_role;
ALTER TABLE public.target_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read the published target list" ON public.target_lists FOR SELECT TO anon, authenticated USING (true);