DROP POLICY IF EXISTS "Anyone can add pipeline records" ON public.pipeline_records;
DROP POLICY IF EXISTS "Anyone can read pipeline records" ON public.pipeline_records;
DROP POLICY IF EXISTS "Anyone can update pipeline records" ON public.pipeline_records;
DROP POLICY IF EXISTS "Anyone can delete pipeline records" ON public.pipeline_records;
DROP POLICY IF EXISTS "Anyone can add enrichment cache" ON public.enrichment_cache;
DROP POLICY IF EXISTS "Anyone can read enrichment cache" ON public.enrichment_cache;
DROP POLICY IF EXISTS "Anyone can update enrichment cache" ON public.enrichment_cache;
DROP POLICY IF EXISTS "Anyone can delete enrichment cache" ON public.enrichment_cache;

REVOKE ALL ON public.pipeline_records FROM anon;
REVOKE ALL ON public.enrichment_cache FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrichment_cache TO authenticated;
GRANT ALL ON public.pipeline_records TO service_role;
GRANT ALL ON public.enrichment_cache TO service_role;

CREATE POLICY "Signed-in users can read pipeline records" ON public.pipeline_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can add pipeline records" ON public.pipeline_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update pipeline records" ON public.pipeline_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete pipeline records" ON public.pipeline_records FOR DELETE TO authenticated USING (true);

CREATE POLICY "Signed-in users can read enrichment cache" ON public.enrichment_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can add enrichment cache" ON public.enrichment_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update enrichment cache" ON public.enrichment_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete enrichment cache" ON public.enrichment_cache FOR DELETE TO authenticated USING (true);