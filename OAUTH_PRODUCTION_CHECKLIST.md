# Gmail/Google OAuth Production Checklist

## Your Production URLs
- **Production App**: https://story-me-ai.vercel.app
- **Supabase Project**: https://qxeiajnmprinwydlozlq.supabase.co

---

## ✅ What You Need to Configure for Production

### 1. Google Cloud Console - Add Production Redirect URIs

**Go to:** https://console.cloud.google.com/

1. **Select your project** (the one where you set up OAuth)

2. **Navigate to**: APIs & Services → Credentials

3. **Click on your OAuth 2.0 Client ID** (the one for StoryMe)

4. **Add these URLs** to "Authorized JavaScript origins":
   ```
   https://story-me-ai.vercel.app
   https://qxeiajnmprinwydlozlq.supabase.co
   ```

5. **Add these URLs** to "Authorized redirect URIs":
   ```
   https://story-me-ai.vercel.app/auth/callback
   https://qxeiajnmprinwydlozlq.supabase.co/auth/v1/callback
   ```

6. **Click "Save"**

---

### 2. Check Supabase Configuration

**Go to:** https://supabase.com/dashboard

1. Select your project: **qxeiajnmprinwydlozlq**

2. Navigate to: **Authentication** → **Providers**

3. Find **Google** provider

4. Verify it shows:
   - ✅ "Enabled" toggle is ON
   - ✅ Client ID and Client Secret are filled in
   - ✅ Callback URL shown (should be: `https://qxeiajnmprinwydlozlq.supabase.co/auth/v1/callback`)

5. **Copy the Callback URL** and make sure it's in your Google OAuth redirect URIs (from step 1 above)

---

### 3. Test the OAuth Flow in Production

1. **Go to**: https://story-me-ai.vercel.app

2. **Click**: "Sign In" or "Sign Up"

3. **Click**: "Continue with Google"

4. **Expected Flow**:
   - Redirects to Google login
   - Shows Google consent screen
   - Asks to select account
   - Redirects back to https://story-me-ai.vercel.app/dashboard
   - You should be logged in!

5. **If you see errors**:
   - ❌ "Redirect URI mismatch" → Check step 1 above, make sure all URLs are added
   - ❌ "Access blocked" → Your OAuth consent screen might need approval
   - ❌ "Invalid client" → Check credentials in Supabase dashboard

---

## 🔍 Common Issues & Solutions

### Issue: "Redirect URI mismatch"
**Solution**:
- Double-check all redirect URIs in Google Cloud Console
- Make sure there are no trailing slashes
- Verify HTTPS (not HTTP) for production URLs

### Issue: "This app isn't verified"
**This is normal for development!**

Users will see a warning screen. They can click "Advanced" → "Go to StoryMe (unsafe)" to continue.

**To remove this warning** (optional, for later):
1. Go to Google Cloud Console
2. Navigate to OAuth consent screen
3. Click "Publish App"
4. Submit for Google verification (takes 1-2 weeks)

### Issue: OAuth works locally but not in production
**Solution**:
- Clear browser cache and cookies
- Check Vercel deployment logs for errors
- Verify environment variables are set in Vercel (though OAuth creds are in Supabase, not Vercel)

---

## 📋 Quick Reference

### Current Configuration Status

**Local Development:**
- ✅ Works on localhost:3000 (or your local port)

**Production:**
- [ ] Added https://story-me-ai.vercel.app to Google OAuth
- [ ] Added https://qxeiajnmprinwydlozlq.supabase.co to Google OAuth
- [ ] Added redirect URIs to Google OAuth
- [ ] Tested sign-in flow in production
- [ ] Tested sign-up flow in production

---

## 🎯 Action Items

1. **Update Google OAuth** (5 minutes)
   - Add production URLs to authorized origins
   - Add redirect URIs
   - Save changes

2. **Test in Production** (5 minutes)
   - Try signing in with Google
   - Try signing up with Google
   - Verify user is created in Supabase

3. **Optional: Verify Other Providers**
   - If you set up Microsoft/Facebook OAuth, repeat similar steps
   - Add production URLs to their redirect configurations

---

## ✅ Success Criteria

- [ ] Can click "Continue with Google" on production
- [ ] Google login popup appears
- [ ] After login, redirects back to app
- [ ] User is logged in and can see their dashboard
- [ ] User data appears in Supabase Auth Users table

---

## 📝 Notes

- **No code changes needed** - OAuth is already implemented in your app
- **No Vercel config needed** - OAuth credentials are managed by Supabase
- **Same database** - Since dev and prod share the same Supabase database, all users will be in one place

---

**Estimated Time:** 10-15 minutes

**Difficulty:** Easy (just URL configuration)

**Required Access:** Google Cloud Console, Supabase Dashboard
