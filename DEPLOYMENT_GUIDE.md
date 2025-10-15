# StoryMe - Production Deployment Guide

## ✅ Pre-Deployment Checklist

### 1. Environment Variables Required
You'll need these 6 environment variables in production:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
FAL_KEY=your_fal_api_key
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

⚠️ **IMPORTANT**: Never commit `.env.local` to Git!

### 2. Critical Features to Test Before Deploying
- [x] Landing page loads with story slideshow
- [x] User can sign up / login
- [x] Guest access works
- [x] Character library (create, edit, delete)
- [x] Story creation with image generation
- [x] Save story functionality
- [x] My Stories page shows saved stories
- [ ] PDF download works (optional - can test after deploy)

---

## 🚀 Deployment Options

### **Option A: Vercel (Recommended - Easiest)**

#### Why Vercel?
- ✅ Zero configuration
- ✅ Automatic HTTPS
- ✅ GitHub integration (auto-deploy on push)
- ✅ Free tier (generous limits)
- ✅ Edge functions globally
- ✅ Built for Next.js

#### Steps:

1. **Push Code to GitHub** (if not already done)
   ```bash
   cd storyme-app
   git init
   git add .
   git commit -m "Initial commit for production"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/storyme.git
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel auto-detects Next.js settings ✅
   - Click "Deploy"

3. **Add Environment Variables**
   - In Vercel dashboard → Settings → Environment Variables
   - Add all 6 variables from your `.env.local`
   - Make sure to update `NEXT_PUBLIC_APP_URL` to your Vercel URL

4. **Redeploy**
   - Settings → Deployments → Click the latest deployment
   - Click "Redeploy" to apply environment variables

#### Estimated Time: **10 minutes**

---

### **Option B: Railway (Alternative - Good for Backend)**

#### Why Railway?
- ✅ Easy deployment
- ✅ Built-in database support
- ✅ Docker-friendly
- ✅ Free tier available

#### Steps:
1. Sign up at https://railway.app
2. Create new project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. Deploy

#### Estimated Time: **15 minutes**

---

### **Option C: Self-Hosted (Docker - Most Control)**

Only recommended if you need full control or have existing infrastructure.

#### Requirements:
- VPS (DigitalOcean, AWS, etc.)
- Docker installed
- Domain name

#### Estimated Time: **1-2 hours**

---

## 🔒 Security Checklist Before Going Live

### Current Status:
- ⚠️ **RLS Policies**: Need to be configured in Supabase
- ⚠️ **Guest Mode**: Currently uses service role (insecure for production)
- ✅ **API Keys**: Properly stored in environment variables
- ✅ **CORS**: Next.js handles this
- ⚠️ **Rate Limiting**: Not implemented yet

### Critical Security Fixes Needed:

1. **Supabase RLS (Row Level Security)**
   ```sql
   -- Run these in Supabase SQL Editor:

   -- Enable RLS on all tables
   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
   ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
   ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
   ALTER TABLE character_library ENABLE ROW LEVEL SECURITY;

   -- Allow users to read their own data
   CREATE POLICY "Users can view own projects"
     ON projects FOR SELECT
     USING (auth.uid() = user_id);

   CREATE POLICY "Users can insert own projects"
     ON projects FOR INSERT
     WITH CHECK (auth.uid() = user_id);

   -- Repeat for other tables...
   ```

2. **Public Projects API**
   - Currently uses service role to bypass RLS
   - For production, add `is_public` column and filter by it
   - Update `/api/projects/public` to not use service role

3. **Rate Limiting**
   - Consider adding Vercel Edge Config for rate limiting
   - Or use Upstash Redis for API rate limiting

---

## 📊 Recommended Deployment Timeline

### Phase 1: MVP Deploy (Today - 30 minutes)
- ✅ Deploy to Vercel
- ✅ Test basic functionality
- ⚠️ Share with 2-3 close friends only (alpha testing)

### Phase 2: Security Hardening (This Week)
- ⚠️ Implement RLS policies
- ⚠️ Add rate limiting
- ⚠️ Set up monitoring (Vercel Analytics)

### Phase 3: Beta Launch (Next Week)
- ✅ Share with wider audience
- ✅ Collect feedback
- ✅ Monitor errors with Sentry

---

## 🎯 My Recommendation

**For getting early feedback quickly:**

1. **Deploy to Vercel NOW** (10 mins)
2. **Share with 2-3 trusted users** for alpha testing
3. **Implement RLS this week** before wider launch
4. **Add monitoring** (Vercel Analytics is free)

**Why this approach?**
- ✅ Get feedback ASAP
- ✅ Low risk (small user base)
- ✅ Learn what breaks before scaling
- ✅ Iterate quickly

---

## 🚨 Known Issues to Warn Users About

1. **Storage Bucket Missing**: Character image uploads don't work yet (need to create Supabase storage bucket)
2. **Guest Mode**: Data isn't fully isolated (fix RLS before public launch)
3. **No Email Verification**: Users can sign up without verifying email

---

## 📝 Post-Deployment TODO

After deploying:

1. **Test Everything**
   - [ ] Landing page loads
   - [ ] Sign up works
   - [ ] Create character
   - [ ] Generate story
   - [ ] Save story
   - [ ] View saved stories

2. **Set Up Monitoring**
   - [ ] Enable Vercel Analytics
   - [ ] Set up error tracking (Sentry)
   - [ ] Monitor Supabase usage

3. **Create Feedback Form**
   - [ ] Add feedback button in app
   - [ ] Create Google Form for feedback

---

## 🆘 Troubleshooting

### "Invalid src prop" error on images
- Add the image domain to `next.config.ts` → `remotePatterns`

### "Bucket not found" on uploads
- Create storage bucket in Supabase dashboard
- Update bucket name in code

### API routes failing
- Check environment variables are set in Vercel
- Check Vercel logs for errors

---

## 🎉 Ready to Deploy?

Run this command to check if everything is ready:

```bash
npm run build
```

If build succeeds ✅ → You're ready for Vercel!

If build fails ❌ → Fix errors before deploying

---

## Questions?

Common deployment questions:

**Q: Should I deploy from main branch or create a production branch?**
A: Start with main. Create `production` branch later when you need staging environment.

**Q: How much will this cost?**
A:
- Vercel: FREE (up to 100GB bandwidth)
- Supabase: FREE (up to 500MB database)
- FAL.ai: Pay per image generated
- OpenAI: Pay per API call

**Q: Can I change providers later?**
A: Yes! The code is portable. Can move to Railway, AWS, etc.

---

## Next Steps

1. **Decide**: Vercel or Railway?
2. **Prepare**: Run `npm run build` locally to test
3. **Deploy**: Follow steps above
4. **Test**: Verify all features work
5. **Share**: Get feedback from 2-3 users
6. **Iterate**: Fix issues, improve UX

Good luck! 🚀
