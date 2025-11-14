# StoryMe.AI

An AI-powered platform for creating personalized children's stories with images, audio, and interactive features.

## Project Structure

```
StoryMe.AI/
├── storyme-app/          # Next.js web application
├── storyme-kids-app/     # iOS Kids app (Swift)
├── supabase/            # Database migrations and functions
└── README.md
```

## Recent Updates

### Hierarchical Tagging System (Nov 2024)

A new hierarchical tagging system for organizing and filtering community stories.

#### Features

- **4 Main Categories**: Collections, Learning, Avocado (AMA), Original Stories
- **Subcategories**: Cool Jobs, Bedtime Stories, Firefighters, Police Officers, Doctors, Teachers, Construction Workers
- **Single-Selection Filters**: Radio button behavior for better UX
- **Automatic Grouping**: Stories grouped by subcategory when filtering Collections or Learning
- **Backward Compatible**: Existing Kids app continues to work without changes

#### Database Schema

**New Fields in `story_tags` table:**
- `category` (text): Parent category identifier
- `parent_id` (uuid): Reference to parent tag
- `is_leaf` (boolean): Whether this is a leaf/subcategory node
- `display_order` (integer): Sort order within category

**Migration:** `supabase/migrations/20251114000001_add_hierarchical_tags.sql`

#### API Endpoints

##### GET `/api/tags`
Returns all available tags with hierarchy information.

**Response:**
```json
{
  "tags": [
    {
      "id": "uuid",
      "name": "Collections",
      "slug": "collections",
      "icon": "📚",
      "category": "collections",
      "parentId": null,
      "isLeaf": false,
      "displayOrder": 1
    },
    {
      "id": "uuid",
      "name": "Cool Jobs",
      "slug": "cool-jobs",
      "icon": "👔",
      "category": "collections",
      "parentId": "parent-uuid",
      "isLeaf": true,
      "displayOrder": 1
    }
  ]
}
```

##### GET `/api/stories/public`
Returns public stories with full tag hierarchy data.

**Query Parameters:**
- `limit` (number, default: 20, max: 100): Stories per page
- `offset` (number, default: 0): Pagination offset
- `sortBy` (string): "recent" or "popular"
- `search` (string): Search query for title/description/author
- `featured` (boolean): Filter for featured stories only
- `tags` (string): Comma-separated tag slugs OR categories

**Filtering Examples:**
```bash
# Filter by specific subcategory
GET /api/stories/public?tags=cool-jobs

# Filter by entire category (returns all subcategories)
GET /api/stories/public?tags=collections

# Filter by multiple categories
GET /api/stories/public?tags=collections,learning
```

**Response:**
```json
{
  "success": true,
  "stories": [
    {
      "id": "uuid",
      "title": "Story Title",
      "description": "Story description",
      "coverImageUrl": "https://...",
      "authorName": "John, 5",
      "featured": false,
      "viewCount": 42,
      "tags": [
        {
          "id": "uuid",
          "name": "Cool Jobs",
          "slug": "cool-jobs",
          "icon": "👔",
          "category": "collections",
          "parentId": "parent-uuid",
          "isLeaf": true,
          "displayOrder": 1
        }
      ],
      "scenes": [...]
    }
  ],
  "totalCount": 100,
  "currentPage": 1,
  "totalPages": 5,
  "offset": 0,
  "limit": 20
}
```

#### Frontend Components

**Updated Pages:**
- `/stories` - Public stories gallery with hierarchical filtering
- `/community-stories` - Dashboard stories page with grouping
- Homepage carousel - Category filters with subcategory grouping

**New Utilities:**
- `storyme-app/src/lib/utils/tagHelpers.ts` - Helper functions for tag display and grouping

**Key Components:**
- `TagSelector.tsx` - Hierarchical tag selection in story editor
- `CommunityStoriesCarousel.tsx` - Homepage carousel with category filters
- `StoryCard.tsx` - Story display with tag badges

#### User Experience

**Filter Behavior:**
1. User sees 5 main category buttons: All, Collections, Learning, Avocado, Original
2. Clicking a category shows only stories from that category
3. For Collections and Learning, stories are automatically grouped by subcategory
4. Single-selection: Clicking a new category auto-deselects the previous one

**Example Flow:**
```
User clicks "Collections"
  → API call: /api/stories/public?tags=collections
  → Frontend groups stories by subcategories
  → Display:
      Cool Jobs
        [Story] [Story] [Story]
      Bedtime Stories
        [Story] [Story]
```

#### Integration Guide for Kids App

The API is fully backward compatible. Kids app can:

**Option 1 (No Changes):**
- Continue using existing endpoints
- Ignore new tag fields
- Everything works as before

**Option 2 (Add Category Filters):**
- Add 5 category filter buttons
- Use `?tags=collections` to filter by category
- Display flat list of results

**Option 3 (Full Integration):**
- Add category filters
- Implement subcategory grouping
- Show section headers for subcategories

See the detailed integration guide in commit `7ed9774`.

## Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase CLI (for database migrations)

### Setup

```bash
# Install dependencies
cd storyme-app
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run migrations
supabase db push

# Start development server
npm run dev
```

### Database Migrations

```bash
# Create a new migration
supabase migration new migration_name

# Apply migrations
supabase db push

# Reset database (careful in production!)
supabase db reset
```

## Deployment

### Web App (Vercel)
Push to `main` branch triggers automatic deployment to Vercel.

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### Database (Supabase)
Migrations are automatically applied during deployment.

## API Documentation

### Authentication
Most endpoints require authentication via Supabase Auth.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

### Core Endpoints

- `POST /api/projects` - Create new story project
- `GET /api/projects` - Get user's projects
- `GET /api/projects/[id]` - Get project details
- `PATCH /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project
- `GET /api/stories/public` - Get public stories (no auth required)
- `GET /api/stories/public/[id]` - Get public story details (no auth required)
- `GET /api/tags` - Get all available tags (no auth required)
- `POST /api/projects/[id]/tags` - Update project tags
- `GET /api/subscription/status` - Get user subscription status
- `POST /api/subscription/cancel` - Cancel subscription

## Tech Stack

### Web App
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **Deployment:** Vercel
- **AI Services:** OpenAI, Fal.ai

### Kids App
- **Platform:** iOS (Swift)
- **UI Framework:** SwiftUI
- **Backend:** Same APIs as web app

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Proprietary - All rights reserved
