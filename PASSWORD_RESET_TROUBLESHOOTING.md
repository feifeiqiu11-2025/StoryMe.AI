# Password Reset Link Expired - Troubleshooting Guide

## 🚨 Current Error

```
Error: otp_expired
Description: Email link is invalid or has expired
URL: https://story-me-ai.vercel.app/?error=access_denied&error_code=otp_expired
```

---

## 🔍 Root Causes & Solutions

### **Cause 1: Email Client Auto-Preview (MOST COMMON)**

**Problem:** Many email clients (Gmail, Outlook, Apple Mail) automatically preview links in emails for security scanning. This "opens" the link, using it up before you actually click it.

**Solution:**
1. **Request a fresh reset email** (old one is now invalid)
2. **Copy the link** instead of clicking:
   - Right-click the reset link in email
   - Select "Copy Link Address"
   - Paste into browser address bar
3. **Disable email preview** in your email client
4. **Use a different email client** temporarily (webmail vs desktop app)

---

### **Cause 2: Link Clicked Multiple Times**

**Problem:** Password reset links are single-use tokens. Once clicked, they become invalid.

**Solution:**
- Request a new reset email
- Only click the link once
- Don't refresh the page after clicking

---

### **Cause 3: Link Expired (Default: 1 hour)**

**Problem:** Supabase password reset links expire after 1 hour by default.

**Solution:**
1. Request a new reset email
2. Click the link immediately after receiving it

**To extend expiration time (in Supabase Dashboard):**
1. Go to Authentication → Settings
2. Look for "Email Auth Settings"
3. Adjust "Password Recovery Token Expiry" (default: 3600 seconds = 1 hour)
4. Recommended: Keep at 1 hour for security

---

### **Cause 4: Supabase Site URL Misconfiguration**

**Problem:** If Supabase doesn't have the correct Site URL configured, it can cause redirect issues.

**Solution - Check Supabase Dashboard:**

1. Go to: https://supabase.com/dashboard/project/qxeiajnmprinwydlozlq
2. **Authentication** → **URL Configuration**
3. Verify these settings:

#### **Site URL:**
```
Production: https://story-me-ai.vercel.app
```

#### **Redirect URLs (Add all of these):**
```
https://story-me-ai.vercel.app/auth/callback
https://story-me-ai.vercel.app/reset-password
https://story-me-ai.vercel.app/dashboard
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
http://localhost:3000/dashboard
```

#### **Additional Redirect URLs (Wildcard for Vercel previews):**
```
https://*.vercel.app/auth/callback
```

---

### **Cause 5: PKCE Flow Issues**

**Problem:** Supabase uses PKCE (Proof Key for Code Exchange) which requires proper configuration.

**Solution - Verify in Supabase:**
1. Authentication → Settings
2. Ensure "Enable PKCE flow" is **ON** (should be by default)
3. Ensure "Enable email confirmations" is configured correctly

---

## ✅ **Step-by-Step Fix (Do This Now)**

### **Step 1: Request Fresh Reset Email**
1. Go to: https://story-me-ai.vercel.app/forgot-password
2. Enter your email
3. Submit

### **Step 2: Handle Email Link Carefully**
**DO THIS:**
- Open email on desktop (not mobile)
- **Right-click** the reset button/link
- Select "Copy Link Address"
- Open new browser tab
- Paste URL and press Enter

**DON'T DO THIS:**
- Don't click the link directly (might get auto-previewed)
- Don't click multiple times
- Don't wait more than 5 minutes

### **Step 3: If It Still Fails**

Check if the URL in the email looks like this:
```
https://story-me-ai.vercel.app/auth/callback?code=...&type=recovery
```

If it looks different (e.g., no `/auth/callback`), you need to:

1. **Deploy the new code** with the auth callback route
2. Check if these files exist on production:
   - `/app/auth/callback/route.ts`
   - Updated `/app/(auth)/forgot-password/page.tsx`

---

## 🔧 **Supabase Configuration Checklist**

Go to Supabase Dashboard and verify:

### **1. URL Configuration**
- [ ] Site URL: `https://story-me-ai.vercel.app`
- [ ] Redirect URLs include `/auth/callback`
- [ ] Redirect URLs include `/reset-password`

### **2. Email Template**
Authentication → Email Templates → Reset Password:
- [ ] Template includes `{{ .ConfirmationURL }}`
- [ ] Template is active
- [ ] No custom URL overrides

### **3. Auth Settings**
- [ ] PKCE flow enabled
- [ ] Email confirmations configured
- [ ] Token expiry time noted (default: 3600 seconds)

---

## 🧪 **Testing Procedure**

### **Test 1: Fresh Reset (Clean Browser)**
1. Open **incognito/private** browser window
2. Go to `/forgot-password`
3. Enter email
4. Open email in **different tab**
5. **Copy link** (don't click)
6. Paste in browser
7. Should land on `/reset-password` page

### **Test 2: Verify Callback Route**
1. After pasting link, check URL bar
2. Should briefly show: `/auth/callback?code=...&type=recovery`
3. Then redirect to: `/reset-password`
4. If it stays on callback or goes to home, there's a routing issue

### **Test 3: Complete Flow**
1. Enter new password
2. Confirm password
3. Submit
4. Should redirect to `/login`
5. Sign in with new password

---

## 🐛 **Debug Information to Check**

### **In Browser Console (F12):**
Look for errors when clicking the reset link:
```javascript
// Open console before clicking link
// Check for:
- Network errors (failed API calls)
- JavaScript errors
- Redirect loops
```

### **Check Email Link URL:**
The link in your email should look like:
```
https://story-me-ai.vercel.app/auth/callback?code=XXXXX&type=recovery
```

**NOT like:**
```
https://story-me-ai.vercel.app/reset-password?token=...
```

---

## 📱 **Email Client Specific Tips**

### **Gmail:**
- Use "Show original" to see raw link
- Desktop Gmail auto-previews less than mobile
- Try Gmail webmail vs Gmail app

### **Outlook/Hotmail:**
- Known to aggressively preview links
- Use Outlook webmail, not desktop app
- Right-click → Copy link

### **Apple Mail:**
- Disable "Load Remote Content Automatically"
- Use plain text view
- Copy link instead of clicking

---

## 🚀 **Quick Fix Summary**

**The problem:** Email link was already "used" before you clicked it (auto-preview).

**The solution:**
1. ✅ **Code is already fixed** (auth callback route created)
2. ⚠️ **Deploy the latest code** to Vercel
3. ⚠️ **Configure Supabase** redirect URLs (see above)
4. ✅ **Request NEW reset email**
5. ✅ **Copy link** instead of clicking
6. ✅ **Paste in browser**

---

## 📊 **Files Modified to Fix This**

1. ✅ Created `/app/auth/callback/route.ts` - Handles email callbacks
2. ✅ Updated `/app/(auth)/forgot-password/page.tsx` - Uses callback URL
3. ✅ Updated `/app/page.tsx` - Shows error message
4. ✅ Added warning about link expiry

---

## 💡 **Prevention Tips**

1. **Click reset links immediately** after receiving email
2. **Use copy/paste method** instead of direct click
3. **Request new link** if you wait more than a few minutes
4. **Don't refresh** the reset password page
5. **Complete password change** in one session

---

## ❓ **Still Not Working?**

If you've tried everything above:

1. **Check deployment:**
   ```bash
   # Verify these routes exist in production:
   curl https://story-me-ai.vercel.app/auth/callback
   curl https://story-me-ai.vercel.app/reset-password
   ```

2. **Check Supabase logs:**
   - Go to Supabase Dashboard
   - Authentication → Logs
   - Look for failed auth attempts

3. **Try alternative method:**
   - Sign in as admin to Supabase
   - Manually reset password via SQL:
   ```sql
   -- Run in Supabase SQL Editor
   -- Replace with your email
   UPDATE auth.users
   SET encrypted_password = crypt('NEW_PASSWORD', gen_salt('bf'))
   WHERE email = 'your@email.com';
   ```

---

**Last Updated:** October 23, 2025
**Status:** Code fixed, awaiting deployment + Supabase configuration
