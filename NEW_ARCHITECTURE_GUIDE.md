# StoryMe New Architecture - Quick Start Guide

## 🎯 Overview

This guide shows you how to use the new service layer architecture in your code. The old scattered approach has been replaced with a clean, testable, maintainable structure.

---

## 📦 Import Patterns

### **Types & Models**

```typescript
// ✅ Use unified domain models
import type { Character, Project, Scene } from '@/lib/domain/models';
import type { CharacterDTO, ProjectDTO, CreateProjectDTO } from '@/lib/domain/dtos';
import { characterToDTO, projectToDTO } from '@/lib/domain/converters';

// ❌ DEPRECATED - Don't use these anymore
import type { Character } from '@/lib/types/story'; // OLD
import type { CharacterLibrary } from '@/lib/types/database'; // OLD
```

### **Services & Repositories**

```typescript
// Use in API routes
import { ProjectService } from '@/lib/services/project.service';
import { StorageService } from '@/lib/services/storage.service';
import { CharacterRepository } from '@/lib/repositories/character.repository';
import { createClient } from '@/lib/supabase/server';

// Initialize
const supabase = await createClient();
const projectService = new ProjectService(supabase);
const storageService = new StorageService(supabase);
```

---

## 🔥 Common Tasks

### **1. Create a New Project**

```typescript
// In API route: /app/api/projects/route.ts
import { ProjectService } from '@/lib/services/project.service';
import { createClient } from '@/lib/supabase/server';
import type { CreateProjectDTO } from '@/lib/domain/dtos';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: CreateProjectDTO = await request.json();

  const projectService = new ProjectService(supabase);
  const project = await projectService.createProject(user.id, body);

  return NextResponse.json({ data: project });
}
```

**What it does automatically**:
- ✅ Validates script length
- ✅ Validates character count (1-5)
- ✅ Verifies characters exist and belong to user
- ✅ Creates project in database
- ✅ Links characters via junction table
- ✅ Increments character usage counts

---

### **2. Upload Character Image**

```typescript
// Already done in /app/api/upload/route.ts
import { StorageService } from '@/lib/services/storage.service';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const storageService = new StorageService(supabase);
  const result = await storageService.uploadCharacterImage(user.id, file);

  return NextResponse.json({
    success: true,
    url: result.url,      // Public Supabase URL
    filename: result.filename,
    path: result.path     // For deletion later
  });
}
```

**What changed**:
- ❌ OLD: Saves to `/public/uploads` folder (lost on deploy)
- ✅ NEW: Saves to Supabase Storage (permanent)

---

### **3. Save Story Scenes**

```typescript
import { ProjectService } from '@/lib/services/project.service';
import { parseScriptIntoScenes } from '@/lib/scene-parser';

export async function POST(request: NextRequest) {
  const { projectId, script, characters } = await request.json();

  // Parse scenes
  const parsedScenes = parseScriptIntoScenes(script, characters);

  // Save to database
  const projectService = new ProjectService(supabase);
  const scenes = await projectService.saveScenes(
    projectId,
    parsedScenes.map(scene => ({
      sceneNumber: scene.sceneNumber,
      description: scene.description,
      characterIds: scene.characterNames?.map(name =>
        characters.find(c => c.name === name)?.id
      ).filter(Boolean)
    }))
  );

  return NextResponse.json({ scenes });
}
```

---

### **4. Get User's Projects**

```typescript
// In API route: /app/api/projects/route.ts
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectService = new ProjectService(supabase);
  const projects = await projectService.getUserProjects(user.id);

  return NextResponse.json({ data: projects });
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "title": "Connor's Dragon Adventure",
      "status": "completed",
      "scenes": [
        {
          "sceneNumber": 1,
          "description": "Connor at the park",
          "images": [
            {
              "imageUrl": "https://...",
              "status": "completed"
            }
          ]
        }
      ],
      "createdAt": "2025-10-14T...",
      "updatedAt": "2025-10-14T..."
    }
  ]
}
```

---

### **5. Save Generated Images**

```typescript
// In /app/api/generate-images/route.ts
import { ProjectService } from '@/lib/services/project.service';
import { StorageService } from '@/lib/services/storage.service';
import { generateImageWithMultipleCharacters } from '@/lib/fal-client';

export async function POST(request: NextRequest) {
  const { projectId, characters, scenes } = await request.json();

  const supabase = await createClient();
  const storageService = new StorageService(supabase);
  const generatedImages = [];

  for (const scene of scenes) {
    // Generate image with Fal.ai
    const result = await generateImageWithMultipleCharacters({
      characters,
      sceneDescription: scene.description,
      artStyle: "children's book illustration"
    });

    // Upload to Supabase Storage (permanent)
    const uploaded = await storageService.uploadGeneratedImageFromUrl(
      projectId,
      scene.id,
      result.imageUrl // Fal.ai URL
    );

    // Save metadata to database
    const supabaseClient = await createClient();
    const { data: imageRecord } = await supabaseClient
      .from('generated_images')
      .insert({
        project_id: projectId,
        scene_id: scene.id,
        image_url: uploaded.url, // Our Supabase URL
        prompt: result.prompt,
        generation_time: result.generationTime,
        status: 'completed'
      })
      .select()
      .single();

    generatedImages.push(imageRecord);
  }

  // Update project status
  const projectService = new ProjectService(supabase);
  await projectService.updateProjectStatus(projectId, userId, 'completed');

  return NextResponse.json({
    success: true,
    generatedImages
  });
}
```

---

## 🎨 Frontend Usage (React Components)

### **Using in Page Components**

```typescript
// /app/(dashboard)/projects/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ProjectWithScenesDTO } from '@/lib/domain/dtos';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithScenesDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const response = await fetch('/api/projects');
      const { data } = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject(projectId: string) {
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    loadProjects(); // Refresh list
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {projects.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          onDelete={() => deleteProject(project.id)}
        />
      ))}
    </div>
  );
}
```

---

## 🧪 Testing Examples

### **Unit Test for ProjectService**

```typescript
// __tests__/services/project.service.test.ts
import { ProjectService } from '@/lib/services/project.service';
import { createClient } from '@supabase/supabase-js';

describe('ProjectService', () => {
  let projectService: ProjectService;
  let supabase: any;

  beforeEach(() => {
    supabase = createClient(/* test config */);
    projectService = new ProjectService(supabase);
  });

  it('should create project with valid data', async () => {
    const userId = 'test-user-id';
    const data = {
      title: 'Test Story',
      originalScript: 'Once upon a time...',
      characterIds: ['char-1']
    };

    const project = await projectService.createProject(userId, data);

    expect(project.title).toBe('Test Story');
    expect(project.status).toBe('draft');
  });

  it('should throw error for invalid script', async () => {
    const data = {
      title: 'Test',
      originalScript: 'Short', // Too short
      characterIds: ['char-1']
    };

    await expect(
      projectService.createProject('user-id', data)
    ).rejects.toThrow('Script must be at least 10 characters');
  });
});
```

---

## 🔐 Authentication Patterns

### **In API Routes**

```typescript
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // user.id is authenticated user ID
  // Use it in all service calls
  const project = await projectService.createProject(user.id, data);
}
```

### **In Client Components** (Next Session - Create Hook)

```typescript
// Will create: /lib/hooks/useAuth.ts
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    }
    loadUser();
  }, []);

  return { user, loading };
}

// Usage in components
const { user, loading } = useAuth();
if (!user) return <LoginPage />;
```

---

## 🗂️ File Organization Rules

### **Where to Put New Code**

| Type | Location | Example |
|------|----------|---------|
| Database models | `/lib/domain/models.ts` | `interface NewTable` |
| DTOs | `/lib/domain/dtos.ts` | `interface NewTableDTO` |
| Converters | `/lib/domain/converters.ts` | `newTableToDTO()` |
| Data access | `/lib/repositories/` | `new-table.repository.ts` |
| Business logic | `/lib/services/` | `new-feature.service.ts` |
| API routes | `/app/api/*/route.ts` | Use services only |
| React hooks | `/lib/hooks/` | `useNewFeature.ts` |
| Validation | `/lib/validation/schemas.ts` | Zod schemas |
| UI components | `/components/` | Organized by feature |

---

## ⚠️ Common Mistakes to Avoid

### **1. Don't Mix Layers**

```typescript
// ❌ BAD - Direct DB call in component
const { data } = await supabase.from('projects').select('*');

// ✅ GOOD - Use service via API
const response = await fetch('/api/projects');
const { data } = await response.json();
```

### **2. Don't Skip Conversion**

```typescript
// ❌ BAD - Return raw DB model to frontend
return NextResponse.json(dbProject); // snake_case fields

// ✅ GOOD - Convert to DTO
return NextResponse.json(projectToDTO(dbProject)); // camelCase
```

### **3. Don't Validate in Components**

```typescript
// ❌ BAD - Validation in component
if (script.length < 10) {
  alert('Script too short');
}

// ✅ GOOD - Service validates and throws
try {
  await projectService.createProject(userId, { script, ... });
} catch (error) {
  toast.error(error.message); // Service provides message
}
```

### **4. Don't Create Services in Components**

```typescript
// ❌ BAD - Service in component
const projectService = new ProjectService(supabase);

// ✅ GOOD - Service in API route only
// Components call API routes, not services directly
```

---

## 🚀 Quick Reference

### **I need to...**

| Task | Use This |
|------|----------|
| Create a project | `ProjectService.createProject()` |
| Save scenes | `ProjectService.saveScenes()` |
| Upload character image | `StorageService.uploadCharacterImage()` |
| Upload generated image | `StorageService.uploadGeneratedImageFromUrl()` |
| Get user's projects | `ProjectService.getUserProjects()` |
| Get project with scenes | `ProjectService.getProjectWithScenes()` |
| Delete project | `ProjectService.deleteProject()` |
| Find character | `CharacterRepository.findById()` |
| Toggle favorite | `CharacterRepository.toggleFavorite()` |
| Increment usage | `CharacterRepository.incrementUsageCount()` |
| Convert DB → Frontend | `characterToDTO()`, `projectToDTO()` |
| Convert Frontend → DB | `characterFromDTO()`, `sceneFromDTO()` |

---

## 📚 Further Reading

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)

---

**Questions?** Check `IMPLEMENTATION_PROGRESS.md` for detailed examples.

**Ready to code!** 🚀
