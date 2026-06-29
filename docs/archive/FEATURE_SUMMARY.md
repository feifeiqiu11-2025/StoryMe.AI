# Feature Summary: User Feedback & Privacy

## 📋 Quick Overview

### Feature 1: Feedback Collection ⭐
**What**: Pop-up modal after user's first completed story
**When**: One-time only, immediately after first story save
**Purpose**: Gather user sentiment and testimonials

**Components**:
- 1-5 star rating (required)
- Optional text feedback (500 char max)
- Option to share publicly on landing page
- "Skip" or "Submit" buttons

### Feature 2: Testimonials Display 💬
**What**: "Voice from Our Little Authors" section on landing page
**Where**: Above footer, below main content
**Content**: Top 3 five-star reviews

**Selection Criteria**:
1. Must be 5-star rating
2. Must be approved by admin
3. Must be public (user opted-in)
4. Has written feedback
5. Sorted by recency

### Feature 3: Privacy Notice 🔒
**What**: Consent modal in signup flow
**When**: Before account creation (both email & OAuth)
**Purpose**: Legal compliance, transparency, build trust

**Key Points**:
- Photos stored securely in Supabase Storage
- Photos sent to fal.ai for AI generation only
- fal.ai doesn't store photos
- No selling/sharing personal data
- User can delete data anytime
- Required consent checkbox

---

## 🎯 Implementation Order (Recommended)

### Phase 1: Privacy Notice (Week 1)
**Priority**: CRITICAL - Legal requirement
**Time**: 1-2 days

**Files to Create**:
- `/src/components/auth/PrivacyConsentModal.tsx`
- `/src/app/(auth)/privacy/page.tsx`
- `/src/app/(auth)/terms/page.tsx`

**Files to Modify**:
- `/src/app/(auth)/signup/page.tsx`
- `/src/components/auth/SocialLoginButtons.tsx`

**Database Changes**:
```sql
ALTER TABLE users
  ADD COLUMN privacy_consent_given_at TIMESTAMPTZ,
  ADD COLUMN privacy_consent_version VARCHAR(10) DEFAULT 'v1.0';
```

### Phase 2: Feedback Collection (Week 1-2)
**Priority**: HIGH - Enables Phase 3
**Time**: 2-3 days

**Files to Create**:
- `/src/components/feedback/FeedbackModal.tsx`
- `/src/components/feedback/StarRating.tsx`
- `/src/app/api/feedback/route.ts`
- `/src/hooks/useFeedbackPrompt.ts`
- Migration: `create_user_feedback_table.sql`

**Files to Modify**:
- Project save success handler
- `/src/app/(dashboard)/projects/[id]/page.tsx` (or wherever save happens)

**Database Changes**:
```sql
-- New table
CREATE TABLE user_feedback (...);

-- Update users table
ALTER TABLE users
  ADD COLUMN has_given_feedback BOOLEAN DEFAULT false,
  ADD COLUMN feedback_prompt_shown_at TIMESTAMPTZ;
```

### Phase 3: Testimonials (Week 2)
**Priority**: MEDIUM - Nice to have, depends on having data
**Time**: 1-2 days

**Files to Create**:
- `/src/components/landing/Testimonials.tsx`
- `/src/app/api/testimonials/route.ts`

**Files to Modify**:
- `/src/app/page.tsx` (landing page)

---

## 📊 Database Schema Summary

### New Table: `user_feedback`
```sql
- id (UUID, PK)
- user_id (UUID, FK → users)
- rating (INTEGER 1-5, NOT NULL)
- feedback_text (TEXT, nullable)
- project_id (UUID, FK → projects, nullable)
- is_public (BOOLEAN, default false)
- is_approved (BOOLEAN, default false)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### Updates to `users` table
```sql
-- Privacy consent tracking
- privacy_consent_given_at (TIMESTAMPTZ)
- privacy_consent_version (VARCHAR)

-- Feedback tracking
- has_given_feedback (BOOLEAN)
- feedback_prompt_shown_at (TIMESTAMPTZ)
```

---

## 🤔 Key Questions to Decide

### 1. Privacy Modal Behavior
**Question**: For OAuth signup, show privacy modal before or after OAuth redirect?

**Option A (Recommended)**: After OAuth, before creating user record
- ✅ User already authenticated with Google
- ✅ Can't bypass consent
- ❌ Extra step after OAuth

**Option B**: Before OAuth click
- ✅ Earlier in flow
- ❌ User might forget/ignore
- ❌ Can still bypass by refreshing

**My Recommendation**: Option A

### 2. Feedback Incentive
**Question**: Offer reward for feedback?

**Options**:
- None (just good will)
- +5 bonus images
- Early access to new features
- Thank you badge/achievement

**My Recommendation**: +5 bonus images for trial users (increases engagement)

### 3. Testimonial Anonymity
**Question**: How much user info to show?

**Options**:
- Full name
- First name + Last initial (e.g., "Sarah M.")
- Just initials (e.g., "S.M.")
- Anonymous quote

**My Recommendation**: First name + Last initial (balances credibility & privacy)

### 4. Auto-Approve 5-Star Reviews?
**Question**: Should 5-star reviews auto-appear on landing page?

**Option A**: Manual approval only (safer)
- ✅ Prevents spam/inappropriate content
- ❌ Requires admin work

**Option B**: Auto-approve 5-star, manual for others
- ✅ Faster to market
- ⚠️ Risk of bad content

**My Recommendation**: Manual approval only (you're early stage, won't have many)

### 5. Allow Editing Feedback?
**Question**: Can users edit/delete their feedback later?

**My Recommendation**:
- ✅ Allow viewing in profile
- ✅ Allow deleting
- ❌ No editing (prevents abuse)

### 6. Age Verification?
**Question**: COPPA compliance for children under 13?

**Options**:
- Age gate (must be 18+ or have parent account)
- Assume parent is creating account (current approach)
- Add "I am a parent/guardian" checkbox

**My Recommendation**: Add checkbox: "☑ I am a parent/legal guardian creating stories for my children"

---

## 🎨 Design Preview

### Feedback Modal
```
╔════════════════════════════════════════╗
║  🎉 Congratulations on Your First      ║
║      Story!                            ║
║                                        ║
║  How would you rate StoryMe?          ║
║  ☆ ☆ ☆ ☆ ☆  ← Click to rate          ║
║                                        ║
║  Tell us more (optional):              ║
║  ┌──────────────────────────────────┐ ║
║  │                                  │ ║
║  │  (Your feedback here...)         │ ║
║  │                                  │ ║
║  └──────────────────────────────────┘ ║
║  0/500 characters                     ║
║                                        ║
║  ☐ Share my feedback publicly         ║
║                                        ║
║  [Skip for now]      [Submit Feedback]║
╚════════════════════════════════════════╝
```

### Testimonials Section (Landing Page)
```
╔════════════════════════════════════════════════╗
║  Voice from Our Little Authors 🌟             ║
║  ────────────────────────────────────────      ║
║                                                ║
║  ┌────────────┐  ┌────────────┐  ┌──────────┐║
║  │ ⭐⭐⭐⭐⭐  │  │ ⭐⭐⭐⭐⭐  │  │ ⭐⭐⭐⭐⭐│║
║  │            │  │            │  │          │║
║  │ "StoryMe   │  │ "My kids   │  │ "Amazing │║
║  │  brought   │  │  can't stop│  │  AI tech │║
║  │  my son's  │  │  reading   │  │  and easy│║
║  │  imagina-  │  │  their own │  │  to use!"│║
║  │  tion to   │  │  stories!" │  │          │║
║  │  life!"    │  │            │  │          │║
║  │            │  │            │  │          │║
║  │ - Sarah M. │  │ - John K.  │  │ - Lisa T.│║
║  │   ⏰ 2 days│  │   ⏰ 5 days│  │  ⏰ 1 week│║
║  └────────────┘  └────────────┘  └──────────┘║
╚════════════════════════════════════════════════╝
```

### Privacy Consent Modal
```
╔════════════════════════════════════════════╗
║  🔒 Privacy & Data Usage Notice            ║
║  ──────────────────────────────────────    ║
║                                            ║
║  Before creating your account:            ║
║                                            ║
║  ✓ Your Photos & Data Security            ║
║    • Encrypted cloud storage (Supabase)   ║
║    • Never sold or shared for marketing   ║
║    • Delete anytime                       ║
║                                            ║
║  ✓ AI Image Generation                    ║
║    • Photos sent to fal.ai for processing ║
║    • fal.ai does NOT store your photos    ║
║    • Only used for story generation       ║
║                                            ║
║  ☐ I am a parent/legal guardian           ║
║  ☐ I consent to Privacy Policy & Terms ↗  ║
║                                            ║
║  [Cancel]          [I Consent, Continue]  ║
╚════════════════════════════════════════════╝
```

---

## 📈 Success Metrics

### Privacy Consent
- **Target**: <5% drop-off rate at consent modal
- **Measure**: Conversions (consent clicks / signup starts)

### Feedback Collection
- **Target**: 30% of first-time users submit feedback
- **Target**: 4.0+ average rating
- **Measure**: Feedback submissions / first stories completed

### Testimonials
- **Target**: 2x increase in signup conversion rate
- **Measure**: Landing page signups before/after testimonials
- **A/B Test**: With vs without testimonials section

---

## ✅ Ready to Build?

Once you approve this plan, we'll start with:
1. **Phase 1: Privacy Notice** (most critical)
2. **Phase 2: Feedback Collection** (gather data)
3. **Phase 3: Testimonials** (showcase social proof)

Let me know if you want to:
- Adjust any design/flow
- Answer any of the key questions
- Prioritize differently
- Add/remove features
