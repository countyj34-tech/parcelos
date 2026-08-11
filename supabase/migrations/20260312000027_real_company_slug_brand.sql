-- When company renames from placeholder (e.g. My Courier Company),
-- update slug/subdomain so /c/{slug} shows the real courier brand.
-- Keep the old slug working via domains alias so existing QR/links don't break.

CREATE OR REPLACE FUNCTION public.update_my_company_brand(
  p_name TEXT,
  p_tagline TEXT DEFAULT NULL,
  p_primary_color TEXT DEFAULT NULL,
  p_secondary_color TEXT DEFAULT NULL,
  p_support_phone TEXT DEFAULT NULL,
  p_support_email TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_price_chart_url TEXT DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_row public.companies%ROWTYPE;
  v_old_slug TEXT;
  v_new_slug TEXT;
  v_base_slug TEXT;
  v_n INT := 0;
  v_placeholder BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No company linked to this account';
  END IF;
  IF public.get_user_role_code() NOT IN ('company_admin', 'branch_manager')
     AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not allowed to update branding';
  END IF;
  IF nullif(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;

  SELECT * INTO v_row FROM public.companies WHERE id = v_company FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  v_old_slug := v_row.slug;
  v_placeholder := v_old_slug IN ('my-courier-company', 'courier', 'my-company', 'company')
    OR v_old_slug LIKE 'my-courier-company-%'
    OR lower(v_row.name) IN ('my courier company', 'your company', 'my company');

  v_base_slug := public.slugify_company_name(trim(p_name));
  IF v_base_slug IS NULL OR v_base_slug = '' THEN
    v_base_slug := v_old_slug;
  END IF;
  v_new_slug := v_base_slug;

  -- Refresh slug when renaming off a placeholder, or when name clearly changed
  IF v_placeholder OR v_base_slug IS DISTINCT FROM v_old_slug THEN
    WHILE EXISTS (
      SELECT 1 FROM public.companies
      WHERE (slug = v_new_slug OR subdomain = v_new_slug || '.parcelos.africa')
        AND id IS DISTINCT FROM v_company
    ) LOOP
      v_n := v_n + 1;
      v_new_slug := v_base_slug || '-' || v_n::TEXT;
    END LOOP;
  ELSE
    v_new_slug := v_old_slug;
  END IF;

  UPDATE public.companies
  SET
    name = trim(p_name),
    slug = v_new_slug,
    subdomain = v_new_slug || '.parcelos.africa',
    tagline = nullif(trim(coalesce(p_tagline, '')), ''),
    primary_color = coalesce(nullif(trim(p_primary_color), ''), primary_color),
    secondary_color = coalesce(nullif(trim(p_secondary_color), ''), secondary_color),
    support_phone = nullif(trim(coalesce(p_support_phone, '')), ''),
    support_email = nullif(trim(coalesce(p_support_email, '')), ''),
    logo_url = CASE WHEN p_logo_url IS NULL THEN logo_url ELSE nullif(trim(p_logo_url), '') END,
    price_chart_url = CASE WHEN p_price_chart_url IS NULL THEN price_chart_url ELSE nullif(trim(p_price_chart_url), '') END,
    updated_at = NOW()
  WHERE id = v_company
  RETURNING * INTO v_row;

  -- Primary domain hostname
  INSERT INTO public.domains (company_id, hostname, domain_type, is_primary, ssl_status, verified, created_by)
  VALUES (v_company, v_new_slug || '.parcelos.africa', 'subdomain', TRUE, 'active', TRUE, auth.uid())
  ON CONFLICT (hostname) DO UPDATE
    SET
      company_id = EXCLUDED.company_id,
      soft_delete = FALSE,
      is_primary = TRUE,
      verified = TRUE,
      ssl_status = 'active',
      updated_at = NOW();

  UPDATE public.domains
  SET is_primary = (hostname = v_new_slug || '.parcelos.africa'),
      updated_at = NOW()
  WHERE company_id = v_company
    AND soft_delete = FALSE
    AND domain_type = 'subdomain';

  -- Keep old share links working (/c/my-courier-company still resolves)
  IF v_old_slug IS DISTINCT FROM v_new_slug THEN
    INSERT INTO public.domains (company_id, hostname, domain_type, is_primary, ssl_status, verified, created_by)
    VALUES (v_company, v_old_slug, 'subdomain', FALSE, 'active', TRUE, auth.uid())
    ON CONFLICT (hostname) DO UPDATE
      SET company_id = EXCLUDED.company_id, soft_delete = FALSE, verified = TRUE, updated_at = NOW();

    INSERT INTO public.domains (company_id, hostname, domain_type, is_primary, ssl_status, verified, created_by)
    VALUES (v_company, v_old_slug || '.parcelos.africa', 'subdomain', FALSE, 'active', TRUE, auth.uid())
    ON CONFLICT (hostname) DO UPDATE
      SET company_id = EXCLUDED.company_id, soft_delete = FALSE, verified = TRUE, updated_at = NOW();
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_company_brand(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Require a real company name (no "My Courier Company" placeholder)
CREATE OR REPLACE FUNCTION public.ensure_my_courier_company(
  p_company_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company UUID;
  v_name TEXT;
  v_email TEXT;
  v_company_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_company := public.repair_my_company_link();
  IF v_company IS NOT NULL THEN
    RETURN v_company;
  END IF;

  SELECT email, full_name INTO v_email, v_name FROM public.users WHERE id = v_uid;
  v_name := COALESCE(nullif(trim(p_full_name), ''), v_name);
  v_company_name := nullif(trim(p_company_name), '');

  IF v_company_name IS NULL
     OR lower(v_company_name) IN ('my courier company', 'your company', 'my company', 'company') THEN
    RAISE EXCEPTION 'Enter your real courier company name';
  END IF;

  v_company := public.register_courier_company(
    v_company_name,
    nullif(trim(p_phone), ''),
    v_name,
    v_email
  );

  RETURN v_company;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_courier_company(TEXT, TEXT, TEXT) TO authenticated;

-- One-shot: rename placeholder company for the signed-in user (optional manual fix)
CREATE OR REPLACE FUNCTION public.rename_my_placeholder_company(p_name TEXT)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.update_my_company_brand(p_name, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_my_placeholder_company(TEXT) TO authenticated;
