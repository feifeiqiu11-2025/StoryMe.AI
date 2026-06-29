# Phase 0 Quick Start Guide
## Get Started in 48 Hours

This is your actionable checklist to launch Phase 0 testing within 2 days.

---

## Day 1: Setup & Preparation

### Morning (2-3 hours): Acquire 3D Printer Access

**Option A: Borrow/Rent** (Recommended for Phase 0)
- [ ] Check local makerspaces/libraries with 3D printers
  - Search: "[your city] makerspace" or "[your city] fab lab"
  - Many offer day passes ($5-20) or free access with membership
- [ ] Ask friends/colleagues who have 3D printers
- [ ] Check universities (some allow community access)

**Option B: Purchase Entry-Level** (If planning long-term)
- [ ] Budget: $200-300
- [ ] Recommended models:
  - **Creality Ender 3 V3** (~$200) - Most popular, huge community
  - **Anycubic Kobra 2** (~$250) - Faster, quieter
  - **Prusa Mini+** (~$400) - Best quality, more expensive
- [ ] Purchase PLA filament (1kg roll, 2-3 colors): $40-60

**What to Look For**:
- Build volume: At least 200×200×200mm (A4 paper fits diagonally)
- Heated bed (for PLA adhesion)
- Community support (for troubleshooting)

### Afternoon (3-4 hours): Learn 3D Modeling Basics

**Tinkercad Tutorial** (Easiest, recommended)
- [ ] Go to https://www.tinkercad.com
- [ ] Create free account
- [ ] Complete "Learn" tutorials (30 min):
  - Basic shapes
  - Grouping and holes
  - Align tool
- [ ] Practice project: Create a simple 4-piece dinosaur (2 hours)
  - Body (oval, extrude 10mm)
  - Head (circle, extrude 8mm)
  - 2 Legs (rectangles, extrude 10mm)
  - Add connection tabs/holes (use cylinder + hole)

**Test Your Skills**:
- [ ] Export as STL
- [ ] Check file in slicer software (Cura or PrusaSlicer)
- [ ] Does it look printable? (no floating parts, flat base)

### Evening (1-2 hours): Print Test Connections

**Goal**: Validate connection tolerances before testing with kids

**Print Test Pieces**:
```
Test Piece A: Tab (male connector)
  - Base: 8mm wide, 5mm tall, 3mm thick
  - Chamfer: 15° on edges
  - Print 3 variations:
    - 8.0mm width
    - 7.8mm width (tighter)
    - 8.2mm width (looser)

Test Piece B: Slot (female connector)
  - Opening: 8.5mm wide, 6mm deep, 3mm thick
  - Chamfer: 15° on edges
  - Print 1 piece

Test Assembly:
  - Does 8.0mm tab fit into 8.5mm slot?
  - Too tight? Try 7.8mm tab
  - Too loose? Try 8.2mm tab

Goal: Find the "just right" tolerance for your printer
```

**Document**:
- [ ] Which tab width works best: ___mm
- [ ] Does chamfer help assembly? Yes/No
- [ ] Can you assemble by hand (no tools)? Yes/No

**Use this tolerance for all test pieces with kids**

---

## Day 2: Recruit & Schedule

### Morning (2 hours): Recruit Kids

**Target**: 3-5 kids, ages 5-8

**Where to Find**:
- [ ] Friends' kids
- [ ] Neighbors
- [ ] Community centers
- [ ] Local schools (ask teachers)
- [ ] Social media (parent groups)

**How to Ask**:
```
"Hi! I'm testing a new workshop where kids draw characters
and we 3D print them into toys they can assemble.

It's 2 short sessions:
- Session 1 (60 min): Drawing
- Session 2 (45 min): Assembly - 2 days later

Totally free, and they keep the toy!

Interested? Need 3-5 kids ages 5-8."
```

**Schedule**:
- [ ] Kid 1: Name _____, Age _____, Session 1: ___/___
- [ ] Kid 2: Name _____, Age _____, Session 1: ___/___
- [ ] Kid 3: Name _____, Age _____, Session 1: ___/___
- [ ] Kid 4: Name _____, Age _____, Session 1: ___/___
- [ ] Kid 5: Name _____, Age _____, Session 1: ___/___

**Spacing**:
- 1-2 days between Session 1 and Session 2 (printing time)
- Can do multiple kids' Session 1 on same day (different time slots)
- Or spread across week

### Afternoon (1 hour): Prepare Materials

**Drawing Supplies**:
- [ ] White paper (A4/Letter, 30+ sheets - 6 per kid + extras)
- [ ] Colored markers (at least 8 colors)
- [ ] Crayons (backup)
- [ ] Erasers
- [ ] Pencils (for sketching first)

**Reference Images**:
- [ ] Print 3 simple character references:
  - Simple dinosaur (4-legged, tail)
  - Simple house (box + triangle roof)
  - Simple car (box + wheels)
- [ ] Print piece breakdown diagram (show 6 pieces separated)

**Documentation**:
- [ ] Camera/phone charged
- [ ] Notebook + pen
- [ ] Printed data collection template (from Phase 0 plan)
- [ ] Timer/stopwatch app

**Workspace Setup**:
- [ ] Comfortable table + chairs (kid height if possible)
- [ ] Good lighting
- [ ] Quiet space (minimal distractions)
- [ ] Snacks/water available

### Evening (1 hour): Final Checklist

**Logistics**:
- [ ] 3D printer access confirmed for next 2 weeks
- [ ] Tinkercad account ready
- [ ] Slicer software installed (Cura or PrusaSlicer)
- [ ] Filament acquired (at least 500g)
- [ ] Test connections printed and validated

**Test Session Prep**:
- [ ] Reference images printed
- [ ] Data collection template printed
- [ ] Camera ready
- [ ] Workspace clean and welcoming
- [ ] Backup plan if kid doesn't show

**Mental Prep**:
- [ ] Review Phase 0 test plan (especially Session 1 script)
- [ ] Practice explaining piece decomposition out loud
- [ ] Remind yourself: Observe, don't judge!
- [ ] Goal is learning, not perfect results

---

## Your First Test Session

### 30 Minutes Before Kid Arrives

- [ ] Set up workspace
- [ ] Lay out materials
- [ ] Test camera
- [ ] Review script for Session 1
- [ ] Take deep breath!

### During Session 1 (60 min)

**Follow the script in Phase 0 test plan**:
1. Introduction (5 min)
2. Character selection (3 min)
3. Piece breakdown explanation (5 min)
4. Drawing pieces (30-40 min)
5. Review together (5 min)

**Key reminders**:
- Let kid choose character (don't force dinosaur)
- Encourage, don't correct drawings
- Take photos of each piece
- Note time stamps
- Observe attention span
- Let kid take breaks if needed

### Immediately After Session 1

- [ ] Thank kid (and parent)
- [ ] Confirm Session 2 date/time
- [ ] Transfer photos to computer
- [ ] Write down observations while fresh
- [ ] Scan/photograph drawings (backup)
- [ ] Begin 3D modeling ASAP

---

## Between Sessions: 3D Modeling & Printing

### Same Day as Session 1 (if possible)

**3D Modeling** (3-5 hours):
- [ ] Import first drawing into Tinkercad
- [ ] Trace rough shape with basic geometry
- [ ] Extrude to 10-15mm depth
- [ ] Add connection points (using your tested tolerances)
- [ ] Export STL
- [ ] Repeat for all 6 pieces

**Tips**:
- Don't aim for perfection (you're simulating automated process)
- Keep it simple (rule-based approach)
- Consistent depth (10mm for small pieces, 15mm for large)
- Always add chamfers to connections (15° angle)

### Next Day: Printing

**Slice & Print** (6-10 hours total, mostly unattended):
- [ ] Import all STLs into slicer
- [ ] Arrange on build plate (maximize bed usage)
- [ ] Settings:
  - Layer height: 0.2mm
  - Infill: 15-20%
  - Supports: Only if necessary
  - Print speed: 50mm/s (reliability > speed)
- [ ] Start print
- [ ] Monitor first layer (critical for adhesion)
- [ ] Check periodically (every 2-3 hours if possible)

**If Print Fails**:
- [ ] Note which piece and why (adhesion, warping, etc.)
- [ ] Fix issue (clean bed, adjust settings)
- [ ] Reprint failed piece
- [ ] Document in notes

### Day Before Session 2

**Post-Processing**:
- [ ] Remove all pieces from build plate
- [ ] Clean off any support material
- [ ] Sand any sharp edges (safety!)
- [ ] Test assembly yourself (do pieces fit?)
- [ ] If too tight: Light sanding on tabs
- [ ] If too loose: Note for next iteration (adjust tolerance)

**Prepare for Session 2**:
- [ ] Put pieces in bag/box (presentation matters!)
- [ ] Print assembly instruction diagram
- [ ] Prepare assembly tools (sandpaper, file - just in case)
- [ ] Review Session 2 script

---

## Session 2: Assembly Day

### 15 Minutes Before

- [ ] Set up workspace
- [ ] Lay out printed pieces (hidden until "reveal")
- [ ] Assembly instructions ready
- [ ] Tools available (but out of sight initially)
- [ ] Camera ready

### During Session 2 (45 min)

**Follow Session 2 script**:
1. Unboxing (5 min) - Capture this reaction!
2. Assembly instructions (5 min)
3. Assembly process (15-25 min) - Let kid lead
4. Play time (10-15 min) - Observe durability
5. Feedback interview (5-10 min)

**Key observations**:
- Recognition reaction (do they see their drawings?)
- Assembly independence (how much help needed?)
- Connection success (too tight/loose/just right?)
- Durability during play (pieces stay together?)
- Enjoyment level (playing or just being polite?)

### Immediately After

- [ ] Thank kid and parent
- [ ] Ask parent pricing question (in private)
- [ ] Take final photos (completed toy)
- [ ] Write observations
- [ ] Clean up workspace

---

## After All 5 Kids Tested

### Week 4: Analysis

**Compile Data** (4 hours):
- [ ] Transfer all notes to spreadsheet
- [ ] Calculate averages:
  - Completion rate (Session 1)
  - Assembly success rate
  - Satisfaction scores
  - Print success rate
- [ ] Organize photos/videos by kid
- [ ] Identify patterns (what worked, what didn't)

**Make Decision**:
- [ ] Review success criteria from Phase 0 plan
- [ ] ✅ GO: Met 80% thresholds → Proceed to Phase 1
- [ ] ❌ NO-GO: Failed critical criteria → Document learnings
- [ ] ⚠️ REVISE: Mixed results → Iterate Phase 0

**Document Results**:
- [ ] Write 1-2 page summary
- [ ] Include key metrics
- [ ] Highlight insights (quotes, photos)
- [ ] Make recommendation (GO/NO-GO/REVISE)
- [ ] Share with stakeholders (if any)

---

## Common Pitfalls to Avoid

### Don't:
- ❌ Lead kids too much ("Draw it like THIS")
- ❌ Fix their drawings (let them be imperfect)
- ❌ Rush sessions (let kids take their time)
- ❌ Over-promise ("This will be PERFECT!")
- ❌ Forget to document (take too many photos rather than too few)
- ❌ Get discouraged by first print failure (it happens!)
- ❌ Skip parent feedback (critical for pricing)

### Do:
- ✅ Observe neutrally (you're a researcher, not teacher)
- ✅ Embrace imperfection (it's more realistic)
- ✅ Be flexible (kid wants to draw house instead of dino? Great!)
- ✅ Take detailed notes (you'll forget details)
- ✅ Test assembly yourself first (catch issues early)
- ✅ Have fun! (Kids can tell if you're stressed)

---

## Budget Tracking

Track actual costs:

```
Equipment:
- 3D printer access: $____
- Filament (___g @ $__/kg): $____
- Paper/markers: $____
- Other materials: $____

Time:
- Prep: ___ hours
- Session 1s (5 × ___ min): ___ hours
- 3D modeling (5 × ___ hours): ___ hours
- Printing (monitoring): ___ hours
- Session 2s (5 × ___ min): ___ hours
- Analysis: ___ hours
Total: ___ hours

Cost per child: $____
Time per child: ___ hours
```

This helps estimate Phase 1 costs and workshop pricing.

---

## Emergency Contacts

**3D Printing Help**:
- Reddit: r/3Dprinting (active, helpful community)
- Tinkercad: Built-in tutorials and forum
- YouTube: Search "[your printer model] troubleshooting"

**If Stuck on 3D Modeling**:
- Tinkercad Discord: https://discord.gg/tinkercad
- Can also hire freelancer on Fiverr ($5-20 per model) if completely blocked

**Kid No-Shows**:
- Have backup activity (let them draw freely)
- Or reschedule (don't stress)
- Minimum 3 kids needed for patterns

---

## What Success Looks Like

After 4 weeks, you'll have:

1. **Concrete data** on feasibility (not guesses)
2. **5 physical prototypes** (proof it works)
3. **Photos/videos** (for marketing later)
4. **Refined understanding** of what kids can/can't do
5. **Validated pricing** (what parents will pay)
6. **Confidence** to build Phase 1 (or decision to pivot)

**Most importantly**: You'll know if this concept is worth 4-6 months of development.

---

## You're Ready!

**Next immediate steps**:
1. Tomorrow: Secure 3D printer access
2. Tomorrow evening: Complete Tinkercad tutorial
3. Day 2: Recruit first 2-3 kids
4. Day 3: Print test connections
5. Week 2: First test session

**Remember**: Phase 0 is about learning, not perfection. Every "failure" teaches you something valuable.

**Questions before starting?** Review:
- [3DModeling-Phase0-TestPlan.md](./3DModeling-Phase0-TestPlan.md) - Full detailed plan
- [3DModeling.MD](./3DModeling.MD) - Overall feature vision

**Good luck! You've got this.** 🎉

---

## Need Help During Phase 0?

If you hit blockers:
- **3D printer issues**: Post on r/3Dprinting with photos
- **3D modeling questions**: Tinkercad community or YouTube
- **Kid behavior questions**: Trust your instincts, there's no "right" way
- **Analysis questions**: Come back with your data, we can help interpret

The goal is to **learn fast and cheaply**. Don't aim for perfection - aim for insights.

Start when you're ready!
