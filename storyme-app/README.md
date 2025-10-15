# StoryMe - Production Application

## Phase 0 Implementation Status

This is the production implementation of StoryMe with Character Library support.

## What's Built So Far

### Project Setup ✅
- Next.js 14 with App Router
- TypeScript configuration
- Tailwind CSS styling
- Modern project structure with src/ directory

### Dependencies Installed ✅
- `@supabase/supabase-js` - Supabase client
- `@supabase/ssr` - Server-side rendering support for Supabase
- `@fal-ai/serverless-client` - Fal.ai image generation
- `openai` - OpenAI API client
- `zod` - Schema validation
- `react-hook-form` + `@hookform/resolvers` - Form handling
- `lucide-react` - Icon library
- `tailwind-merge` + `clsx` - Utility class management
- `react-dropzone` - File upload
- `date-fns` - Date formatting

### Authentication System ✅
- `/login` - Email/password sign in
- `/signup` - User registration with email verification
- `/api/auth/callback` - OAuth callback handler
- Middleware for protected routes
- Automatic redirect to login for unauthenticated users
- Session management with Supabase Auth

### Database Layer ✅
- Supabase client configuration (browser and server)
- TypeScript types for all database tables
- Query functions for Character Library operations:
  - `getUserCharacters()` - Get all user's characters
  - `getCharacterById()` - Get single character
  - `createCharacter()` - Create new character
  - `updateCharacter()` - Update character
  - `deleteCharacter()` - Delete character
  - `toggleCharacterFavorite()` - Mark as favorite
  - `searchCharacters()` - Search by name
  - `getFavoriteCharacters()` - Get favorites

### API Routes ✅
- `GET /api/characters` - List all user's characters
- `POST /api/characters` - Create new character
- `GET /api/characters/[id]` - Get specific character
- `PATCH /api/characters/[id]` - Update character
- `DELETE /api/characters/[id]` - Delete character
- All routes protected with authentication
- Zod validation on all inputs
- Proper error handling

### UI Pages ✅
- `/dashboard` - Dashboard home with stats and quick actions
- `/characters` - Character Library grid view
- `/characters/new` - Create new character (to be built)
- `/characters/[id]` - Character detail (to be built)
- Dashboard layout with navigation header

### Validation Schemas ✅
- Character Library validation (requires at least one description field)
- Project validation
- Scene validation
- File upload validation (10MB limit, image types)
- Login/signup validation

### Middleware ✅
- Session refresh on every request
- Protected route handling
- Redirect unauthenticated users to login
- Redirect authenticated users away from login/signup

## What's Next (Remaining Phase 0 Tasks)

### Week 1: Complete Character Library UI
1. Character creation form with file upload
2. Character detail page
3. Character edit functionality
4. File upload to Supabase Storage
5. Character preview component

### Week 2: Projects
1. Project CRUD APIs
2. Project dashboard
3. Character selection from library
4. Link characters to projects

## File Structure

```
storyme-app/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx          # Login page
│   │   │   ├── signup/
│   │   │   │   └── page.tsx          # Signup page
│   │   │   └── layout.tsx            # Auth layout
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx          # Dashboard home
│   │   │   ├── characters/
│   │   │   │   ├── page.tsx          # Character library
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx      # Create character (TODO)
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx      # Character detail (TODO)
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx  # Edit character (TODO)
│   │   │   ├── projects/
│   │   │   │   └── page.tsx          # Projects list (TODO)
│   │   │   └── layout.tsx            # Dashboard layout
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── callback/
│   │   │   │       └── route.ts      # Auth callback
│   │   │   └── characters/
│   │   │       ├── route.ts          # List/create characters
│   │   │       └── [id]/
│   │   │           └── route.ts      # Get/update/delete character
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                        # UI components (TODO)
│   │   ├── auth/                      # Auth components (TODO)
│   │   ├── characters/                # Character components (TODO)
│   │   └── shared/                    # Shared components (TODO)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   └── server.ts             # Server Supabase client
│   │   ├── db/
│   │   │   └── characters.ts         # Character queries
│   │   ├── utils/
│   │   │   ├── cn.ts                 # Class name utility
│   │   │   └── validators.ts         # Zod schemas
│   │   └── types/
│   │       └── database.ts           # TypeScript types
│   └── middleware.ts                  # Auth middleware
├── .env.local.example
├── .env.local
├── package.json
└── README.md
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `FAL_KEY` - Your Fal.ai API key
- `OPENAI_API_KEY` - Your OpenAI API key

### 3. Set Up Supabase Database

1. Create a new Supabase project at https://supabase.com
2. Copy the database schema from `/home/gulbrand/Feifei/StoryMe/database-schema.sql`
3. Run the migration in Supabase SQL Editor
4. Set up storage buckets (see PHASE0_SETUP.md)

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### 5. Create Your First Account

1. Go to `/signup` to create an account
2. Sign in at `/login`
3. You'll be redirected to the dashboard

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Image Generation**: Fal.ai (FLUX models)
- **AI**: OpenAI GPT-4o-mini
- **Validation**: Zod
- **Forms**: React Hook Form

## Key Features

### Character Library System
- **Reusable Characters**: Create once, use in multiple stories
- **Usage Tracking**: See how many times each character is used
- **Favorites**: Mark frequently used characters
- **Search**: Find characters by name
- **Detailed Descriptions**: Hair color, skin tone, clothing, age, etc.
- **Reference Images**: Upload photos for AI consistency

### Security
- **Row Level Security (RLS)**: Users can only access their own data
- **Protected Routes**: Middleware enforces authentication
- **Validated Inputs**: Zod schemas on all API endpoints
- **Secure Sessions**: HTTP-only cookies via Supabase

### User Experience
- **Modern UI**: Clean, responsive design with Tailwind
- **Dashboard**: Overview of characters, projects, and storybooks
- **Quick Actions**: Fast access to common tasks
- **Empty States**: Helpful guidance when no data exists

## Database Schema

See `/home/gulbrand/Feifei/StoryMe/database-schema.sql` for complete schema.

Key tables:
- `users` - User accounts
- `character_library` - Reusable character definitions
- `projects` - Story projects
- `project_characters` - Many-to-many link between projects and characters
- `scenes` - Individual scenes in a story
- `generated_images` - AI-generated images for scenes
- `storybooks` - Finalized storybook PDFs
- `character_ratings` - Consistency ratings for character appearances

## Development Notes

### Adding New API Routes
1. Create route file in `src/app/api/`
2. Import `createClient` from `@/lib/supabase/server`
3. Check authentication with `supabase.auth.getUser()`
4. Validate input with Zod schemas
5. Use database query functions from `src/lib/db/`
6. Return JSON responses with proper status codes

### Adding New Pages
1. Create page in appropriate route group: `(auth)` or `(dashboard)`
2. Use Server Components for data fetching when possible
3. Client Components (with `'use client'`) for interactivity
4. Import and use shared components from `src/components/`

### Testing Character Library APIs

```bash
# List characters (requires authentication)
curl http://localhost:3000/api/characters \
  -H "Cookie: sb-access-token=YOUR_TOKEN"

# Create character
curl -X POST http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{
    "name": "Connor",
    "hair_color": "brown",
    "skin_tone": "fair",
    "clothing": "blue t-shirt and jeans",
    "age": "5"
  }'
```

## Deployment

Ready to deploy to Vercel:

```bash
npm run build
```

Set environment variables in Vercel dashboard before deploying.

## Next Steps

See [PHASE0_SETUP.md](../PHASE0_SETUP.md) for detailed Phase 0 implementation plan.

After completing Phase 0:
- Phase 1: Story input and simplification
- Phase 2: Character reference generation with Fal.ai
- Phase 3: Scene-by-scene image generation
- Phase 4: Storybook assembly and PDF export
