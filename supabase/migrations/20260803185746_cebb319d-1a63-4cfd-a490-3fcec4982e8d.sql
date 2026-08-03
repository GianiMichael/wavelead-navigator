CREATE TABLE public.iso_wholesale_prices (
  iso TEXT PRIMARY KEY,
  iso_name TEXT NOT NULL DEFAULT '',
  hub TEXT NOT NULL DEFAULT '',
  price_mwh NUMERIC,
  market TEXT NOT NULL DEFAULT '',
  interval_start TIMESTAMP WITH TIME ZONE,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error TEXT
);

GRANT SELECT ON public.iso_wholesale_prices TO anon;
GRANT SELECT ON public.iso_wholesale_prices TO authenticated;
GRANT ALL ON public.iso_wholesale_prices TO service_role;

ALTER TABLE public.iso_wholesale_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached ISO wholesale prices"
ON public.iso_wholesale_prices FOR SELECT
TO anon, authenticated
USING (true);