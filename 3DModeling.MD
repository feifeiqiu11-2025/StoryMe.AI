# 3D Printable Character Feature Plan

## Overview
Transform children's story characters into physical 3D printed models through a guided drawing and assembly experience. Integrates with existing KindleWood Studio character creation to bring stories to life.

**Target Audience**: Children aged 5-8 years old
**Workshop Model**: 2-session in-person workshops (Session 1: Design, Session 2: Assembly)

---

## Core Concept

### The Magic Flow
1. **Story Creation** (existing KindleWood flow)
   - Child creates story with character
   - Character becomes emotionally meaningful

2. **3D Transformation Journey**
   - "Want to bring [character name] to life? Let's build them!"
   - System breaks character into printable pieces
   - Guided experience helps child draw each piece
   - AI enhances drawings into 3D models
   - Teacher prints offline between sessions
   - Child assembles physical version and takes home

### Educational Value
- **Systems Thinking**: Breaking complex objects into component parts
- **Spatial Reasoning**: 2D drawings → 3D understanding
- **Problem Solving**: How pieces fit together
- **Pride & Ownership**: Creating something physical and real
- **Design Iteration**: Learning from what works/doesn't work

---

## Phase 1: MVP Foundation

### Character Types (Variety Balance)
Start with **3 character categories** to avoid monotony:

1. **Creatures** (Dinosaur, Dragon, Monster)
   - 4-5 pieces: body, head, legs (2x), tail
   - Natural articulation points
   - Kid-friendly, popular theme

2. **Structures** (House, Castle, Treehouse)
   - 4-5 pieces: base/foundation, walls (2x), roof, door/window panel
   - Teaches architecture basics
   - Stackable assembly

3. **Vehicles** (Rocket, Car, Boat)
   - 4-5 pieces: main body, wheels/fins (2x), top/cabin, accessories
   - Functional parts concept
   - Movement/play potential

**Why 3 categories**:
- Provides variety without overwhelming development
- Appeals to different interests (animals, building, transportation)
- Different assembly mechanics (articulated, stacked, attached)
- Can expand within categories later (Phase 2: add Robots, Buildings, Airplanes, etc.)

### Technical Components

#### 1. Guided Drawing Experience
**Interface Requirements**:
- Kid-friendly drawing canvas (large buttons, simple tools)
- Step-by-step visual guides: "Now let's draw the dino's body!"
- Reference image showing what piece looks like
- Basic tools only: brush size, color picker, eraser, undo/redo
- Progress indicator (piece 2 of 5)
- Save/resume capability (child might not finish all pieces in one sitting)

**Age-Appropriate Guidance**:
- Visual examples, not text-heavy instructions
- Optional voice guidance: "Make the body round and big!"
- Encouragement messages: "Great start! Let's add some details!"
- No wrong answers - all drawings accepted

#### 2. Simple 3D Viewer (NOT full modeling software)
**Features**:
- View generated 3D model from drawing
- Rotate (drag to spin)
- Zoom in/out (pinch or buttons)
- Toggle between individual pieces and assembled view
- Show connection points highlighted
- Color preview matching child's drawing

**What it does NOT need**:
- Vertex editing
- Boolean operations
- Professional modeling tools
- Complex UI - keep it minimal and playful

#### 3. AI Drawing Enhancement & 3D Generation

**Input**: Child's 2D drawing (wobbly lines, colors, rough shapes)

**Processing Steps**:
1. **Shape Recognition**
   - Identify intended form (is this a body, leg, head?)
   - Clean up wobbly lines while preserving character
   - Maintain child's artistic style (colors, decorations, personality)

2. **3D Extrusion with Explanations**
   - Convert 2D → 3D with appropriate depth/thickness
   - Target size: Max ~A4 paper size (210mm x 297mm), typically smaller
   - Auto-determine reasonable proportions from drawing

3. **Structural Integrity Enhancements**
   - Minimum wall thickness: 2-3mm (printability requirement)
   - Add internal supports if needed
   - Reinforce thin areas
   - **CRITICAL**: Show child what changed and why
     - "I made this part a bit thicker so it won't break easily!"
     - "I added support here so it prints better!"
     - Visual overlay showing original vs. enhanced
     - Educational moment - teach engineering thinking

4. **Connection Point Generation**
   - Add dovetail slots and tabs for assembly
   - Number pieces for assembly order
   - Ensure tolerances work for typical PLA prints (~0.2-0.3mm clearance)
   - Test fitting logic (pieces should fit snugly but not too tight)

**Key Principle**: Enhance for printability while keeping child's creative vision recognizable

#### 4. Assembly Planning System

**Pre-Print Validation**:
- Teacher review interface showing all pieces
- Flag potential print issues (too thin, unsupported overhangs)
- Estimated print time per piece and total
- Material estimate (grams of filament)
- Approve/request child revision workflow

**Assembly Instructions Generation**:
- Visual step-by-step guide (pictures, not heavy text)
- Numbered pieces (match numbers on physical prints)
- "First, connect piece 1 and piece 2 like this..."
- Simple animations showing how pieces fit
- Preview of final assembled character

**Physical Assembly Aids**:
- Print numbers directly on connection tabs
- Color-code connection points (red tab → red slot)
- Instruction card exports as PDF for teacher to print

#### 5. 3D Printing Pipeline

**Export Format**: STL (universal, works with 99% of printers)

**Recommended Print Settings** (include in export metadata):
- Material: PLA (safe, biodegradable, easiest)
- Layer height: 0.2mm (good balance of quality/speed)
- Infill: 15-20% (strong enough, not wasteful)
- Support: Auto-generate where needed
- Print speed: Standard (reliability > speed)

**Safety & Post-Processing Notes**:
- Include safety checklist for teacher:
  - Sand sharp edges
  - Check for small detached parts
  - Verify structural integrity
- Recommended post-processing tools: sandpaper, file

**Print Time Estimates** (4-piece character):
- Small pieces: 30-60 min each
- Medium pieces: 1-2 hours each
- Large pieces: 2-3 hours each
- **Total: 4-8 hours per character** (overnight print batch)

---

## Integration with Existing KindleWood Platform

### Character Story → Physical Model Flow

**Existing Assets Leverage**:
- Use character images from story as reference templates
- Character's appearance guides piece design
- Character name carries through to 3D project
- Story context makes pieces meaningful ("This is Spike from your adventure!")

**Technical Integration Points**:
- Character database: add `3d_model_project_id` field
- Story completion screen: "Want to build [character]?" CTA
- Character gallery: show both story image and 3D model status
- Portfolio: display digital story + photo of physical creation

**Example Flow**:
```
Story: "Spike the Brave Dinosaur explores the jungle"
→ Character: Green dinosaur with red spikes and big smile
→ 3D Project: "Build Spike!"
  - Piece 1: Body (green, round)
  - Piece 2: Head (with big smile)
  - Piece 3-4: Legs (sturdy)
  - Piece 5: Tail (with red spikes)
→ Print → Assemble → Child plays with Spike from their story!
```

---

## Workshop Session Structure

### Session 1: Design & Creation (60-90 minutes)

**Part 1: Story Recap (10 min)**
- Review character from previous story session
- Build excitement: "Let's make [character] real!"

**Part 2: Piece Planning (10 min)**
- System shows character broken into pieces
- Explain what each piece is and why
- Show assembly preview

**Part 3: Guided Drawing (40-60 min)**
- Child draws each piece with guidance
- AI generates 3D preview after each piece
- Child can iterate/redraw if unhappy
- Optional: simple 3D viewer play/exploration

**Part 4: Review & Submit (10 min)**
- Teacher reviews all pieces
- Check for printability issues
- Child approves final designs
- Export to print queue

**Between Sessions**: Teacher prints all pieces (overnight or multi-day)

### Session 2: Assembly & Play (45-60 minutes)

**Part 1: Introduction (5 min)**
- Show printed pieces
- Review assembly instructions together

**Part 2: Assembly (20-30 min)**
- Child assembles with teacher guidance
- Problem-solving if pieces tight/loose
- Tools available: sandpaper, gentle force

**Part 3: Celebration & Play (15-20 min)**
- Photograph completed character
- Free play time
- Share with peers
- Take home!

**Part 4: Reflection (5 min)**
- What did you learn?
- What would you do differently?
- Ideas for next character?

---

## Technical Architecture (High-Level)

### System Components

```
┌─────────────────────────────────────────────────────┐
│  Existing KindleWood Platform                       │
│  (Story Creation, Character Generation)             │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  3D Feature Module                                  │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ Guided Drawing Interface                   │    │
│  │ - Canvas component                         │    │
│  │ - Step-by-step wizard                      │    │
│  │ - Progress tracking                        │    │
│  └────────────────┬───────────────────────────┘    │
│                   │                                 │
│                   ▼                                 │
│  ┌────────────────────────────────────────────┐    │
│  │ AI Processing Pipeline                     │    │
│  │ - Image analysis (shape recognition)       │    │
│  │ - 2D → 3D conversion                       │    │
│  │ - Structural enhancement                   │    │
│  │ - Connection point generation              │    │
│  └────────────────┬───────────────────────────┘    │
│                   │                                 │
│                   ▼                                 │
│  ┌────────────────────────────────────────────┐    │
│  │ 3D Viewer Component                        │    │
│  │ - WebGL rendering (Three.js)               │    │
│  │ - Rotation, zoom controls                  │    │
│  │ - Assembly preview                         │    │
│  └────────────────┬───────────────────────────┘    │
│                   │                                 │
│                   ▼                                 │
│  ┌────────────────────────────────────────────┐    │
│  │ Export & Print Preparation                 │    │
│  │ - STL file generation                      │    │
│  │ - Assembly instruction PDF                 │    │
│  │ - Teacher review interface                 │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Data Models

```typescript
interface Character3DProject {
  id: string;
  character_id: string; // links to story character
  character_name: string;
  character_type: 'creature' | 'structure' | 'vehicle';
  template_id: string; // which template (dino, castle, rocket, etc.)

  pieces: Piece[];
  status: 'drawing' | 'review' | 'approved' | 'printing' | 'completed';

  created_at: Date;
  session_1_completed_at?: Date;
  session_2_completed_at?: Date;
}

interface Piece {
  id: string;
  piece_number: number; // 1-5
  piece_type: string; // 'body', 'head', 'leg', etc.

  // Child's drawing
  drawing_image_url: string;
  drawing_data: DrawingData; // vector/canvas data

  // Generated 3D model
  model_3d_url?: string; // STL file
  model_preview_url?: string; // thumbnail
  mesh_data?: MeshData;

  // Enhancements applied
  enhancements: Enhancement[];

  // Printing info
  estimated_print_time_minutes?: number;
  estimated_filament_grams?: number;
  print_status?: 'pending' | 'printing' | 'completed' | 'failed';
}

interface Enhancement {
  type: 'thickening' | 'support_added' | 'connection_point' | 'smoothing';
  location: string; // description of where
  reason: string; // kid-friendly explanation
  visual_indicator?: object; // coordinates for overlay display
}

interface Template {
  id: string;
  name: string; // 'Dinosaur', 'Castle', 'Rocket'
  category: 'creature' | 'structure' | 'vehicle';
  piece_count: number;
  pieces_config: PieceConfig[];
  assembly_instructions: AssemblyStep[];
}

interface PieceConfig {
  piece_type: string;
  display_name: string; // "The body"
  drawing_prompt: string; // "Draw a big round body for your dino!"
  reference_image_url: string;
  suggested_colors?: string[];
  connection_points: ConnectionPoint[];
}

interface ConnectionPoint {
  type: 'tab' | 'slot';
  connects_to_piece: number; // piece number
  position: 'top' | 'bottom' | 'left' | 'right' | 'side';
  size: 'small' | 'medium' | 'large';
}
```

### Technology Stack (Aligned with Design Principles)

> **📋 See [3DModeling-Architecture-Review.md](./3DModeling-Architecture-Review.md) for detailed analysis against our 8 design principles**

**Frontend**:
- Framework: **Next.js 15** (App Router) ✅ Already using
- UI Library: **React 19** ✅ Already using
- Styling: **Tailwind CSS 4** ✅ Already using
- Drawing canvas: **Konva.js** ⭐ (Touch-optimized, React integration, reusable component)
- 3D viewer: **Three.js** (Industry standard, huge ecosystem, reusable)
- Form validation: **Zod + React Hook Form** ✅ Already using
- State: **React Context + Zustand** (Simple, no Redux complexity)
- Real-time: **Supabase Realtime** ✅ Already using

**Backend**:
- API: **Next.js API Routes (v1)** ✅ Already using, versioned endpoints
- Database: **Supabase (PostgreSQL)** ✅ Already using, RLS for security
- Storage: **Supabase Storage** ✅ Already using, signed URLs only
- Auth: **Supabase Auth** ✅ Already using, RBAC support
- Job Queue: **Supabase Edge Functions + pg_cron** (Start simple) or **BullMQ** (if scaling)
- Rate Limiting: **Upstash Redis** (Serverless, pay-per-use)

**AI/Processing** (Reuse Before Rebuild):
- **MVP Approach**: Rule-based extrusion (OpenCV + trimesh)
  - Detect edges in 2D drawing
  - Extrude to fixed depth with bevels
  - Add connection points from template
  - **Cost**: ~$0.01 per project
  - **Pros**: Predictable, fast, cheap, good enough for kids' drawings

- **Phase 2 Option**: Meshy.ai or CSM API (evaluate if MVP quality insufficient)
  - Full 2D → 3D AI reconstruction
  - **Cost**: ~$0.40-2.00 per project (40-200x more expensive)
  - Only upgrade if quality demands it

- Image Processing: **OpenCV** (Python, industry standard)
- STL Generation: **trimesh** (Python library, purpose-built, handles edge cases)
- Mesh Validation: **trimesh.repair** (Auto-fix common STL issues)
- 3D Preview: **Three.js** (Client-side rendering, no server needed)

**Infrastructure**:
- Hosting: **Vercel** (Likely already using for Next.js)
- Python Services: **Vercel Serverless Functions** (Same platform)
- Monitoring: **Sentry** (Error tracking)
- Logging: **Axiom or Datadog** (Centralized logs)
- Analytics: **Plausible or PostHog** (Privacy-friendly, COPPA compliant)

**Key Architectural Decisions**:
1. ✅ **Reuse Existing**: Leverage Next.js, Supabase, Tailwind already in place
2. ✅ **Start Simple**: Rule-based 3D generation, not complex AI (validate first)
3. ✅ **Security First**: RBAC, RLS, signed URLs, rate limiting, file validation
4. ✅ **Stateless**: Job queue for async processing, state in DB not memory
5. ✅ **Versioned APIs**: /v1/ endpoints with Zod schemas, standardized errors
6. ✅ **Accessible**: Responsive design, keyboard nav, screen readers, WCAG AA

---

## Major Risks & Mitigation Strategies

### Risk 1: Print Failures (10-30% failure rate)
**Impact**: Child's piece doesn't print, disappointment

**Mitigation**:
- Teacher validation before printing (catch issues early)
- Backup generic pieces for each template
- Auto-repair tools in export pipeline (fix common STL errors)
- Test prints before workshop to calibrate settings
- Multiple printers (redundancy)

### Risk 2: Assembly Difficulty
**Impact**: Pieces don't fit, child frustrated, needs excessive adult help

**Mitigation**:
- Extensive tolerance testing during development
- Include assembly tools (sandpaper, small file) in workshop kit
- Design pieces with forgiveness (tapered connections, not tight press-fits)
- Teacher practice assembly before session 2
- Fallback: glue/tape if connections fail

### Risk 3: Design Quality Variance
**Impact**: Some kids create unprintable designs, others bored waiting

**Mitigation**:
- AI validation with gentle suggestions: "Want to make this stronger?"
- Template constraints (can't draw too small/large)
- Teacher can assist struggling kids during drawing
- Advanced kids can add more details/decorations
- Offer extension activities (design second character, help peers)

### Risk 4: 2D → 3D AI Accuracy
**Impact**: Generated 3D model doesn't match child's intent

**Mitigation**:
- Immediate preview after each piece (child sees and can redraw)
- Simple viewer allows inspection from all angles
- Teacher review catches major mismatches
- Start with forgiving templates (round dino body is hard to mess up)
- Iterate on AI with real workshop data

### Risk 5: Cost Per Child
**Impact**: Materials + printer wear + teacher time = potentially expensive

**Mitigation**:
- Use budget PLA filament (~$15-20/kg, ~$2-4 per character)
- Share printers across multiple workshops
- Consider materials fee for parents (optional, $5-10)
- Batch printing overnight (efficient use of printer time)
- Start small - validate ROI before scaling

### Risk 6: Safety Concerns
**Impact**: Sharp edges, small parts, brittleness

**Mitigation**:
- Mandatory post-processing checklist (sand edges)
- Age warnings for younger siblings
- PLA is non-toxic, biodegradable
- Design pieces large enough (no tiny parts)
- Teacher inspects each piece before giving to child
- Include safety card with take-home item

### Risk 7: Technical Complexity
**Impact**: Feature too hard to build, takes too long, buggy

**Mitigation**:
- **Phase 0**: Manual prototype (hand-model 3D from kids' drawings, test assembly)
- Start with 1 template type (dino only)
- Semi-automated initially (teacher can edit 3D models if AI fails)
- Iterative development with real user testing
- Focus on reliability over features

---

## Success Metrics

### User Experience
- **Engagement**: % of kids who complete all pieces in Session 1
- **Satisfaction**: Post-workshop survey (kid + parent feedback)
- **Assembly Success**: % of kids who successfully assemble without frustration
- **Replay Intent**: % wanting to do another character

### Technical Performance
- **Print Success Rate**: Target >85% successful prints
- **AI Accuracy**: Teacher approval rate of auto-generated 3D models
- **Iteration Rate**: Average drawings per piece (lower = AI got it right)
- **Processing Time**: Drawing → 3D model generation (target <30 seconds)

### Educational Impact
- **Learning Outcomes**: Can child explain how pieces fit together?
- **Problem-Solving**: Did child iterate/improve designs?
- **Spatial Reasoning**: Can child predict assembled look from pieces?

### Business Viability
- **Cost Per Child**: Materials + labor (target <$10)
- **Workshop Capacity**: Kids per session (limited by printer throughput)
- **Retention**: % of kids who return for another workshop
- **Parent Satisfaction**: NPS score

---

## Phase 0: Manual Validation (Before Building)

### Goal
Validate concept feasibility and desirability without building tech.

### Process
1. **Select 3-5 test kids** (ages 5-8)
2. **Use existing character** from their stories
3. **Guide them to draw pieces** on paper
4. **You manually create 3D models** (use Tinkercad, Blender, etc.)
5. **Print and test assembly** with kids
6. **Document**:
   - What worked / what didn't
   - Print failures and why
   - Assembly challenges
   - Kid reactions and engagement
   - Time required (drawing, modeling, printing, assembly)
   - Actual costs

### Key Questions to Answer
- Do kids enjoy the drawing process?
- Can they understand piece decomposition?
- Is assembly satisfying and achievable?
- Do prints actually work (fit, durability)?
- Is 2-session model practical?
- What's real cost and time investment?

### Go/No-Go Decision
If manual validation shows strong engagement + feasible logistics → Proceed to Phase 1
If major issues → Iterate concept or pivot

---

## Phase 1: MVP Development

### Scope
- **1 character category**: Creatures (Dinosaur template)
- **4 pieces**: Body, head, 2 legs (simplified, no tail for MVP)
- **Semi-automated**: AI assists, teacher can override
- **10-20 kid pilot** in controlled workshop environment

### Development Timeline Estimate
*Note: Rough estimate, will vary based on team size and expertise*

- **Design & Planning**: 2-3 weeks
  - Finalize UI/UX for drawing interface
  - Define AI pipeline architecture
  - Create detailed technical specs

- **Core Development**: 8-12 weeks
  - Drawing interface (2-3 weeks)
  - AI processing pipeline (4-5 weeks)
  - 3D viewer component (2-3 weeks)
  - Export & teacher tools (1-2 weeks)

- **Testing & Iteration**: 4-6 weeks
  - Internal testing
  - Print testing (calibrate tolerances)
  - Pilot workshop with real kids
  - Bug fixes and improvements

**Total: ~4-6 months for MVP**

### Success Criteria for Phase 1
- 80%+ of kids complete drawing session
- 85%+ print success rate
- 75%+ successful assembly without major frustration
- Positive feedback from kids and teachers
- Cost per child <$15

### If Successful → Proceed to Phase 2

---

## Phase 2: Expansion

### Add Variety
- **Expand categories**:
  - Structures: Castle, House
  - Vehicles: Rocket, Car
- **5 pieces** per character (add complexity)
- **More templates** within categories:
  - Creatures: Dragon, Monster, Pet
  - Structures: Treehouse, Tower
  - Vehicles: Boat, Airplane

### Enhanced Features
- **Improved AI**: Better accuracy, faster processing
- **More viewer controls**: Exploded view, assembly animation
- **Customization options**: Add accessories, change proportions
- **Gallery sharing**: Kids see peers' creations (inspiration)
- **Achievement system**: Unlock new templates after completing X characters

### Advanced Integration
- **Multi-character scenes**: Build multiple characters from same story
- **Story-driven workshops**: Create story, then build all characters/settings
- **Take-home kits**: Pre-printed pieces + assembly instructions for home

### What NOT to Include (Keep It Simple)
- ❌ AR preview (removed per your feedback)
- ❌ Multi-material printing (stick to single-color PLA)
- ❌ Articulated joints (too complex for Phase 2, maybe Phase 3)
- ❌ Full generic custom mode (stick to templates)
- ❌ Online marketplace (don't need to share STLs publicly yet)

---

## Open Questions & Future Decisions

### Technical Decisions Needed
1. **AI approach**: Rule-based vs. ML model vs. hybrid?
2. **Hosting**: Cloud-based or local workshop setup?
3. **Printer recommendation**: Which specific models to suggest to partners?

### Business/Workshop Questions
1. **Pricing model**: Materials fee? Premium workshop tier?
2. **Partnerships**: Sell to schools? Libraries? Maker spaces?
3. **Scaling**: How many printers needed per X kids?

### Product Evolution
1. **Phase 3 features**: Articulated joints? Moving parts?
2. **Different materials**: Wood filament? Flexible TPU?
3. **Advanced mode**: Older kids (9-12) with more freedom?

---

## Design Principles Compliance

This feature has been designed following KindleWood's 8 core system design principles:

1. **Security by Default** ✅
   - RBAC with child/teacher/admin roles
   - Row-Level Security in Supabase
   - File upload validation (size, type, malware scan)
   - Signed URLs for all file access (never direct S3)
   - Rate limiting on expensive operations
   - Audit logging for teacher actions

2. **Clear API Contracts** ✅
   - All endpoints defined with Zod schemas
   - Versioned at /api/v1/
   - Standardized error responses
   - Request validation on all routes
   - OpenAPI documentation generated
   - TypeScript client for frontend

3. **Scalable Database Schema** ✅
   - Proper foreign keys and constraints
   - Indexes for common queries
   - Row-Level Security policies
   - Soft deletes (deleted_at)
   - Version tracking for iterations
   - Optimized queries (avoid N+1)

4. **Reusable Components** ✅
   - Generic DrawingCanvas component
   - Generic Model3DViewer component
   - Shared file upload utilities
   - Workshop UI patterns (wizards, progress)

5. **Reuse Before Rebuild** ✅
   - Konva.js for drawing (not custom canvas)
   - Three.js for 3D viewer (industry standard)
   - trimesh for STL export (don't rebuild)
   - OpenCV for image processing (mature)
   - Rule-based extrusion (not complex AI)

6. **Separation of Concerns** ✅
   - UI → API → Service → Repository layers
   - No business logic in API routes
   - No database calls in UI components
   - External services abstracted
   - Dependency injection for testing

7. **Prefer Stateless Services** ✅
   - State in database, not server memory
   - Async job queue for 3D generation
   - Supabase Realtime for progress updates
   - Stateless API handlers (multi-server ready)

8. **Responsive & Accessible UI** ✅
   - Responsive design (mobile/tablet/desktop)
   - Touch-optimized (44px min touch targets)
   - Keyboard navigation
   - Screen reader support (ARIA labels)
   - WCAG AA color contrast minimum
   - Large fonts for kids (18-20px)

**📋 Full Compliance Analysis**: See [3DModeling-Architecture-Review.md](./3DModeling-Architecture-Review.md)

---

## Cost Estimates

### MVP (Rule-Based Extrusion)
- Image upload storage: $0.001
- 3D processing (serverless): $0.005
- STL file storage: $0.002
- Database operations: $0.001
- **Total: ~$0.01 per project** ✅ Very affordable

For 100 kids: **$1.00 total**

### Phase 2 (AI-Based if needed)
- Meshy.ai API: $0.10-0.50 per piece × 4 pieces = $0.40-2.00
- Other costs: $0.01
- **Total: ~$0.41-2.01 per project**

For 100 kids: **$41-201 total** (40-200x more expensive)

**Recommendation**: Start with MVP. Only upgrade to AI if quality is insufficient.

---

## Summary

This feature combines KindleWood's story-driven character creation with hands-on physical building, creating a unique "stories that come to life" experience. By starting with templated character categories (creatures, structures, vehicles) and a guided decomposition process, we balance creative freedom with technical feasibility.

**Key Success Factors**:
- ✅ Leverage existing character emotional connection
- ✅ Age-appropriate guidance and simplicity
- ✅ Educational value (systems thinking, spatial reasoning)
- ✅ 2-session model accommodates print time
- ✅ Teacher-supported environment handles complexity
- ✅ Variety through 3 categories prevents monotony
- ✅ Explainable AI enhancements teach engineering thinking
- ✅ **Architecture follows all 8 design principles** ⭐

**Critical Path**:
1. **Phase 0**: Manual validation (prove concept works)
2. **Security & Architecture Review**: Address critical items in Architecture Review doc
3. **Phase 1**: MVP with dino template using rule-based extrusion (prove tech works)
4. **Phase 2**: Expansion (scale to multiple templates, evaluate AI if needed)

**Go/No-Go**: ✅ Proceed with Phase 0, but **block Phase 1 development** until:
- Security model fully designed (RBAC, RLS, file validation)
- API contracts defined (Zod schemas, OpenAPI)
- Database schema reviewed and approved
- Auto-save implemented (prevent data loss)
- Accessibility requirements met (WCAG AA minimum)

**The Vision**: Every child's story character can become a real toy they built themselves, teaching valuable skills while creating lasting memories and physical artifacts of their creativity.

---

## Related Documents

- **[3DModeling-Architecture-Review.md](./3DModeling-Architecture-Review.md)** - Detailed design principles compliance analysis, security considerations, risks, and tech stack evaluation
- **CLAUDE.MD** (to be created) - Project-wide design principles and development guidelines
