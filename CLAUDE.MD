# KindleWood Studio - Development Guidelines for Claude

This file provides context and instructions for AI assistants (Claude) working on the KindleWood Studio codebase.

---

## Project Overview

**KindleWood Studio** (formerly StoryMe.AI) is an AI-powered platform for creating personalized children's stories with illustrations, audio narration, and interactive features.

**Target Audience**: Children aged 5-8 and their parents/teachers
**Core Features**: Story generation, character creation, illustration, narration, quizzes, 3D printable models

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Form Validation**: Zod + React Hook Form
- **State Management**: React Context (simple state), Zustand (if complex)
- **Icons**: Lucide React

### Backend
- **Runtime**: Next.js API Routes (serverless functions)
- **Database**: Supabase (PostgreSQL with Row-Level Security)
- **Storage**: Supabase Storage (for images, audio, PDFs, STL files)
- **Auth**: Supabase Auth (email/password, OAuth)
- **Real-time**: Supabase Realtime (WebSocket for live updates)

### AI Services
- **Primary AI**: Google Gemini (character analysis, story generation)
- **Legacy/Fallback**: OpenAI GPT (being phased out)
- **Image Generation**: Fal.ai
- **Audio/TTS**: Microsoft Cognitive Services Speech SDK

### DevOps
- **Hosting**: Vercel
- **Monitoring**: Sentry (errors), Axiom/Datadog (logs)
- **Analytics**: Plausible or PostHog (privacy-friendly)
- **Version Control**: Git (GitHub)

---

## File Organization

```
storyme-app/
├── app/                          # Next.js App Router pages
│   ├── api/v1/                  # API routes (versioned)
│   ├── (auth)/                  # Auth-related pages
│   ├── dashboard/               # User dashboard
│   ├── stories/                 # Story creation/viewing
│   └── 3d-projects/             # 3D modeling feature (planned)
│
├── components/                   # React components
│   ├── ui/                      # Reusable UI components
│   ├── stories/                 # Story-specific components
│   └── 3d-modeling/             # 3D feature components (planned)
│
├── lib/                         # Business logic & utilities
│   ├── supabase/                # Supabase client & helpers
│   ├── ai/                      # AI service integrations
│   ├── storage/                 # File upload/download utilities
│   └── 3d-modeling/             # 3D feature services (planned)
│
├── supabase/
│   └── migrations/              # Database migrations
│
├── public/                      # Static assets
├── __tests__/                   # Test files
└── scripts/                     # Utility scripts
```

---

## System Design Principles

**MANDATORY**: Before implementing ANY feature, validate the design against these 8 principles.

### 1. Security by Default
Apply authentication, authorization, input validation, and safe handling of secrets from day one.

**Required Checks**:
- [ ] Does this feature require authentication? How is it enforced?
- [ ] What user roles can access this? (RBAC defined?)
- [ ] What inputs need validation? (Use Zod schemas)
- [ ] Are there any secrets? (Store in environment variables only)
- [ ] Are file uploads validated? (Size, type, malware scan)
- [ ] Are URLs signed/time-limited? (Never expose direct S3 URLs)
- [ ] Is rate limiting needed? (For expensive operations)

**Examples**:
- ✅ All API routes check `auth.uid()` before processing
- ✅ Row-Level Security (RLS) policies on all Supabase tables
- ✅ File uploads: validate MIME type, size limits, re-encode images
- ✅ Secrets in `.env.local`, never committed to git
- ❌ No direct database queries from client-side code

### 2. Clear API Contracts
Define precise request/response formats, errors, and versioning so the system behaves predictably.

**Required Checks**:
- [ ] Are request/response types defined with Zod schemas?
- [ ] Is this API endpoint versioned? (Use `/api/v1/...`)
- [ ] Are errors standardized across endpoints?
- [ ] Is there request/response validation?
- [ ] Are correlation IDs included for debugging?

**Pattern**:
```typescript
// Define schemas
const CreateStoryRequestSchema = z.object({
  title: z.string().min(1).max(100),
  character_ids: z.array(z.string().uuid()).min(1).max(5),
});

const CreateStoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    story_id: z.string().uuid(),
    title: z.string(),
    created_at: z.string().datetime(),
  }),
});

// Standardized error response
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),        // 'UNAUTHORIZED', 'VALIDATION_FAILED'
    message: z.string(),     // Human-readable message
    details: z.record(z.any()).optional(),
    request_id: z.string(),  // For debugging
  }),
});

// API handler validates both
export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  try {
    const body = await req.json();
    const validated = CreateStoryRequestSchema.parse(body);

    // ... process request

    const response = CreateStoryResponseSchema.parse(result);
    return NextResponse.json(response);
  } catch (error) {
    return handleAPIError(error, requestId);
  }
}
```

**Examples**:
- ✅ All API routes use Zod for validation
- ✅ Versioned endpoints: `/api/v1/stories`, `/api/v1/3d-projects`
- ✅ Consistent error format with request IDs
- ❌ No unvalidated JSON parsing
- ❌ No API version in headers (use URL for clarity)

### 3. Scalable Database Schema
Design tables and relationships that can evolve over time without breaking existing data.

**Required Checks**:
- [ ] Are foreign keys defined?
- [ ] Are constraints appropriate? (NOT NULL, CHECK, UNIQUE)
- [ ] Are indexes added for common queries?
- [ ] Is there a migration strategy? (Incremental SQL files)
- [ ] Can this schema evolve? (Nullable columns for future fields)
- [ ] Are queries optimized? (Avoid N+1 problems)

**Pattern**:
```sql
-- Use migrations: supabase/migrations/YYYYMMDD_description.sql

CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'completed', 'published')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete

  -- Indexes for common queries
  INDEX idx_stories_user ON (user_id) WHERE deleted_at IS NULL,
  INDEX idx_stories_status ON (status) WHERE deleted_at IS NULL
);

-- Row-Level Security
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_stories" ON stories
  FOR SELECT USING (auth.uid() = user_id);
```

**Examples**:
- ✅ Migrations in `supabase/migrations/` with timestamps
- ✅ RLS policies on all tables
- ✅ Soft deletes (`deleted_at`) instead of hard deletes
- ✅ Indexes on foreign keys and common filters
- ❌ No schema changes without migrations
- ❌ No raw SQL in application code (use Supabase client)

### 4. Reusable Components
Create modular, reusable UI components and backend modules to reduce duplication.

**Required Checks**:
- [ ] Is this component generic enough for reuse?
- [ ] Does it have a clear, single responsibility?
- [ ] Are props well-defined with TypeScript?
- [ ] Is it documented (JSDoc comments)?
- [ ] Can it be composed with other components?

**Pattern**:
```typescript
// components/ui/Button.tsx
// Generic, reusable button component

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) {
  // Reusable across all features
}

// Usage
<Button variant="primary" size="lg" onClick={handleSave}>
  Save Story
</Button>
```

**Examples**:
- ✅ Generic UI components in `components/ui/`
- ✅ Shared utilities in `lib/` (uploadFile, formatDate, etc.)
- ✅ Reusable hooks (`useAuth`, `useToast`, etc.)
- ❌ No copy-pasting components between features
- ❌ No feature-specific logic in generic components

### 5. Reuse Before Rebuild
Use existing services or libraries (auth, storage, queues) instead of building everything from scratch.

**Required Checks**:
- [ ] Does a library/service already exist for this?
- [ ] Have I searched npm, GitHub, or service marketplaces?
- [ ] Is the existing solution mature and well-maintained?
- [ ] What's the cost/benefit vs. building custom?

**Examples**:
- ✅ Use Supabase Auth (don't build custom auth)
- ✅ Use Zod for validation (don't write custom validators)
- ✅ Use Three.js for 3D viewer (don't build WebGL from scratch)
- ✅ Use trimesh for STL export (don't write custom STL generator)
- ✅ Use OpenCV for image processing (don't rebuild computer vision)
- ❌ Don't build custom job queue (use BullMQ or Supabase Edge Functions)
- ❌ Don't build custom PDF generator if libraries exist

**When to Build Custom**:
- No suitable library exists
- Existing solutions don't meet specific requirements
- Cost of library is prohibitive
- Security/compliance concerns with third-party code

### 6. Separation of Concerns
Keep business logic, data access, and UI layers independent for easier maintenance and testing.

**Required Architecture**:
```
UI Layer (components/)
  ↓ calls
API Layer (app/api/v1/)
  ↓ calls
Service Layer (lib/*/services/)
  ↓ calls
Repository Layer (lib/*/repositories/)
  ↓ calls
Database (Supabase)
```

**Rules**:
- ❌ UI components CANNOT make database calls directly
- ❌ API routes CANNOT contain business logic
- ❌ Services CANNOT import UI components
- ✅ UI calls API routes or client-side services
- ✅ API routes validate input, call services, return responses
- ✅ Services contain business logic, orchestrate operations
- ✅ Repositories handle database operations only

**Example**:
```typescript
// ❌ BAD: Business logic in API route
export async function POST(req: NextRequest) {
  const { title } = await req.json();
  const story = await supabase.from('stories').insert({ title });
  const character = await supabase.from('characters').insert({ story_id: story.id });
  // ... complex logic in API route
}

// ✅ GOOD: Service layer handles business logic
// app/api/v1/stories/create/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json();
  const validated = CreateStoryRequestSchema.parse(body);

  const story = await storyService.createStory(validated);

  return NextResponse.json({ success: true, data: story });
}

// lib/stories/storyService.ts
export class StoryService {
  async createStory(data: CreateStoryData): Promise<Story> {
    // Business logic here
    const story = await this.storyRepository.create(data);
    await this.characterService.createDefaultCharacters(story.id);
    return story;
  }
}

// lib/stories/storyRepository.ts
export class StoryRepository {
  async create(data: CreateStoryData): Promise<Story> {
    // Database operation only
    const { data: story } = await this.supabase
      .from('stories')
      .insert(data)
      .select()
      .single();
    return story;
  }
}
```

### 7. Prefer Stateless Services
Store state in databases or caches, not in server memory, to simplify scaling and failover.

**Required Checks**:
- [ ] Is state stored in database/cache, not server memory?
- [ ] Are long-running operations async (job queue)?
- [ ] Can this API handler run on multiple servers?
- [ ] Is session state in database (Supabase Auth)?

**Examples**:
- ✅ Use Supabase Realtime for progress updates (not polling)
- ✅ Use job queue for 3D model generation (not synchronous processing)
- ✅ Store workflow state in database (`status` column)
- ✅ API routes are stateless (no in-memory caches)
- ❌ No `const cache = new Map()` in API routes
- ❌ No long-running synchronous operations (>5 seconds)

**Pattern for Async Jobs**:
```typescript
// POST /api/v1/3d-projects/:id/generate
export async function POST(req: NextRequest) {
  const { projectId } = params;

  // ❌ BAD: Synchronous (blocks for 60 seconds)
  // const model = await generate3DModel(projectId);

  // ✅ GOOD: Enqueue job, return immediately
  const jobId = await jobQueue.enqueue('generate-3d', { projectId });

  await db.update('projects_3d', projectId, {
    status: 'processing',
    job_id: jobId
  });

  return NextResponse.json({
    success: true,
    status: 'processing',
    estimated_seconds: 30
  });
}

// Client polls or uses Supabase Realtime for updates
```

### 8. Responsive & Accessible UI
Ensure interfaces work across devices and maintain basic accessibility standards.

**Required Checks**:
- [ ] Does this work on mobile, tablet, desktop?
- [ ] Are touch targets at least 44px (iOS minimum)?
- [ ] Is keyboard navigation supported?
- [ ] Are there ARIA labels for screen readers?
- [ ] Is color contrast WCAG AA compliant? (4.5:1 minimum)
- [ ] Are fonts large enough for kids? (16-20px)
- [ ] Are error messages accessible (aria-live)?

**Examples**:
```tsx
// ✅ Responsive with Tailwind
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* Adapts to screen size */}
</div>

// ✅ Touch-optimized button
<button className="min-h-[44px] min-w-[44px] px-4 py-2">
  Save
</button>

// ✅ Keyboard navigation
<div
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') handleClick();
  }}
  role="button"
>
  {/* Keyboard accessible */}
</div>

// ✅ Screen reader support
<img src={url} alt="Child's drawing of a dinosaur" />

<label htmlFor="story-title">
  Story Title
  <span className="sr-only">required</span>
</label>
<input
  id="story-title"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? 'title-error' : undefined}
/>

// ✅ Accessible errors
<div role="alert" aria-live="assertive" className="text-red-600">
  {error.message}
</div>
```

---

## Mandatory Workflow for Feature Implementation

**⚠️ CRITICAL INSTRUCTION FOR ALL FEATURE IMPLEMENTATIONS**

Before writing ANY code for a new feature, you MUST follow this workflow:

### STEP 1: Design Review (MANDATORY)

When the user requests a new feature:

1. **Read the request carefully**
2. **Identify which of the 8 principles apply** to this feature
3. **Draft how the feature will satisfy each principle**:
   - Security: What auth/validation is needed?
   - API Contracts: What endpoints/schemas?
   - Database: What tables/migrations?
   - Reusable Components: What can be reused?
   - Reuse Before Rebuild: What libraries exist?
   - Separation of Concerns: Which layers involved?
   - Stateless: Is async processing needed?
   - Accessible: What a11y requirements?

4. **Present design to user for approval**:
   ```
   "Before implementing [feature], let me validate the design:

   **Principle 1 (Security)**:
   - Requires authentication (Supabase Auth)
   - RBAC: Only [role] can access
   - Input validation: [fields] using Zod
   - File uploads: [validation rules]

   **Principle 2 (API Contracts)**:
   - Endpoint: POST /api/v1/[resource]
   - Request schema: [fields]
   - Response schema: [fields]
   - Errors: [codes]

   [... address all relevant principles ...]

   Design addresses: [X, Y, Z principles]. Approve to proceed?"
   ```

5. **Wait for user confirmation before coding**

### STEP 2: Implementation (Only After Approval)

Once approved:

1. **Write code following the design**
2. **Include comments referencing principles**:
   ```typescript
   // Principle 1 (Security): Validate auth before processing
   const user = await getUser(req);
   if (!user) throw new UnauthorizedError();

   // Principle 2 (API Contract): Validate request with Zod
   const validated = RequestSchema.parse(body);
   ```

3. **Create migrations if database changes**:
   ```bash
   # supabase/migrations/YYYYMMDD_add_feature.sql
   ```

4. **Update relevant documentation**:
   - Update this CLAUDE.MD if architectural patterns change
   - Update feature docs (like 3DModeling.MD)

### STEP 3: Self-Review (Before Finishing)

Before marking task complete:

1. **Verify each principle was implemented**:
   ```
   ✓ Security: Auth added, inputs validated
   ✓ API Contracts: Zod schemas defined, versioned endpoint
   ✓ Database: Migration created, RLS policies added
   ✓ Reusable: Used existing Button component
   ✓ Reuse: Used Supabase Storage (not custom)
   ✓ Separation: Service layer handles logic, not API route
   ✓ Stateless: Async job for long operation
   ✓ Accessible: Keyboard nav, ARIA labels added
   ```

2. **Report compliance**:
   ```
   "Implementation complete. Design principle compliance:
   - [✓] Security by Default
   - [✓] Clear API Contracts
   - [✓] Scalable Database Schema
   [... etc ...]

   All principles addressed."
   ```

### If User Says "Skip Design, Just Code"

**Still mention principles during implementation**:

```
"Implementing [feature] with the following approach:

- Security: Using Supabase Auth, validating [inputs]
- API: Creating POST /api/v1/[endpoint] with Zod schemas
- Database: Adding migration for [tables]

[Implement with principle comments in code]"
```

**Add TODO comments for any missing compliance**:
```typescript
// TODO (Principle 7): Move this to async job queue (currently synchronous)
const result = await expensiveOperation();
```

---

## Common Patterns & Best Practices

### File Uploads

```typescript
import { uploadFile } from '@/lib/storage/uploadFile';

// Validate and upload
const file = req.files[0];
await validateFile(file, {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/png', 'image/jpeg'],
});

const url = await uploadFile({
  bucket: 'drawings',
  path: `projects/${projectId}/piece-${pieceId}.png`,
  file: file.buffer,
});

// Return signed URL (expires in 1 hour)
const signedUrl = await storage.createSignedUrl(url, { expiresIn: 3600 });
```

### API Error Handling

```typescript
// lib/api/errors.ts
export function handleAPIError(error: unknown, requestId: string) {
  if (error instanceof ZodError) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid request data',
        details: error.errors,
        request_id: requestId,
      },
    }, { status: 400 });
  }

  if (error instanceof UnauthorizedError) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        request_id: requestId,
      },
    }, { status: 401 });
  }

  // Log unexpected errors to Sentry
  captureException(error, { tags: { request_id: requestId } });

  return NextResponse.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      request_id: requestId,
    },
  }, { status: 500 });
}
```

### Database Queries (Supabase)

```typescript
// ✅ GOOD: Use Supabase client, respects RLS
const { data, error } = await supabase
  .from('stories')
  .select('*, scenes(*)')
  .eq('id', storyId)
  .single();

// ❌ BAD: Raw SQL bypasses RLS
const story = await db.query('SELECT * FROM stories WHERE id = $1', [storyId]);
```

### Real-time Updates

```typescript
// Client-side: Subscribe to changes
const subscription = supabase
  .channel(`project-${projectId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'projects_3d',
      filter: `id=eq.${projectId}`,
    },
    (payload) => {
      // Update UI when database changes
      setProject(payload.new);
    }
  )
  .subscribe();

// Cleanup on unmount
return () => subscription.unsubscribe();
```

---

## Important Context & Gotchas

### Character Generation
- **Current**: Uses Gemini for character analysis (replaced GPT)
- **Legacy**: Old code may reference OpenAI, should be updated
- **Character library**: Predefined characters (dino, house, human, etc.)
- **Subject types**: 'animated_object', 'animal', 'human', 'scene'

### Database
- **RLS is mandatory**: All tables have Row-Level Security enabled
- **Soft deletes**: Use `deleted_at` column, don't hard delete
- **Migrations**: Incremental SQL files in `supabase/migrations/`
- **Existing tables**: stories, scenes, characters, audio_pages, quiz_questions, etc.

### Authentication
- **User roles**: Stored in `users` table metadata
- **Workshop context**: Some features need `workshop_id` for RBAC
- **OAuth**: Supports Google, GitHub (configured in Supabase)

### Known Issues
- Character generation migrated from GPT to Gemini (Phase 1 complete)
- Some old code paths may still reference OpenAI (should be removed)
- 3D modeling feature is in planning phase (see 3DModeling.MD)

---

## Testing

### Unit Tests
```typescript
// __tests__/lib/stories/storyService.test.ts
import { describe, it, expect } from '@jest/globals';
import { StoryService } from '@/lib/stories/storyService';

describe('StoryService', () => {
  it('creates story with valid data', async () => {
    const service = new StoryService();
    const story = await service.createStory({
      title: 'Test Story',
      user_id: 'test-user-id',
    });

    expect(story.title).toBe('Test Story');
    expect(story.status).toBe('draft');
  });
});
```

### Integration Tests
```typescript
// __tests__/api/stories/create.test.ts
import { POST } from '@/app/api/v1/stories/create/route';

describe('POST /api/v1/stories/create', () => {
  it('creates story with authenticated user', async () => {
    const req = createMockRequest({
      body: { title: 'Test Story' },
      auth: { uid: 'test-user' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.data.story_id).toBeDefined();
  });
});
```

---

## Related Documents

- **[3DModeling.MD](./3DModeling.MD)** - 3D printable character feature plan
- **[3DModeling-Architecture-Review.md](./3DModeling-Architecture-Review.md)** - Detailed architecture analysis with security, risks, tech stack evaluation
- **README.md** - Project setup and deployment instructions (if exists)

---

## Summary

This project follows strict architectural principles to ensure security, scalability, and maintainability. When implementing features:

1. **Always validate design against 8 principles first**
2. **Get user approval before coding**
3. **Use existing libraries and services (reuse before rebuild)**
4. **Follow layer separation (UI → API → Service → Repository)**
5. **Write tests for business logic**
6. **Document decisions and update this file as needed**

**If in doubt, ask the user before proceeding.**
