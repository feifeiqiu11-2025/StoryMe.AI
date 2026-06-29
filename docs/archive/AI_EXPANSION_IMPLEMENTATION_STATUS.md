# AI Story Expansion Feature - Implementation Status

## 📊 **Current Progress: 60% Complete**

---

## ✅ **Completed Components**

### **1. Type Definitions** ✓
**File:** `src/lib/types/story.ts`

Added:
- `ExpansionLevel` type: 'minimal' | 'smart' | 'rich'
- Updated `EnhancedScene` interface with `title` and `isNewCharacter` fields
- Updated `StorySession` with `expansionLevel`, `enhancedScenes`, `approvedForGeneration`

### **2. ExpansionLevelSelector Component** ✓
**File:** `src/components/story/ExpansionLevelSelector.tsx`

Features:
- 3 expansion options with clear descriptions
- Age-based scene count estimates
- Visual radio button UI with selection indicators
- Helpful tips for users
- Default set to "Minimal"

### **3. ScenePreviewApproval Component** ✓
**File:** `src/components/story/ScenePreviewApproval.tsx`

Features:
- Full-page preview of enhanced scenes before image generation
- Shows scene titles, captions, and characters
- Highlights new characters added by AI
- Summary statistics (total scenes, characters, estimated time)
- Approve/Back buttons
- Cost-saving preview workflow

### **4. AI Scene Enhancer Logic** ✓
**File:** `src/lib/ai/scene-enhancer.ts`

Added:
- `getTargetSceneCount()` - Calculates target scene count by age and expansion level
- `getExpansionInstructions()` - Generates AI prompts for each expansion level
- Updated `buildEnhancementPrompt()` to accept `expansionLevel` parameter
- Updated `parseEnhancementResponse()` to handle expanded scenes and new characters
- Enhanced JSON output format with titles and character tracking

**Expansion Logic:**
- **Minimal:** Keep exact scene count, only enhance captions
- **Smart:**
  - Age 3-4: 2x scenes, max 8
  - Age 5-6: 2.5x scenes, max 10
  - Age 7-8: 3x scenes, max 12
- **Rich:** 3x scenes, 12-15 total

### **5. API Route Updates** ✓
**File:** `src/app/api/enhance-scenes/route.ts`

Changes:
- Added `expansionLevel` parameter (defaults to 'minimal')
- Passes expansion level to AI prompt builder
- Logging includes expansion level

---

## 🚧 **Remaining Work (40%)**

### **6. Update StorySettingsPanel**
**File:** `src/components/story/StorySettingsPanel.tsx`

**TODO:**
- Import `ExpansionLevelSelector` component
- Add expansion level state
- Pass expansion level to parent component
- Add it to the UI between story tone and enhance button

**Example Integration:**
```tsx
import ExpansionLevelSelector from './ExpansionLevelSelector';

// In component:
<ExpansionLevelSelector
  value={expansionLevel}
  readingLevel={readingLevel}
  onChange={setExpansionLevel}
/>
```

### **7. Update Create Page Workflow**
**File:** `src/app/(dashboard)/create/page.tsx`

**TODO:**
1. Add state for expansion level:
   ```tsx
   const [expansionLevel, setExpansionLevel] = useState<ExpansionLevel>('minimal');
   ```

2. Add state for preview:
   ```tsx
   const [showPreview, setShowPreview] = useState(false);
   const [enhancedScenes, setEnhancedScenes] = useState<EnhancedScene[]>([]);
   ```

3. Update enhance scenes handler to:
   - Pass `expansionLevel` to API
   - Store `enhancedScenes` in state
   - Show preview instead of going straight to image generation

4. Add preview screen rendering:
   ```tsx
   {showPreview && (
     <ScenePreviewApproval
       enhancedScenes={enhancedScenes}
       originalSceneCount={scenes.length}
       userCharacters={characters.map(c => c.name)}
       onApprove={() => {
         setShowPreview(false);
         // Proceed to image generation
       }}
       onBack={() => {
         setShowPreview(false);
         // Return to settings
       }}
       isGenerating={false}
     />
   )}
   ```

5. Update workflow:
   ```
   OLD: Script → Settings → [Enhance] → Image Generation
   NEW: Script → Settings → [Enhance] → Preview → [Approve] → Image Generation
   ```

### **8. Update Guest Mode** (Optional)
**File:** `src/app/guest/page.tsx`

Same changes as create page for guest users.

---

## 🎯 **Implementation Steps (Next Session)**

### **Step 1: Update StorySettingsPanel** (15 min)
1. Read the file
2. Import ExpansionLevelSelector
3. Add expansion level state and prop
4. Insert component in UI
5. Test rendering

### **Step 2: Update Create Page** (30 min)
1. Add expansion level state
2. Add preview state
3. Update enhance handler
4. Add preview screen conditional rendering
5. Wire up approve/back buttons

### **Step 3: Test All Scenarios** (20 min)
1. Test Minimal expansion (same scene count)
2. Test Smart expansion (2-3x scenes)
3. Test Rich expansion (12-15 scenes)
4. Verify preview shows correctly
5. Verify new characters are highlighted
6. Verify approve proceeds to image gen

### **Step 4: Polish & Error Handling** (15 min)
1. Add loading states
2. Handle API errors gracefully
3. Add helpful user messages
4. Test edge cases (1 scene, 10 scenes, etc.)

**Total Time Estimate:** ~80 minutes

---

## 📋 **Testing Checklist**

### **Minimal Expansion (Default)**
- [ ] User writes 3 scenes
- [ ] Selects "Minimal" (default)
- [ ] Enhances scenes
- [ ] Preview shows EXACTLY 3 scenes
- [ ] No new characters added
- [ ] Captions are improved but story structure unchanged
- [ ] Approves and generates 3 images

### **Smart Expansion**
- [ ] User writes 3 scenes, age 5
- [ ] Selects "Smart"
- [ ] Enhances scenes
- [ ] Preview shows 7-8 scenes (2.5x)
- [ ] New characters are marked with "(NEW)"
- [ ] Story has transitions and details
- [ ] Approves and generates 7-8 images

### **Rich Expansion**
- [ ] User writes 2 scenes, age 7
- [ ] Selects "Rich"
- [ ] Enhances scenes
- [ ] Preview shows 12-15 scenes
- [ ] Story has dialogue, emotions, story arcs
- [ ] Approves and generates 12-15 images

### **Preview Workflow**
- [ ] Preview shows all scenes with titles
- [ ] Character summary is accurate
- [ ] New characters are highlighted
- [ ] Estimated time is correct
- [ ] "Back to Edit" returns to settings
- [ ] "Approve" proceeds to image generation

### **Edge Cases**
- [ ] 1 scene input works
- [ ] 10 scene input works
- [ ] Invalid expansion level defaults to 'minimal'
- [ ] API timeout handled gracefully
- [ ] Parsing errors fall back correctly

---

## 🎨 **User Experience Flow**

### **Current Flow (Without Feature):**
```
1. User inputs script
2. Selects reading level & tone
3. Clicks "Enhance Scenes"
4. Images generate immediately
5. User sees final result
```

### **New Flow (With Feature):**
```
1. User inputs script
2. Selects reading level & tone
3. Selects expansion level (minimal/smart/rich) ← NEW
4. Clicks "Enhance Scenes" ← NEW
5. Sees preview with scene titles/captions ← NEW
6. Reviews:
   - Scene count
   - New characters
   - Story flow
7. Options:
   a) "Back to Edit" - change settings, try different expansion
   b) "Approve & Generate Images" - proceed
8. Images generate
9. User sees final result
```

**Benefits:**
- ✅ User control over story expansion
- ✅ Preview before expensive image generation
- ✅ Opportunity to adjust before committing
- ✅ Saves money on regenerations
- ✅ Clear expectations of AI behavior

---

## 💡 **Design Decisions Summary**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Default Expansion** | Minimal | Respects user's original story |
| **Preview Step** | Always | Saves costs, sets expectations |
| **Expansion Levels** | 3 levels | Simple but flexible |
| **Scene Count Logic** | Age-based | Age-appropriate story length |
| **New Characters** | Allowed in Smart/Rich | Enables richer storytelling |
| **Character Marking** | "(NEW)" suffix | Clear visibility of AI additions |
| **Titles** | Always included | Better preview experience |

---

## 📂 **Files Modified/Created**

### **Created:**
1. `src/components/story/ExpansionLevelSelector.tsx`
2. `src/components/story/ScenePreviewApproval.tsx`
3. `AI_EXPANSION_IMPLEMENTATION_STATUS.md` (this file)

### **Modified:**
1. `src/lib/types/story.ts`
2. `src/lib/ai/scene-enhancer.ts`
3. `src/app/api/enhance-scenes/route.ts`

### **Remaining to Modify:**
1. `src/components/story/StorySettingsPanel.tsx`
2. `src/app/(dashboard)/create/page.tsx`
3. `src/app/guest/page.tsx` (optional)

---

## 🚀 **Ready to Continue?**

The foundation is complete! Next session, we can:
1. Integrate the components into the UI
2. Wire up the workflow
3. Test all three expansion modes
4. Deploy to production

Estimated completion time: **1-1.5 hours**

---

Let me know when you're ready to continue implementation! 🎉
