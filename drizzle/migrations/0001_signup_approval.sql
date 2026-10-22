CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

ALTER TABLE public.profiles ADD COLUMN approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN email text NOT NULL DEFAULT '';
UPDATE public.profiles p SET email = COALESCE(u.email, '') FROM auth.users u WHERE u.id = p.id;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT approved FROM public.profiles WHERE id = _user_id), false)
$$;

-- users may only change their nickname; approval goes through approve_user()
DROP POLICY "own profile insert" ON public.profiles;
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (nickname) ON public.profiles TO authenticated;
CREATE POLICY "admin profiles select" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.approve_user(_user_id uuid, _approved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET approved = _approved WHERE id = _user_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.approve_user(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approve_user(uuid, boolean) TO authenticated;

-- first account ever becomes the admin and is approved automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  first_user := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
  INSERT INTO public.profiles (id, nickname, email, approved)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), ''), COALESCE(NEW.email,''), first_user)
  ON CONFLICT (id) DO NOTHING;
  IF first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;

-- diary access requires approval
DROP POLICY "own entries select" ON public.entries;
DROP POLICY "own entries insert" ON public.entries;
DROP POLICY "own entries update" ON public.entries;
DROP POLICY "own entries delete" ON public.entries;
CREATE POLICY "own entries select" ON public.entries FOR SELECT TO authenticated USING (auth.uid() = user_id AND public.is_approved(auth.uid()));
CREATE POLICY "own entries insert" ON public.entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));
CREATE POLICY "own entries update" ON public.entries FOR UPDATE TO authenticated USING (auth.uid() = user_id AND public.is_approved(auth.uid()));
CREATE POLICY "own entries delete" ON public.entries FOR DELETE TO authenticated USING (auth.uid() = user_id AND public.is_approved(auth.uid()));
DROP POLICY "own comments select" ON public.comments;
DROP POLICY "own comments insert" ON public.comments;
DROP POLICY "own comments delete" ON public.comments;
CREATE POLICY "own comments select" ON public.comments FOR SELECT TO authenticated USING (auth.uid() = user_id AND public.is_approved(auth.uid()));
CREATE POLICY "own comments insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()) AND EXISTS (SELECT 1 FROM public.entries e WHERE e.id = entry_id AND e.user_id = auth.uid()));
CREATE POLICY "own comments delete" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id AND public.is_approved(auth.uid()));