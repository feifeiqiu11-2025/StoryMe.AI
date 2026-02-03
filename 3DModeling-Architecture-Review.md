# 3D Modeling Feature - Architecture Review Against Design Principles

**Date**: 2026-01-29
**Reviewer**: System Architecture Analysis
**Feature**: 3D Printable Character Models
**Status**: Pre-Implementation Design Review

---

## Executive Summary

This document analyzes the proposed 3D modeling feature architecture against KindleWood's 8 core design principles. It identifies compliance gaps, architectural risks, and provides concrete recommendations for a production-ready system.

**Overall Assessment**: The initial design (3DModeling.MD) captures the vision well but needs significant architectural hardening before implementation. Multiple critical security, scalability, and operational concerns must be addressed.

**Recommendation**: Proceed with Phase 0 manual validation, but revise technical architecture before Phase 1 development.

---

## Design Principles Compliance Analysis

### Principle 1: Security by Default ⚠️ NEEDS WORK

#### Current State (from 3DModeling.MD)
- ❌ No authentication/authorization strategy defined
- ❌ File upload security not addressed (drawing images, STL files)
- ❌ No input validation specified for drawings, dimensions
- ❌ Teacher vs. student permissions unclear
- ❌ 3D printer access control not mentioned
- ⚠️ Mentions "teacher review" but no authorization model

#### Critical Security Risks

**Risk 1.1: Malicious File Upload**
- **Threat**: Child/attacker uploads malicious image disguised as drawing
  - SVG with embedded scripts (XSS)
  - Extremely large images (DoS via memory exhaustion)
  - Non-image files renamed to .png
- **Impact**: Server compromise, resource exhaustion, data breach
- **Likelihood**: Medium (workshop setting reduces risk, but possible)

**Risk 1.2: Unauthorized STL Access**
- **Threat**: Anyone with STL URL can download/modify other kids' models
- **Impact**: Privacy violation, IP theft (if templates are commercial)
- **Likelihood**: High (common misconfiguration)

**Risk 1.3: AI Processing Injection**
- **Threat**: Specially crafted images that exploit AI model vulnerabilities
  - Adversarial images causing model crashes
  - Prompt injection via OCR if system reads text in drawings
- **Impact**: Service disruption, unexpected behavior
- **Likelihood**: Low but increasing (AI attacks becoming common)

**Risk 1.4: Teacher Account Compromise**
- **Threat**: If teacher account hacked, attacker controls entire workshop
  - Access to all children's data
  - Can modify/delete projects
  - Can inject malicious STL files
- **Impact**: CRITICAL - data breach, child safety
- **Likelihood**: Medium (phishing, weak passwords)

#### Required Security Controls

**AUTH-1: Multi-Tier Authentication**
```typescript
// Role-based access control
enum UserRole {
  CHILD = 'child',           // Can create/edit own projects only
  TEACHER = 'teacher',       // Can view/approve projects in their workshops
  WORKSHOP_ADMIN = 'admin',  // Can manage workshops, assign teachers
  SYSTEM_ADMIN = 'system'    // Full access (KindleWood staff)
}

// Every API request must validate
interface RequestContext {
  user_id: string;
  role: UserRole;
  workshop_id?: string;      // Which workshop context
  permissions: Permission[]; // Fine-grained capabilities
}
```

**AUTH-2: Resource-Level Authorization**
```typescript
// Example: Can this user access this project?
async function authorize3DProject(
  ctx: RequestContext,
  projectId: string,
  action: 'read' | 'write' | 'approve' | 'delete'
): Promise<boolean> {
  // Child can only access their own projects
  if (ctx.role === 'CHILD') {
    const project = await getProject(projectId);
    return project.creator_id === ctx.user_id &&
           ['read', 'write'].includes(action);
  }

  // Teacher can approve projects in their workshop
  if (ctx.role === 'TEACHER') {
    const project = await getProject(projectId);
    return project.workshop_id === ctx.workshop_id;
  }

  // Admin has full access
  return ctx.role === 'WORKSHOP_ADMIN' || ctx.role === 'SYSTEM_ADMIN';
}
```

**INPUT-1: File Upload Validation**
```typescript
// Drawing upload validation
const DRAWING_UPLOAD_RULES = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB max
  allowedMimeTypes: ['image/png', 'image/jpeg'], // NO SVG (XSS risk)
  maxDimensions: { width: 4096, height: 4096 },
  scanForMalware: true, // Use ClamAV or cloud service
  sanitizeMetadata: true, // Strip EXIF data (privacy)
};

async function validateDrawingUpload(file: File): Promise<void> {
  // 1. Check file size
  if (file.size > DRAWING_UPLOAD_RULES.maxFileSizeBytes) {
    throw new Error('File too large');
  }

  // 2. Verify MIME type (don't trust client-provided)
  const actualMimeType = await detectMimeType(file.buffer);
  if (!DRAWING_UPLOAD_RULES.allowedMimeTypes.includes(actualMimeType)) {
    throw new Error('Invalid file type');
  }

  // 3. Check image dimensions
  const dimensions = await getImageDimensions(file.buffer);
  if (dimensions.width > DRAWING_UPLOAD_RULES.maxDimensions.width ||
      dimensions.height > DRAWING_UPLOAD_RULES.maxDimensions.height) {
    throw new Error('Image dimensions too large');
  }

  // 4. Scan for malware (async)
  await scanFile(file.buffer);

  // 5. Re-encode image to strip metadata and potential exploits
  const cleanBuffer = await reEncodeImage(file.buffer, 'png');
  return cleanBuffer;
}
```

**INPUT-2: 3D Model Parameter Validation**
```typescript
// Validate AI-generated parameters before creating mesh
interface ModelConstraints {
  maxVolumeMm3: number;        // Prevent giant models
  maxSurfaceAreaMm2: number;
  minWallThicknessMm: number;
  maxPieceCount: number;
  allowedDimensions: {
    maxX: number; // 210mm (A4 width)
    maxY: number; // 297mm (A4 length)
    maxZ: number; // 100mm (reasonable height)
  };
}

const CONSTRAINTS: ModelConstraints = {
  maxVolumeMm3: 500_000, // ~8cm cube
  maxSurfaceAreaMm2: 150_000,
  minWallThicknessMm: 2.0,
  maxPieceCount: 10,
  allowedDimensions: {
    maxX: 210,
    maxY: 297,
    maxZ: 100,
  },
};

function validateModelParameters(params: ModelParams): void {
  // Validate each parameter against constraints
  // Throw detailed error if validation fails
  // This prevents AI from generating unbounded/malicious models
}
```

**DATA-1: Signed URLs for File Access**
```typescript
// Never expose direct S3/Storage URLs
// Generate time-limited signed URLs

async function getDrawingUrl(
  projectId: string,
  pieceId: string,
  ctx: RequestContext
): Promise<string> {
  // 1. Authorize access
  if (!await authorize3DProject(ctx, projectId, 'read')) {
    throw new UnauthorizedError();
  }

  // 2. Generate signed URL (expires in 1 hour)
  const path = `3d-projects/${projectId}/pieces/${pieceId}/drawing.png`;
  const signedUrl = await storage.createSignedUrl(path, {
    expiresIn: 3600, // 1 hour
    action: 'read',
  });

  return signedUrl;
}

// Same pattern for STL files
async function getSTLDownloadUrl(
  projectId: string,
  ctx: RequestContext
): Promise<string> {
  // Only teachers can download STL files
  if (ctx.role !== 'TEACHER' && ctx.role !== 'WORKSHOP_ADMIN') {
    throw new ForbiddenError('Only teachers can download STL files');
  }

  // ... generate signed URL with short expiry
}
```

**SEC-1: Rate Limiting**
```typescript
// Prevent abuse of expensive operations
const RATE_LIMITS = {
  // AI processing is expensive
  '3d-generation': {
    maxRequestsPerHour: 20,    // Per child
    maxRequestsPerDay: 50,
  },

  // File uploads
  'drawing-upload': {
    maxRequestsPerHour: 30,
    maxFileSizePerDay: 100 * 1024 * 1024, // 100MB total
  },

  // STL downloads (teacher only)
  'stl-download': {
    maxRequestsPerHour: 100,   // Per teacher
  },
};

// Implement using Redis or Supabase functions
async function checkRateLimit(
  userId: string,
  action: string
): Promise<void> {
  const key = `ratelimit:${action}:${userId}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour window
  }

  const limit = RATE_LIMITS[action].maxRequestsPerHour;
  if (count > limit) {
    throw new RateLimitError(`Too many ${action} requests`);
  }
}
```

#### Security Compliance: 40% → Target: 95%

**Action Items**:
1. ✅ Define RBAC model (child/teacher/admin roles)
2. ✅ Implement row-level security in Supabase (follow existing RLS patterns)
3. ✅ Add file upload validation (mime type, size, dimensions, malware scan)
4. ✅ Use signed URLs for all file access (never direct S3 URLs)
5. ✅ Implement rate limiting on AI processing endpoints
6. ✅ Add audit logging for teacher actions (who approved what, when)
7. ✅ Encrypt STL files at rest (contains child's creative work - PII)
8. ⚠️ Consider COPPA compliance (children under 13)

---

### Principle 2: Clear API Contracts ⚠️ PARTIALLY DEFINED

#### Current State
- ✅ Data models defined in TypeScript interfaces
- ⚠️ API endpoints mentioned but not formally specified
- ❌ No error response format defined
- ❌ No versioning strategy
- ❌ No request validation schemas

#### Issues

**Issue 2.1: Undocumented API Endpoints**
The doc mentions endpoints like:
- `POST /api/v1/3d-projects/create`
- `POST /api/v1/3d-projects/:id/pieces/:pieceId/drawing`

But doesn't define:
- Request schemas
- Response schemas
- Error codes
- Authentication requirements
- Rate limits

**Issue 2.2: No Standardized Error Format**
Different parts of system will return errors differently, causing:
- Inconsistent UX (error messages vary)
- Difficult debugging (no correlation IDs)
- Poor monitoring (can't aggregate error types)

**Issue 2.3: Version Sprawl Risk**
Workshop might run over multiple weeks. If API changes between sessions:
- Child's project from Session 1 might break in Session 2
- Teachers get confused by different interfaces

#### Required API Contracts

**API-1: Standardized Request/Response**
```typescript
// Use Zod for runtime validation + TypeScript types
import { z } from 'zod';

// Request: Create new 3D project
export const Create3DProjectRequestSchema = z.object({
  character_id: z.string().uuid(),
  template_id: z.string().uuid(),
  workshop_id: z.string().uuid().optional(),
});

export type Create3DProjectRequest = z.infer<typeof Create3DProjectRequestSchema>;

// Response: Success
export const Create3DProjectResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    project_id: z.string().uuid(),
    character_name: z.string(),
    template_name: z.string(),
    piece_count: z.number(),
    status: z.enum(['drawing', 'review', 'approved', 'printing', 'completed']),
    created_at: z.string().datetime(),
  }),
});

export type Create3DProjectResponse = z.infer<typeof Create3DProjectResponseSchema>;

// Response: Error (standardized across ALL endpoints)
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),        // Machine-readable: 'UNAUTHORIZED', 'RATE_LIMIT_EXCEEDED'
    message: z.string(),     // Human-readable: 'You must be logged in'
    details: z.record(z.any()).optional(), // Field-specific errors
    request_id: z.string(),  // For support/debugging
    timestamp: z.string().datetime(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
```

**API-2: API Route Handler Pattern**
```typescript
// Standardized handler that enforces contracts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

interface APIHandlerOptions<TRequest, TResponse> {
  requestSchema: z.ZodType<TRequest>;
  responseSchema: z.ZodType<TResponse>;
  requireAuth: boolean;
  requiredRoles?: UserRole[];
  rateLimit?: string; // rate limit key
}

function createAPIHandler<TRequest, TResponse>(
  options: APIHandlerOptions<TRequest, TResponse>,
  handler: (req: TRequest, ctx: RequestContext) => Promise<TResponse>
) {
  return async (request: NextRequest) => {
    const requestId = generateRequestId();

    try {
      // 1. Authenticate
      let ctx: RequestContext | null = null;
      if (options.requireAuth) {
        ctx = await authenticate(request);
        if (!ctx) {
          return errorResponse('UNAUTHORIZED', 'Authentication required', requestId);
        }

        // 2. Authorize (check roles)
        if (options.requiredRoles && !options.requiredRoles.includes(ctx.role)) {
          return errorResponse('FORBIDDEN', 'Insufficient permissions', requestId);
        }
      }

      // 3. Rate limit
      if (options.rateLimit && ctx) {
        await checkRateLimit(ctx.user_id, options.rateLimit);
      }

      // 4. Parse and validate request
      const body = await request.json();
      const validatedRequest = options.requestSchema.parse(body);

      // 5. Execute handler
      const result = await handler(validatedRequest, ctx!);

      // 6. Validate and return response
      const validatedResponse = options.responseSchema.parse(result);
      return NextResponse.json(validatedResponse);

    } catch (error) {
      // Standardized error handling
      return handleAPIError(error, requestId);
    }
  };
}

// Usage example
export const POST = createAPIHandler({
  requestSchema: Create3DProjectRequestSchema,
  responseSchema: Create3DProjectResponseSchema,
  requireAuth: true,
  requiredRoles: ['CHILD', 'TEACHER'],
  rateLimit: '3d-project-create',
}, async (req, ctx) => {
  // Type-safe implementation
  const project = await createProject({
    character_id: req.character_id,
    template_id: req.template_id,
    creator_id: ctx.user_id,
    workshop_id: req.workshop_id,
  });

  return {
    success: true,
    data: {
      project_id: project.id,
      character_name: project.character_name,
      template_name: project.template_name,
      piece_count: project.pieces.length,
      status: project.status,
      created_at: project.created_at.toISOString(),
    },
  };
});
```

**API-3: Versioning Strategy**
```typescript
// File structure
/app/api/
  /v1/
    /3d-projects/
      /create/route.ts
      /[projectId]/
        /pieces/
          /[pieceId]/
            /drawing/route.ts
            /generate-3d/route.ts
        /export-stl/route.ts
  /v2/ (future)

// Version in URL, NOT headers (easier for workshops, clear in logs)
// Support v1 for at least 1 year after v2 release
```

**API-4: OpenAPI Documentation**
```yaml
# Generate from Zod schemas using zod-to-openapi
openapi: 3.0.0
info:
  title: KindleWood 3D Printing API
  version: 1.0.0

paths:
  /api/v1/3d-projects/create:
    post:
      summary: Create new 3D printable project
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Create3DProjectRequest'
      responses:
        200:
          description: Project created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Create3DProjectResponse'
        401:
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        429:
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

# Auto-generate TypeScript client for frontend
# Auto-generate documentation site for teachers/partners
```

#### API Contract Compliance: 30% → Target: 95%

**Action Items**:
1. ✅ Define all API endpoints with Zod schemas
2. ✅ Implement standardized error responses
3. ✅ Add request validation to all endpoints
4. ✅ Version API at /v1/ (allow future v2)
5. ✅ Generate OpenAPI documentation
6. ✅ Create TypeScript client library for frontend
7. ✅ Add request/response logging with correlation IDs

---

### Principle 3: Scalable Database Schema ✅ GOOD FOUNDATION, NEEDS REFINEMENT

#### Current State
- ✅ Well-designed TypeScript interfaces
- ✅ Proper foreign keys (character_id links to story character)
- ✅ Status enums for workflow
- ⚠️ Missing indexes
- ⚠️ No migration strategy defined
- ⚠️ Potential N+1 query issues

#### Schema Review

**GOOD: Core tables are well-designed**
```typescript
// Character3DProject - main entity
interface Character3DProject {
  id: string;                  // ✅ UUID primary key
  character_id: string;        // ✅ Foreign key to characters table
  template_id: string;         // ✅ Foreign key to templates
  status: ProjectStatus;       // ✅ Enum for workflow state
  created_at: Date;            // ✅ Timestamp
  session_1_completed_at?: Date; // ✅ Nullable for incomplete
}

// Piece - child entity
interface Piece {
  id: string;                  // ✅ UUID
  project_id: string;          // ✅ FK to Character3DProject (implicit)
  piece_number: number;        // ✅ Ordering
  drawing_image_url: string;   // ✅ External storage reference
  enhancements: Enhancement[]; // ⚠️ JSON array - see below
}
```

**ISSUE: Missing database constraints and indexes**

#### Required Schema Improvements

**SCHEMA-1: Full Database Schema with Constraints**
```sql
-- Migration: 20260129_create_3d_printing_tables.sql

-- Templates (predefined: dino, castle, rocket)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('creature', 'structure', 'vehicle')),
  description TEXT,
  piece_count INTEGER NOT NULL CHECK (piece_count BETWEEN 3 AND 10),
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template piece configurations
CREATE TABLE IF NOT EXISTS template_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  piece_number INTEGER NOT NULL CHECK (piece_number > 0),
  piece_type TEXT NOT NULL, -- 'body', 'head', 'leg', etc.
  display_name TEXT NOT NULL,
  drawing_prompt TEXT NOT NULL,
  reference_image_url TEXT,
  suggested_colors JSONB, -- array of color hex codes

  -- Connection points for assembly
  connection_points JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Constraints
  UNIQUE(template_id, piece_number),
  CHECK (jsonb_typeof(connection_points) = 'array')
);

-- 3D Projects (child's creation)
CREATE TABLE IF NOT EXISTS projects_3d (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workshop_id UUID REFERENCES workshops(id) ON DELETE SET NULL,

  -- Metadata
  character_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drawing'
    CHECK (status IN ('drawing', 'review', 'approved', 'printing', 'completed', 'failed')),

  -- Workflow timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_1_completed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id), -- teacher who approved
  reviewed_at TIMESTAMPTZ,
  session_2_completed_at TIMESTAMPTZ,

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CHECK (
    (status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    OR status != 'approved'
  )
);

-- Individual pieces (child's drawings + generated 3D models)
CREATE TABLE IF NOT EXISTS project_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  project_id UUID NOT NULL REFERENCES projects_3d(id) ON DELETE CASCADE,
  template_piece_id UUID NOT NULL REFERENCES template_pieces(id) ON DELETE RESTRICT,

  -- Piece info
  piece_number INTEGER NOT NULL CHECK (piece_number > 0),
  piece_type TEXT NOT NULL,

  -- Child's drawing
  drawing_image_url TEXT NOT NULL, -- Signed URL from Supabase Storage
  drawing_uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Generated 3D model
  model_3d_url TEXT, -- STL file URL
  model_preview_url TEXT, -- PNG thumbnail of 3D model
  model_generated_at TIMESTAMPTZ,

  -- Print metadata
  estimated_print_time_minutes INTEGER,
  estimated_filament_grams DECIMAL(6,2),
  print_status TEXT CHECK (print_status IN ('pending', 'printing', 'completed', 'failed')),
  printed_at TIMESTAMPTZ,

  -- Version tracking (if child redraws)
  version INTEGER DEFAULT 1,
  is_current_version BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(project_id, piece_number, is_current_version)
    WHERE is_current_version = true, -- Only one current version per piece
  CHECK (
    (model_3d_url IS NOT NULL AND model_generated_at IS NOT NULL)
    OR model_3d_url IS NULL
  )
);

-- AI enhancements applied to pieces (audit trail)
CREATE TABLE IF NOT EXISTS piece_enhancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id UUID NOT NULL REFERENCES project_pieces(id) ON DELETE CASCADE,

  enhancement_type TEXT NOT NULL
    CHECK (enhancement_type IN ('thickening', 'support_added', 'connection_point', 'smoothing')),
  location TEXT NOT NULL, -- Human-readable: "bottom left corner"
  reason TEXT NOT NULL,   -- Kid-friendly: "Made thicker so it won't break!"

  -- Technical details (for debugging)
  parameters JSONB,

  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assembly instructions (generated per project)
CREATE TABLE IF NOT EXISTS assembly_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects_3d(id) ON DELETE CASCADE,

  step_number INTEGER NOT NULL CHECK (step_number > 0),
  instruction_text TEXT NOT NULL,
  illustration_url TEXT, -- Image showing how to connect pieces

  piece_a_id UUID NOT NULL REFERENCES project_pieces(id),
  piece_b_id UUID REFERENCES project_pieces(id), -- Nullable for first piece

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, step_number)
);

-- Print jobs (for workshop management)
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects_3d(id) ON DELETE CASCADE,

  -- Which printer / batch
  printer_id TEXT, -- e.g., "workshop-1-printer-a"
  batch_id UUID,   -- Group multiple projects printed overnight

  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'printing', 'completed', 'failed', 'cancelled')),

  -- Timing
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Failure tracking
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Operator notes
  notes TEXT,
  operator_id UUID REFERENCES auth.users(id), -- Teacher who started print

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_projects_3d_creator ON projects_3d(creator_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_3d_workshop ON projects_3d(workshop_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_3d_status ON projects_3d(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_3d_character ON projects_3d(character_id);

CREATE INDEX idx_project_pieces_project ON project_pieces(project_id);
CREATE INDEX idx_project_pieces_current ON project_pieces(project_id, is_current_version)
  WHERE is_current_version = true;

CREATE INDEX idx_piece_enhancements_piece ON piece_enhancements(piece_id);

CREATE INDEX idx_print_jobs_status ON print_jobs(status) WHERE status != 'completed';
CREATE INDEX idx_print_jobs_batch ON print_jobs(batch_id) WHERE batch_id IS NOT NULL;

-- Row-Level Security (follow existing Supabase patterns)
ALTER TABLE projects_3d ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE piece_enhancements ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Children can only see their own projects
CREATE POLICY "children_own_projects" ON projects_3d
  FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "children_create_projects" ON projects_3d
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "children_update_own_projects" ON projects_3d
  FOR UPDATE
  USING (auth.uid() = creator_id AND status IN ('drawing', 'review'));

-- RLS Policies: Teachers can see projects in their workshops
CREATE POLICY "teachers_workshop_projects" ON projects_3d
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workshop_teachers wt
      WHERE wt.workshop_id = projects_3d.workshop_id
        AND wt.teacher_id = auth.uid()
    )
  );

CREATE POLICY "teachers_approve_projects" ON projects_3d
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workshop_teachers wt
      WHERE wt.workshop_id = projects_3d.workshop_id
        AND wt.teacher_id = auth.uid()
    )
  )
  WITH CHECK (status IN ('approved', 'printing', 'completed', 'failed'));

-- Similar RLS for other tables...

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_3d_updated_at BEFORE UPDATE ON projects_3d
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_pieces_updated_at BEFORE UPDATE ON project_pieces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update project status when all pieces have 3D models
CREATE OR REPLACE FUNCTION check_project_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- If all pieces have 3D models generated, mark as ready for review
  IF (
    SELECT COUNT(*)
    FROM project_pieces
    WHERE project_id = NEW.project_id
      AND is_current_version = true
      AND model_3d_url IS NULL
  ) = 0 THEN
    UPDATE projects_3d
    SET status = 'review'
    WHERE id = NEW.project_id AND status = 'drawing';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER piece_model_generated AFTER UPDATE ON project_pieces
  FOR EACH ROW
  WHEN (OLD.model_3d_url IS NULL AND NEW.model_3d_url IS NOT NULL)
  EXECUTE FUNCTION check_project_completion();
```

**SCHEMA-2: Migration Strategy**
```typescript
// Follow existing Supabase migration pattern
// Migrations in: storyme-app/supabase/migrations/

// File naming: 20260129_create_3d_printing_tables.sql
// Incremental changes: 20260205_add_print_job_priority.sql

// Always:
// - Write UP migration (create tables)
// - Write DOWN migration (drop tables) for rollback
// - Test locally before production
// - Run migrations during low-traffic windows
```

**SCHEMA-3: Query Optimization**
```typescript
// BAD: N+1 query problem
async function getProjectsForWorkshop(workshopId: string) {
  const projects = await db.query('SELECT * FROM projects_3d WHERE workshop_id = $1', [workshopId]);

  for (const project of projects) {
    // N additional queries!
    project.pieces = await db.query('SELECT * FROM project_pieces WHERE project_id = $1', [project.id]);
  }

  return projects;
}

// GOOD: Single query with JOIN
async function getProjectsForWorkshop(workshopId: string) {
  const result = await db.query(`
    SELECT
      p.*,
      json_agg(
        json_build_object(
          'id', pp.id,
          'piece_number', pp.piece_number,
          'drawing_image_url', pp.drawing_image_url,
          'model_3d_url', pp.model_3d_url,
          'print_status', pp.print_status
        ) ORDER BY pp.piece_number
      ) AS pieces
    FROM projects_3d p
    LEFT JOIN project_pieces pp ON pp.project_id = p.id AND pp.is_current_version = true
    WHERE p.workshop_id = $1
      AND p.deleted_at IS NULL
    GROUP BY p.id
  `, [workshopId]);

  return result.rows;
}
```

#### Database Schema Compliance: 70% → Target: 95%

**Action Items**:
1. ✅ Create full SQL migration with constraints
2. ✅ Add proper indexes for common queries
3. ✅ Implement Row-Level Security policies
4. ✅ Add database triggers for workflow automation
5. ✅ Version piece drawings (allow child to iterate)
6. ✅ Add print job tracking table
7. ✅ Optimize queries to avoid N+1 problems
8. ✅ Add soft delete support (deleted_at instead of hard delete)

---

### Principle 4: Reusable Components ✅ GOOD APPROACH

#### Current State
- ✅ Plans to reuse Fabric.js drawing canvas from character creation
- ✅ Reuse Supabase storage pattern
- ✅ Separate concerns (drawing UI, 3D viewer, AI processing)
- ⚠️ Need to ensure components are truly decoupled

#### Component Architecture

**COMP-1: Reusable Drawing Canvas Component**
```typescript
// components/3d-modeling/DrawingCanvas.tsx
// This should be generic enough to reuse elsewhere

interface DrawingCanvasProps {
  width: number;
  height: number;
  backgroundColor?: string;
  referenceImage?: string; // Show as overlay/guide
  onSave: (imageData: ImageData) => Promise<void>;
  onCancel?: () => void;
  tools?: DrawingTool[]; // Customize which tools available
  maxUndoSteps?: number;
}

export function DrawingCanvas(props: DrawingCanvasProps) {
  // Wrap Fabric.js in React component
  // Handle touch events for tablets
  // Provide undo/redo
  // Export as PNG/JPEG

  // IMPORTANT: No 3D-specific logic here
  // Just a generic kid-friendly drawing interface
}

// Usage in 3D feature
<DrawingCanvas
  width={800}
  height={600}
  referenceImage={templatePiece.reference_image_url}
  onSave={async (imageData) => {
    await uploadDrawing(projectId, pieceId, imageData);
  }}
  tools={['brush', 'eraser', 'colorPicker', 'undo', 'redo']}
/>

// Can also use in character creation, scene drawing, etc.
```

**COMP-2: Reusable 3D Viewer Component**
```typescript
// components/3d-modeling/Model3DViewer.tsx

interface Model3DViewerProps {
  modelUrl: string; // URL to STL file
  width?: number;
  height?: number;
  allowRotation?: boolean;
  allowZoom?: boolean;
  backgroundColor?: string;
  highlightConnectionPoints?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function Model3DViewer(props: Model3DViewerProps) {
  // Wrap Three.js
  // Load STL file
  // Render with simple controls

  // Reusable for:
  // - Piece preview after drawing
  // - Assembly instructions
  // - Teacher review interface
  // - Future: product previews, AR mode, etc.
}
```

**COMP-3: Reusable File Upload**
```typescript
// lib/storage/uploadFile.ts
// Already exists in KindleWood, extend for drawings

interface UploadOptions {
  bucket: string;
  path: string;
  file: File | Blob;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  onProgress?: (percent: number) => void;
}

export async function uploadFile(options: UploadOptions): Promise<string> {
  // Validate file
  // Upload to Supabase Storage
  // Return public URL or signed URL

  // Used for:
  // - Drawing uploads
  // - STL uploads (teacher override)
  // - Reference images
  // - Assembly instruction images
}
```

#### Component Reusability: 80% → Target: 95%

**Action Items**:
1. ✅ Extract drawing canvas as generic component
2. ✅ Extract 3D viewer as generic component
3. ✅ Share file upload utilities across features
4. ✅ Create shared workshop UI components (progress indicators, step wizards)
5. ✅ Document component APIs for future reuse

---

### Principle 5: Reuse Before Rebuild ⚠️ NEEDS EVALUATION

#### Current State
- ⚠️ Suggests building custom 2D→3D conversion (complex!)
- ⚠️ Suggests custom mesh generation (very complex!)
- ⚠️ May be reinventing wheels that already exist

#### Technology Evaluation

**DECISION POINT: 2D → 3D Conversion**

**Option A: Build Custom (Original Plan)**
- ❌ Extremely complex (6-12 months of work)
- ❌ Requires 3D graphics expertise
- ❌ High risk of poor results
- ❌ Ongoing maintenance burden
- ✅ Full control over output
- ✅ No external dependencies

**Option B: Use Existing AI Services** ⭐ RECOMMENDED
- ✅ Much faster to implement (2-4 weeks)
- ✅ Proven technology
- ✅ Continually improving
- ✅ Handles edge cases better
- ⚠️ Costs per API call
- ⚠️ Less control over output
- ⚠️ Vendor lock-in risk

**Services to Evaluate**:
1. **Meshy.ai** - Image to 3D model API
   - Input: 2D image
   - Output: 3D mesh (glTF, OBJ, STL)
   - Quality: High
   - Cost: ~$0.10-0.50 per conversion
   - Pros: Specialized for this exact use case
   - Cons: Startup, could shut down

2. **CSM (Common Sense Machines)** - 3D reconstruction API
   - Similar to Meshy
   - Good for objects/characters
   - Cost: ~$0.20 per conversion

3. **OpenAI Shap-E** - Open source 2D→3D
   - Self-hosted (no per-use cost)
   - Lower quality than commercial
   - Requires GPU servers
   - Pros: Free, controllable
   - Cons: Need infrastructure, quality issues

4. **Rule-Based Extrusion** (Simplest approach) ⭐ RECOMMENDED FOR MVP
   - Detect edges in 2D drawing (OpenCV)
   - Extrude to fixed depth (e.g., 10mm)
   - Add bevels/rounded edges
   - Generate connection points based on template
   - Much simpler than full 3D reconstruction
   - Pros: Predictable, fast, cheap
   - Cons: Less sophisticated (but may be fine for kids' drawings!)

**RECOMMENDATION**:
- **Phase 0/MVP**: Rule-based extrusion (cheap, fast, good enough)
- **Phase 2**: Evaluate AI services if quality insufficient
- **Never**: Build custom 3D reconstruction from scratch

**DECISION POINT: STL File Generation**

**Option A: Use trimesh library (Python)** ⭐ RECOMMENDED
- ✅ Mature, well-tested
- ✅ Purpose-built for 3D mesh operations
- ✅ Handles STL export, repair, validation
- ✅ Open source, free
- ✅ Good documentation

**Option B: Build custom STL generator**
- ❌ Reinventing wheel
- ❌ STL format has edge cases
- ❌ Need to handle mesh errors (non-manifold, etc.)

**RECOMMENDATION**: Definitely use trimesh, don't rebuild.

**DECISION POINT: Drawing Interface**

**Option A: Fabric.js** ⭐ RECOMMENDED
- ✅ Already familiar (use in character creation?)
- ✅ Canvas-based, performant
- ✅ Good touch support
- ✅ Active development

**Option B: Konva.js**
- ✅ Similar to Fabric.js
- ✅ React integration
- ⚠️ Learn new library

**Option C: Excalidraw**
- ✅ Beautiful UX
- ⚠️ More for diagrams than freehand drawing
- ⚠️ May be too complex for 5-8 year olds

**RECOMMENDATION**: Stick with Fabric.js if already using it, otherwise Konva.js.

**DECISION POINT: 3D Viewer**

**Option A: Three.js** ⭐ RECOMMENDED
- ✅ Industry standard
- ✅ Huge ecosystem
- ✅ Great docs
- ✅ Works everywhere (WebGL)

**Option B: Babylon.js**
- ✅ Similar to Three.js
- ✅ Microsoft-backed
- ⚠️ Larger bundle size

**Option C: Model-Viewer (Google)**
- ✅ Web component, very simple
- ✅ AR support built-in
- ⚠️ Less customizable

**RECOMMENDATION**: Three.js for full control, Model-Viewer if want simple/AR.

#### Reuse Compliance: 40% → Target: 90%

**Action Items**:
1. ✅ Use rule-based extrusion for MVP (don't build complex 3D reconstruction)
2. ✅ Evaluate Meshy.ai or CSM for Phase 2 if needed
3. ✅ Use trimesh library for STL generation (don't build custom)
4. ✅ Use existing drawing library (Fabric.js or Konva.js)
5. ✅ Use Three.js for 3D viewer (industry standard)
6. ✅ Use OpenCV for image processing (don't build custom computer vision)
7. ❌ Don't build custom mesh repair tools (use existing)

---

### Principle 6: Separation of Concerns ✅ MOSTLY GOOD

#### Current State
- ✅ Separate UI, API, AI processing layers mentioned
- ✅ Data models separated from business logic
- ⚠️ Need to ensure clean boundaries

#### Architecture Layers

**LAYER-1: Presentation Layer (UI Components)**
```
components/3d-modeling/
  ├── DrawingCanvas.tsx          # Generic drawing interface
  ├── Model3DViewer.tsx          # Generic 3D viewer
  ├── ProjectWizard.tsx          # Step-by-step workflow
  ├── PieceDrawingStep.tsx       # Single piece drawing UI
  ├── AssemblyInstructions.tsx   # Visual assembly guide
  └── TeacherReviewDashboard.tsx # Teacher approval interface

app/3d-projects/
  ├── page.tsx                   # Project list
  ├── [projectId]/
  │   ├── page.tsx               # Project detail
  │   ├── draw/page.tsx          # Drawing session
  │   └── review/page.tsx        # Review/preview
  └── new/page.tsx               # Create project

# UI components should:
# - NOT contain business logic
# - NOT make database calls directly
# - Call service layer functions
# - Handle user interactions and display
```

**LAYER-2: API Layer (Next.js Routes)**
```
app/api/v1/3d-projects/
  ├── create/route.ts                    # POST /api/v1/3d-projects/create
  ├── [projectId]/
  │   ├── route.ts                       # GET/PUT/DELETE /api/v1/3d-projects/:id
  │   ├── pieces/
  │   │   ├── [pieceId]/
  │   │   │   ├── drawing/route.ts       # POST upload drawing
  │   │   │   └── generate-3d/route.ts   # POST trigger 3D generation
  │   ├── approve/route.ts               # POST teacher approval
  │   └── export-stl/route.ts            # GET download STL files

# API routes should:
# - Validate input (Zod schemas)
# - Authenticate/authorize
# - Call service layer
# - Return standardized responses
# - NOT contain business logic
```

**LAYER-3: Service Layer (Business Logic)**
```
lib/3d-modeling/
  ├── projectService.ts          # Project CRUD operations
  ├── pieceService.ts            # Piece management
  ├── generationService.ts       # Orchestrates 2D→3D conversion
  ├── assemblyService.ts         # Assembly instruction generation
  ├── printService.ts            # Print job management
  └── templateService.ts         # Template management

# Example service
// lib/3d-modeling/generationService.ts
export class GenerationService {
  async generatePiece3DModel(
    pieceId: string,
    drawingImageUrl: string,
    templateConfig: PieceConfig
  ): Promise<Generated3DModel> {
    // 1. Download drawing image
    const imageBuffer = await this.storageService.download(drawingImageUrl);

    // 2. Process image (extract contours, clean up)
    const processedImage = await this.imageProcessor.process(imageBuffer);

    // 3. Generate 3D mesh
    const mesh = await this.meshGenerator.extrude(processedImage, templateConfig);

    // 4. Add connection points
    const meshWithConnections = await this.meshGenerator.addConnectionPoints(
      mesh,
      templateConfig.connection_points
    );

    // 5. Validate printability
    const enhancements = await this.validator.ensurePrintable(meshWithConnections);

    // 6. Export to STL
    const stlBuffer = await this.stlExporter.export(meshWithConnections);

    // 7. Upload STL
    const stlUrl = await this.storageService.upload(stlBuffer, `pieces/${pieceId}/model.stl`);

    // 8. Generate preview image
    const previewBuffer = await this.renderer.renderPreview(meshWithConnections);
    const previewUrl = await this.storageService.upload(previewBuffer, `pieces/${pieceId}/preview.png`);

    // 9. Record enhancements
    await this.enhancementService.recordEnhancements(pieceId, enhancements);

    return {
      stl_url: stlUrl,
      preview_url: previewUrl,
      enhancements,
      print_time_estimate: this.estimator.calculatePrintTime(meshWithConnections),
      filament_estimate: this.estimator.calculateFilament(meshWithConnections),
    };
  }
}

# Services should:
# - Contain business logic
# - Orchestrate multiple data operations
# - Call data layer (repositories)
# - Call external services (AI, storage)
# - Be testable (dependency injection)
```

**LAYER-4: Data Layer (Repositories)**
```
lib/3d-modeling/repositories/
  ├── projectRepository.ts       # Database operations for projects
  ├── pieceRepository.ts         # Database operations for pieces
  ├── templateRepository.ts      # Database operations for templates
  └── printJobRepository.ts      # Database operations for print jobs

# Example repository
// lib/3d-modeling/repositories/projectRepository.ts
export class ProjectRepository {
  constructor(private db: SupabaseClient) {}

  async create(data: CreateProjectData): Promise<Project> {
    const { data: project, error } = await this.db
      .from('projects_3d')
      .insert({
        character_id: data.character_id,
        template_id: data.template_id,
        creator_id: data.creator_id,
        workshop_id: data.workshop_id,
        character_name: data.character_name,
        status: 'drawing',
      })
      .select()
      .single();

    if (error) throw new DatabaseError(error);
    return project;
  }

  async findById(id: string): Promise<Project | null> {
    const { data, error } = await this.db
      .from('projects_3d')
      .select(`
        *,
        pieces:project_pieces(*)
      `)
      .eq('id', id)
      .eq('pieces.is_current_version', true)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data;
  }

  // ... other CRUD operations
}

# Repositories should:
# - Only talk to database
# - No business logic
# - Return domain models
# - Handle database errors
```

**LAYER-5: External Services Layer**
```
lib/3d-modeling/external/
  ├── meshGenerator.ts           # 2D→3D conversion (calls Python service or AI API)
  ├── imageProcessor.ts          # Image processing (OpenCV)
  ├── stlExporter.ts             # STL file generation
  ├── storageService.ts          # Supabase Storage wrapper
  └── renderService.ts           # 3D preview rendering

# Example external service
// lib/3d-modeling/external/meshGenerator.ts
export class MeshGenerator {
  private pythonServiceUrl: string;

  async extrude(
    imageData: ImageData,
    config: ExtrusionConfig
  ): Promise<Mesh3D> {
    // Call Python microservice that uses OpenCV + trimesh
    const response = await fetch(`${this.pythonServiceUrl}/generate-mesh`, {
      method: 'POST',
      body: JSON.stringify({
        image: imageData.base64,
        extrusion_depth_mm: config.depth_mm || 10,
        wall_thickness_mm: config.min_wall_thickness || 2.5,
        smoothing: config.smoothing || 'medium',
      }),
    });

    if (!response.ok) {
      throw new MeshGenerationError(await response.text());
    }

    const mesh = await response.json();
    return mesh;
  }
}

# External services should:
# - Wrap external APIs/services
# - Handle network errors
# - Retry logic
# - Rate limiting
# - Circuit breakers (if service down)
```

#### Separation of Concerns: 75% → Target: 95%

**Action Items**:
1. ✅ Strict layer separation (UI → API → Service → Repository)
2. ✅ No business logic in API routes (move to services)
3. ✅ No database calls in UI components (use API)
4. ✅ Use dependency injection for testability
5. ✅ Create clear interfaces between layers

---

### Principle 7: Prefer Stateless Services ✅ GOOD, NEEDS CLARIFICATION

#### Current State
- ✅ Mentions state in database
- ✅ Workflow status stored in DB
- ⚠️ Need to ensure processing jobs are stateless

#### Stateless Architecture

**STATE-1: No Server-Side Session State**
```typescript
// BAD: Storing state in server memory
const activeProjects = new Map<string, Project>(); // ❌ Lost on server restart

app.post('/api/v1/3d-projects/:id/pieces/:pieceId/generate-3d', async (req, res) => {
  const project = activeProjects.get(req.params.id); // ❌ Won't work with multiple servers
  // ...
});

// GOOD: State in database
app.post('/api/v1/3d-projects/:id/pieces/:pieceId/generate-3d', async (req, res) => {
  const project = await projectRepository.findById(req.params.id); // ✅ Stateless
  // ...
});
```

**STATE-2: Async Processing with Job Queue**
```typescript
// 3D generation takes time (10-60 seconds)
// Don't block API request

// BAD: Synchronous processing
app.post('/api/v1/3d-projects/:id/pieces/:pieceId/generate-3d', async (req, res) => {
  const result = await generateMesh(pieceId); // ❌ Client waits 60 seconds
  res.json(result);
});

// GOOD: Async job queue
app.post('/api/v1/3d-projects/:id/pieces/:pieceId/generate-3d', async (req, res) => {
  // 1. Enqueue job
  const jobId = await jobQueue.enqueue('generate-3d-mesh', {
    piece_id: pieceId,
    drawing_url: drawingUrl,
  });

  // 2. Update piece status
  await pieceRepository.update(pieceId, {
    model_generation_status: 'processing',
    model_generation_job_id: jobId,
  });

  // 3. Return immediately
  res.json({
    success: true,
    status: 'processing',
    job_id: jobId,
    estimated_completion_seconds: 30,
  });
});

// Job processor (separate process/function)
jobQueue.process('generate-3d-mesh', async (job) => {
  const { piece_id, drawing_url } = job.data;

  try {
    // Generate mesh
    const result = await generationService.generatePiece3DModel(piece_id, drawing_url);

    // Update database
    await pieceRepository.update(piece_id, {
      model_3d_url: result.stl_url,
      model_preview_url: result.preview_url,
      model_generation_status: 'completed',
      model_generated_at: new Date(),
    });

    // Notify child (WebSocket or polling)
    await notificationService.notify(piece.creator_id, {
      type: '3d_model_ready',
      piece_id: piece_id,
    });

  } catch (error) {
    // Update database with error
    await pieceRepository.update(piece_id, {
      model_generation_status: 'failed',
      model_generation_error: error.message,
    });

    // Retry or notify teacher
  }
});
```

**STATE-3: Use Supabase Realtime for Progress Updates**
```typescript
// Frontend: Subscribe to piece updates
const subscription = supabase
  .channel(`piece-${pieceId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'project_pieces',
      filter: `id=eq.${pieceId}`,
    },
    (payload) => {
      // Update UI when model_3d_url changes
      if (payload.new.model_3d_url) {
        showModelPreview(payload.new.model_3d_url);
      }
    }
  )
  .subscribe();

// No polling needed!
// Database update triggers real-time notification
```

**STATE-4: Job Queue Options**

**Option A: Supabase Edge Functions + pg_cron** ⭐ RECOMMENDED
- Use existing Supabase infrastructure
- Edge Functions for job processing
- pg_cron for scheduling/retry
- Pros: No new infrastructure, integrated
- Cons: Less feature-rich than dedicated queue

**Option B: BullMQ (Redis-based)**
- Popular job queue for Node.js
- Great retries, monitoring, rate limiting
- Pros: Feature-rich, mature
- Cons: Need Redis server

**Option C: Cloud Tasks (GCP) or SQS (AWS)**
- Managed queue service
- Highly scalable
- Pros: No infrastructure management
- Cons: Vendor lock-in, costs

**RECOMMENDATION**: Start with Supabase Edge Functions, migrate to BullMQ if needed.

#### Stateless Service Compliance: 80% → Target: 95%

**Action Items**:
1. ✅ No server-side session state (store in database)
2. ✅ Async job queue for 3D generation
3. ✅ Use Supabase Realtime for progress updates
4. ✅ Stateless API handlers (can run on multiple servers)
5. ✅ Job retries handled by queue (not in-memory)

---

### Principle 8: Responsive & Accessible UI ⚠️ NEEDS ATTENTION

#### Current State
- ⚠️ Mentions "touch-friendly" but no responsive design strategy
- ❌ No accessibility considerations mentioned
- ❌ No keyboard navigation for 3D viewer
- ❌ No screen reader support

#### Accessibility Requirements

**A11Y-1: Responsive Design**
```typescript
// Drawing canvas must work on:
// - Desktop (mouse)
// - Tablet (touch, primary device in workshops)
// - Phone (smaller screen, backup)

// Use responsive breakpoints
const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
};

// Drawing canvas adapts to screen size
<DrawingCanvas
  width={isMobile ? '100%' : 800}
  height={isMobile ? 'calc(100vh - 200px)' : 600}
  touchOptimized={isMobile || isTablet}
/>
```

**A11Y-2: Keyboard Navigation**
```typescript
// 3D viewer must be keyboard-accessible
<Model3DViewer
  modelUrl={stlUrl}
  keyboardControls={{
    rotate: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
    zoom: ['+', '-'],
    reset: ['r'],
  }}
  ariaLabel={`3D model of ${pieceName}`}
/>

// Drawing canvas
<DrawingCanvas
  keyboardShortcuts={{
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    clear: 'Ctrl+Shift+X',
  }}
/>
```

**A11Y-3: Screen Reader Support**
```tsx
// Provide text alternatives for visual content
<div role="region" aria-label="Drawing canvas">
  <DrawingCanvas {...props} />
  <div className="sr-only">
    Drawing piece {pieceNumber} of {totalPieces}: {pieceName}.
    Current tool: {currentTool}.
    Instructions: {drawingPrompt}
  </div>
</div>

// 3D model preview
<div>
  <Model3DViewer modelUrl={stlUrl} />
  <p className="sr-only">
    3D model preview showing {pieceName} from your drawing.
    Estimated print time: {printTime} minutes.
  </p>
</div>

// Assembly instructions
<ol aria-label="Assembly steps">
  {steps.map((step, index) => (
    <li key={index}>
      <img src={step.illustration_url} alt={step.instruction_text} />
      <p>{step.instruction_text}</p>
    </li>
  ))}
</ol>
```

**A11Y-4: Color Contrast & Font Sizes**
```css
/* WCAG AAA compliance */
/* Minimum contrast ratio: 7:1 for normal text, 4.5:1 for large text */

.drawing-prompt {
  font-size: 1.25rem; /* 20px - large enough for kids */
  line-height: 1.5;
  color: #1a1a1a; /* Dark text */
  background: #ffffff; /* White background */
  /* Contrast ratio: 21:1 ✓ */
}

.button-primary {
  font-size: 1.125rem; /* 18px */
  font-weight: 600;
  padding: 0.75rem 1.5rem; /* Large touch target */
  min-height: 44px; /* iOS touch target minimum */
  min-width: 44px;
}
```

**A11Y-5: Error Messages**
```tsx
// Accessible error display
{error && (
  <div
    role="alert"
    aria-live="assertive"
    className="error-message"
  >
    <strong>Error:</strong> {error.message}
    {error.helpText && <p>{error.helpText}</p>}
  </div>
)}

// Form validation
<label htmlFor="project-name">
  Project Name
  <span aria-label="required" className="required">*</span>
</label>
<input
  id="project-name"
  required
  aria-required="true"
  aria-invalid={errors.name ? 'true' : 'false'}
  aria-describedby={errors.name ? 'name-error' : undefined}
/>
{errors.name && (
  <span id="name-error" className="error">
    {errors.name.message}
  </span>
)}
```

**A11Y-6: Progress Indicators**
```tsx
// Visual + screen reader progress
<div
  role="progressbar"
  aria-valuenow={currentPiece}
  aria-valuemin={1}
  aria-valuemax={totalPieces}
  aria-label={`Drawing progress: piece ${currentPiece} of ${totalPieces}`}
>
  <div className="progress-bar">
    <div
      className="progress-fill"
      style={{ width: `${(currentPiece / totalPieces) * 100}%` }}
    />
  </div>
  <span className="progress-text">
    Piece {currentPiece} of {totalPieces}
  </span>
</div>
```

#### Responsive & Accessible Compliance: 30% → Target: 90%

**Action Items**:
1. ✅ Responsive design for mobile/tablet/desktop
2. ✅ Touch-optimized drawing canvas (44px min touch targets)
3. ✅ Keyboard navigation for all interactive elements
4. ✅ Screen reader support (ARIA labels, roles)
5. ✅ WCAG AA color contrast minimum (AAA preferred)
6. ✅ Large, readable fonts for kids (min 16px, prefer 18-20px)
7. ✅ Error messages with aria-live regions
8. ✅ Test with actual screen readers (NVDA, JAWS, VoiceOver)

---

## Additional Risks Not Covered by Principles

### Risk 8: Data Loss During Workshops ⚠️ HIGH IMPACT

**Scenario**:
- Child spends 45 minutes drawing pieces
- Browser crashes, tablet runs out of battery, WiFi drops
- All work lost
- Child devastated

**Mitigation**:
```typescript
// AUTO-SAVE every 30 seconds
useEffect(() => {
  const autoSave = setInterval(async () => {
    if (hasUnsavedChanges) {
      await saveDraft(pieceId, canvasData);
      setHasUnsavedChanges(false);
    }
  }, 30_000); // 30 seconds

  return () => clearInterval(autoSave);
}, [hasUnsavedChanges, pieceId, canvasData]);

// SAVE ON VISIBILITY CHANGE (user switches tabs)
useEffect(() => {
  const handleVisibilityChange = async () => {
    if (document.hidden && hasUnsavedChanges) {
      await saveDraft(pieceId, canvasData);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [hasUnsavedChanges]);

// OFFLINE SUPPORT (Service Worker + IndexedDB)
// If WiFi drops, save locally, sync when reconnected
```

### Risk 9: Print File Corruption ⚠️ MEDIUM IMPACT

**Scenario**: STL file gets corrupted during generation/upload, printer can't read it

**Mitigation**:
```typescript
// Validate STL file before saving
import { validateSTL } from 'stl-validator';

async function exportSTL(mesh: Mesh3D): Promise<Buffer> {
  const stlBuffer = await meshToSTL(mesh);

  // Validate STL
  const validation = validateSTL(stlBuffer);
  if (!validation.valid) {
    throw new STLValidationError(validation.errors);
  }

  // Check for common issues
  if (!validation.isManifold) {
    // Attempt auto-repair
    stlBuffer = await repairMesh(stlBuffer);
  }

  return stlBuffer;
}
```

### Risk 10: Workshop Scaling Issues ⚠️ MEDIUM IMPACT

**Scenario**: 20 kids all generating 3D models simultaneously, server overloads

**Mitigation**:
```typescript
// Job queue with concurrency limits
const queue = new BullMQ('3d-generation', {
  concurrency: 5, // Max 5 generations at once
  limiter: {
    max: 10,      // Max 10 jobs per minute
    duration: 60000,
  },
});

// Priority for teacher review (more urgent than generation)
await queue.add('generate-mesh', { piece_id }, {
  priority: currentTime - createdTime, // FIFO
});

// Monitor queue depth
if (queue.waiting() > 50) {
  alert('System busy, estimated wait time: 10 minutes');
}
```

---

## Revised Technology Stack Recommendations

### Frontend
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | **Next.js 15 (App Router)** | ✅ Already using, SSR, API routes |
| UI Library | **React 19** | ✅ Already using |
| Styling | **Tailwind CSS 4** | ✅ Already using, utility-first |
| Drawing Canvas | **Konva.js** ⭐ NEW | Touch-optimized, React integration |
| 3D Viewer | **Three.js** | Industry standard, huge ecosystem |
| Form Validation | **Zod + React Hook Form** | ✅ Already using, type-safe |
| State Management | **React Context + Zustand** | Simple, no Redux needed |
| Real-time Updates | **Supabase Realtime** | ✅ Already using, WebSocket-based |

### Backend
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| API | **Next.js API Routes** | ✅ Already using, serverless |
| Database | **Supabase (PostgreSQL)** | ✅ Already using, RLS built-in |
| Storage | **Supabase Storage** | ✅ Already using, S3-compatible |
| Auth | **Supabase Auth** | ✅ Already using, RBAC support |
| Job Queue | **Supabase Edge Functions + pg_cron** ⭐ | No new infra, or BullMQ if scaling |
| Rate Limiting | **Upstash Redis** | Serverless Redis, pay-per-use |

### AI/Processing
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| 2D→3D (MVP) | **Custom extrusion (OpenCV + trimesh)** ⭐ | Simple, predictable, free |
| 2D→3D (Phase 2) | **Meshy.ai API** | Evaluate if MVP quality insufficient |
| Image Processing | **OpenCV (Python)** | Industry standard, mature |
| STL Generation | **trimesh (Python)** | Purpose-built, handles edge cases |
| Mesh Validation | **trimesh.repair** | Auto-fix common STL issues |
| 3D Preview Render | **Three.js (client-side)** | No server needed, instant |

### Infrastructure
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Hosting | **Vercel** | ✅ Likely already using for Next.js |
| Python Services | **Vercel Serverless Functions (Python)** | Same platform, simple deployment |
| Monitoring | **Sentry** | Error tracking, performance |
| Analytics | **Plausible or PostHog** | Privacy-friendly, COPPA compliant |
| Logging | **Axiom or Datadog** | Centralized logging |

---

## Cost Estimates (Per Child/Project)

### MVP (Rule-Based Extrusion)
- Image upload storage: $0.001
- 3D processing (serverless function): $0.005
- STL file storage: $0.002
- Database operations: $0.001
- **Total: ~$0.01 per project** ✅ Very affordable

### Phase 2 (AI-Based Reconstruction)
- Meshy.ai API: $0.10-0.50 per piece × 4 pieces = $0.40-2.00
- Other costs: $0.01
- **Total: ~$0.41-2.01 per project** ⚠️ 40-200x more expensive

### Recommendation
**Start with MVP**. If 100 kids use it:
- MVP cost: $1.00 total
- AI cost: $41-201 total

Validate with cheap MVP, upgrade to AI only if quality demands it.

---

## Summary & Recommendations

### Compliance Scorecard

| Principle | Current | Target | Priority |
|-----------|---------|--------|----------|
| 1. Security by Default | 40% | 95% | 🔴 CRITICAL |
| 2. Clear API Contracts | 30% | 95% | 🟡 HIGH |
| 3. Scalable Database Schema | 70% | 95% | 🟡 HIGH |
| 4. Reusable Components | 80% | 95% | 🟢 MEDIUM |
| 5. Reuse Before Rebuild | 40% | 90% | 🟡 HIGH |
| 6. Separation of Concerns | 75% | 95% | 🟢 MEDIUM |
| 7. Prefer Stateless Services | 80% | 95% | 🟢 MEDIUM |
| 8. Responsive & Accessible UI | 30% | 90% | 🟡 HIGH |

### Critical Action Items (Must Do Before Phase 1)

1. **SECURITY** 🔴
   - Define RBAC model (child/teacher/admin)
   - Implement RLS policies in Supabase
   - Add file upload validation
   - Use signed URLs for file access
   - Implement rate limiting

2. **API CONTRACTS** 🟡
   - Define all endpoints with Zod schemas
   - Standardize error responses
   - Version API at /v1/
   - Add request validation

3. **DATABASE** 🟡
   - Create full migration with constraints
   - Add indexes for performance
   - Implement soft deletes
   - Add version tracking for pieces

4. **ARCHITECTURE** 🟡
   - Use rule-based extrusion for MVP (don't build complex AI)
   - Use trimesh for STL export (don't build custom)
   - Implement job queue for async processing
   - Auto-save to prevent data loss

5. **ACCESSIBILITY** 🟡
   - Responsive design for tablets
   - Keyboard navigation
   - Screen reader support
   - WCAG AA compliance minimum

### Go/No-Go Recommendation

**GO** - Proceed with Phase 0 manual validation using revised architecture

**BUT BLOCK Phase 1 development until**:
- ✅ Security model fully designed (RBAC, RLS, file validation)
- ✅ API contracts defined (Zod schemas, OpenAPI docs)
- ✅ Database schema reviewed and approved
- ✅ Technology choices finalized (rule-based extrusion vs AI)
- ✅ Cost model validated (ensure <$0.10 per child)

### Estimated Effort (Phase 1 with Corrections)

**Original estimate**: 4-6 months
**Revised estimate**: 3-4 months (using existing libraries, simpler approach)

Breakdown:
- Security & auth setup: 2 weeks
- Database schema & migrations: 1 week
- API layer (Zod schemas, handlers): 2 weeks
- Drawing UI (Konva.js integration): 2 weeks
- 3D generation pipeline (OpenCV + trimesh): 4 weeks ⭐ Biggest unknowns
- 3D viewer (Three.js): 2 weeks
- Assembly instructions: 1 week
- Teacher review interface: 1 week
- Testing & bug fixes: 3 weeks
- **Total: ~16 weeks (4 months)**

### Next Steps

1. **Review this document** with team
2. **Make architecture decisions**:
   - Rule-based extrusion vs AI for MVP?
   - BullMQ vs Supabase Edge Functions for jobs?
   - Konva.js vs Fabric.js for drawing?
3. **Create detailed tech specs** for approved decisions
4. **Begin Phase 0 manual validation** (hand-model 3D from kids' drawings)
5. **Iterate architecture** based on Phase 0 learnings
6. **Start Phase 1 development** once all critical items addressed

---

**End of Architecture Review**
