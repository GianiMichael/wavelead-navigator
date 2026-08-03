CREATE TABLE public.pipeline_records (
  lead_id text PRIMARY KEY,
  business_name text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  domain text,
  tier text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  industry_label text NOT NULL DEFAULT '',
  deregulated text NOT NULL DEFAULT '',
  energy_priority text NOT NULL DEFAULT '',
  campaign_id text NOT NULL DEFAULT '',
  campaign_name text NOT NULL DEFAULT '',
  date_added timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'Pending',
  last_synced timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.enrichment_cache (
  domain text PRIMARY KEY,
  payload jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_records TO anon, authenticated;
GRANT ALL ON public.pipeline_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrichment_cache TO anon, authenticated;
GRANT ALL ON public.enrichment_cache TO service_role;

ALTER TABLE public.pipeline_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pipeline records" ON public.pipeline_records FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can add pipeline records" ON public.pipeline_records FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update pipeline records" ON public.pipeline_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete pipeline records" ON public.pipeline_records FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Anyone can read enrichment cache" ON public.enrichment_cache FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can add enrichment cache" ON public.enrichment_cache FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update enrichment cache" ON public.enrichment_cache FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete enrichment cache" ON public.enrichment_cache FOR DELETE TO anon, authenticated USING (true);