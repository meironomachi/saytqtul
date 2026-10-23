-- 계정 관리: 아이디(이메일) 찾기, 관리자의 계정 삭제
-- schema.sql 다음에 실행합니다. 여러 번 실행해도 괜찮습니다.

-- 닉네임으로 가입 이메일 찾기. 앞 두 글자만 보이고 나머지는 가림 (예: me***@gmail.com)
CREATE OR REPLACE FUNCTION public.find_login_email(_nickname text)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(regexp_replace(email, '^([^@]{1,2})[^@]*', '\1***') ORDER BY created_at), '{}')
  FROM public.profiles
  WHERE length(trim(_nickname)) > 0 AND lower(nickname) = lower(trim(_nickname)) AND email <> ''
$$;
REVOKE EXECUTE ON FUNCTION public.find_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.find_login_email(text) TO anon, authenticated;

-- 관리자가 다른 사람의 계정을 지움. 그 사람의 일기·댓글·태그·서재·가계부·노트 기록도 함께 지우고,
-- 지워야 할 일기·노트 사진 경로를 돌려줌 (사진 파일은 화면에서 저장소 기능으로 지움)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  photos text[];
  more text[];
  t text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION '자기 계정은 여기서 지울 수 없어요'; END IF;
  SELECT coalesce(array_agg(p), '{}') INTO photos FROM public.entries e, unnest(e.photos) p WHERE e.user_id = _user_id;
  IF to_regclass('public.writing_posts') IS NOT NULL THEN
    EXECUTE 'SELECT coalesce(array_agg(DISTINCT p), ''{}'') FROM (
        SELECT unnest(photos) p FROM public.writing_posts WHERE user_id = $1
        UNION SELECT jsonb_array_elements_text(fields->''photos'') FROM public.writing_versions WHERE user_id = $1 AND jsonb_typeof(fields->''photos'') = ''array'') x'
      INTO more USING _user_id;
    photos := photos || more;
  END IF;
  -- 서재·가계부·노트 표는 아직 없을 수도 있어서 있는 것만 지움 (자식 표부터)
  FOREACH t IN ARRAY ARRAY['comments', 'entries', 'labels', 'reading_sessions', 'highlights', 'books',
                           'money_transactions', 'money_recurring', 'money_rules', 'money_budgets', 'money_categories', 'money_accounts',
                           'writing_comments', 'writing_versions', 'writing_posts', 'writing_folders'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', t) USING _user_id;
    END IF;
  END LOOP;
  DELETE FROM auth.users WHERE id = _user_id; -- profiles, user_roles는 함께 지워짐
  RETURN photos;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- 관리자는 지운 계정의 일기 사진 파일을 정리할 수 있음
DROP POLICY IF EXISTS "admin photos delete" ON storage.objects;
CREATE POLICY "admin photos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'diary-photos' AND public.has_role(auth.uid(), 'admin'));
