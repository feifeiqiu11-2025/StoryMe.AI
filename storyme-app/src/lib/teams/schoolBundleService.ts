/**
 * School Bundle Service
 *
 * Manages 4-teacher school bundles. Each bundle:
 *   - Maps to one Stripe Customer (the billing primary teacher)
 *   - One Stripe Subscription on the team monthly price
 *   - 4 KW user accounts, each with stories_limit=15 (NOT shared)
 *
 * Webhook handles all post-Checkout state changes (see webhooks/stripe/route.ts).
 * This service only handles the synchronous admin actions: create, list, portal,
 * tax-exempt toggle, member removal, and Checkout regeneration.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { stripe, getPriceId } from '@/lib/stripe/config';

// Stripe Checkout Sessions hard-cap at 24h. Use 23h for a safety margin
// against clock skew between our server and Stripe's API.
const CHECKOUT_EXPIRY_SECONDS = 23 * 60 * 60;
const MAX_BUNDLE_MEMBERS = 4;

export type BundleStatus =
  | 'pending'
  | 'checkout_expired'
  | 'incomplete'
  | 'active'
  | 'past_due'
  | 'cancelled';

export interface CreateBundleInput {
  schoolName: string;
  primaryEmail: string;
  memberEmails: string[]; // up to 3 additional teachers
  successUrl: string;
  cancelUrl: string;
}

export interface BundleSummary {
  teamId: string;
  schoolName: string;
  primaryEmail: string;
  memberCount: number;
  status: BundleStatus | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  taxExempt: boolean;
  checkoutUrl: string | null;
  checkoutExpiresAt: string | null;
}

export class BundleError extends Error {
  constructor(public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

/**
 * Create a school bundle: validate emails, stamp users, create Checkout.
 * Returns Checkout URL — admin sends to school primary.
 */
export async function createBundle(input: CreateBundleInput): Promise<{
  teamId: string;
  checkoutUrl: string;
  checkoutExpiresAt: string;
}> {
  const supabase = createServiceRoleClient();

  // ── 1. Normalize + validate input ──────────────────────────────────────
  const schoolName = input.schoolName.trim();
  if (!schoolName) {
    throw new BundleError('VALIDATION_FAILED', 'School name required');
  }

  const primaryEmail = input.primaryEmail.trim().toLowerCase();
  const memberEmails = (input.memberEmails || [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const allEmails = [primaryEmail, ...memberEmails];

  if (allEmails.length < 1 || allEmails.length > MAX_BUNDLE_MEMBERS) {
    throw new BundleError(
      'VALIDATION_FAILED',
      `Bundle must have 1–${MAX_BUNDLE_MEMBERS} teachers (got ${allEmails.length})`
    );
  }
  if (new Set(allEmails).size !== allEmails.length) {
    throw new BundleError('VALIDATION_FAILED', 'Duplicate emails in bundle');
  }

  // ── 2. Look up users + pre-flight checks ───────────────────────────────
  // Case-insensitive: query each email via ilike, OR'd together. Necessary
  // because users.email may be stored mixed-case (depends on signup flow).
  const orFilter = allEmails.map((e) => `email.ilike.${e}`).join(',');
  const { data: users, error: lookupError } = await supabase
    .from('users')
    .select('id, email, team_id, stripe_subscription_id, subscription_tier')
    .or(orFilter);

  if (lookupError) {
    throw new BundleError('DB_ERROR', 'Failed to look up users', lookupError);
  }

  // Build lowercase email → user map for the missing-emails diff
  const userByEmail = new Map<string, (typeof users)[number]>();
  for (const u of users || []) {
    if (u.email) userByEmail.set(u.email.toLowerCase(), u);
  }

  const missingEmails = allEmails.filter((e) => !userByEmail.has(e));
  if (missingEmails.length > 0) {
    throw new BundleError(
      'USERS_NOT_FOUND',
      `These emails are not registered KW users: ${missingEmails.join(', ')}. Have them sign up first.`,
      { missingEmails }
    );
  }

  const conflicts = (users || []).filter(
    (u) => u.team_id || (u.stripe_subscription_id && u.subscription_tier !== 'free')
  );
  if (conflicts.length > 0) {
    throw new BundleError(
      'USER_HAS_EXISTING_SUBSCRIPTION',
      `These users already have a team or paid subscription — cancel first: ${conflicts
        .map((c) => c.email)
        .join(', ')}`,
      { conflicts: conflicts.map((c) => ({ email: c.email, tier: c.subscription_tier })) }
    );
  }

  const primaryUser = userByEmail.get(primaryEmail)!;
  const memberUsers = memberEmails.map((e) => userByEmail.get(e)!);
  const allUsers = [primaryUser, ...memberUsers];

  // ── 3. Create teams row (status='pending') ─────────────────────────────
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      primary_user_id: primaryUser.id,
      team_name: schoolName,
      max_members: MAX_BUNDLE_MEMBERS,
      member_count: allUsers.length,
      subscription_status: 'pending',
    })
    .select()
    .single();

  if (teamError || !team) {
    throw new BundleError('DB_ERROR', 'Failed to create team row', teamError);
  }

  // ── 4. Stamp users with team_id (tier flip happens via webhook) ────────
  // Cleanup helper if Stripe step fails
  const cleanup = async () => {
    await supabase.from('users').update({ team_id: null, is_team_primary: false }).eq('team_id', team.id);
    await supabase.from('teams').delete().eq('id', team.id);
  };

  try {
    for (const u of allUsers) {
      const { error } = await supabase
        .from('users')
        .update({
          team_id: team.id,
          is_team_primary: u.id === primaryUser.id,
        })
        .eq('id', u.id);
      if (error) throw new BundleError('DB_ERROR', `Failed to stamp user ${u.email}`, error);
    }

    // ── 5. Create Stripe Checkout Session ───────────────────────────────
    const priceId = getPriceId('team', 'monthly');
    if (!priceId) {
      throw new BundleError(
        'CONFIG_MISSING',
        'STRIPE_PRICE_TEAM_MONTHLY env var is not set'
      );
    }

    const expiresAtUnix = Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_SECONDS;

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer_email: primaryEmail,
        line_items: [{ price: priceId, quantity: 1 }],
        automatic_tax: { enabled: true },
        billing_address_collection: 'required',
        allow_promotion_codes: true,
        // tax_id_collection lets schools enter exemption IDs at checkout
        tax_id_collection: { enabled: true },
        subscription_data: {
          metadata: {
            team_id: team.id,
            type: 'school_bundle',
            school_name: schoolName,
          },
        },
        metadata: {
          team_id: team.id,
          type: 'school_bundle',
          school_name: schoolName,
        },
        expires_at: expiresAtUnix,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
      {
        idempotencyKey: `school-bundle-create-${team.id}`,
      }
    );

    if (!session.url) {
      throw new BundleError('STRIPE_ERROR', 'Stripe did not return a Checkout URL');
    }

    const checkoutExpiresAt = new Date(expiresAtUnix * 1000).toISOString();

    // ── 6. Save Checkout state on team row ────────────────────────────────
    const { error: updateError } = await supabase
      .from('teams')
      .update({
        checkout_session_id: session.id,
        checkout_url: session.url,
        checkout_expires_at: checkoutExpiresAt,
      })
      .eq('id', team.id);

    if (updateError) {
      throw new BundleError('DB_ERROR', 'Failed to save Checkout state', updateError);
    }

    return {
      teamId: team.id,
      checkoutUrl: session.url,
      checkoutExpiresAt,
    };
  } catch (err) {
    await cleanup().catch((e) => console.error('[BundleService] cleanup failed:', e));
    throw err;
  }
}

/**
 * List all school bundles with summary info (admin dashboard).
 */
export async function listBundles(): Promise<BundleSummary[]> {
  const supabase = createServiceRoleClient();

  const { data: teams, error } = await supabase
    .from('teams')
    .select(
      'id, team_name, primary_user_id, member_count, subscription_status, current_period_end, cancel_at_period_end, tax_exempt, checkout_url, checkout_expires_at'
    )
    .order('created_at', { ascending: false });

  if (error) throw new BundleError('DB_ERROR', 'Failed to list bundles', error);
  if (!teams || teams.length === 0) return [];

  const primaryIds = teams.map((t) => t.primary_user_id).filter(Boolean);
  const { data: primaries } = await supabase
    .from('users')
    .select('id, email')
    .in('id', primaryIds);

  const emailById = new Map((primaries || []).map((p) => [p.id, p.email]));

  return teams.map((t) => ({
    teamId: t.id,
    schoolName: t.team_name || '(unnamed)',
    primaryEmail: emailById.get(t.primary_user_id) || '',
    memberCount: t.member_count || 0,
    status: (t.subscription_status as BundleStatus) || null,
    currentPeriodEnd: t.current_period_end,
    cancelAtPeriodEnd: !!t.cancel_at_period_end,
    taxExempt: !!t.tax_exempt,
    checkoutUrl: t.checkout_url,
    checkoutExpiresAt: t.checkout_expires_at,
  }));
}

/**
 * Open Stripe Customer Portal for a bundle's billing primary.
 * School uses this to manage payment method, cancel, view invoices.
 */
export async function createPortalSession(
  teamId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const supabase = createServiceRoleClient();
  const { data: team, error } = await supabase
    .from('teams')
    .select('stripe_customer_id')
    .eq('id', teamId)
    .single();

  if (error || !team?.stripe_customer_id) {
    throw new BundleError(
      'NO_STRIPE_CUSTOMER',
      'Bundle has no Stripe Customer yet — Checkout must be completed first'
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: team.stripe_customer_id,
    return_url: returnUrl,
  });

  return { url: session.url };
}

/**
 * Toggle tax-exempt flag on the Stripe Customer + record on team.
 */
export async function setTaxExempt(
  teamId: string,
  exempt: boolean,
  note?: string
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: team, error } = await supabase
    .from('teams')
    .select('stripe_customer_id')
    .eq('id', teamId)
    .single();

  if (error || !team?.stripe_customer_id) {
    throw new BundleError('NO_STRIPE_CUSTOMER', 'Bundle has no Stripe Customer yet');
  }

  await stripe.customers.update(team.stripe_customer_id, {
    tax_exempt: exempt ? 'exempt' : 'none',
  });

  await supabase
    .from('teams')
    .update({ tax_exempt: exempt, tax_exempt_note: note ?? null })
    .eq('id', teamId);
}

/**
 * Remove a teacher from the bundle: unstamp + revert tier.
 * Stripe subscription unchanged — school keeps paying for the seat.
 */
export async function removeMember(teamId: string, userId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, team_id, is_team_primary')
    .eq('id', userId)
    .single();

  if (!user || user.team_id !== teamId) {
    throw new BundleError('NOT_A_MEMBER', 'User is not a member of this bundle');
  }
  if (user.is_team_primary) {
    throw new BundleError(
      'CANNOT_REMOVE_PRIMARY',
      'Primary teacher cannot be removed. Cancel the bundle or switch primary first.'
    );
  }

  // Revert: detach from team, drop tier to free, reset limit
  await supabase
    .from('users')
    .update({
      team_id: null,
      is_team_primary: false,
      subscription_tier: 'free',
      subscription_status: 'cancelled',
      stories_limit: 2,
    })
    .eq('id', userId);

  // Decrement team member_count
  const { data: team } = await supabase
    .from('teams')
    .select('member_count')
    .eq('id', teamId)
    .single();
  if (team) {
    await supabase
      .from('teams')
      .update({ member_count: Math.max(0, (team.member_count || 1) - 1) })
      .eq('id', teamId);
  }
}

/**
 * Regenerate Checkout link for a 'pending' or 'checkout_expired' bundle.
 */
export async function regenerateCheckout(
  teamId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ checkoutUrl: string; checkoutExpiresAt: string }> {
  const supabase = createServiceRoleClient();

  const { data: team, error } = await supabase
    .from('teams')
    .select('id, team_name, primary_user_id, subscription_status, checkout_session_id')
    .eq('id', teamId)
    .single();

  if (error || !team) {
    throw new BundleError('NOT_FOUND', 'Bundle not found');
  }
  if (
    team.subscription_status !== 'pending' &&
    team.subscription_status !== 'checkout_expired'
  ) {
    throw new BundleError(
      'INVALID_STATE',
      `Cannot regenerate Checkout for status='${team.subscription_status}'`
    );
  }

  const { data: primary } = await supabase
    .from('users')
    .select('email')
    .eq('id', team.primary_user_id)
    .single();
  if (!primary?.email) {
    throw new BundleError('PRIMARY_NOT_FOUND', 'Primary teacher email missing');
  }

  // Invalidate the previous Checkout link so the school can't complete it after
  // we issue a new one (would create a duplicate Stripe subscription otherwise).
  if (team.checkout_session_id) {
    try {
      await stripe.checkout.sessions.expire(team.checkout_session_id);
    } catch (e) {
      // Already complete or expired — Stripe rejects expire() on those. Safe to ignore.
      console.log(`[BundleService] Could not expire old session ${team.checkout_session_id}:`, e);
    }
  }

  const priceId = getPriceId('team', 'monthly');
  const expiresAtUnix = Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_SECONDS;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: primary.email,
    line_items: [{ price: priceId, quantity: 1 }],
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    allow_promotion_codes: true,
    tax_id_collection: { enabled: true },
    subscription_data: {
      metadata: {
        team_id: team.id,
        type: 'school_bundle',
        school_name: team.team_name || '',
      },
    },
    metadata: {
      team_id: team.id,
      type: 'school_bundle',
      school_name: team.team_name || '',
    },
    expires_at: expiresAtUnix,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new BundleError('STRIPE_ERROR', 'Stripe did not return a Checkout URL');
  }

  const checkoutExpiresAt = new Date(expiresAtUnix * 1000).toISOString();

  await supabase
    .from('teams')
    .update({
      checkout_session_id: session.id,
      checkout_url: session.url,
      checkout_expires_at: checkoutExpiresAt,
      subscription_status: 'pending',
    })
    .eq('id', teamId);

  return { checkoutUrl: session.url, checkoutExpiresAt };
}

/**
 * Delete a bundle that never reached 'active'. Unstamps users.
 * Refuses to delete an active/past_due bundle (cancel via Stripe Portal first).
 */
export async function deleteBundle(teamId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: team } = await supabase
    .from('teams')
    .select('subscription_status, stripe_subscription_id, checkout_session_id')
    .eq('id', teamId)
    .single();

  if (!team) throw new BundleError('NOT_FOUND', 'Bundle not found');

  const deletableStatuses: (BundleStatus | null)[] = [null, 'pending', 'checkout_expired', 'cancelled'];
  if (!deletableStatuses.includes(team.subscription_status as BundleStatus)) {
    throw new BundleError(
      'INVALID_STATE',
      `Cannot delete bundle with status='${team.subscription_status}'. Cancel via Stripe Portal first.`
    );
  }

  // Kill any in-flight Checkout session so school can't complete and create
  // an orphaned subscription after we delete the team row.
  if (team.checkout_session_id) {
    try {
      await stripe.checkout.sessions.expire(team.checkout_session_id);
    } catch (e) {
      console.log(`[BundleService] Could not expire session ${team.checkout_session_id}:`, e);
    }
  }

  // Detach users
  await supabase
    .from('users')
    .update({ team_id: null, is_team_primary: false })
    .eq('team_id', teamId);

  // Delete team
  await supabase.from('teams').delete().eq('id', teamId);
}
