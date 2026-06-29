# Fix OAuth Redirect to Localhost Issue

## Problem
After OAuth sign-in on production, users are redirected to `http://localhost:3002` instead of the production domain.

## Root Cause
Supabase Site URL is configured to `localhost:3002` instead of the production URL.

---

## Solution: Update Supabase Configuration

### Step 1: Update Site URL in Supabase

1. **Go to**: https://supabase.com/dashboard
2. **Select**: Project `qxeiajnmprinwydlozlq`
3. **Navigate to**: Authentication → URL Configuration (left sidebar)
4. **Update "Site URL"** to:
   ```
   https://story-me-ai.vercel.app
   ```
5. **Click "Save"**

### Step 2: Add Redirect URLs

In the same page, scroll to **"Redirect URLs"** section:

**Add these URLs** (one per line):
```
https://story-me-ai.vercel.app/**
http://localhost:3000/**
http://localhost:3002/**
http://localhost:3005/**
```

The `/**` wildcard allows OAuth to redirect to any path on your domain.

**Click "Save"**

---

## Step 3: Test the Fix

1. **Go to**: https://story-me-ai.vercel.app
2. **Try**: Create story in guest mode
3. **Click**: Sign in with Google
4. **Complete**: OAuth flow
5. **Expected**: Redirects back to `https://story-me-ai.vercel.app/dashboard`
6. **✅ Success**: You should stay on the production domain

---

## Additional Configuration (If Needed)

### If you still see localhost redirects:

**Check Google Cloud Console redirect URIs:**
1. Go to: https://console.cloud.google.com/
2. Navigate to: APIs & Services → Credentials
3. Click on your OAuth 2.0 Client ID
4. Verify "Authorized redirect URIs" includes:
   ```
   https://qxeiajnmprinwydlozlq.supabase.co/auth/v1/callback
   https://story-me-ai.vercel.app/api/auth/callback
   ```

---

## Why This Happens

- Supabase uses the "Site URL" to determine where to redirect users after OAuth
- If it's set to localhost, OAuth will always redirect to localhost
- The production URL must be configured in Supabase for production deployments

---

## Screenshot Locations (for reference)

**Supabase Dashboard:**
```
Dashboard → Select Project → Authentication → URL Configuration
```

You'll see:
- ✏️ **Site URL**: The main URL where users access your app
- ✏️ **Redirect URLs**: Additional allowed redirect patterns

---

## Quick Reference

**Current Issue**: Redirects to `http://localhost:3002/?code=...`
**Expected**: Redirects to `https://story-me-ai.vercel.app/?code=...` or `/dashboard`
**Fix**: Change Supabase Site URL from localhost to production URL
**Time**: 2 minutes
**Impact**: Fixes OAuth on production immediately

---

## After Fix

✅ OAuth sign-in works on production
✅ Users stay on story-me-ai.vercel.app
✅ Guest stories restore after sign-in
✅ No localhost redirects
