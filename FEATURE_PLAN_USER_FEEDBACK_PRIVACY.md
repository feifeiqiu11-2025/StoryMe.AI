# Feature Implementation Plan: User Feedback & Privacy Notice

## Overview
Three interconnected features to improve user trust, gather feedback, and showcase social proof.

---

## Feature 1: User Feedback Collection (After First Story)

### User Experience Flow
1. **Trigger**: When user saves their first completed story
2. **Modal Popup**: Appears immediately after save success
3. **One-Time Only**: Never shown again for this user (tracked in database)

### Feedback Form Design
```
┌─────────────────────────────────────────┐
│  🎉 Congratulations on Your First Story!│
│                                         │
│  We'd love to hear about your          │
│  experience!                            │
│                                         │
│  How would you rate StoryMe?           │
│  ⭐⭐⭐⭐⭐ (Interactive 1-5 stars)      │
│                                         │
│  Tell us more (optional):               │
│  ┌─────────────────────────────────┐   │
│  │ Multiline text area             │   │
│  │ (max 500 characters)            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Skip for now]  [Submit Feedback]     │
└─────────────────────────────────────────┘
```

### Database Schema
```sql
-- New table: user_feedback
CREATE TABLE user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Ratings (1-5 stars)
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),

  -- Optional detailed feedback
  feedback_text TEXT,

  -- Metadata
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT false, -- User can opt-in to show on landing page
  is_approved BOOLEAN DEFAULT false, -- Admin approval before showing

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX idx_user_feedback_rating ON user_feedback(rating DESC);
CREATE INDEX idx_user_feedback_public ON user_feedback(is_public, is_approved, rating DESC) WHERE is_public = true AND is_approved = true;

-- RLS policies
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
  ON user_feedback FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own feedback"
  ON user_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own feedback"
  ON user_feedback FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Public can view approved feedback
CREATE POLICY "Public can view approved feedback"
  ON user_feedback FOR SELECT
  USING (is_public = true AND is_approved = true);

-- Add column to users table to track if feedback was given
ALTER TABLE users
  ADD COLUMN has_given_feedback BOOLEAN DEFAULT false,
  ADD COLUMN feedback_prompt_shown_at TIMESTAMPTZ;
```

### Implementation Files

#### 1. `/src/components/feedback/FeedbackModal.tsx`
- Client component with React Hook Form
- Star rating component (interactive hover/click)
- Textarea with character counter
- Submit to `/api/feedback` endpoint
- Success message with option to share publicly

#### 2. `/src/app/api/feedback/route.ts`
- POST: Create new feedback
  - Validate user authentication
  - Check hasn't given feedback already
  - Insert into `user_feedback` table
  - Update `users.has_given_feedback = true`
- GET: Retrieve user's feedback (for profile page)

#### 3. `/src/hooks/useFeedbackPrompt.ts`
- Custom hook to check if feedback prompt should show
- Triggers on project status change to "completed"
- Checks `has_given_feedback` flag

### User Flow Integration
```typescript
// In project save success handler
if (projectJustCompleted && !user.has_given_feedback) {
  showFeedbackModal();
}
```

---

## Feature 2: Testimonials on Landing Page

### Design & Placement
**Location**: Above footer, below all main content

```
┌───────────────────────────────────────────────┐
│  Voice from Our Little Authors 🌟            │
│                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ ⭐⭐⭐⭐⭐│  │ ⭐⭐⭐⭐⭐│  │ ⭐⭐⭐⭐⭐│   │
│  │          │  │          │  │          │   │
│  │ "Amazing │  │ "My kids │  │ "Best    │   │
│  │  app!"   │  │  love it"│  │  gift"   │   │
│  │          │  │          │  │          │   │
│  │ - Sarah M│  │ - John K │  │ - Lisa T │   │
│  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────────────────────────────┘
```

### Selection Criteria
- Top 3 by rating (5 stars only)
- Then by recency (most recent first)
- Must be approved by admin (`is_approved = true`)
- Must be public (`is_public = true`)
- Has feedback_text (not null or empty)

### Implementation Files

#### 1. `/src/components/landing/Testimonials.tsx`
```typescript
interface Testimonial {
  id: string;
  rating: number;
  feedback_text: string;
  user_name: string; // From users table
  created_at: string;
}

// Fetches top 3 testimonials
// Responsive grid layout
// Star rating display
// User initial avatar or photo
```

#### 2. `/src/app/api/testimonials/route.ts`
```typescript
// GET endpoint - public access (no auth required)
// Returns top 3 approved, public feedback items
// Sorted by: rating DESC, created_at DESC
// Includes user name (first name only for privacy)
```

#### 3. Update `/src/app/page.tsx`
```typescript
// Import Testimonials component
// Place above footer
<Testimonials />
<Footer />
```

### Database Query
```sql
SELECT
  uf.id,
  uf.rating,
  uf.feedback_text,
  uf.created_at,
  SPLIT_PART(u.name, ' ', 1) || ' ' || SUBSTRING(SPLIT_PART(u.name, ' ', 2), 1, 1) || '.' as user_name
FROM user_feedback uf
JOIN users u ON uf.user_id = u.id
WHERE uf.is_public = true
  AND uf.is_approved = true
  AND uf.rating = 5
  AND uf.feedback_text IS NOT NULL
  AND LENGTH(TRIM(uf.feedback_text)) > 0
ORDER BY uf.rating DESC, uf.created_at DESC
LIMIT 3;
```

---

## Feature 3: Privacy Notice in Signup Flow

### Privacy Notice Design
**Placement**: Between signup form submission and account creation

```
┌─────────────────────────────────────────────┐
│  🔒 Privacy & Data Usage Notice             │
│                                             │
│  Before you create your account, please    │
│  review how we handle your data:           │
│                                             │
│  ✓ Your Photos & Data Security             │
│    • Photos are safely stored in encrypted │
│      cloud storage (Supabase Storage)      │
│    • We will NEVER sell or share your      │
│      personal information with third       │
│      parties for marketing                 │
│    • You can delete your data anytime      │
│                                             │
│  ✓ AI Image Generation                     │
│    • Photos are sent to fal.ai (our AI     │
│      partner) to generate story images     │
│    • fal.ai processes images solely for    │
│      generation and does NOT store them    │
│    • Read fal.ai privacy policy ↗          │
│                                             │
│  ✓ Your Rights                             │
│    • Access your data anytime              │
│    • Request data deletion                 │
│    • Export your stories                   │
│                                             │
│  [ ] I have read and consent to the        │
│      Privacy Policy and Terms of Service   │
│                                             │
│  [Cancel]              [I Consent, Sign Up]│
└─────────────────────────────────────────────┘
```

### Implementation Approach

#### Option A: Multi-Step Signup (Recommended)
```
Step 1: User Info Form →
Step 2: Privacy Consent →
Step 3: Account Creation →
Redirect to Dashboard
```

#### Option B: Privacy Consent Modal (Simpler)
```
User fills form → Clicks "Create Account" →
Privacy Modal Appears → User consents →
Account created → Dashboard
```

### Implementation Files

#### 1. `/src/components/auth/PrivacyConsentModal.tsx`
- Modal component with privacy notice
- Checkbox for consent (required to proceed)
- Links to full Privacy Policy & Terms
- "I Consent" button (disabled until checkbox checked)

#### 2. Update `/src/app/(auth)/signup/page.tsx`
```typescript
const [showPrivacyModal, setShowPrivacyModal] = useState(false);
const [hasConsented, setHasConsented] = useState(false);

const handleSignup = (e) => {
  e.preventDefault();

  // Show privacy modal instead of immediate signup
  setShowPrivacyModal(true);
};

const handlePrivacyConsent = async () => {
  setHasConsented(true);
  // Now proceed with actual signup
  await createAccount();
};
```

#### 3. `/src/app/(auth)/privacy/page.tsx`
- Full privacy policy page
- Detailed information about data handling
- Link from privacy modal

#### 4. `/src/app/(auth)/terms/page.tsx`
- Terms of service page
- Link from privacy modal

#### 5. Database Update
```sql
-- Track consent in users table
ALTER TABLE users
  ADD COLUMN privacy_consent_given_at TIMESTAMPTZ,
  ADD COLUMN privacy_consent_version VARCHAR(10) DEFAULT 'v1.0';

-- Store consent version for future policy updates
```

### OAuth Signup Flow
For Google/social signups, show privacy modal:
1. User clicks "Sign in with Google"
2. OAuth completes
3. Check if user is new (`!user.privacy_consent_given_at`)
4. Show privacy modal BEFORE creating user record
5. After consent, create user record with consent timestamp

---

## Implementation Priority & Timeline

### Phase 1: Privacy Notice (Critical - Do First)
**Why**: Legal requirement, builds trust
**Timeline**: 1-2 days
**Files**:
- PrivacyConsentModal component
- Privacy & Terms pages
- Update signup flow

### Phase 2: Feedback Collection
**Why**: Start gathering data for testimonials
**Timeline**: 2-3 days
**Files**:
- Database migration
- FeedbackModal component
- API routes
- Integration with project save flow

### Phase 3: Testimonials Display
**Why**: Depends on having feedback data
**Timeline**: 1-2 days
**Files**:
- Testimonials component
- API route
- Landing page update

---

## Testing Checklist

### Privacy Notice
- [ ] Email signup shows privacy modal
- [ ] OAuth signup shows privacy modal for new users
- [ ] Cannot proceed without consent
- [ ] Consent timestamp saved to database
- [ ] Privacy policy page loads
- [ ] Terms page loads
- [ ] Links open in new tab

### Feedback Collection
- [ ] Modal appears after first story saved
- [ ] Modal doesn't appear for subsequent stories
- [ ] Star rating works (1-5 stars)
- [ ] Text area accepts input
- [ ] Character counter works
- [ ] "Skip" dismisses modal
- [ ] "Submit" saves to database
- [ ] Success message appears
- [ ] Option to make public works

### Testimonials
- [ ] Shows top 3 five-star reviews
- [ ] Only shows approved feedback
- [ ] User names are anonymized (First name + Last initial)
- [ ] Responsive layout (mobile, tablet, desktop)
- [ ] Fallback message if no testimonials yet

---

## Admin Panel (Future Enhancement)

### Feedback Management Dashboard
- View all feedback
- Approve/reject for public display
- Filter by rating
- Search feedback text
- Export to CSV

**Location**: `/admin/feedback` (admin-only route)

---

## Privacy & Legal Considerations

### GDPR Compliance
- ✅ Clear consent before data processing
- ✅ Right to access data
- ✅ Right to delete data
- ✅ Data retention policy
- ✅ Third-party processor disclosure (fal.ai)

### COPPA Compliance (Children under 13)
- ⚠️ Parental consent may be required
- Consider age verification
- Consider separate "Parent" account type

### Recommendations
1. Consult with legal counsel for final privacy policy wording
2. Consider adding age gate (13+) or parental consent flow
3. Add cookie consent banner (if using analytics)

---

## Success Metrics

### Feedback Collection
- Target: 30% of first-time users provide feedback
- Target: 4+ average rating

### Testimonials Impact
- Measure landing page conversion rate before/after
- Track "Sign Up" button clicks
- A/B test with/without testimonials

### Privacy Consent
- Measure drop-off rate at privacy modal
- Optimize wording if >10% abandonment

---

## Questions for Review

1. **Privacy Modal Timing**: Show before or after OAuth redirect?
2. **Feedback Incentive**: Offer anything for feedback (e.g., 5 bonus images)?
3. **Testimonial Anonymity**: First name + last initial, or just initials?
4. **Admin Approval**: Manual or auto-approve 5-star reviews?
5. **Age Verification**: Required for COPPA compliance?
6. **Feedback Edit**: Allow users to edit their feedback later?

---

## Next Steps

After reviewing this plan:
1. Confirm approach for each feature
2. Answer questions above
3. Prioritize implementation order
4. Set timeline expectations
5. Begin with Privacy Notice (Phase 1)
