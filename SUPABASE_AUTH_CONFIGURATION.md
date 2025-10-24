# Supabase Auth Configuration Guide
## Fixing Password Reset Redirect Issue

**Problem:** Password reset emails redirect to landing page instead of reset password form.

**Solution:** Configure redirect URLs in Supabase Dashboard.

---

## 🔧 Configuration Steps

### 1. **Go to Supabase Dashboard**
1. Navigate to: https://supabase.com/dashboard
2. Select your project: `qxeiajnmprinwydlozlq`

### 2. **Configure Redirect URLs**
1. Click **"Authentication"** in the left sidebar
2. Click **"URL Configuration"**
3. Find **"Redirect URLs"** section

### 3. **Add These URLs:**

#### For Local Development:
```
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
http://localhost:3000/dashboard
```

#### For Production:
```
https://story-me-ai.vercel.app/auth/callback
https://story-me-ai.vercel.app/reset-password
https://story-me-ai.vercel.app/dashboard
https://studio.kindlewood.com/auth/callback
https://studio.kindlewood.com/reset-password
https://studio.kindlewood.com/dashboard
```

### 4. **Site URL Configuration**
In the same **URL Configuration** section:

- **Site URL (Development):** `http://localhost:3000`
- **Site URL (Production):** `https://studio.kindlewood.com` (or `https://story-me-ai.vercel.app`)

### 5. **Email Template Configuration (Optional but Recommended)**

1. Go to **Authentication > Email Templates**
2. Select **"Reset Password"**
3. Verify the template includes: `{{ .ConfirmationURL }}`
4. The URL will now automatically redirect to `/auth/callback?type=recovery`

---

## 🔄 How the Flow Works Now

### Updated Password Reset Flow:

1. **User requests password reset** → `/forgot-password`
2. **Supabase sends email** with link to: `/auth/callback?type=recovery&code=...`
3. **Auth callback route** (`/auth/callback/route.ts`) handles the code:
   - Exchanges code for session
   - Detects `type=recovery` parameter
   - Redirects to `/reset-password`
4. **Reset password page** (`/reset-password`) loads with valid session
5. **User sets new password** → Redirects to `/login`

---

## 📝 Files Modified

### Created:
- ✅ `/app/auth/callback/route.ts` - Handles Supabase auth callbacks

### Updated:
- ✅ `/app/(auth)/forgot-password/page.tsx` - Changed redirect to `/auth/callback?type=recovery`

---

## 🧪 Testing Checklist

After configuring Supabase:

1. **Test Password Reset (Development)**
   - [ ] Go to `http://localhost:3000/forgot-password`
   - [ ] Enter email and submit
   - [ ] Check email inbox
   - [ ] Click reset link
   - [ ] Verify redirected to `/reset-password` page (NOT landing page)
   - [ ] Enter new password
   - [ ] Verify redirected to `/login`

2. **Test Password Reset (Production)**
   - [ ] Go to production forgot password page
   - [ ] Same steps as above
   - [ ] Verify works on production domain

3. **Test Email Verification (Bonus)**
   - [ ] Sign up new user
   - [ ] Check verification email
   - [ ] Click verification link
   - [ ] Verify redirected to dashboard

---

## 🚨 Common Issues & Solutions

### Issue 1: Still redirecting to landing page
**Cause:** Redirect URL not whitelisted in Supabase
**Solution:** Double-check URLs in Supabase Dashboard > Authentication > URL Configuration

### Issue 2: "Invalid or expired reset link"
**Cause:** Session not being created properly
**Solution:**
- Verify `exchangeCodeForSession()` is working in `/auth/callback/route.ts`
- Check browser console for errors
- Verify Supabase PKCE flow is enabled (it should be by default)

### Issue 3: Email not received
**Cause:** Email rate limiting or SMTP configuration
**Solution:**
- Check Supabase email logs: Dashboard > Authentication > Email Logs
- Verify email address is correct
- Check spam folder
- For production, consider custom SMTP (SendGrid, Mailgun, etc.)

---

## 🔐 Security Notes

### PKCE Flow (Proof Key for Code Exchange)
- Supabase uses PKCE for security
- The `code` parameter in the callback is single-use
- Tokens expire after 1 hour (Supabase default)
- Session is stored securely in cookies

### Redirect URL Validation
- Supabase **only** allows redirects to whitelisted URLs
- This prevents open redirect vulnerabilities
- Always whitelist both development and production URLs

---

## 📚 Additional Resources

- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Password Reset Docs:** https://supabase.com/docs/guides/auth/passwords#password-resets
- **PKCE Flow:** https://supabase.com/docs/guides/auth/server-side/pkce-flow

---

## ✅ Quick Fix Summary

**What You Need to Do RIGHT NOW:**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication > URL Configuration**
4. Add to **Redirect URLs**:
   ```
   http://localhost:3000/auth/callback
   https://story-me-ai.vercel.app/auth/callback
   https://studio.kindlewood.com/auth/callback
   ```
5. Click **Save**
6. Test password reset again

**That's it!** The code is already fixed. You just need to configure Supabase.

---

**Last Updated:** October 23, 2025
**Status:** Awaiting Supabase configuration
