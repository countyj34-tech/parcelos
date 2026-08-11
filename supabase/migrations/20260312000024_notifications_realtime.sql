-- Allow users to mark their own notifications as read
DROP POLICY IF EXISTS notifications_user_update ON public.notifications;
CREATE POLICY notifications_user_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Company admins can see all company in-app notifications (already have tenant select)
-- Ensure insert path for system events (service role / SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_company_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (
    company_id, user_id, channel, title, body, status, sent_at, metadata
  ) VALUES (
    p_company_id, p_user_id, 'in_app', p_title, p_body, 'delivered', NOW(), coalesce(p_metadata, '{}'::JSONB)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_user(UUID, UUID, TEXT, TEXT, JSONB) TO service_role, authenticated;

-- Welcome notification when company is registered (called from app after signup is fine too)
CREATE OR REPLACE FUNCTION public.notify_company_welcome(p_company_id UUID, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT name INTO v_name FROM public.companies WHERE id = p_company_id;
  RETURN public.notify_user(
    p_user_id,
    p_company_id,
    'Welcome to ParcelOS',
    'Your company ' || coalesce(v_name, 'workspace') || ' is ready. Finish branding, then share your portal link with customers.',
    jsonb_build_object('kind', 'success')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_company_welcome(UUID, UUID) TO authenticated, service_role;
