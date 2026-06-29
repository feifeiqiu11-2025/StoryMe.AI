# Phase 2A: Database & Backend Implementation - Complete

**Date:** October 23, 2025
**Status:** ✅ Ready for Database Migration
**Next Phase:** Phase 2B - Stripe Integration

---

## 📋 Overview

Phase 2A implements the complete database schema and backend infrastructure for the KindleWood Studio subscription system. This includes:

- User subscription fields
- Subscription tracking
- Team management
- Usage tracking and limits
- Automated trial initialization
- Row Level Security policies
- Subscription middleware

---

## 🗄️ Database Migrations Created

### Migration 1: Add Subscription Fields to Users Table
**File:** `supabase/migrations/20251023000001_add_subscription_fields_to_users.sql`

**New Columns Added to `users` table:**
- `subscription_tier` - 'trial', 'basic', 'premium', 'team'
- `subscription_status` - 'active', 'cancelled', 'past_due', 'incomplete', 'trialing'
- `trial_start_date` - Timestamp when trial started
- `trial_end_date` - Timestamp when trial ends (7 days after start)
- `stories_created_this_month` - Counter for monthly usage
- `stories_limit` - 5 (trial), 20 (basic), -1 (unlimited)
- `billing_cycle_start` - Subscription start/renewal date
- `stripe_customer_id` - Stripe customer identifier
- `stripe_subscription_id` - Stripe subscription identifier
- `team_id` - Links team members together
- `is_team_primary` - True for billing account
- `annual_subscription` - True if annual plan

**Functions Added:**
- `initialize_user_trial()` - Auto-initializes 7-day trial for new users
- `reset_monthly_story_count()` - Resets story count on billing cycle

**Triggers Added:**
- `trigger_initialize_user_trial` - Runs on user insert

**Indexes Added:**
- `idx_users_stripe_customer_id`
- `idx_users_stripe_subscription_id`
- `idx_users_team_id`

---

### Migration 2: Create Subscriptions Table
**File:** `supabase/migrations/20251023000002_create_subscriptions_table.sql`

**Table:** `subscriptions`
```sql
- id (UUID, primary key)
- user_id (UUID, references users)
- stripe_subscription_id (TEXT, unique)
- stripe_customer_id (TEXT)
- tier (TEXT: 'basic', 'premium', 'team')
- status (TEXT: 'active', 'cancelled', 'past_due', etc.)
- current_period_start (TIMESTAMP)
- current_period_end (TIMESTAMP)
- cancel_at_period_end (BOOLEAN)
- cancelled_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Functions Added:**
- `sync_subscription_to_user()` - Syncs subscription changes to users table

**Triggers Added:**
- `trigger_sync_subscription_to_user` - Auto-syncs on subscription changes
- `trigger_update_subscriptions_updated_at` - Updates timestamp

**Indexes Added:**
- `idx_subscriptions_user_id`
- `idx_subscriptions_stripe_subscription_id`
- `idx_subscriptions_stripe_customer_id`
- `idx_subscriptions_status`

---

### Migration 3: Create Teams Tables
**File:** `supabase/migrations/20251023000003_create_teams_tables.sql`

**Table:** `teams`
```sql
- id (UUID, primary key)
- primary_user_id (UUID, references users)
- team_name (TEXT)
- member_count (INTEGER, default 1)
- max_members (INTEGER, default 5)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Table:** `team_members`
```sql
- id (UUID, primary key)
- team_id (UUID, references teams)
- user_id (UUID, references users)
- is_primary (BOOLEAN)
- invited_email (TEXT)
- invitation_status (TEXT: 'pending', 'accepted', 'declined', 'expired')
- joined_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

**Functions Added:**
- `update_team_member_count()` - Auto-updates team member count
- `sync_team_member_to_user()` - Syncs team membership to users table
- `enforce_max_team_members()` - Prevents exceeding 5 members

**Triggers Added:**
- `trigger_update_team_member_count`
- `trigger_sync_team_member_to_user`
- `trigger_enforce_max_team_members`
- `trigger_update_teams_updated_at`

**Indexes Added:**
- `idx_teams_primary_user_id`
- `idx_team_members_team_id`
- `idx_team_members_user_id`
- `idx_team_members_invited_email`

---

### Migration 4: Create Usage Tracking Table
**File:** `supabase/migrations/20251023000004_create_usage_tracking_table.sql`

**Table:** `usage_tracking`
```sql
- id (UUID, primary key)
- user_id (UUID, references users)
- billing_period_start (DATE)
- billing_period_end (DATE)
- stories_created (INTEGER)
- stories_limit (INTEGER)
- last_story_created_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Functions Added:**
- `get_or_create_usage_tracking(p_user_id UUID)` - Gets or creates usage record for current period
- `can_create_story(p_user_id UUID)` - Checks if user can create a story
- `increment_story_count(p_user_id UUID)` - Increments story count after creation

**Triggers Added:**
- `trigger_update_usage_tracking_updated_at`

**Indexes Added:**
- `idx_usage_tracking_user_id`
- `idx_usage_tracking_billing_period`
- `idx_usage_tracking_user_period`

---

### Migration 5: Add RLS Policies
**File:** `supabase/migrations/20251023000005_add_rls_policies.sql`

**RLS Enabled for:**
- `subscriptions`
- `teams`
- `team_members`
- `usage_tracking`

**Policies Created:**

**Subscriptions:**
- Users can view own subscription
- Service role can manage all subscriptions

**Teams:**
- Primary users can view/update/delete own team
- Team members can view their team
- Primary users can create teams
- Service role can manage all teams

**Team Members:**
- Team members can view own team members
- Primary users can manage team members
- Users can update own team member record (accept invitation)
- Service role can manage all team members

**Usage Tracking:**
- Users can view own usage tracking
- Service role can manage all usage tracking
- System can insert/update usage tracking (via functions)

---

### Migration 6: Test Schema
**File:** `supabase/migrations/20251023000006_test_subscription_schema.sql`

**Tests:**
- Verifies all tables exist
- Verifies all functions exist
- Verifies all triggers exist
- Verifies all indexes exist

---

## 📦 Backend Code Created

### Subscription Middleware
**File:** `storyme-app/src/lib/subscription/middleware.ts`

**Functions:**

1. **`checkStoryCreationLimit(userId: string): Promise<SubscriptionStatus>`**
   - Checks if user can create a new story
   - Returns detailed status about subscription and usage
   - Validates subscription status, trial expiry, and limits

2. **`incrementStoryCount(userId: string): Promise<void>`**
   - Increments story count after successful creation
   - Calls database function `increment_story_count`

3. **`getCurrentUsageTracking(userId: string)`**
   - Gets usage tracking for current billing period
   - Calls database function `get_or_create_usage_tracking`

4. **`checkFreeAction(userId: string): Promise<boolean>`**
   - Validates user can perform free actions (translation, viewing, etc.)

5. **`getSubscriptionSummary(userId: string)`**
   - Returns comprehensive subscription summary
   - Includes trial days remaining, usage percentage, etc.

**Response Types:**
```typescript
interface SubscriptionStatus {
  canCreate: boolean;
  reason?: string;
  storiesUsed: number;
  storiesLimit: number;
  tier: string;
  status: string;
  trialEndsAt?: string;
}
```

---

### Subscription Utilities
**File:** `storyme-app/src/lib/subscription/utils.ts`

**Functions:**

1. **Formatting:**
   - `formatTierName(tier: string): string` - Display-friendly tier names
   - `formatPrice(price: number): string` - Currency formatting
   - `formatDate(date: string | Date): string` - Date formatting

2. **Pricing:**
   - `getTierPrice(tier: string, annual: boolean): number` - Get tier price
   - `calculateAnnualSavings(tier: string): number` - Calculate savings

3. **Features:**
   - `getTierFeatures(tier: string): string[]` - Get tier feature list
   - `isUnlimitedTier(tier: string): boolean` - Check if unlimited

4. **UI Helpers:**
   - `getTierColor(tier: string): string` - Tailwind color classes
   - `getStatusBadge(status: string)` - Badge color and label

5. **Business Logic:**
   - `getUpgradeRecommendation()` - Smart upgrade suggestions
   - `getNextBillingDate()` - Calculate next billing date
   - `daysUntil(date: Date): number` - Days until date

---

## 🔄 How It Works

### New User Signup Flow:
1. User signs up → `users` table insert
2. `trigger_initialize_user_trial` fires automatically
3. Sets:
   - `subscription_tier = 'trial'`
   - `subscription_status = 'trialing'`
   - `trial_start_date = NOW()`
   - `trial_end_date = NOW() + 7 days`
   - `stories_limit = 5`
   - `stories_created_this_month = 0`

### Story Creation Flow:
1. User clicks "Create Story"
2. Frontend calls `checkStoryCreationLimit(userId)`
3. Middleware checks:
   - Subscription status (active/trialing)
   - Trial expiry
   - Story limit
4. If allowed:
   - Story is created
   - `incrementStoryCount(userId)` is called
   - Updates `stories_created_this_month` in users table
   - Creates/updates `usage_tracking` record
5. If denied:
   - Returns reason (trial expired, limit reached, etc.)
   - Frontend shows upgrade prompt

### Team Creation Flow:
1. Primary user signs up for Team tier
2. `teams` table record created
3. Primary user invites 4 emails
4. `team_members` records created with `invitation_status = 'pending'`
5. Invited users sign up
6. `invitation_status` → 'accepted'
7. `trigger_sync_team_member_to_user` fires
8. Updates user's `team_id`, `subscription_tier = 'team'`, `stories_limit = -1`

### Monthly Billing Reset:
1. Cron job (or scheduled function) calls `reset_monthly_story_count()`
2. Resets `stories_created_this_month = 0` for all active subscribers
3. Updates `billing_cycle_start` to next month

---

## ✅ Testing Checklist

### Database Schema:
- [x] All 6 migration files created
- [x] Users table has all new columns
- [x] Subscriptions table created
- [x] Teams and team_members tables created
- [x] Usage_tracking table created
- [x] All indexes created
- [x] All functions created
- [x] All triggers created
- [x] RLS policies created

### Backend Code:
- [x] Subscription middleware created
- [x] Subscription utils created
- [x] TypeScript types defined
- [x] Error handling implemented

### Ready for Testing (after migration):
- [ ] Apply migrations to production database
- [ ] Test trial initialization on new user signup
- [ ] Test `can_create_story()` function
- [ ] Test `increment_story_count()` function
- [ ] Test story limit enforcement (Basic tier)
- [ ] Test unlimited stories (Premium tier)
- [ ] Test team creation
- [ ] Test team member invitation
- [ ] Test RLS policies (users can only see own data)
- [ ] Test monthly reset function

---

## 🚀 Next Steps

### Phase 2B: Stripe Integration
1. Set up Stripe products:
   - Trial (Free, 7 days, 5 stories)
   - Basic ($8.99/month or $89/year, 20 stories)
   - Premium ($14.99/month or $149/year, unlimited)
   - Team ($59.99/month or $599/year, 5 accounts)

2. Implement Stripe Checkout:
   - Create checkout session endpoint
   - Handle success/cancel redirects
   - Sync subscription to database

3. Implement Stripe Webhooks:
   - `checkout.session.completed` - Create subscription
   - `customer.subscription.updated` - Update subscription
   - `customer.subscription.deleted` - Cancel subscription
   - `invoice.payment_failed` - Handle failed payment

4. Create Customer Portal:
   - Manage subscription
   - Update payment method
   - View invoices
   - Cancel subscription

---

## 📝 Migration Instructions

### To Apply Migrations to Production:

**Option 1: Supabase Dashboard (Recommended for first time)**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of each migration file (in order)
3. Execute one by one
4. Run test migration last to verify

**Option 2: Supabase CLI (if local setup available)**
```bash
npx supabase db reset  # Reset and apply all migrations
npx supabase db push   # Push migrations to remote
```

**Option 3: Direct Database Access**
```bash
# Run each migration file
psql $DATABASE_URL -f supabase/migrations/20251023000001_add_subscription_fields_to_users.sql
psql $DATABASE_URL -f supabase/migrations/20251023000002_create_subscriptions_table.sql
psql $DATABASE_URL -f supabase/migrations/20251023000003_create_teams_tables.sql
psql $DATABASE_URL -f supabase/migrations/20251023000004_create_usage_tracking_table.sql
psql $DATABASE_URL -f supabase/migrations/20251023000005_add_rls_policies.sql
psql $DATABASE_URL -f supabase/migrations/20251023000006_test_subscription_schema.sql
```

---

## 🔒 Security Notes

- RLS policies ensure users can only access their own data
- Service role has full access (for Stripe webhooks)
- Team members can only see their own team data
- Primary users can manage their team
- All sensitive operations use database functions (not client-side)

---

## 📊 Database Schema Diagram

```
┌─────────────┐
│   users     │
├─────────────┤
│ id          │◄─────┐
│ email       │      │
│ sub_tier    │      │
│ sub_status  │      │
│ stories_    │      │
│   limit     │      │
│ team_id     │──┐   │
└─────────────┘  │   │
                 │   │
┌─────────────┐  │   │
│subscriptions│  │   │
├─────────────┤  │   │
│ id          │  │   │
│ user_id     │──┘   │
│ stripe_sub  │      │
│ tier        │      │
└─────────────┘      │
                     │
┌─────────────┐      │
│   teams     │      │
├─────────────┤      │
│ id          │◄─────┤
│ primary_    │      │
│   user_id   │──────┘
└─────────────┘
       ▲
       │
┌─────────────┐
│team_members │
├─────────────┤
│ team_id     │──────┘
│ user_id     │
│ is_primary  │
└─────────────┘

┌─────────────┐
│usage_       │
│  tracking   │
├─────────────┤
│ user_id     │
│ period_     │
│   start     │
│ stories_    │
│   created   │
└─────────────┘
```

---

**Phase 2A Status:** ✅ Complete - Ready for Migration
**Next Phase:** Phase 2B - Stripe Integration
**Timeline:** Phase 2A took 1 hour, Phase 2B estimated 3-4 hours

---

**Last Updated:** October 23, 2025
**Implementation Team:** Development Team
