# Phase 1: Software-First Implementation Plan
## Build End-to-End Flow, Test Hardware Later

**Strategy**: Build complete software pipeline with simulated 3D outputs, then integrate real 3D printing at the end.

**Timeline**: 8-12 weeks (software development)
**Goal**: Functional web app where kids can draw, generate 3D models, preview assembly, and download STL files

---

## Why Software-First Makes Sense

### Advantages:
- ✅ **No hardware dependency** - Develop anywhere, anytime
- ✅ **Faster iteration** - Test UX without waiting for prints
- ✅ **Parallel development** - Multiple devs can work simultaneously
- ✅ **Lower initial cost** - No printer needed until end
- ✅ **Early user testing** - Test drawing/preview experience with kids online
- ✅ **Mock realistic scenarios** - Simulate print times, failures, etc.

### 3D Printer Integration Later:
- Week 13+: Acquire printer, test real STL files
- Adjust tolerances based on actual prints
- Validate assembly with physical pieces
- Iterate connection mechanisms

---

## Phase 1 Scope (Software Only)

### What We're Building:

**User Features**:
1. ✅ Character selection from library
2. ✅ Gemini-powered piece breakdown suggestion
3. ✅ Excalidraw-based drawing interface (per piece)
4. ✅ Auto-save with resume capability
5. ✅ 2D → 3D conversion (rule-based + Gemini enhancement)
6. ✅ 3D preview (Three.js viewer, rotate/zoom)
7. ✅ Assembly preview (all pieces together)
8. ✅ STL file export (download ZIP)
9. ✅ Project management (save, list, delete)

**Admin/Teacher Features**:
10. ✅ View all projects in workshop
11. ✅ Download STL files for printing
12. ✅ Simple dashboard

**Infrastructure**:
13. ✅ Database schema (Supabase)
14. ✅ File storage (drawings, STL files)
15. ✅ API endpoints (versioned, validated)
16. ✅ Authentication & authorization (RLS)
17. ✅ Async job queue (3D generation)

### What We're NOT Building (Yet):
- ❌ Physical printer integration
- ❌ Print job queue/monitoring
- ❌ Assembly instructions (PDF generation)
- ❌ Multi-user workshops (start single-user)
- ❌ Payment/billing
- ❌ Advanced customization (Phase 2)

---

## Development Phases

### Phase 1A: Foundation (Weeks 1-3)

**Goal**: Database, auth, basic UI scaffolding

#### Week 1: Database & Auth Setup

**Tasks**:
- [ ] Create Supabase migration for 3D modeling tables
- [ ] Implement RLS policies
- [ ] Set up authentication context
- [ ] Create basic API route structure

**Deliverables**:
- [ ] `supabase/migrations/20260201_create_3d_modeling_tables.sql`
- [ ] Row-level security policies tested
- [ ] `/app/api/v1/3d-projects/` route structure

**Database Schema** (from Architecture Review):
```sql
-- Templates table
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('creature', 'structure', 'vehicle')),
  description TEXT,
  piece_count INTEGER NOT NULL CHECK (piece_count BETWEEN 3 AND 10),
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template pieces configuration
CREATE TABLE template_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  piece_number INTEGER NOT NULL CHECK (piece_number > 0),
  piece_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  drawing_prompt TEXT NOT NULL,
  reference_image_url TEXT,
  suggested_colors JSONB,
  connection_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(template_id, piece_number)
);

-- User's 3D projects
CREATE TABLE projects_3d (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drawing'
    CHECK (status IN ('drawing', 'generating', 'review', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Individual pieces (drawings + 3D models)
CREATE TABLE project_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects_3d(id) ON DELETE CASCADE,
  template_piece_id UUID NOT NULL REFERENCES template_pieces(id) ON DELETE RESTRICT,
  piece_number INTEGER NOT NULL CHECK (piece_number > 0),
  piece_type TEXT NOT NULL,

  -- Drawing data
  drawing_image_url TEXT NOT NULL,
  drawing_data JSONB, -- Excalidraw scene data
  drawing_uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  -- 3D model
  model_3d_url TEXT, -- STL file
  model_preview_url TEXT, -- PNG thumbnail
  model_generated_at TIMESTAMPTZ,

  -- Metadata
  estimated_print_time_minutes INTEGER,
  estimated_filament_grams DECIMAL(6,2),

  version INTEGER DEFAULT 1,
  is_current_version BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, piece_number, is_current_version)
    WHERE is_current_version = true
);

-- Indexes
CREATE INDEX idx_projects_3d_creator ON projects_3d(creator_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_3d_status ON projects_3d(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_pieces_project ON project_pieces(project_id);
CREATE INDEX idx_project_pieces_current ON project_pieces(project_id, is_current_version)
  WHERE is_current_version = true;

-- RLS Policies
ALTER TABLE projects_3d ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_projects" ON projects_3d
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "users_create_projects" ON projects_3d
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "users_update_own_projects" ON projects_3d
  FOR UPDATE USING (auth.uid() = creator_id);

-- Similar for project_pieces...
```

**Test**:
- [ ] Can create project
- [ ] Can save piece drawing
- [ ] RLS prevents unauthorized access
- [ ] Indexes improve query performance

---

#### Week 2: Basic UI Structure

**Tasks**:
- [ ] Create character page with "Bring to 3D" CTA
- [ ] Create 3D project creation flow
- [ ] Build basic layout/navigation

**Pages to Create**:
```
/characters/[characterId]
  └─ [Bring to Real World] button

/3d-projects/new?characterId=xxx
  └─ Character selection & template suggestion

/3d-projects/[projectId]
  └─ Project overview (all pieces)

/3d-projects/[projectId]/draw/[pieceId]
  └─ Drawing interface (next week)

/3d-projects/[projectId]/preview
  └─ Assembly preview (later)
```

**Components**:
```tsx
// components/3d-modeling/ProjectWizard.tsx
// components/3d-modeling/PieceCard.tsx
// components/3d-modeling/ProgressBar.tsx
```

**Deliverables**:
- [ ] Navigation flow works
- [ ] Can create project from character
- [ ] Can see list of pieces to draw

**Test**:
- [ ] User can navigate through flow
- [ ] Data persists in database
- [ ] UI is responsive (mobile, tablet, desktop)

---

#### Week 3: Character Analysis (Gemini Integration)

**Tasks**:
- [ ] Implement Gemini-based piece breakdown
- [ ] Template suggestion logic
- [ ] Piece breakdown UI

**Service Layer**:
```typescript
// lib/3d-modeling/services/characterAnalyzer.ts

import { gemini } from '@/lib/ai/gemini';

export async function analyzeCharacterForBreakdown(
  characterId: string
): Promise<PieceBreakdown> {
  // Get character from database
  const character = await getCharacter(characterId);

  const prompt = `Analyze this character for 3D printing.

Character: ${character.name}
Type: ${character.subject_type}
Description: ${character.description}

Task: Suggest how to break this into 3D printable pieces.

Guidelines:
- Minimum 3 pieces, maximum 8 pieces
- Each piece simple enough for a child (5-8 years) to draw
- Pieces connect logically (head to body, legs to body, etc.)
- Consider printability (no floating parts)
- Match character's actual structure

Return JSON:
{
  "recommended_template": "creature_4_legged|creature_2_legged|structure_building|vehicle_wheeled",
  "pieces": [
    { "name": "Body", "description": "The round center part", "type": "body" },
    { "name": "Head", "description": "With face and expression", "type": "head" },
    ...
  ],
  "piece_count": 6,
  "complexity": "simple|medium|complex",
  "supported": true,
  "reason": "Fits standard 4-legged creature template"
}`;

  const result = await gemini.generateContent({
    prompt,
    image: character.image_url,
    responseFormat: 'json',
  });

  return JSON.parse(result.text);
}
```

**UI Component**:
```tsx
// components/3d-modeling/PieceBreakdownSuggestion.tsx

"Let's build {characterName} in {pieceCount} pieces!"

[Visual diagram showing pieces]

Piece 1: Body (the main part)
Piece 2: Head (with the face)
...

[Use This Breakdown] [Customize]
```

**Deliverables**:
- [ ] Gemini analyzes character and suggests breakdown
- [ ] User sees suggested pieces
- [ ] Can accept or request different breakdown

**Test**:
- [ ] Works for different character types
- [ ] Handles errors gracefully (API failure)
- [ ] Suggestions make sense

---

### Phase 1B: Drawing Experience (Weeks 4-6)

**Goal**: Kids can draw pieces and see them saved

#### Week 4: Excalidraw Integration

**Tasks**:
- [ ] Integrate Excalidraw component
- [ ] Customize for kid-friendly experience
- [ ] Implement save/load functionality

**Component**:
```tsx
// components/3d-modeling/DrawingCanvas.tsx

import { Excalidraw } from "@excalidraw/excalidraw";
import { useState, useEffect } from "react";

interface DrawingCanvasProps {
  projectId: string;
  pieceId: string;
  pieceConfig: PieceConfig;
  onSave: (imageData: ImageData) => Promise<void>;
}

export function DrawingCanvas({
  projectId,
  pieceId,
  pieceConfig,
  onSave
}: DrawingCanvasProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (hasUnsavedChanges && excalidrawAPI) {
        await saveDrawing();
        setHasUnsavedChanges(false);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, excalidrawAPI]);

  const saveDrawing = async () => {
    if (!excalidrawAPI) return;

    // Get scene data
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();

    // Export as PNG
    const blob = await excalidrawAPI.exportToBlob({
      mimeType: "image/png",
      elements,
      appState,
    });

    // Upload to Supabase Storage
    const imageUrl = await uploadDrawing(projectId, pieceId, blob);

    // Save scene data (for editing later)
    await savePieceData(pieceId, {
      drawing_image_url: imageUrl,
      drawing_data: { elements, appState },
    });

    toast.success("Saved ✓");
  };

  return (
    <div className="h-screen w-full">
      {/* Reference image sidebar */}
      <div className="fixed left-0 top-0 w-64 h-full bg-white border-r p-4">
        <h3 className="font-bold mb-2">Reference</h3>
        <img src={pieceConfig.reference_image_url} alt="Reference" />
        <p className="text-sm mt-2">{pieceConfig.drawing_prompt}</p>
      </div>

      {/* Drawing canvas */}
      <div className="ml-64 h-full">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onChange={() => setHasUnsavedChanges(true)}
          initialData={{
            appState: {
              viewBackgroundColor: "#ffffff",
              currentItemFontFamily: 1,
              currentItemStrokeColor: "#000000",
              currentItemBackgroundColor: "transparent",
            },
          }}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: false,
              saveAsImage: false,
            },
            tools: {
              image: false, // Disable image import for simplicity
            },
          }}
        />
      </div>

      {/* Bottom toolbar */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t p-4 flex justify-between">
        <button onClick={() => history.back()}>← Back</button>
        <div className="text-sm text-gray-600">
          {hasUnsavedChanges ? "Unsaved changes" : "All saved ✓"}
        </div>
        <button onClick={saveAndContinue} className="btn-primary">
          Save & Continue →
        </button>
      </div>
    </div>
  );
}
```

**API Route**:
```typescript
// app/api/v1/3d-projects/[projectId]/pieces/[pieceId]/drawing/route.ts

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string; pieceId: string } }
) {
  const user = await getUser(req);
  if (!user) throw new UnauthorizedError();

  // Validate request
  const formData = await req.formData();
  const imageFile = formData.get('image') as File;

  // Validate file
  await validateDrawingUpload(imageFile);

  // Upload to Supabase Storage
  const path = `3d-projects/${params.projectId}/pieces/${params.pieceId}/drawing.png`;
  const { data } = await supabase.storage
    .from('drawings')
    .upload(path, imageFile, { upsert: true });

  // Update piece record
  await supabase
    .from('project_pieces')
    .update({
      drawing_image_url: data.path,
      drawing_uploaded_at: new Date().toISOString(),
    })
    .eq('id', params.pieceId);

  return NextResponse.json({ success: true, url: data.path });
}
```

**Deliverables**:
- [ ] Drawing interface works smoothly
- [ ] Auto-save functionality
- [ ] Can resume drawing later
- [ ] Drawings upload to storage

**Test**:
- [ ] Drawing on tablet/touch device
- [ ] Auto-save triggers correctly
- [ ] Can reload and continue drawing
- [ ] Reference image helpful

---

#### Week 5: Multi-Piece Workflow

**Tasks**:
- [ ] Progress tracking (piece 2 of 6)
- [ ] Navigate between pieces
- [ ] Show completion status

**Component**:
```tsx
// components/3d-modeling/PieceDrawingWizard.tsx

export function PieceDrawingWizard({ projectId }) {
  const { project, pieces } = useProject(projectId);
  const [currentPieceIndex, setCurrentPieceIndex] = useState(0);

  const currentPiece = pieces[currentPieceIndex];
  const progress = (currentPieceIndex + 1) / pieces.length;

  const handleSaveAndContinue = async (imageData) => {
    await savePieceDrawing(currentPiece.id, imageData);

    if (currentPieceIndex < pieces.length - 1) {
      // Next piece
      setCurrentPieceIndex(currentPieceIndex + 1);
    } else {
      // All pieces done! Go to 3D generation
      router.push(`/3d-projects/${projectId}/generate`);
    }
  };

  return (
    <div>
      {/* Progress bar */}
      <ProgressBar value={progress} max={1} />
      <p className="text-sm text-gray-600">
        Piece {currentPieceIndex + 1} of {pieces.length}: {currentPiece.display_name}
      </p>

      {/* Drawing canvas */}
      <DrawingCanvas
        projectId={projectId}
        pieceId={currentPiece.id}
        pieceConfig={currentPiece.template_piece}
        onSave={handleSaveAndContinue}
      />

      {/* Piece navigation (optional) */}
      <div className="piece-thumbnails">
        {pieces.map((piece, idx) => (
          <PieceThumbnail
            key={piece.id}
            piece={piece}
            isActive={idx === currentPieceIndex}
            isComplete={!!piece.drawing_image_url}
            onClick={() => setCurrentPieceIndex(idx)}
          />
        ))}
      </div>
    </div>
  );
}
```

**Deliverables**:
- [ ] Can draw all pieces sequentially
- [ ] Progress indicator shows completion
- [ ] Can jump to specific piece
- [ ] "Save & Exit" preserves progress

**Test**:
- [ ] Complete full project (all 6 pieces)
- [ ] Exit mid-way and resume
- [ ] Navigate back to edit earlier piece

---

#### Week 6: Drawing Preview & Iteration

**Tasks**:
- [ ] Show drawing preview after saving
- [ ] Allow redrawing/editing
- [ ] Visual confirmation before 3D generation

**Component**:
```tsx
// components/3d-modeling/DrawingPreview.tsx

export function DrawingPreview({ projectId }) {
  const { pieces } = useProject(projectId);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {pieces.map((piece) => (
        <div key={piece.id} className="border rounded-lg p-4">
          <h3 className="font-bold mb-2">{piece.display_name}</h3>

          {piece.drawing_image_url ? (
            <>
              <img
                src={piece.drawing_image_url}
                alt={piece.display_name}
                className="w-full h-48 object-contain border"
              />
              <button
                onClick={() => editPiece(piece.id)}
                className="mt-2 text-sm text-blue-600"
              >
                ✏️ Edit Drawing
              </button>
            </>
          ) : (
            <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
              <button onClick={() => drawPiece(piece.id)}>
                Start Drawing →
              </button>
            </div>
          )}
        </div>
      ))}

      {allPiecesDrawn && (
        <div className="col-span-full mt-8 text-center">
          <button
            onClick={generateModels}
            className="btn-primary btn-lg"
          >
            Generate 3D Models →
          </button>
        </div>
      )}
    </div>
  );
}
```

**Deliverables**:
- [ ] Grid view of all pieces
- [ ] Can edit any piece
- [ ] Clear "Generate 3D" CTA when ready

**Test**:
- [ ] User can review all drawings
- [ ] Editing works smoothly
- [ ] Clear next step

---

### Phase 1C: 3D Generation (Weeks 7-9)

**Goal**: Convert drawings to 3D models (STL files)

#### Week 7: Python Service Setup

**Tasks**:
- [ ] Create Python serverless function
- [ ] OpenCV + trimesh setup
- [ ] Basic 2D → 3D extrusion

**Python Service** (Vercel Serverless Function):
```python
# api/generate-3d-model.py

from PIL import Image
import cv2
import numpy as np
import trimesh
from io import BytesIO

def handler(request):
    """
    Convert 2D drawing to 3D STL model

    Input: PNG image of child's drawing
    Output: STL file binary data
    """
    # Get image from request
    image_data = request.files['image'].read()
    image = Image.open(BytesIO(image_data))

    # Convert to OpenCV format
    img_array = np.array(image)
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

    # Edge detection
    edges = cv2.Canny(gray, 50, 150)

    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Get largest contour (main shape)
    main_contour = max(contours, key=cv2.contourArea)

    # Simplify contour
    epsilon = 0.01 * cv2.arcLength(main_contour, True)
    simplified = cv2.approxPolyDP(main_contour, epsilon, True)

    # Convert to 3D points (extrude to depth)
    depth_mm = request.form.get('depth', 10)  # Default 10mm
    vertices_2d = simplified.reshape(-1, 2)

    # Create top face
    top_vertices = np.column_stack([
        vertices_2d[:, 0],
        vertices_2d[:, 1],
        np.full(len(vertices_2d), depth_mm)
    ])

    # Create bottom face
    bottom_vertices = np.column_stack([
        vertices_2d[:, 0],
        vertices_2d[:, 1],
        np.zeros(len(vertices_2d))
    ])

    # Combine vertices
    all_vertices = np.vstack([bottom_vertices, top_vertices])

    # Create faces (triangulate)
    faces = create_faces(len(vertices_2d))

    # Create mesh
    mesh = trimesh.Trimesh(vertices=all_vertices, faces=faces)

    # Add connection points (tabs/slots)
    mesh = add_connection_points(mesh, request.form.get('connections'))

    # Validate and repair mesh
    mesh.fill_holes()
    mesh.fix_normals()

    # Export to STL
    stl_bytes = mesh.export(file_type='stl')

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'model/stl'},
        'body': stl_bytes
    }

def create_faces(num_vertices):
    """Create triangulated faces for extruded shape"""
    faces = []

    # Bottom face (triangulate)
    for i in range(1, num_vertices - 1):
        faces.append([0, i, i + 1])

    # Top face
    offset = num_vertices
    for i in range(1, num_vertices - 1):
        faces.append([offset, offset + i + 1, offset + i])

    # Side faces
    for i in range(num_vertices):
        next_i = (i + 1) % num_vertices
        faces.append([i, next_i, offset + i])
        faces.append([next_i, offset + next_i, offset + i])

    return np.array(faces)

def add_connection_points(mesh, connections_json):
    """Add tabs/slots for assembly"""
    # Parse connection config
    connections = json.loads(connections_json or '[]')

    for conn in connections:
        if conn['type'] == 'tab':
            # Create chamfered peg
            tab_mesh = create_chamfered_tab(
                width_base=8.0,
                width_tip=7.5,
                height=5.0,
                angle=15
            )
            # Position on mesh surface
            tab_mesh.apply_translation(conn['position'])
            mesh = mesh + tab_mesh

        elif conn['type'] == 'slot':
            # Create chamfered hole
            slot_mesh = create_chamfered_slot(
                width_opening=8.5,
                width_base=8.0,
                depth=5.5,
                angle=15
            )
            slot_mesh.apply_translation(conn['position'])
            mesh = mesh - slot_mesh

    return mesh
```

**Deliverables**:
- [ ] Python function deploys to Vercel
- [ ] Can convert PNG → STL
- [ ] Basic extrusion works

**Test**:
- [ ] Simple shapes convert correctly
- [ ] STL file is valid (no errors in slicer)
- [ ] Connection points added

---

#### Week 8: Gemini Enhancement Integration

**Tasks**:
- [ ] Integrate Gemini image enhancement
- [ ] Hybrid approach (OpenCV + Gemini)
- [ ] Quality assessment

**Enhanced Service**:
```typescript
// lib/3d-modeling/services/modelGenerator.ts

export async function generate3DModel(
  pieceId: string,
  drawingUrl: string,
  pieceConfig: PieceConfig
): Promise<Generated3DModel> {

  // Step 1: Download drawing
  const drawingBlob = await fetch(drawingUrl).then(r => r.blob());

  // Step 2: Basic OpenCV cleanup (fast path)
  const cleanedImage = await enhanceWithOpenCV(drawingBlob);

  // Step 3: Assess quality
  const quality = await assessDrawingQuality(cleanedImage);

  let finalImage = cleanedImage;

  if (quality.score < 0.7) {
    // Low quality, use Gemini enhancement
    finalImage = await enhanceWithGemini(cleanedImage, pieceConfig);
  }

  // Step 4: Generate 3D mesh
  const stlBlob = await pythonService.generate3D({
    image: finalImage,
    depth: pieceConfig.depth_mm || 10,
    connections: pieceConfig.connection_points,
  });

  // Step 5: Upload STL
  const stlUrl = await uploadSTL(pieceId, stlBlob);

  // Step 6: Generate preview image
  const previewUrl = await generatePreview(stlUrl);

  // Step 7: Update database
  await supabase
    .from('project_pieces')
    .update({
      model_3d_url: stlUrl,
      model_preview_url: previewUrl,
      model_generated_at: new Date().toISOString(),
    })
    .eq('id', pieceId);

  return {
    stl_url: stlUrl,
    preview_url: previewUrl,
  };
}

async function enhanceWithGemini(
  image: Blob,
  pieceConfig: PieceConfig
): Promise<Blob> {
  const prompt = `Enhance this child's drawing for 3D printing.

Piece: ${pieceConfig.display_name}
Type: ${pieceConfig.piece_type}

Task:
- Smooth wobbly lines
- Keep child's style and colors
- Make outline clear
- Fill gaps
- Maintain creative elements (decorations, patterns)

Return enhanced version suitable for 3D conversion.`;

  const result = await gemini.generateImage({
    prompt,
    referenceImage: image,
  });

  return result.imageBlob;
}
```

**Job Queue Integration**:
```typescript
// lib/3d-modeling/jobs/generateModelJob.ts

import { Queue } from 'bullmq';

const modelQueue = new Queue('3d-model-generation', {
  connection: redis,
});

export async function enqueueModelGeneration(pieceId: string) {
  const job = await modelQueue.add('generate', {
    pieceId,
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });

  return job.id;
}

// Worker (separate process)
const worker = new Worker('3d-model-generation', async (job) => {
  const { pieceId } = job.data;

  // Update status
  await updatePieceStatus(pieceId, 'generating');

  try {
    const piece = await getPiece(pieceId);
    const result = await generate3DModel(
      pieceId,
      piece.drawing_image_url,
      piece.template_piece
    );

    await updatePieceStatus(pieceId, 'completed');

    // Notify via Supabase Realtime
    await notifyGenerationComplete(pieceId);

  } catch (error) {
    await updatePieceStatus(pieceId, 'failed');
    throw error;
  }
});
```

**Deliverables**:
- [ ] Hybrid enhancement working
- [ ] Async job queue processing
- [ ] Real-time status updates

**Test**:
- [ ] Generate models for various drawing qualities
- [ ] Job retries on failure
- [ ] Status updates in UI

---

#### Week 9: STL File Management

**Tasks**:
- [ ] STL validation
- [ ] File export/download
- [ ] Metadata extraction

**Service**:
```typescript
// lib/3d-modeling/services/stlManager.ts

export async function validateSTL(stlUrl: string): Promise<ValidationResult> {
  // Download STL
  const stlBlob = await fetch(stlUrl).then(r => r.blob());

  // Call Python validator
  const validation = await pythonService.validateSTL(stlBlob);

  return {
    is_valid: validation.is_manifold && !validation.has_errors,
    is_manifold: validation.is_manifold,
    has_holes: validation.has_holes,
    surface_area_mm2: validation.surface_area,
    volume_mm3: validation.volume,
    bounding_box: validation.bounding_box,
    warnings: validation.warnings,
  };
}

export async function exportProjectSTLs(projectId: string): Promise<Blob> {
  const { pieces } = await getProject(projectId);

  // Create ZIP
  const zip = new JSZip();

  for (const piece of pieces) {
    if (!piece.model_3d_url) continue;

    const stlBlob = await fetch(piece.model_3d_url).then(r => r.blob());
    zip.file(`piece-${piece.piece_number}-${piece.piece_type}.stl`, stlBlob);
  }

  // Add metadata JSON
  zip.file('project-info.json', JSON.stringify({
    project_id: projectId,
    character_name: pieces[0].project.character_name,
    piece_count: pieces.length,
    total_print_time_minutes: pieces.reduce((sum, p) =>
      sum + (p.estimated_print_time_minutes || 0), 0
    ),
    total_filament_grams: pieces.reduce((sum, p) =>
      sum + (p.estimated_filament_grams || 0), 0
    ),
    created_at: new Date().toISOString(),
  }, null, 2));

  return zip.generateAsync({ type: 'blob' });
}
```

**API Route**:
```typescript
// app/api/v1/3d-projects/[projectId]/export-stl/route.ts

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const user = await getUser(req);
  if (!user) throw new UnauthorizedError();

  // Authorize
  const project = await getProject(params.projectId);
  if (project.creator_id !== user.id) {
    throw new ForbiddenError();
  }

  // Generate ZIP
  const zipBlob = await exportProjectSTLs(params.projectId);

  return new Response(zipBlob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${project.character_name}-3d-models.zip"`,
    },
  });
}
```

**Deliverables**:
- [ ] STL validation working
- [ ] Can download ZIP of all STLs
- [ ] Metadata included

**Test**:
- [ ] Downloaded STLs open in slicer
- [ ] ZIP contains all pieces
- [ ] Metadata is accurate

---

### Phase 1D: 3D Preview (Weeks 10-11)

**Goal**: View 3D models in browser (Three.js)

#### Week 10: Three.js Viewer

**Tasks**:
- [ ] Integrate Three.js
- [ ] Load and render STL files
- [ ] Camera controls (orbit, zoom)

**Component**:
```tsx
// components/3d-modeling/Model3DViewer.tsx

import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, STLLoader } from '@react-three/drei';
import { Suspense } from 'react';

interface Model3DViewerProps {
  stlUrl: string;
  color?: string;
  width?: number;
  height?: number;
}

function STLModel({ url, color = '#888888' }) {
  const geometry = useLoader(STLLoader, url);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function Model3DViewer({
  stlUrl,
  color,
  width = 400,
  height = 400
}: Model3DViewerProps) {

  return (
    <div style={{ width, height }}>
      <Canvas camera={{ position: [0, 0, 100], fov: 50 }}>
        <Suspense fallback={<LoadingSpinner />}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <STLModel url={stlUrl} color={color} />
          <OrbitControls />
        </Suspense>
      </Canvas>

      <div className="controls mt-2 text-sm text-gray-600">
        🖱️ Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}
```

**Deliverables**:
- [ ] Can view individual pieces in 3D
- [ ] Smooth rotation/zoom
- [ ] Works on mobile/desktop

**Test**:
- [ ] STL loads correctly
- [ ] Controls are intuitive
- [ ] Performance is smooth

---

#### Week 11: Assembly Preview

**Tasks**:
- [ ] Show all pieces together
- [ ] Animated assembly
- [ ] Connection points visualization

**Component**:
```tsx
// components/3d-modeling/AssemblyPreview.tsx

export function AssemblyPreview({ projectId }) {
  const { pieces } = useProject(projectId);
  const [isAssembled, setIsAssembled] = useState(false);

  return (
    <div>
      <Canvas camera={{ position: [0, 0, 150], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} />

        {pieces.map((piece, idx) => {
          const position = isAssembled
            ? getAssembledPosition(piece)
            : getExplodedPosition(piece, idx);

          return (
            <STLModel
              key={piece.id}
              url={piece.model_3d_url}
              position={position}
              color={piece.color || '#888888'}
            />
          );
        })}

        <OrbitControls />
      </Canvas>

      <button onClick={() => setIsAssembled(!isAssembled)}>
        {isAssembled ? 'Explode View' : 'Assemble'}
      </button>
    </div>
  );
}
```

**Deliverables**:
- [ ] Can preview full assembly
- [ ] Toggle exploded/assembled view
- [ ] Understand how pieces fit

**Test**:
- [ ] All pieces visible
- [ ] Animation smooth
- [ ] Positions make sense

---

### Phase 1E: Polish & Testing (Week 12)

**Goal**: Bug fixes, optimization, user testing

#### Tasks:
- [ ] End-to-end testing (complete flow)
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] User acceptance testing (5-10 users)
- [ ] Documentation

**Testing Checklist**:
- [ ] Can create project from character
- [ ] Can draw all pieces
- [ ] Auto-save works
- [ ] Can resume after closing
- [ ] 3D generation succeeds
- [ ] Can preview 3D models
- [ ] Can download STL files
- [ ] STLs are valid (open in slicer)
- [ ] Works on mobile/tablet/desktop
- [ ] Error messages are helpful
- [ ] Loading states are clear

**Performance**:
- [ ] Drawing canvas loads quickly (<2s)
- [ ] 3D generation completes in reasonable time (<60s)
- [ ] 3D viewer renders smoothly (>30fps)
- [ ] No memory leaks
- [ ] Optimized images (WebP, lazy loading)

**Deliverables**:
- [ ] All critical bugs fixed
- [ ] Performance targets met
- [ ] User feedback incorporated
- [ ] Ready for Phase 2 (hardware testing)

---

## Phase 2: Hardware Integration (Week 13+)

**Now integrate real 3D printing**:

### Week 13: Printer Setup
- [ ] Acquire 3D printer
- [ ] Test STL files from Phase 1
- [ ] Adjust tolerances based on prints
- [ ] Document printer settings

### Week 14: Physical Assembly Testing
- [ ] Print test pieces (connection mechanisms)
- [ ] Test with kids (assembly difficulty)
- [ ] Iterate on connection design
- [ ] Validate durability

### Week 15+: Refinement
- [ ] Adjust 3D generation based on physical results
- [ ] Fine-tune connection tolerances
- [ ] Add print job management (if needed)
- [ ] Create assembly instructions

---

## Development Stack Summary

**Frontend**:
- Next.js 15 (App Router)
- React 19
- Tailwind CSS
- Excalidraw (drawing)
- Three.js + react-three/fiber (3D viewer)
- Zod (validation)

**Backend**:
- Next.js API Routes (/api/v1/)
- Supabase (PostgreSQL + Storage + Auth + Realtime)
- Python (Vercel Serverless Functions)
  - OpenCV (image processing)
  - trimesh (3D mesh generation)
  - Pillow (image manipulation)
- BullMQ or Supabase Edge Functions (job queue)

**AI**:
- Gemini (character analysis, image enhancement)

**Infrastructure**:
- Vercel (hosting)
- Upstash Redis (rate limiting, job queue)
- Sentry (error tracking)

---

## Success Criteria (End of Phase 1)

**Functional**:
- [ ] Complete end-to-end flow works
- [ ] 90%+ uptime during testing
- [ ] <5% error rate in 3D generation
- [ ] STL files validated in slicer

**Performance**:
- [ ] Drawing interface responsive (<100ms latency)
- [ ] 3D generation <60 seconds per piece
- [ ] 3D viewer >30fps
- [ ] Page load <3 seconds

**User Experience**:
- [ ] 5-10 users complete full flow
- [ ] 80%+ satisfaction ("easy to use")
- [ ] <20% support requests
- [ ] Kids ages 5-8 can use independently (mostly)

**Technical**:
- [ ] All 8 design principles followed
- [ ] RLS security validated
- [ ] API documentation complete
- [ ] Tests cover critical paths

---

## Next Steps After Phase 1

**If successful**:
1. Acquire 3D printer
2. Print 5-10 test projects
3. Validate assembly with real kids
4. Iterate on tolerances/connections
5. Launch pilot workshop (10-20 kids)

**Cost for Phase 1**:
- Development time: 8-12 weeks
- Infrastructure: ~$50-100/month (Vercel, Supabase, Redis)
- AI costs: ~$0.05 per project × 100 tests = $5
- **Total: Mostly time investment**

---

## Questions?

Before starting implementation:
- [ ] Team/developers ready?
- [ ] Supabase project set up?
- [ ] Gemini API access confirmed?
- [ ] Vercel account ready?
- [ ] Design principles reviewed?

**Ready to start Week 1?** Let me know if you want me to generate specific code files or have any questions about the implementation plan!
