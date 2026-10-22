CREATE TABLE public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('mood','activity')),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#0031B0',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.labels TO authenticated;
GRANT ALL ON public.labels TO service_role;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own labels all" ON public.labels FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_approved(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));

ALTER TABLE public.entries ADD COLUMN moods jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.entries ADD COLUMN timetable jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.entries ADD COLUMN photos text[] NOT NULL DEFAULT '{}';

CREATE POLICY "own photos select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'diary-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_approved(auth.uid()));
CREATE POLICY "own photos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'diary-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_approved(auth.uid()));
CREATE POLICY "own photos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'diary-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_approved(auth.uid()));