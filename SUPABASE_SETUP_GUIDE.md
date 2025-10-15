# Supabase Setup Guide for StoryMe

**Last Updated:** October 13, 2025
**Status:** Ready for Real Supabase Integration

---

## Overview

This guide will walk you through setting up real Supabase authentication and database for StoryMe. Follow the steps in order, and pay special attention to steps marked with **🔴 MANUAL ACTION REQUIRED**.

**Estimated Time:** 20-30 minutes

---

## Prerequisites

- [x] StoryMe app is running locally
- [x] Node.js and npm installed
- [ ] Supabase account (we'll create this)
- [ ] Valid email for testing

---

## Step-by-Step Setup

### Part 1: Create Supabase Project (🔴 MANUAL)

#### 🔴 STEP 1: Create Supabase Account & Project

1. **Go to Supabase:**
   - Visit: https://supabase.com/dashboard
   - Click "Sign In" or "Start your project"

2. **Create Account:**
   - Sign in with GitHub (recommended) or email
   - Verify your email if prompted

3. **Create New Project:**
   - Click "New Project" button
   - Fill in project details:
     - **Organization:** (Select or create new)
     - **Project Name:** `StoryMe` (or your preferred name)
     - **Database Password:** (Generate strong password - SAVE THIS!)
     - **Region:** Choose closest to your users (e.g., `US East (Ohio)`)
     - **Pricing Plan:** Free (sufficient for development)
   - Click "Create new project"
   - **Wait 2-3 minutes** for project to be provisioned

#### 🔴 STEP 2: Get Your Credentials

1. **Navigate to Project Settings:**
   - In your project dashboard, click the "Settings" icon (gear) in the left sidebar
   - Click "API" under Project Settings

2. **Copy These Values:**
   - **Project URL:** `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key:** Long string starting with `eyJhbGc...`
   - **service_role key:** Another long string (keep this SECRET!)

3. **Keep These Safe:**
   - Open a text file and paste these values temporarily
   - You'll need them in the next step

---

### Part 2: Configure Environment Variables (🔴 MANUAL)

#### 🔴 STEP 3: Update .env.local File

1. **Open Your .env.local File:**
   ```bash
   cd /home/gulbrand/Feifei/StoryMe/storyme-app
   # Open .env.local in your editor
   ```

2. **Replace Placeholder Values:**

   **BEFORE:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

   **AFTER:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   Replace with YOUR actual values from Step 2!

3. **Keep Other Values:**
   - Leave `FAL_KEY` unchanged (already working)
   - Leave `OPENAI_API_KEY` as is (for future use)
   - Leave `NEXT_PUBLIC_APP_URL` as is

4. **Save the File**

5. **Update Port in .env.local:**
   Add this line if not present:
   ```bash
   NEXT_PUBLIC_APP_URL=http://localhost:3002
   ```

---

### Part 3: Set Up Database Schema (🔴 MANUAL)

#### 🔴 STEP 4: Run Database Schema in Supabase SQL Editor

1. **Open SQL Editor:**
   - In your Supabase project dashboard
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

2. **Copy & Paste Schema Part 1 (Main Schema):**
   - Open file: `/home/gulbrand/Feifei/StoryMe/database-schema.sql`
   - Copy the ENTIRE contents
   - Paste into Supabase SQL Editor
   - Click "Run" button (bottom right)
   - **Wait for success message:** "Success. No rows returned"

3. **Copy & Paste Schema Part 2 (Guest Analytics):**
   - Open file: `/home/gulbrand/Feifei/StoryMe/database-schema-guest-analytics.sql`
   - Copy the ENTIRE contents
   - Create a NEW query in SQL Editor
   - Paste contents
   - Click "Run" button
   - **Wait for success message**

4. **Verify Tables Created:**
   - Click "Table Editor" in left sidebar
   - You should see these tables:
     - `users`
     - `character_library`
     - `projects`
     - `scenes`
     - `generated_images`
     - `storybooks`
     - `guest_sessions`
     - And more...

5. **If You See Errors:**
   - Check if you ran Part 1 before Part 2
   - Some errors about existing extensions are OK
   - Contact me if tables don't appear

---

### Part 4: Configure Authentication Settings (🔴 MANUAL)

#### 🔴 STEP 5: Configure Email Settings

1. **Navigate to Authentication Settings:**
   - In Supabase dashboard, click "Authentication" in sidebar
   - Click "URL Configuration"

2. **Set Site URL:**
   - **Site URL:** `http://localhost:3002`
   - Click "Save"

3. **Set Redirect URLs:**
   - **Redirect URLs:** Add these:
     - `http://localhost:3002/dashboard`
     - `http://localhost:3002/auth/callback`
   - Click "Save"

4. **Configure Email Templates (Optional but Recommended):**
   - Click "Email Templates" under Authentication
   - Customize "Confirm signup" email if desired
   - For development, default templates are fine

5. **Enable Email Confirmation (Optional):**
   - Go to Authentication → Settings
   - Under "Auth Providers", find "Email"
   - Toggle "Enable email confirmations" (ON or OFF based on preference)
   - For development: Recommend OFF for faster testing
   - For production: Recommend ON for security
   - Click "Save"

---

### Part 5: Restart Development Server (🔴 MANUAL)

#### 🔴 STEP 6: Restart Your App

The app needs to reload environment variables:

```bash
# Kill current dev server
# Press Ctrl+C in terminal where npm run dev is running

# Or find and kill the process:
lsof -ti:3002 | xargs kill

# Restart dev server
cd /home/gulbrand/Feifei/StoryMe/storyme-app
PORT=3002 npm run dev
```

**Wait for:** "Ready in X ms" message

---

### Part 6: Test Authentication (🔴 MANUAL)

#### 🔴 STEP 7: Test Signup Flow

1. **Clear Browser Data (Important!):**
   - Open browser DevTools (F12)
   - Go to "Application" tab → "Local Storage"
   - Delete `storyme_users` and `storyme_session` keys
   - Or use Incognito/Private window

2. **Navigate to Signup:**
   - Open: http://localhost:3002/signup

3. **Create Test Account:**
   - Full Name: `Test User`
   - Email: `your-real-email@example.com` (use real email!)
   - Password: `testpass123456` (min 8 chars)
   - Confirm Password: `testpass123456`
   - Click "Create Account"

4. **Expected Results:**

   **If Email Confirmation is ENABLED:**
   - Message: "Check your email to confirm your account"
   - Check your email inbox
   - Click confirmation link
   - You'll be redirected to app
   - Dashboard should load

   **If Email Confirmation is DISABLED:**
   - Immediate redirect to `/dashboard`
   - Dashboard shows: "Welcome back, Test User!"
   - No email confirmation needed

5. **Check Supabase Dashboard:**
   - Go to Supabase → Authentication → Users
   - You should see your new user listed!
   - Status: "Confirmed" or "Waiting for verification"

#### 🔴 STEP 8: Test Login Flow

1. **Sign Out:**
   - On dashboard, click "Sign Out" button
   - Should redirect to homepage

2. **Navigate to Login:**
   - Open: http://localhost:3002/login

3. **Sign In:**
   - Email: `your-real-email@example.com`
   - Password: `testpass123456`
   - Click "Sign In"

4. **Expected Results:**
   - Successful login
   - Redirect to `/dashboard`
   - Dashboard shows your name
   - No errors in browser console

#### 🔴 STEP 9: Test Protected Routes

1. **While Logged In:**
   - Try accessing: http://localhost:3002/login
   - **Expected:** Auto-redirect to `/dashboard`

2. **Sign Out Again:**
   - Click "Sign Out" on dashboard

3. **While Logged Out:**
   - Try accessing: http://localhost:3002/dashboard
   - **Expected:** Auto-redirect to `/login?redirectedFrom=/dashboard`

4. **Test Middleware:**
   - Open browser DevTools → Network tab
   - Watch for redirect responses
   - Should see 307 redirects working properly

---

## Part 7: Verify Setup (Automated)

After you complete the manual steps above, I'll run automated tests to verify:

- ✅ Supabase credentials are valid
- ✅ Database tables exist
- ✅ Authentication is working
- ✅ Middleware is protecting routes
- ✅ User data is being stored in Supabase

---

## Troubleshooting

### Issue: "Failed to fetch" or Network Error

**Solution:**
- Check if `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL`
- Verify URL doesn't have trailing slash
- Restart dev server after changing `.env.local`

### Issue: "Invalid JWT" or "Invalid API key"

**Solution:**
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
- Check for extra spaces or line breaks
- Copy key again from Supabase dashboard

### Issue: Signup succeeds but can't login

**Solution:**
- Check if email confirmation is required
- Go to Supabase → Authentication → Settings
- Disable email confirmation for testing
- Or check your email inbox for confirmation link

### Issue: "Session is missing user" error

**Solution:**
- Clear browser localStorage
- Sign out and sign in again
- Check browser console for specific errors

### Issue: Tables not showing up

**Solution:**
- Make sure you ran `database-schema.sql` first
- Then ran `database-schema-guest-analytics.sql` second
- Check SQL Editor for error messages
- Some "already exists" errors are OK

### Issue: Middleware redirect loop

**Solution:**
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Restart dev server
- Clear browser cookies
- Check middleware.ts matcher config

---

## What Changes Automatically

Once you complete the manual steps, these features will automatically switch from fallback to Supabase:

### Signup Page ([signup/page.tsx](storyme-app/src/app/(auth)/signup/page.tsx#L40-L61))
- Detects Supabase is configured
- Uses `supabase.auth.signUp()` instead of localStorage
- Stores user data in Supabase database
- Sends confirmation email (if enabled)

### Login Page ([login/page.tsx](storyme-app/src/app/(auth)/login/page.tsx#L26-L42))
- Detects Supabase is configured
- Uses `supabase.auth.signInWithPassword()`
- Validates password server-side
- Creates secure session with JWT

### Middleware ([middleware.ts](storyme-app/src/middleware.ts#L9-L65))
- Refreshes Supabase sessions automatically
- Uses real JWT validation
- Protects routes with server-side checks
- Handles cookie management

### Dashboard ([dashboard/page.tsx](storyme-app/src/app/(dashboard)/dashboard/page.tsx#L19-L37))
- Will eventually read from Supabase instead of localStorage
- (Needs update to use Supabase client - I can help with this)

---

## Next Steps After Setup

Once Supabase is working, we can:

1. **Update Dashboard to Use Supabase:**
   - Read user data from Supabase auth
   - Fetch user's saved stories from database
   - Display character library from database

2. **Implement Story Persistence:**
   - Save guest stories to database on signup
   - Store generated images in Supabase Storage
   - Link stories to user accounts

3. **Add Guest Session Migration:**
   - Track guest sessions in database
   - Convert guest stories to user stories on signup
   - Analytics on guest-to-user conversion

4. **Enable Row Level Security (RLS):**
   - Ensure users can only access their own data
   - Protect against unauthorized access
   - Already partially configured in schema

---

## Files Modified/Used

### Configuration Files:
- `.env.local` - Environment variables (🔴 YOU EDIT THIS)
- `database-schema.sql` - Main database schema (🔴 YOU RUN THIS)
- `database-schema-guest-analytics.sql` - Guest tracking (🔴 YOU RUN THIS)

### Authentication Files (Already Configured):
- `src/lib/supabase/client.ts` - Client-side Supabase client
- `src/lib/supabase/server.ts` - Server-side Supabase client
- `src/app/(auth)/signup/page.tsx` - Signup page with dual-mode auth
- `src/app/(auth)/login/page.tsx` - Login page with dual-mode auth
- `src/middleware.ts` - Authentication middleware

### Files That Need Future Updates:
- `src/app/(dashboard)/dashboard/page.tsx` - Update to use Supabase
- `src/app/guest/page.tsx` - Add session tracking
- API routes for saving stories

---

## Security Notes

### Environment Variables:
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Safe to expose (public)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Safe to expose (public, limited permissions)
- ❌ `SUPABASE_SERVICE_ROLE_KEY` - NEVER expose to client (server-only)

### Row Level Security (RLS):
- Already enabled on `projects` table
- Ensures users can only access their own data
- Applied via Supabase policies

### Session Management:
- Supabase handles JWT tokens automatically
- Tokens stored in secure HTTP-only cookies
- Auto-refresh before expiration
- Middleware validates on every request

---

## Support

### If You Get Stuck:

1. **Check browser console** for error messages
2. **Check Supabase logs:**
   - Supabase Dashboard → Logs → Auth Logs
3. **Verify environment variables** are loaded:
   ```bash
   # In terminal
   echo $NEXT_PUBLIC_SUPABASE_URL
   ```
4. **Ask me for help!** - Provide:
   - Error messages from browser console
   - What step you're on
   - What you expected vs what happened

---

## Summary Checklist

Before moving to next feature, verify:

- [ ] 🔴 Supabase project created
- [ ] 🔴 Credentials copied to `.env.local`
- [ ] 🔴 Database schema SQL executed successfully
- [ ] 🔴 Auth settings configured (Site URL, Redirect URLs)
- [ ] 🔴 Dev server restarted
- [ ] 🔴 Test account created via signup
- [ ] 🔴 Able to login with test account
- [ ] 🔴 Protected routes redirect correctly
- [ ] 🔴 User appears in Supabase Auth dashboard
- [ ] All automated tests pass (I'll run these)

---

**Ready to begin? Start with Part 1: Create Supabase Project!**

When you've completed the manual steps (marked with 🔴), let me know and I'll verify everything is working correctly.
