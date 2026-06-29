# Supabase Setup - Quick Checklist

**Use this as a quick reference while following the detailed guide.**

---

## 🔴 YOUR MANUAL TASKS

### Task 1: Create Supabase Project (10 min)
- [ ] Go to https://supabase.com/dashboard
- [ ] Sign up/Login with GitHub or email
- [ ] Click "New Project"
- [ ] Fill in:
  - Project Name: `StoryMe`
  - Database Password: (Generate & save!)
  - Region: Choose closest
- [ ] Wait 2-3 minutes for provisioning

### Task 2: Copy Credentials (2 min)
- [ ] Go to Settings → API in Supabase
- [ ] Copy these 3 values:
  - [ ] Project URL
  - [ ] anon public key
  - [ ] service_role key

### Task 3: Update .env.local (2 min)
- [ ] Open: `storyme-app/.env.local`
- [ ] Replace these lines:
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
  ```
- [ ] Save file

### Task 4: Run Database Schema (5 min)
- [ ] In Supabase, click "SQL Editor"
- [ ] Click "New query"
- [ ] Copy entire `database-schema.sql` file
- [ ] Paste & click "Run"
- [ ] Wait for "Success. No rows returned"
- [ ] Create another new query
- [ ] Copy entire `database-schema-guest-analytics.sql`
- [ ] Paste & click "Run"
- [ ] Verify tables in "Table Editor"

### Task 5: Configure Auth Settings (3 min)
- [ ] Go to Authentication → URL Configuration
- [ ] Set Site URL: `http://localhost:3002`
- [ ] Add Redirect URLs:
  - `http://localhost:3002/dashboard`
  - `http://localhost:3002/auth/callback`
- [ ] Click "Save"
- [ ] (Optional) Go to Settings → disable "Enable email confirmations" for faster testing

### Task 6: Restart Dev Server (1 min)
```bash
# Press Ctrl+C in terminal OR:
lsof -ti:3002 | xargs kill

# Then restart:
cd storyme-app
PORT=3002 npm run dev
```

### Task 7: Test Signup (2 min)
- [ ] Open http://localhost:3002/signup in incognito window
- [ ] Create account with real email
- [ ] Should redirect to dashboard
- [ ] Verify user appears in Supabase → Authentication → Users

### Task 8: Test Login (2 min)
- [ ] Sign out
- [ ] Go to http://localhost:3002/login
- [ ] Login with test account
- [ ] Should redirect to dashboard

### Task 9: Test Protected Routes (1 min)
- [ ] While logged out, try: http://localhost:3002/dashboard
  - Should redirect to login
- [ ] While logged in, try: http://localhost:3002/login
  - Should redirect to dashboard

---

## ✅ VERIFICATION (Tell me when ready)

Once you complete tasks 1-9, tell me you're done and I'll:
- [ ] Verify credentials are valid
- [ ] Test Supabase connection
- [ ] Check database tables
- [ ] Confirm auth is working
- [ ] Update dashboard to use Supabase
- [ ] Run full integration test

---

## 📋 Files You'll Touch

- `storyme-app/.env.local` - Edit with credentials
- `database-schema.sql` - Copy/paste to Supabase
- `database-schema-guest-analytics.sql` - Copy/paste to Supabase

## 🔗 URLs You'll Need

- Supabase Dashboard: https://supabase.com/dashboard
- Your App: http://localhost:3002
- Signup Page: http://localhost:3002/signup
- Login Page: http://localhost:3002/login
- Dashboard: http://localhost:3002/dashboard

---

## 🆘 Common Issues

| Problem | Solution |
|---------|----------|
| "Invalid API key" | Check `.env.local` for typos, restart server |
| Tables not created | Run `database-schema.sql` BEFORE `database-schema-guest-analytics.sql` |
| Can't login | Check email confirmation setting, check password |
| Redirect loop | Clear browser localStorage, restart server |

---

**Estimated Total Time: 25-30 minutes**

**Full detailed guide:** [SUPABASE_SETUP_GUIDE.md](SUPABASE_SETUP_GUIDE.md)
