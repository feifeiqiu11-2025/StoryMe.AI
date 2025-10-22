# Next Steps: Multi-Platform Publishing (Spotify + KindleWood Kids App)

## Overview

We've built a **generic, scalable publishing system** that can handle multiple platforms:
- ✅ Spotify Podcast (automated via RSS)
- 🔜 KindleWood Kids App (mobile app)
- 🔜 Apple Podcasts (future)
- 🔜 YouTube (future)

---

## ✅ What's Already Built

### 1. Generic Publications Database
- **File**: `supabase/migrations/20251021_add_publications_generic.sql`
- **Table**: `publications` (not `spotify_publications`)
- **Platform field**: Can be `'spotify'`, `'kindlewood_app'`, `'apple_podcasts'`, etc.
- **Scalable**: Add new platforms without schema changes

### 2. Audio Compilation Service
- **File**: `src/lib/services/audio-compilation.service.ts`
- **Works for all platforms** - creates MP3 audiobook from scenes

### 3. Spotify Publishing
- **API**: `/api/projects/[id]/publish-spotify`
- **RSS Feed**: `/api/podcast/feed.xml`
- **Frontend**: Spotify button on Story Viewer page

### 4. Dependencies Installed
- FFmpeg for audio compilation
- All TypeScript types

---

## 🤖 Step 1: Automated - I'll Do This Now

### A. Run Database Migration
```bash
cd storyme-app
npx supabase db push
```

### B. Update Code to Use Generic `publications` Table
Need to update:
1. `/api/projects/[id]/publish-spotify/route.ts` - Change table name
2. `/api/projects/[id]/spotify-status/route.ts` - Change table name
3. `/api/podcast/feed.xml/route.ts` - Add `WHERE platform = 'spotify'`
4. Frontend Story Viewer page - Update fetch calls

### C. Test RSS Feed Locally
- Visit `http://localhost:3001/api/podcast/feed.xml`
- Validate XML structure

---

## 👤 Step 2: What YOU Need to Do

### A. Create Professional Podcast Cover Art
**Current**: Placeholder SVG at `/public/podcast-cover-art.jpg`

**Requirements**:
- Size: **3000 x 3000 pixels** (Spotify requirement)
- Format: JPG or PNG
- File size: < 512 KB
- Design elements:
  - KindleWood logo/branding
  - "Stories Created by Kids, for Kids" tagline
  - Colorful, child-friendly
  - Readable at thumbnail size (300x300px)

**Tools you can use**:
- Canva (templates for podcast cover art)
- Hire designer on Fiverr ($20-50)
- Adobe Photoshop/Illustrator

**When ready**: Replace `/public/podcast-cover-art.jpg` with your design

---

### B. Set Up Spotify for Podcasters Account

**Step-by-step**:

1. **Go to**: https://podcasters.spotify.com/
2. **Sign in** with your Spotify account (or create one)
3. **Click**: "Get Started" or "Add Your Podcast"
4. **Select**: "I already have a podcast" → "Import with RSS"
5. **Enter RSS URL**:
   ```
   https://your-production-domain.com/api/podcast/feed.xml
   ```
   (Use your actual domain, not localhost!)

6. **Verify Ownership**:
   - Spotify will send verification email to `podcast@kindlewood.com`
   - Click verification link in email

7. **Submit for Review**:
   - Spotify reviews in 1-2 business days
   - They check: cover art, content quality, audio quality

8. **Wait for Approval Email**

9. **Once Approved**:
   - Spotify will automatically poll your RSS feed every 1-6 hours
   - New stories published via "Publish to Spotify" will appear automatically!

---

### C. Set Up Email Alias: `podcast@kindlewood.com`

**Why**: Spotify sends verification emails here

**Options**:

**Option 1: Gmail Alias (Free)**
1. In Gmail settings → "Accounts and Import"
2. "Add another email address"
3. Add `podcast@kindlewood.com` forwarding to your Gmail

**Option 2: Custom Email**
1. Log into your domain provider (GoDaddy, Namecheap, etc.)
2. Create email alias: `podcast@kindlewood.com`
3. Forward to your main email

---

### D. Deploy to Production

Before submitting to Spotify, you MUST deploy to production:

```bash
# 1. Commit all changes
git add .
git commit -m "Add: Multi-platform publishing system (Spotify + KindleWood App)"
git push

# 2. Deploy to Vercel (or your hosting)
vercel --prod
```

**Verify**:
- Visit `https://your-domain.com/api/podcast/feed.xml`
- Should return valid XML RSS feed

---

### E. Create a Test Story with Audio (Optional)

To test before going live:

1. Create a test story in your app
2. Generate audio for all scenes
3. Click "Publish to Spotify"
4. Watch button status: Gray → Orange → Blue
5. Check RSS feed - should include new episode

---

## 🔜 Step 3: KindleWood Kids App Publishing (After Spotify is Live)

### What We'll Build:

1. **Mobile API Endpoint**: `/api/kindlewood-app/stories`
   - Returns published stories in app-friendly JSON
   - Includes audio URLs, cover images, metadata

2. **App Publishing Button**: Next to Spotify button
   - Same flow: compile → publish → live
   - Status tracking in `publications` table (platform: `'kindlewood_app'`)

3. **App Sync Service**:
   - Mobile app fetches new stories from API
   - Downloads audio for offline playback
   - Caches cover images

### Timeline Estimate:
- Backend API: 2-3 days
- Mobile app integration: 1 week (depends on app readiness)

---

## 📋 Quick Action Checklist

### Automated (I'll do right now):
- [ ] Run database migration
- [ ] Update code to use generic `publications` table
- [ ] Test RSS feed locally
- [ ] Fix any bugs
- [ ] Create deployment guide

### You need to do:
- [ ] Create professional podcast cover art (3000x3000px JPG)
- [ ] Replace `/public/podcast-cover-art.jpg` with your design
- [ ] Set up `podcast@kindlewood.com` email alias
- [ ] Deploy to production (Vercel)
- [ ] Go to https://podcasters.spotify.com/
- [ ] Submit RSS feed: `https://your-domain.com/api/podcast/feed.xml`
- [ ] Verify email ownership
- [ ] Wait for Spotify approval (1-2 days)
- [ ] Test: Create story → Generate audio → Publish to Spotify
- [ ] Confirm episode appears on Spotify within 6 hours

### After Spotify is live:
- [ ] Test with real users
- [ ] Monitor RSS feed for errors
- [ ] Start planning KindleWood Kids App publishing

---

## 🚨 Important Notes

### 1. RSS Feed URL Must Be HTTPS
- Spotify **requires** HTTPS
- Use production domain, not localhost
- Example: `https://kindlewood.com/api/podcast/feed.xml`

### 2. Audio Files Must Be Publicly Accessible
- Supabase Storage bucket must be **public**
- Test by opening audio URLs in incognito browser
- Should play without authentication

### 3. Content Guidelines
- Stories must be child-appropriate
- No copyrighted material
- No personal information (addresses, phone numbers)
- Spotify may reject if content violates guidelines

### 4. First Episode Timing
- After Spotify approval, publish 1 test episode
- Wait 6-12 hours to confirm it appears
- Then enable for all users

---

## 🎯 Success Metrics

Once live, you'll be able to track:
- Stories published to Spotify
- Stories published to KindleWood App
- User engagement on each platform
- RSS feed poll frequency
- Episode download stats (via Spotify dashboard)

---

## Need Help?

**Spotify Documentation**:
- https://podcasters.spotify.com/resources
- https://support.spotify.com/us/podcasters/

**RSS Feed Validators**:
- https://podba.se/validate/
- https://castfeedvalidator.com/

**KindleWood Support**:
- Email: podcast@kindlewood.com (you'll set this up!)

---

## What I'm Doing Next (Automated):

1. ✅ Run database migration
2. ✅ Update all code to use generic `publications` table
3. ✅ Test RSS feed endpoint
4. ✅ Verify compilation service works
5. ✅ Create troubleshooting guide

Let me do all the automated work now!
