-- Public parcel categories for customer share-link registration + default seeds

CREATE OR REPLACE FUNCTION public.ensure_default_parcel_categories(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.parcel_categories (company_id, name, description, is_fragile, is_perishable, sort_order)
  VALUES
    (p_company_id, 'Documents', 'Letters, contracts, certificates', FALSE, FALSE, 10),
    (p_company_id, 'Electronics', 'Phones, laptops, accessories', TRUE, FALSE, 20),
    (p_company_id, 'Clothing & Textiles', 'Clothes, fabric, shoes', FALSE, FALSE, 30),
    (p_company_id, 'Auto Spares', 'Vehicle parts and fittings', FALSE, FALSE, 40),
    (p_company_id, 'Groceries & Perishables', 'Food and fresh goods', FALSE, TRUE, 50),
    (p_company_id, 'Medical Supplies', 'Medicines and medical kits', TRUE, FALSE, 60),
    (p_company_id, 'Fragile Goods', 'Glass, ceramics, delicate items', TRUE, FALSE, 70)
  ON CONFLICT (company_id, name) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_parcel_categories(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.list_company_categories_public(p_company_id UUID)
RETURNS TABLE (id UUID, name TEXT, sort_order INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_default_parcel_categories(p_company_id);

  RETURN QUERY
  SELECT c.id, c.name, c.sort_order
  FROM public.parcel_categories c
  JOIN public.companies co ON co.id = c.company_id
  WHERE c.company_id = p_company_id
    AND c.soft_delete = FALSE
    AND co.soft_delete = FALSE
    AND NOT public.is_company_locked(co.id)
  ORDER BY c.sort_order ASC, c.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_company_categories_public(UUID) TO anon, authenticated, service_role;

-- Seed defaults for every existing courier company
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.companies WHERE soft_delete = FALSE
  LOOP
    PERFORM public.ensure_default_parcel_categories(r.id);
  END LOOP;
END;
$$;
