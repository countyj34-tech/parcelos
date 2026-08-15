-- Category list was empty: list_company_categories_public was STABLE but inserted rows.
-- Recreate as VOLATILE, always return categories, and allow custom names from send-parcel.

CREATE OR REPLACE FUNCTION public.ensure_default_parcel_categories(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.parcel_categories (company_id, name, description, is_fragile, is_perishable, sort_order)
  VALUES
    (p_company_id, 'Documents', 'Letters, contracts, certificates', FALSE, FALSE, 10),
    (p_company_id, 'Electronics', 'Phones, laptops, accessories', TRUE, FALSE, 20),
    (p_company_id, 'Clothing & Textiles', 'Clothes, fabric, shoes', FALSE, FALSE, 30),
    (p_company_id, 'Auto Spares', 'Vehicle parts and fittings', FALSE, FALSE, 40),
    (p_company_id, 'Groceries & Perishables', 'Food and fresh goods', FALSE, TRUE, 50),
    (p_company_id, 'Medical Supplies', 'Medicines and medical kits', TRUE, FALSE, 60),
    (p_company_id, 'Fragile Goods', 'Glass, ceramics, delicate items', TRUE, FALSE, 70),
    (p_company_id, 'General', 'Other parcels', FALSE, FALSE, 80)
  ON CONFLICT (company_id, name) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_company_categories_public(p_company_id UUID)
RETURNS TABLE (id UUID, name TEXT, sort_order INT)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.ensure_default_parcel_categories(p_company_id);
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN QUERY
  SELECT c.id, c.name, c.sort_order
  FROM public.parcel_categories c
  JOIN public.companies co ON co.id = c.company_id
  WHERE c.company_id = p_company_id
    AND c.soft_delete = FALSE
    AND co.soft_delete = FALSE
  ORDER BY c.sort_order ASC, c.name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_parcel_category(p_company_id UUID, p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT := nullif(trim(p_name), '');
  v_id UUID;
BEGIN
  IF p_company_id IS NULL OR v_name IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.id INTO v_id
  FROM public.parcel_categories c
  WHERE c.company_id = p_company_id
    AND c.soft_delete = FALSE
    AND lower(c.name) = lower(v_name)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.parcel_categories (company_id, name, description, sort_order)
  VALUES (p_company_id, v_name, 'Custom category', 200)
  ON CONFLICT (company_id, name) DO UPDATE
    SET soft_delete = FALSE, updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_parcel_categories(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_company_categories_public(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_parcel_category(UUID, TEXT) TO anon, authenticated, service_role;
