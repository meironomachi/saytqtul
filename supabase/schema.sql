-- 일기장 데이터베이스
-- Supabase 대시보드 → SQL Editor → New query 에 이 파일 전체를 붙여 넣고 Run 하세요. 한 번만 실행하면 됩니다.
-- 여러 번 실행해도 괜찮습니다. 이미 만들어진 부분은 건너뛰고 빠진 부분만 채웁니다.
-- 가장 먼저 가입한 사람이 관리자가 되고 바로 승인됩니다. 그 뒤 가입자는 관리자가 승인해야 일기를 쓸 수 있어요.

-- 사용자 정보와 승인 상태
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT approved FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.approve_user(_user_id uuid, _approved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET approved = _approved WHERE id = _user_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.approve_user(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approve_user(uuid, boolean) TO authenticated;

-- 가입하면 프로필을 만들고, 첫 가입자는 관리자로 지정
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  first_user := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
  INSERT INTO public.profiles (id, nickname, email, approved)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), ''), COALESCE(NEW.email, ''), first_user)
  ON CONFLICT (id) DO NOTHING;
  IF first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (nickname) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "admin profiles select" ON public.profiles;
CREATE POLICY "admin profiles select" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own roles select" ON public.user_roles;
CREATE POLICY "own roles select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 일기
CREATE TABLE IF NOT EXISTS public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  entry_date date NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  moods jsonb NOT NULL DEFAULT '[]'::jsonb,
  timetable jsonb NOT NULL DEFAULT '{}'::jsonb,
  photos text[] NOT NULL DEFAULT '{}',
  weather text CHECK (weather IS NULL OR weather IN ('sunny', 'cloudy', 'rainy', 'snowy', 'windy')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS moods jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS timetable jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS weather text;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT ALL ON public.entries TO service_role;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own entries select" ON public.entries;
CREATE POLICY "own entries select" ON public.entries FOR SELECT TO authenticated USING (auth.uid() = user_id AND public.is_approved(auth.uid()));
DROP POLICY IF EXISTS "own entries insert" ON public.entries;
CREATE POLICY "own entries insert" ON public.entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));
DROP POLICY IF EXISTS "own entries update" ON public.entries;
CREATE POLICY "own entries update" ON public.entries FOR UPDATE TO authenticated USING (auth.uid() = user_id AND public.is_approved(auth.uid()));
DROP POLICY IF EXISTS "own entries delete" ON public.entries;
CREATE POLICY "own entries delete" ON public.entries FOR DELETE TO authenticated USING (auth.uid() = user_id AND public.is_approved(auth.uid()));

-- 댓글
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own comments select" ON public.comments;
CREATE POLICY "own comments select" ON public.comments FOR SELECT TO authenticated USING (auth.uid() = user_id AND public.is_approved(auth.uid()));
DROP POLICY IF EXISTS "own comments insert" ON public.comments;
CREATE POLICY "own comments insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_id AND e.user_id = auth.uid()));
DROP POLICY IF EXISTS "own comments delete" ON public.comments;
CREATE POLICY "own comments delete" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id AND public.is_approved(auth.uid()));

-- 기분 태그(mood)와 한 일 태그(activity)
CREATE TABLE IF NOT EXISTS public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('mood', 'activity')),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#0031B0',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.labels TO authenticated;
GRANT ALL ON public.labels TO service_role;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own labels all" ON public.labels;
CREATE POLICY "own labels all" ON public.labels FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_approved(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));

-- 사진 저장소 (본인 폴더만 접근)
INSERT INTO storage.buckets (id, name, public) VALUES ('diary-photos', 'diary-photos', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "own photos select" ON storage.objects;
CREATE POLICY "own photos select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'diary-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_approved(auth.uid()));
DROP POLICY IF EXISTS "own photos insert" ON storage.objects;
CREATE POLICY "own photos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'diary-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_approved(auth.uid()));
DROP POLICY IF EXISTS "own photos delete" ON storage.objects;
CREATE POLICY "own photos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'diary-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_approved(auth.uid()));
