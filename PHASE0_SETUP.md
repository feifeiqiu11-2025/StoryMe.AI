# 🚀 StoryMe - Phase 0 Setup Guide

## Overview
This guide will help you set up the production StoryMe application with Character Library support.

---

## ✅ What We're Building

### Key Enhancement: **Character Library System**

Users can now:
- Create characters ONCE and save to their library
- Reuse characters across multiple stories
- Build a collection of characters over time
- Track character usage and consistency scores

---

## 📋 Phase 0 Tasks Checklist

### Week 1: Technical Foundation

#### Day 1: Project Setup
- [ ] Create new Next.js project (production version)
- [ ] Set up Git repository
- [ ] Configure environment variables
- [ ] Install core dependencies

#### Day 2: Database Setup
- [ ] Create Supabase project
- [ ] Run database migrations (schema provided)
- [ ] Configure Row Level Security (RLS)
- [ ] Set up storage buckets

#### Day 3: Authentication
- [ ] Implement Supabase Auth
- [ ] Create login/signup pages
- [ ] Add middleware for protected routes
- [ ] Build user profile management

#### Day 4: Character Library Foundation
- [ ] Character Library API routes (CRUD)
- [ ] Character creation form UI
- [ ] Character list/grid view
- [ ] Character detail page

#### Day 5: Project Management
- [ ] Project CRUD APIs
- [ ] Project dashboard UI
- [ ] Project creation flow
- [ ] Project status management

---

## 🛠️ Step-by-Step Implementation

### STEP 1: Create Production Project

```bash
# Navigate to StoryMe directory
cd /home/gulbrand/Feifei/StoryMe

# Create new production app
npx create-next-app@latest storyme-app --typescript --tailwind --app --src-dir --eslint

# Navigate to new project
cd storyme-app

# Install core dependencies
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @fal-ai/serverless-client openai
npm install zod react-hook-form @hookform/resolvers
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install react-dropzone date-fns

# Install dev dependencies
npm install -D @types/node
```

### STEP 2: Set Up Supabase

#### 2.1: Create Supabase Project
1. Go to https://supabase.com
2. Create new project: "storyme-production"
3. Save credentials:
   - Project URL
   - Anon (public) key
   - Service role key (keep secret!)

#### 2.2: Run Database Migrations

```sql
-- Copy the entire database-schema.sql file content
-- Paste into Supabase SQL Editor
-- Run the migration
```

#### 2.3: Configure Storage Buckets

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('character-images', 'character-images', true),
  ('storybook-images', 'storybook-images', true),
  ('storybook-pdfs', 'storybook-pdfs', true),
  ('videos', 'videos', true);

-- Set up storage policies (allow authenticated users)
CREATE POLICY "Users can upload character images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'character-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their character images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'character-images' AND auth.uid()::text = (storage.foldername(name))[1]);
```

#### 2.4: Configure Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE storybooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data

-- character_library policies
CREATE POLICY "Users can view own characters"
ON character_library FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own characters"
ON character_library FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own characters"
ON character_library FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own characters"
ON character_library FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- projects policies
CREATE POLICY "Users can view own projects"
ON projects FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
ON projects FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
ON projects FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
ON projects FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Similar policies for other tables...
```

### STEP 3: Environment Variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Fal.ai
FAL_KEY=your-fal-key-here

# OpenAI
OPENAI_API_KEY=your-openai-key-here

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (later)
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
```

### STEP 4: Project Structure

```
storyme-app/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── signup/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── characters/          # CHARACTER LIBRARY
│   │   │   │   ├── page.tsx        # List all characters
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx    # Create new character
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    # Character detail
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx # Edit character
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx        # List all projects
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Project detail
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   ├── create/                   # Story creation flow
│   │   │   └── [projectId]/
│   │   │       ├── characters/       # Select from library
│   │   │       ├── script/
│   │   │       ├── generate/
│   │   │       └── review/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── callback/
│   │   │   │       └── route.ts
│   │   │   ├── characters/           # CHARACTER LIBRARY APIs
│   │   │   │   ├── route.ts         # GET, POST
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts     # GET, PATCH, DELETE
│   │   │   ├── projects/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   └── generate-character-reference/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Landing page
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── auth/
│   │   │   ├── login-form.tsx
│   │   │   └── signup-form.tsx
│   │   ├── characters/               # CHARACTER LIBRARY COMPONENTS
│   │   │   ├── character-card.tsx
│   │   │   ├── character-form.tsx
│   │   │   ├── character-library-grid.tsx
│   │   │   ├── character-selector.tsx  # For selecting in projects
│   │   │   └── character-preview.tsx
│   │   ├── projects/
│   │   │   ├── project-card.tsx
│   │   │   └── project-list.tsx
│   │   └── shared/
│   │       ├── header.tsx
│   │       ├── sidebar.tsx
│   │       └── file-upload.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts            # Client-side Supabase
│   │   │   ├── server.ts            # Server-side Supabase
│   │   │   └── middleware.ts
│   │   ├── db/
│   │   │   ├── characters.ts        # CHARACTER LIBRARY QUERIES
│   │   │   ├── projects.ts
│   │   │   └── users.ts
│   │   ├── ai/
│   │   │   ├── fal-client.ts        # Fal.ai integration
│   │   │   ├── openai-client.ts     # OpenAI integration
│   │   │   └── character-generator.ts # Character reference generation
│   │   ├── utils/
│   │   │   ├── cn.ts                # className utility
│   │   │   └── validators.ts        # Zod schemas
│   │   └── types/
│   │       └── database.ts          # TypeScript types from DB
│   └── middleware.ts                 # Auth middleware
├── public/
├── .env.local
├── package.json
└── tsconfig.json
```

---

## 🎨 Character Library UI Flow

### 1. Character Library Page (`/dashboard/characters`)

**Features:**
- Grid view of all saved characters
- Search and filter
- "Create New Character" button
- Character cards showing:
  - Thumbnail image
  - Character name
  - Usage count (how many stories)
  - Consistency score (%)
  - Quick actions (Edit, Delete, Favorite)

### 2. Create Character Page (`/dashboard/characters/new`)

**Form Fields:**
- Character Name *
- Upload Photo *
- Hair Color
- Skin Tone
- Clothing Description
- Age
- Other Features
- Personality Traits (multi-select)
- Art Style Preference (dropdown)

**Actions:**
- "Generate Reference" - Creates AI reference images
- Preview generated character
- "Save to Library" - Adds to character_library table

### 3. Character Detail Page (`/dashboard/characters/[id]`)

**Displays:**
- All character info
- Reference images (carousel)
- Consistency scores (from past projects)
- List of stories using this character
- Edit and Delete buttons

### 4. Character Selector (in Project Creation)

When creating a new story:
- Shows user's character library
- User selects 1-5 characters for this story
- Can set primary character
- Option to create new character inline
- Creates entries in `project_characters` table

---

## 🔧 Key API Routes

### Character Library APIs

```typescript
// GET /api/characters - List all characters
// POST /api/characters - Create new character
// GET /api/characters/[id] - Get character detail
// PATCH /api/characters/[id] - Update character
// DELETE /api/characters/[id] - Delete character
// POST /api/characters/[id]/generate-reference - Generate AI references
```

### Example Implementation:

```typescript
// src/app/api/characters/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user's characters
  const { data: characters, error } = await supabase
    .from('character_library')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ characters })
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Insert new character
  const { data: character, error } = await supabase
    .from('character_library')
    .insert({
      user_id: user.id,
      name: body.name,
      hair_color: body.hairColor,
      skin_tone: body.skinTone,
      clothing: body.clothing,
      age: body.age,
      other_features: body.otherFeatures,
      personality_traits: body.personalityTraits,
      reference_image_url: body.referenceImageUrl,
      reference_image_filename: body.referenceImageFilename
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ character }, { status: 201 })
}
```

---

## 📊 Database Relationships

```
user
  └── character_library (1:many)
       └── project_characters (many:many via projects)
            └── projects
                 └── scenes
                      └── generated_images
                           └── character_ratings
```

**Key Points:**
- Characters belong to users
- Projects use characters via `project_characters` junction table
- Character can be reused across multiple projects
- Ratings track consistency per character per image

---

## 🧪 Testing Plan

### Manual Testing Checklist

```
Character Library:
[ ] Create new character with photo
[ ] Create new character with text description only
[ ] Edit existing character
[ ] Delete character
[ ] View character detail page
[ ] Generate AI reference images
[ ] Upload different photo formats (jpg, png, webp)
[ ] Test file size limits (max 10MB)

Character Reuse:
[ ] Create Project A with Character "Connor"
[ ] Create Project B, select existing "Connor" from library
[ ] Verify Connor appears in both projects
[ ] Check usage_count increments
[ ] Edit Connor in library, verify changes reflect in both projects

Authentication:
[ ] Sign up new user
[ ] Log in
[ ] Log out
[ ] Password reset
[ ] Protected route access
[ ] User can only see their own characters
```

---

## 📝 Migration from POC

### What to Keep from POC:
✅ Fal.ai integration code (`lib/fal-client.ts`)
✅ Scene parser utilities (`lib/scene-parser.ts`)
✅ Multi-character prompt generation logic
✅ UI components (CharacterManager, ScriptInput, etc.)

### What to Change:
❌ Single-use characters → Character Library
❌ In-memory state → Supabase database
❌ No auth → Full authentication
❌ POC structure → Production structure

### Migration Steps:
1. Copy useful code from `/poc/` to `/storyme-app/src/`
2. Refactor to use Supabase instead of local state
3. Add authentication checks
4. Update API routes to use new database schema
5. Enhance UI with Character Library features

---

## 🎯 Success Criteria for Phase 0

By end of Week 2, you should have:
- ✅ Production app structure set up
- ✅ Supabase database running with schema
- ✅ Authentication working (login/signup)
- ✅ Character Library CRUD operations working
- ✅ User can create character and save to library
- ✅ User can view all their saved characters
- ✅ User can edit and delete characters
- ✅ Basic project creation (without image generation yet)
- ✅ Character selection from library when creating project

---

## 🚀 Next: Phase 1 (Week 3+)

Once Phase 0 is complete, we'll add:
- Video/text story input
- Story simplification with GPT-4o
- Character reference generation with Fal.ai
- Scene-by-scene image generation
- Storybook assembly and PDF export

---

## 💡 Tips

1. **Start Small**: Get auth working first, then characters, then projects
2. **Test Frequently**: Test each feature immediately after building
3. **Use Supabase Studio**: Great for viewing database data during development
4. **Keep POC Running**: Reference it while building production version
5. **Ask Questions**: If stuck on any step, reach out!

---

Ready to start building? Let me know which step you want to tackle first! 🚀
