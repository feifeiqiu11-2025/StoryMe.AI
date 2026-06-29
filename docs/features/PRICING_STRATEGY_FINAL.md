# KindleWood Studio - Final Pricing Strategy

**Date:** October 23, 2025
**Status:** ✅ Approved - Ready for Implementation

---

## 💰 **Subscription Tiers**

### **Free Trial** (7 Days)
```
Price: $0
Duration: 7 days from signup
Limit: Up to 5 stories
Features: Full access to all features
After Trial: Must upgrade to Basic or Premium to continue creating stories
Access: Can still view/download existing stories after trial ends
```

**Trial Expiry Behavior:**
- Can view existing stories (read-only)
- Can download existing PDFs
- Cannot create NEW stories
- Prominent upgrade prompt

---

### **Basic Tier** - $8.99/month
```
Price: $8.99/month (or $89/year - save $18)
Stories: 20 NEW stories per month
Billing Cycle: Resets on monthly anniversary
```

**Features Included:**
- ✅ Create 20 new stories per month
- ✅ AI story generation with character consistency
- ✅ Audio narration (English + Chinese)
- ✅ High-quality PDF download
- ✅ Publish to Spotify (KindleWood Stories podcast)
- ✅ KindleWood Kids app access (FREE)
- ✅ Unlimited child profiles
- ✅ Quiz generation per story
- ✅ Reading analytics
- ✅ Reading goals tracking
- ✅ Unlimited access to previously created stories
- ✅ FREE translation (English ↔ Chinese) - doesn't count toward limit

**Features Coming Soon:**
- ⏳ Edit/regenerate existing stories (free, no credit usage)
- ⏳ Advanced analytics

**Story Counting Rules:**
- Creating a NEW story = 1 story (counts toward 20/month limit)
- Translating existing story = FREE (no count)
- Viewing/downloading existing story = FREE (no count)
- Edit/regenerate (when available) = FREE (no count)

**Best For:** Families creating 1-2 stories per week, 1-3 children

---

### **Premium Tier** - $14.99/month
```
Price: $14.99/month (or $149/year - save $30.88)
Stories: Unlimited
Billing Cycle: Monthly or annual
```

**Features Included:**
- ✅ **Unlimited story creation**
- ✅ Everything in Basic tier +
- ✅ Priority support
- ✅ Early access to new features
- ✅ Advanced analytics (coming soon)
- ✅ No story limits ever

**Best For:** Active creators, multiple children, frequent story creation

---

### **Team Tier** - $59.99/month
```
Price: $59.99/month (or $599/year - save $120.88)
Accounts: 5 separate KindleWood Studio logins
Stories: Unlimited per account
Billing: Managed by primary account
```

**How Team Works:**
- 5 completely separate Studio accounts (5 different email logins)
- Each account: Unlimited stories
- Each account: Own "My Stories" library (not shared)
- Each account: Own child profiles
- Each account: Independent usage (no sharing needed)
- Primary account: Handles all billing/payment
- Backend: User table has `team_id` and `is_team_primary` flags
- No team management UI needed (just billing)

**Features Per Account:**
- ✅ All Premium features
- ✅ Unlimited story creation
- ✅ Priority support for all team members
- ✅ Early access to features

**Team Setup:**
1. Primary user signs up for Team plan
2. Primary user invites 4 additional emails
3. Each invited user creates their own Studio account
4. Backend links all 5 accounts via `team_id`
5. Only primary account sees billing/payment info

**Best For:**
- Schools (5 teachers)
- Daycare centers (5 educators)
- Large families (5 parents/grandparents)
- Parent co-ops

**Value Proposition:** $59.99 ÷ 5 = $12/user (saves $2.99 per user vs Premium)

---

## 🎯 **Feature Matrix**

| Feature | Free Trial | Basic | Premium | Team |
|---------|-----------|-------|---------|------|
| **Duration** | 7 days | Ongoing | Ongoing | Ongoing |
| **New Stories** | 5 total | 20/month | Unlimited | Unlimited |
| **AI Generation** | ✅ | ✅ | ✅ | ✅ |
| **Audio Narration** | ✅ | ✅ | ✅ | ✅ |
| **PDF Download** | ✅ | ✅ | ✅ | ✅ |
| **Spotify Publishing** | ✅ | ✅ | ✅ | ✅ |
| **Kids App (FREE)** | ✅ | ✅ | ✅ | ✅ |
| **Child Profiles** | Unlimited | Unlimited | Unlimited | Unlimited |
| **Quizzes** | ✅ | ✅ | ✅ | ✅ |
| **Reading Analytics** | ✅ | ✅ | ✅ | ✅ |
| **Translation (FREE)** | ✅ | ✅ | ✅ | ✅ |
| **Edit Stories (soon)** | ✅ | ✅ | ✅ | ✅ |
| **Priority Support** | ❌ | ❌ | ✅ | ✅ |
| **Early Features** | ❌ | ❌ | ✅ | ✅ |
| **Team Accounts** | ❌ | ❌ | ❌ | 5 accounts |
| **Annual Discount** | - | 15% | 15% | 15% |

---

## 📱 **KindleWood Kids App Messaging**

**Key Message:** "KindleWood Kids App is FREE with any Studio plan"

**Full Messaging:**
```
✨ KindleWood Kids App: Included FREE

The KindleWood Kids mobile app is included FREE with every
Studio subscription. Your children can read, listen, and learn
from all the stories you create in Studio.

✅ No separate app purchase
✅ No in-app purchases
✅ No ads - ever
✅ Safe, parent-controlled content

Available on iOS and Android (coming soon)
```

**Where to Show:**
- Pricing page (prominent callout)
- Signup confirmation email
- Dashboard welcome banner (first login)
- Kids app download page
- FAQ section

---

## 🔢 **Story Counting Logic**

### **What Counts Toward Limit:**
```
✅ Creating a NEW story from scratch = 1 story
```

### **What's FREE (No Count):**
```
✅ Translating existing story (EN ↔ ZH) = FREE
✅ Viewing existing stories = FREE
✅ Downloading existing PDFs = FREE
✅ Publishing existing story to Spotify = FREE
✅ Accessing story in Kids app = FREE
✅ [Coming Soon] Editing/regenerating existing story = FREE
```

### **Monthly Reset:**
- Story count resets on billing anniversary
- Basic: Get 20 new credits on renewal date
- Premium/Team: Always unlimited

### **Over-Limit Behavior (Basic Tier):**
- User hits 20/20 stories
- Show upgrade prompt
- Options:
  1. Wait until next billing cycle (show countdown)
  2. Upgrade to Premium (unlimited)
  3. Buy one-time add-on: +10 stories for $4.99 (future feature)

---

## 💳 **Billing & Payment**

### **Payment Processor:**
- Stripe (industry standard)

### **Billing Cycles:**
- Monthly: Charge every 30 days
- Annual: Charge once per year (15% discount)

### **Payment Methods Accepted:**
- Credit/Debit cards (Visa, Mastercard, Amex, Discover)
- Apple Pay / Google Pay (via Stripe)
- ACH/Bank transfer (for annual plans, future)

### **Currency:**
- USD (primary)
- Add localized pricing later (CNY, EUR, etc.)

### **Team Billing:**
- Only primary account has billing access
- Primary account email receives invoices
- If primary cancels, entire team loses access
- Team members cannot see billing info

---

## 🔄 **Upgrade/Downgrade Rules**

### **Free Trial → Basic/Premium:**
- Immediate upgrade
- Trial ends immediately
- Billing starts now
- Keeps all stories created during trial

### **Basic → Premium:**
- Immediate upgrade
- Prorated credit for unused Basic time
- Unlimited stories start immediately
- No data loss

### **Premium → Basic:**
- Downgrade takes effect at end of current billing period
- Keep existing stories (no deletion)
- Can still view/download all stories
- New story creation limited to 20/month starting next cycle

### **Any Tier → Team:**
- Immediate upgrade
- Invite 4 additional users
- Primary account keeps all existing stories
- New team members start fresh

### **Cancellation:**
- Can cancel anytime
- Access continues until end of billing period
- After expiry:
  - Can view/download existing stories (read-only)
  - Cannot create new stories
  - Kids app: Can still read existing stories
  - No data deletion for 30 days (grace period)
  - After 30 days: Account marked inactive (can reactivate)

---

## 📊 **Database Schema Requirements**

### **Users Table Updates:**
```sql
ALTER TABLE users ADD COLUMN:
- subscription_tier (text): 'trial', 'basic', 'premium', 'team'
- subscription_status (text): 'active', 'cancelled', 'past_due', 'incomplete'
- trial_start_date (timestamp)
- trial_end_date (timestamp)
- stories_created_this_month (integer): Resets monthly
- stories_limit (integer): 5 (trial), 20 (basic), -1 (unlimited)
- billing_cycle_start (timestamp): Subscription start/renewal date
- stripe_customer_id (text)
- stripe_subscription_id (text)
- team_id (uuid): Links team members
- is_team_primary (boolean): True for billing account
- annual_subscription (boolean): True if annual plan
```

### **New Tables:**

**`subscriptions` table:**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  tier TEXT, -- 'basic', 'premium', 'team'
  status TEXT, -- 'active', 'cancelled', 'past_due'
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**`teams` table:**
```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  primary_user_id UUID REFERENCES users(id),
  team_name TEXT,
  member_count INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 5,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**`team_members` table:**
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id),
  is_primary BOOLEAN DEFAULT FALSE,
  invited_email TEXT,
  invitation_status TEXT, -- 'pending', 'accepted', 'declined'
  joined_at TIMESTAMP,
  created_at TIMESTAMP
);
```

**`usage_tracking` table:**
```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  billing_period_start DATE,
  billing_period_end DATE,
  stories_created INTEGER DEFAULT 0,
  stories_limit INTEGER,
  created_at TIMESTAMP
);
```

---

## 🎨 **UI/UX Requirements**

### **Pricing Page:**
- Show all 4 tiers clearly
- Highlight "Most Popular" (Premium)
- Show annual savings
- "Kids App FREE" callout
- Feature comparison table
- FAQ section
- "Start Free Trial" CTA

### **Upgrade Prompts:**
- When user hits story limit (Basic)
- When trial expires
- Dashboard banner (non-intrusive)
- Settings page link

### **Billing Dashboard:**
- Current plan display
- Usage this month (Basic only)
- Renewal date
- Payment method
- Invoice history
- Cancel/change plan options

### **Team Management:**
- Primary user only:
  - Invite members (email)
  - View team member list
  - Remove members
  - View billing
- Team members:
  - See "Team Member" badge
  - No billing access
  - Independent story library

---

## 🚀 **Launch Strategy**

### **Soft Launch (Recommended):**
1. Enable subscriptions for existing users only
2. Monitor for bugs/issues
3. Collect feedback
4. Fix issues quickly
5. Public launch after 1 week

### **Public Launch:**
1. Announce on landing page
2. Email existing users
3. Social media announcement
4. Update Kids app description

### **Migration Plan:**
- Existing users: Keep on "trial" or "free tier"
- Email: "We've launched subscriptions! Upgrade to unlock unlimited stories"
- Grace period: 30 days to upgrade
- After grace: Soft limit enforcement (warnings, not blocks)

---

## ✅ **Implementation Checklist**

### **Phase 2A: Database & Backend (Day 1-2)**
- [ ] Update users table schema
- [ ] Create subscriptions table
- [ ] Create teams & team_members tables
- [ ] Create usage_tracking table
- [ ] Add RLS policies
- [ ] Create subscription middleware (check limits before story creation)
- [ ] Add usage tracking functions

### **Phase 2B: Stripe Integration (Day 2-3)**
- [ ] Create Stripe account / use existing
- [ ] Set up Stripe products (Trial, Basic, Premium, Team)
- [ ] Set up pricing (monthly + annual for each)
- [ ] Implement Stripe Checkout
- [ ] Add webhook handlers (payment success, failed, cancelled)
- [ ] Create customer portal link
- [ ] Test payment flows (sandbox)

### **Phase 2C: UI Pages (Day 3-4)**
- [ ] Build pricing page (/pricing)
- [ ] Update upgrade page (replace placeholder)
- [ ] Add usage dashboard widget
- [ ] Create billing settings page
- [ ] Add upgrade prompts/modals
- [ ] Update settings page (show current plan)
- [ ] Add "Kids App FREE" messaging

### **Phase 2D: Team Features (Day 4-5)**
- [ ] Team signup flow
- [ ] Team invitation system
- [ ] Team member dashboard
- [ ] Primary account billing view
- [ ] Test team workflows

### **Phase 2E: Testing (Day 5)**
- [ ] Test free trial flow
- [ ] Test upgrade Basic → Premium
- [ ] Test downgrade Premium → Basic
- [ ] Test team creation
- [ ] Test story limit enforcement
- [ ] Test billing cycle resets
- [ ] Test cancellation flow
- [ ] Test webhook reliability

### **Phase 2F: Documentation (Day 5)**
- [ ] Update user docs
- [ ] Create FAQ
- [ ] Write upgrade emails
- [ ] Create billing policy page
- [ ] Write refund policy

---

## 📝 **Open Questions / Future Enhancements**

### **Future Add-Ons:**
- [ ] One-time story packs: +10 stories for $4.99 (Basic only)
- [ ] Professional printing: Physical book for $29.99
- [ ] Gift subscriptions
- [ ] White-label option (Team tier, $99/mo extra)
- [ ] Custom voice cloning ($49 one-time)

### **Localization:**
- [ ] CNY pricing for China market
- [ ] EUR pricing for Europe
- [ ] Currency selector on pricing page

### **Analytics:**
- [ ] Track conversion rates (trial → paid)
- [ ] Monitor churn rate
- [ ] A/B test pricing
- [ ] Measure feature usage by tier

---

**Status:** ✅ Ready for implementation
**Next Step:** Database schema updates + Stripe setup
**Timeline:** 5-7 days to full launch
**Owner:** Development team

---

**Last Updated:** October 23, 2025
**Approved By:** Product team
