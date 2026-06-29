# 🚀 Deployment Checklist - Project Deletion Fix

## ⚠️ CRITICAL: Database Migration Required First!

Before deploying the code changes, you MUST run the database migration.

### Step 1: Apply Database Migration (5 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select project: **qxeiajnmprinwydlozlq**

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run Migration Script**
   - Open the file: `storyme-app/fix-cascade-delete.sql`
   - Copy all contents
   - Paste into SQL Editor
   - Click "Run" or press `Ctrl+Enter`

4. **Verify Success**
   - You should see query results at the bottom
   - Look for a row with:
     ```
     constraint_name: generated_images_project_id_fkey
     delete_rule: CASCADE
     ```
   - ✅ If `delete_rule` shows "CASCADE", migration succeeded!
   - ❌ If it shows "NO ACTION", re-run the migration

---

### Step 2: Deploy Code to Production (Auto)

The code has already been pushed to GitHub. Vercel will auto-deploy.

1. **Check Vercel Dashboard**
   - Go to: https://vercel.com/dashboard
   - Find your StoryMe project
   - Watch for new deployment from commit `134b7b8`

2. **Wait for Deployment**
   - Vercel typically takes 2-3 minutes to build and deploy
   - Green checkmark = successful deployment

---

### Step 3: Post-Deployment Testing (10 minutes)

#### Test Project Deletion

1. **Login to Production**
   - Go to your production URL
   - Sign in with your account

2. **Create Test Project**
   - Create a new story with characters
   - Generate at least 1 scene image
   - Save the project

3. **Test Deletion**
   - Go to Projects page
   - Click delete on the test project
   - ✅ Should succeed without errors
   - ✅ Project should disappear from list
   - ✅ No "Failed to delete" error

4. **Verify Database Cleanup**
   - In Supabase Dashboard → Table Editor
   - Check `generated_images` table
   - ✅ Images for deleted project should be gone
   - Check `scenes` table
   - ✅ Scenes for deleted project should be gone

#### Test Edge Cases

- [ ] Delete project with no images (should work)
- [ ] Delete project with multiple scenes/images (should work)
- [ ] Delete someone else's project (should fail with "Unauthorized")
- [ ] Try to delete non-existent project (should fail gracefully)

---

### Step 4: Monitor Production (24 hours)

Watch for:
- Any error reports from users
- Failed delete operations in logs
- Database performance issues

---

## 🔴 Rollback Plan (If Something Goes Wrong)

### If Deletion Breaks Production:

1. **Revert Database Migration**
   ```sql
   ALTER TABLE generated_images DROP CONSTRAINT generated_images_project_id_fkey;
   ALTER TABLE generated_images
     ADD CONSTRAINT generated_images_project_id_fkey
     FOREIGN KEY (project_id) REFERENCES projects(id);
   ```

2. **Revert Code Deployment**
   - Go to Vercel Dashboard
   - Find previous deployment (commit `beb1a1d`)
   - Click "..." menu → "Promote to Production"

3. **Notify Users**
   - Project deletion will be temporarily unavailable
   - We'll fix and redeploy

---

## 📊 What Changed

### Database Schema
- Added `ON DELETE CASCADE` to `generated_images.project_id` foreign key
- Now when a project is deleted, all associated images are auto-deleted

### Code Changes
- Enhanced error handling in DELETE API route
- Better logging for debugging
- Improved user error messages

### Files Changed
- [storyme-app/src/app/api/projects/\[id\]/route.ts](storyme-app/src/app/api/projects/[id]/route.ts)
- [storyme-app/src/app/(dashboard)/projects/page.tsx](storyme-app/src/app/(dashboard)/projects/page.tsx)
- [storyme-app/fix-cascade-delete.sql](storyme-app/fix-cascade-delete.sql) (new)

---

## ✅ Success Criteria

- [ ] Database migration executed successfully
- [ ] Code deployed to production
- [ ] Can delete projects with images
- [ ] Can delete projects without images
- [ ] Deleted projects removed from database
- [ ] No error alerts shown to users
- [ ] Logs show HTTP 200 for successful deletes

---

## 📝 Notes

- This fix addresses the critical bug where users couldn't delete projects
- The database migration is safe and non-destructive
- Zero downtime required for deployment
- Can be run during business hours

---

**Estimated Total Time:** 15-20 minutes

**Risk Level:** Low (migration is reversible, code changes are additive)

**Business Impact:** High (fixes critical user-facing feature)
