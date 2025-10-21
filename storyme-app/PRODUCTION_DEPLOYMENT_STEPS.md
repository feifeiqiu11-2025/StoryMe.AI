# Production Deployment Steps

## Commit: d5cf81e - Privacy consent, user feedback, and landing page improvements

### ✅ Pre-Deployment Checklist

- [x] Production build passes (`npm run build`)
- [x] All changes committed
- [x] Database migrations prepared
- [ ] Migrations run in production database
- [ ] Code pushed to repository
- [ ] Production deployment verified

### 📊 Database Migrations Required

**IMPORTANT**: Run these migrations in the Supabase SQL Editor **BEFORE** deploying the code:

#### Migration 1: Privacy Consent (20251020_add_privacy_consent.sql)

```sql
-- ============================================
-- Privacy Consent Tracking
-- Adds consent tracking to users table for GDPR/privacy compliance
-- ============================================

-- Add privacy consent fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_given BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_date TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_version VARCHAR(10) DEFAULT '1.0';
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_date TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN users.privacy_consent_given IS 'User has consented to privacy policy';
COMMENT ON COLUMN users.privacy_consent_date IS 'When user gave privacy consent';
COMMENT ON COLUMN users.privacy_consent_version IS 'Version of privacy policy user consented to';
COMMENT ON COLUMN users.terms_accepted IS 'User has accepted terms of service';
COMMENT ON COLUMN users.terms_accepted_date IS 'When user accepted terms';

-- Index for querying consent status
CREATE INDEX IF NOT EXISTS idx_users_privacy_consent ON users(privacy_consent_given, privacy_consent_date);
```

#### Migration 2: User Feedback (20251020_add_user_feedback.sql)

See: `supabase/migrations/20251020_add_user_feedback.sql` (92 lines)

Or run directly from Supabase SQL Editor:
1. Go to Supabase Dashboard > SQL Editor
2. Copy content from `supabase/migrations/20251020_add_user_feedback.sql`
3. Execute

### 🚀 Deployment Steps

1. **Run database migrations** (see above)
   - Navigate to Supabase Dashboard
   - Go to SQL Editor
   - Run both migration files
   - Verify tables created: `user_feedback` table should exist
   - Verify columns added to `users` table

2. **Push code to repository**
   ```bash
   git push origin main
   ```

3. **Verify Vercel deployment**
   - Check Vercel dashboard for automatic deployment
   - Wait for build to complete
   - Verify deployment logs show no errors

4. **Test production deployment**
   - Visit landing page - verify real stories display
   - Create test account - verify consent flow
   - Create first story - verify feedback modal appears
   - Check testimonials section

### 🔍 Verification Checklist

After deployment, verify:

- [ ] Landing page shows real public stories (not mock stories)
- [ ] Story images display correctly
- [ ] Author names and ages show ("by Carter, 3 years old")
- [ ] Testimonials section loads
- [ ] New user signup triggers consent page
- [ ] Consent is required before accessing dashboard
- [ ] First story save triggers feedback modal
- [ ] Feedback submission works
- [ ] Public testimonials appear on landing page

### 🐛 Rollback Plan

If issues occur:

1. **Code rollback**: Revert commit d5cf81e
   ```bash
   git revert d5cf81e
   git push origin main
   ```

2. **Database rollback**: The migrations only ADD columns/tables, they don't modify existing data, so rollback is safe. Existing functionality will continue to work.

### 📝 Post-Deployment Tasks

- [ ] Monitor error logs for 24 hours
- [ ] Check user feedback submissions
- [ ] Update privacy policy email placeholders:
  - `storyme@example.com` → actual email
  - `[Your Name]` → actual name
- [ ] Feature 1-2 high-quality testimonials as admin

### 🎯 What This Deployment Adds

**For Users:**
- Privacy consent flow (GDPR compliant)
- Ability to provide feedback after creating first story
- See real community stories on landing page
- View testimonials from other users

**For Product:**
- Collect user feedback and ratings
- Display social proof via testimonials
- Track privacy consent for compliance
- Better landing page with real content

**Bug Fixes:**
- Landing page slideshow now shows real images and author info
- Fixed Suspense boundary error in production builds

---

**Deployed by**: Claude Code
**Date**: 2025-10-19
**Commit**: d5cf81e
