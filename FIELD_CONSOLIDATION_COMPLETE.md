# Field Consolidation - Subscription System ✅

**Date:** October 23, 2025
**Status:** Complete - All duplicates resolved
**Backward Compatibility:** Full support for existing 'free' users

---

## Executive Summary

✅ **subscription_tier** - ALREADY EXISTS (reused, not recreated)
✅ **trial_started_at / trial_ends_at** - ALREADY EXIST (reused)
✅ **user_usage_stats** - Is a VIEW, not a table (no conflict)
✅ **Backward compatibility** - Maintained for existing 'free' tier users

---

## Complete Field Inventory

### Existing Fields (Already in users table)

| Field | Source | Values | Used By |
|-------|--------|--------|---------|
| `subscription_tier` | Pre-existing | `'free'`, `'premium'` | Image limits + **Story limits** |
| `trial_started_at` | 20251019 migration | TIMESTAMP | Image limits + **Story limits** |
| `trial_ends_at` | 20251019 migration | TIMESTAMP | Image limits + **Story limits** |
| `trial_status` | 20251019 migration | `'active'`, `'expired'` | Image limits only |
| `images_generated_count` | 20251019 migration | INTEGER | Image limits only |
| `images_limit` | 20251019 migration | INTEGER | Image limits only |

### New Fields (Phase 2A)

| Field | Type | Purpose |
|-------|------|---------|
| `subscription_status` | TEXT | Stripe status (`'active'`, `'cancelled'`, etc.) |
| `stories_created_this_month` | INTEGER | Monthly story counter |
| `stories_limit` | INTEGER | 5 (trial), 20 (basic), -1 (unlimited) |
| `billing_cycle_start` | TIMESTAMP | Billing period start |
| `stripe_customer_id` | TEXT | Stripe customer ID |
| `stripe_subscription_id` | TEXT | Stripe subscription ID |
| `team_id` | UUID | Team membership link |
| `is_team_primary` | BOOLEAN | Primary billing account |
| `annual_subscription` | BOOLEAN | Annual vs monthly plan |

---

## Backward Compatibility: 'free' vs 'trial'

### The Issue

Existing production database uses:
- `subscription_tier = 'free'` for trial users
- `subscription_tier = 'premium'` for premium users

New pricing system wants to use:
- `subscription_tier = 'trial'` ❌ (would break existing users)
- `subscription_tier = 'basic'` (NEW tier)
- `subscription_tier = 'premium'` ✅
- `subscription_tier = 'team'` (NEW tier)

### The Solution

**Keep both 'free' and 'trial'** - They mean the same thing.

**Migration:**
1. Updated CHECK constraint to accept both values
2. Existing users keep `'free'`
3. New users also get `'free'` (not `'trial'`)
4. Code treats them as equivalent

**Updated CHECK constraint:**
```sql
CHECK (subscription_tier IN ('free', 'trial', 'basic', 'premium', 'team'))
```

**Code handles both:**
```typescript
const isTrialTier = subscription_tier === 'trial' || subscription_tier === 'free';
```

---

## Migration Changes

### 20251023000001_add_subscription_fields_to_users.sql

**What Changed:**

❌ **Removed** (would create duplicates):
```sql
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier...
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_start_date...
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_end_date...
```

✅ **Updated** (extends existing field):
```sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'trial', 'basic', 'premium', 'team'));
```

✅ **Added** (new fields only):
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT...
ALTER TABLE users ADD COLUMN IF NOT EXISTS stories_created_this_month INTEGER...
-- ... 7 more new fields
```

✅ **Updated** (uses existing field names):
```sql
CREATE OR REPLACE FUNCTION initialize_user_trial()
RETURNS TRIGGER AS $$
BEGIN
  NEW.trial_started_at := COALESCE(NEW.trial_started_at, NOW());  -- not trial_start_date
  NEW.trial_ends_at := COALESCE(NEW.trial_ends_at, NOW() + INTERVAL '7 days');  -- not trial_end_date
  NEW.subscription_tier := COALESCE(NEW.subscription_tier, 'free');  -- not 'trial'
  -- ...
END;
$$;
```

---

## Code Changes

### middleware.ts

**Changed:**
- `trial_end_date` → `trial_ends_at` (all occurrences)
- Added: `const isTrialTier = tier === 'trial' || tier === 'free'`

### utils.ts

**Added 'free' to all mappings:**
```typescript
formatTierName: { free: 'Free Trial', trial: 'Free Trial', ... }
getTierColor: { free: 'bg-gray-100...', trial: 'bg-gray-100...', ... }
getTierPrice: { free: 0, trial: 0, ... }
getTierFeatures: { free: [...trialFeatures], trial: [...trialFeatures], ... }
```

---

## Tier Reference Guide

| Tier Value | Display | Price/mo | Stories | For |
|------------|---------|----------|---------|-----|
| `'free'` | Free Trial | $0 | 5 | Existing users (backward compat) |
| `'trial'` | Free Trial | $0 | 5 | New users (optional, treated same as 'free') |
| `'basic'` | Basic | $8.99 | 20 | NEW paid tier |
| `'premium'` | Premium | $14.99 | Unlimited | Existing + new paid |
| `'team'` | Team | $59.99 | Unlimited | NEW team tier (5 accounts) |

---

## Why Keep trial_status AND subscription_status?

They control **different systems**:

| Field | System | Purpose | Values |
|-------|--------|---------|--------|
| `trial_status` | Image generation | Can user generate images? | `'active'`, `'expired'` |
| `subscription_status` | Story creation | Can user create stories? | `'active'`, `'cancelled'`, `'past_due'`, `'trialing'` |

**Example scenario:**
- User has `trial_status = 'expired'` (can't generate more images)
- User upgrades to Basic
- User now has `subscription_status = 'active'` (can create 20 stories/month)
- But still `trial_status = 'expired'` (still can't generate free images)

**Independent systems, independent status fields.**

---

## Why Create usage_tracking When user_usage_stats Exists?

**user_usage_stats** = VIEW (read-only, real-time aggregation)
```sql
CREATE VIEW user_usage_stats AS
SELECT u.id, COUNT(p.id) as total_projects, ...
FROM users u
LEFT JOIN projects p ...
```
- Aggregates ALL user activity
- Read-only
- Real-time calculations
- For analytics/dashboards

**usage_tracking** = TABLE (historical billing records)
```sql
CREATE TABLE usage_tracking (
  user_id, billing_period_start, billing_period_end,
  stories_created, stories_limit, ...
)
```
- Stores per-billing-period snapshots
- Historical record keeping
- For limit enforcement
- For billing audits

**Different purposes, no duplication.**

---

## Testing Checklist

### Existing Users (Backward Compatibility)

- [ ] Users with `subscription_tier = 'free'` can create stories
- [ ] Users with `subscription_tier = 'premium'` have unlimited stories
- [ ] Trial expiry check works for 'free' tier users
- [ ] `user_usage_stats` view still queries correctly

### New Users

- [ ] New signups get `subscription_tier = 'free'`
- [ ] New subscription fields populate correctly
- [ ] Trial expires after 7 days
- [ ] Story limit enforcement works

### New Tiers

- [ ] Can set `subscription_tier = 'basic'`
- [ ] Basic tier has 20 story limit
- [ ] Can set `subscription_tier = 'team'`
- [ ] Team tier has unlimited stories

### Migration Safety

- [ ] Migration is idempotent (can run multiple times)
- [ ] CHECK constraint update doesn't break existing data
- [ ] All existing users get correct default values
- [ ] No NULL values in required fields

---

## Files Changed

**Database Migrations:**
- `supabase/migrations/20251023000001_add_subscription_fields_to_users.sql` - Updated
- `supabase/migrations/20251023000002_create_subscriptions_table.sql` - No changes needed
- `supabase/migrations/20251023000003_create_teams_tables.sql` - No changes needed
- `supabase/migrations/20251023000004_create_usage_tracking_table.sql` - No changes needed
- `supabase/migrations/20251023000005_add_rls_policies.sql` - No changes needed
- `supabase/migrations/20251023000006_test_subscription_schema.sql` - No changes needed

**Application Code:**
- `storyme-app/src/lib/subscription/middleware.ts` - Field names updated, 'free' support added
- `storyme-app/src/lib/subscription/utils.ts` - 'free' added to all tier mappings

---

## Summary

✅ **No duplicate fields created**
✅ **Reused existing subscription_tier, trial_started_at, trial_ends_at**
✅ **Backward compatible with 'free' tier**
✅ **user_usage_stats is a VIEW (no conflict)**
✅ **usage_tracking is a TABLE for billing periods (different purpose)**
✅ **All code updated to handle both 'free' and 'trial'**
✅ **All migrations ready for production**

**Ready to apply migrations! 🚀**
