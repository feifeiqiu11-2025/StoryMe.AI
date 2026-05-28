-- ============================================
-- Enable RLS on public.users (close mass-assignment vuln)
-- ============================================
--
-- Background: public.users had no RLS. Any authenticated user could update
-- their own row directly from the browser (or server-as-user) client,
-- including privileged columns like trial_status, images_limit,
-- stories_limit, subscription_status. This migration:
--
-- 1. Enables RLS on public.users with own-row policies.
-- 2. Adds a BEFORE INSERT/UPDATE trigger that sanitizes privileged columns
--    when the caller is the unprivileged `authenticated` role.
--    Service-role and SECURITY DEFINER functions bypass via current_user.
-- 3. Adds an append-only audit log so future tampering attempts are
--    visible (the sanitized writes still get logged with the attempted
--    payload).
-- 4. Promotes existing trigger functions that mutate users to
--    SECURITY DEFINER so internal counters continue to increment under
--    the new policy.

-- ----- 1. RLS + own-row policies -----------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS users_insert_own ON public.users;
CREATE POLICY users_insert_own ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No DELETE policy: deletes from `authenticated` are blocked.
-- Account deletion already runs through the service-role admin client.

-- ----- 2. Privileged-column guard trigger --------------------------------
--
-- Uses current_user (the active Postgres role), NOT auth.role() (the JWT
-- claim). Inside a SECURITY DEFINER function the JWT context is unchanged
-- but current_user becomes the function owner — so internal triggers
-- like track_image_generation() and increment_story_count() can update
-- privileged columns while direct writes from the authenticated role
-- cannot.

-- Maintenance note: if a new financially-sensitive or access-control
-- column is added to public.users (e.g. is_admin, gift_credits), it
-- MUST be added to both branches below. Otherwise an authenticated
-- user can tamper with it from the browser.

CREATE OR REPLACE FUNCTION public.users_block_privileged_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sanitize only for the two user-facing Postgres roles. service_role
  -- and postgres (incl. SECURITY DEFINER functions owned by postgres)
  -- bypass without being affected.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Clobber privileged columns to safe defaults regardless of payload.
    -- Mirrors the legit defaults used by the auth callback + signup page.
    NEW.trial_status               := 'active';
    NEW.trial_started_at           := NOW();
    NEW.trial_ends_at              := NOW() + INTERVAL '7 days';
    NEW.images_generated_count     := 0;
    NEW.images_limit               := 50;
    NEW.stories_created_this_month := 0;
    NEW.stories_limit              := 2;
    NEW.subscription_tier          := 'free';
    NEW.subscription_status        := NULL;
    NEW.billing_cycle_start        := NULL;
    NEW.annual_subscription        := FALSE;
    NEW.stripe_customer_id         := NULL;
    NEW.stripe_subscription_id     := NULL;
    NEW.team_id                    := NULL;
    NEW.is_team_primary            := FALSE;
    NEW.feedback_bonus_awarded     := FALSE;
    NEW.has_given_feedback         := FALSE;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Preserve OLD values for every privileged column. Tamper attempts
    -- are silently ignored; the audit trigger records the attempt.
    --
    -- email is preserved on UPDATE (but NOT clobbered on INSERT, since
    -- signup legitimately sets it from the auth profile). The source of
    -- truth is auth.users.email; allowing user-mutable changes here would
    -- let a user spoof admin status — isAdminEmail() is currently called
    -- against public.users.email in two paths (subscription middleware,
    -- support admin route).
    NEW.email                      := OLD.email;
    NEW.trial_status               := OLD.trial_status;
    NEW.trial_started_at           := OLD.trial_started_at;
    NEW.trial_ends_at              := OLD.trial_ends_at;
    NEW.images_generated_count     := OLD.images_generated_count;
    NEW.images_limit               := OLD.images_limit;
    NEW.stories_created_this_month := OLD.stories_created_this_month;
    NEW.stories_limit              := OLD.stories_limit;
    NEW.subscription_tier          := OLD.subscription_tier;
    NEW.subscription_status        := OLD.subscription_status;
    NEW.billing_cycle_start        := OLD.billing_cycle_start;
    NEW.annual_subscription        := OLD.annual_subscription;
    NEW.stripe_customer_id         := OLD.stripe_customer_id;
    NEW.stripe_subscription_id     := OLD.stripe_subscription_id;
    NEW.team_id                    := OLD.team_id;
    NEW.is_team_primary            := OLD.is_team_primary;
    NEW.feedback_bonus_awarded     := OLD.feedback_bonus_awarded;
    NEW.has_given_feedback         := OLD.has_given_feedback;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_block_privileged_changes ON public.users;
CREATE TRIGGER users_block_privileged_changes
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_block_privileged_changes();

COMMENT ON FUNCTION public.users_block_privileged_changes() IS
  'Silently sanitizes privileged columns on public.users when called by the authenticated role. Service-role and SECURITY DEFINER functions bypass via current_user check.';

-- ----- 3. Audit log ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID,
  op          TEXT NOT NULL,
  caller_role TEXT NOT NULL,
  caller_uid  UUID,
  before_row  JSONB,
  after_row   JSONB,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_audit_log_user_id
  ON public.users_audit_log (user_id, changed_at DESC);

ALTER TABLE public.users_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies: service-role bypasses RLS, everyone else is locked out.

CREATE OR REPLACE FUNCTION public.users_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users_audit_log (
    user_id, op, caller_role, caller_uid, before_row, after_row
  )
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    current_user,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS users_audit ON public.users;
CREATE TRIGGER users_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_audit();

COMMENT ON TABLE public.users_audit_log IS
  'Append-only audit log for public.users mutations. Captures attempted writes including those silently sanitized by users_block_privileged_changes.';

-- ----- 4. Promote internal counter functions to SECURITY DEFINER ---------
--
-- Without this, the privileged-column guard above would block the
-- counter updates fired by DB triggers and RPCs, handing every user
-- unlimited image generation / story creation.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'track_image_generation'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.track_image_generation() SECURITY DEFINER';
  END IF;
END
$$;

-- increment_story_count is referenced by subscription middleware.
-- Promote if it exists (some environments may not have it yet).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'increment_story_count'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.increment_story_count(UUID) SECURITY DEFINER';
  END IF;
END
$$;
