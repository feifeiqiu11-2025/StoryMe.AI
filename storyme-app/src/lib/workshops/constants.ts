/**
 * Workshop Data Constants
 *
 * Hardcoded workshop content for MVP.
 * Isolates content from UI for easy future migration to CMS/database.
 */

export interface WorkshopSessionSlot {
  time: string;
  ageRange: string;
  title: string;
  description: string;
  highlights: string[];
}

export interface WorkshopSession {
  id: string;
  dateLabel: string; // e.g. "Sunday, March 15, 2026" or "Week 1"
  theme: string; // e.g. "Nature", "Innovation"
  themeDescription?: string; // Short subtitle for curriculum overview
  morning: WorkshopSessionSlot;
  afternoon?: WorkshopSessionSlot; // Optional for single-session partners
  series?: number; // 1, 2, etc. — for grouping sessions into enrollable series
  enrollable?: boolean; // defaults true; false = preview-only (not selectable)
  topicId?: string; // groups sessions into topic-pair enrollment units (e.g. 'time-management')
  topicLabel?: string; // human-readable topic name (e.g. 'Time Management')
}

// Per-session-type program config (dual-mode partners).
// Lets each program have its own name, age range, time label, description,
// and enrollment mode independent of the partner-level enrollmentMode.
export interface DualModeProgram {
  name: string; // e.g. 'Morning Session', 'Creative Storyteller'
  ageLabel: string; // e.g. 'Ages 4–6'
  timeLabel: string; // e.g. '10:00 – 11:00 AM · 1 hour' or '9:45–10:45 AM or 11:00 AM–12:00 PM'
  shortDescription: string; // shown on the session-picker card
  enrollmentMode?: 'individual' | 'series' | 'topic-pair'; // overrides partner-level mode
  // Optional "intro + series-package" split for series-mode programs.
  // When both prices are set, the registration UI renders TWO selectable
  // bundles instead of one Series Overview: the first enrollable session is
  // the intro (priced at introPrice), the remainder form a discounted package
  // (priced at seriesPackagePrice for the whole bundle).
  introPrice?: number; // cents — special price for the first enrollable session
  seriesPackagePrice?: number; // cents — bundle price for the rest of the series
}

export interface WorkshopSessionPricing {
  originalPrice: number; // cents — displayed with strikethrough
  promoPrice: number; // cents — current/sale price
}

export interface WorkshopPricing {
  morning: WorkshopSessionPricing;
  afternoon: WorkshopSessionPricing;
  single?: WorkshopSessionPricing; // For single-session partners (no morning/afternoon split)
  currency: string;
}

export interface WorkshopCapacity {
  morning: number;
  afternoon: number;
  single?: number; // For single-session partners
  perLocation?: Record<string, number>; // Keyed by location slug, for multi-location partners
}

export interface WorkshopTimeSlot {
  slug: string; // e.g. 'slot-1', 'slot-2'
  label: string; // e.g. '3:30 – 4:05 PM'
  startTime: string; // '15:30'
  endTime: string; // '16:05'
}

export interface WorkshopLocation {
  slug: string; // e.g. 'bellevue', 'kirkland'
  name: string;
  address: string;
  mapUrl?: string;
  taxRate?: number; // e.g. 0.103 for 10.3% WA sales tax
  dayOfWeek?: string; // e.g. 'monday', 'wednesday' — for computing session dates
  startDate?: string; // ISO date string, e.g. '2026-04-01'
  skipDates?: string[]; // ISO date strings to skip (e.g. spring break)
  timeSlots?: WorkshopTimeSlot[]; // Available time slots at this location
}

export interface WorkshopPartner {
  id: string;
  slug: string;
  name: string;
  partnerName: string;
  tagline: string;
  description: string;
  partnerDescription: string;
  logoUrl?: string;
  theme: 'green' | 'amber' | 'blue' | 'purple' | 'indigo';
  status: 'active' | 'completed' | 'coming_soon'; // active = render on /workshops + register; completed = preserved for reporting, hidden from public; coming_soon = teaser only
  sessionMode: 'single' | 'dual'; // single = one session type; dual = morning + afternoon
  enrollmentMode?: 'individual' | 'series' | 'topic-pair'; // partner-level default; overridden by morningProgram/afternoonProgram.enrollmentMode
  morningProgram?: DualModeProgram; // dual-mode partner morning program config
  afternoonProgram?: DualModeProgram; // dual-mode partner afternoon program config
  sessions: WorkshopSession[];
  pricing: WorkshopPricing;
  capacity: WorkshopCapacity;
  location?: WorkshopLocation; // Single location (SteamOji)
  locations?: WorkshopLocation[]; // Multiple locations (Avocado)
  partnerUrl?: string; // Link to partner website
}

export const WORKSHOP_PARTNERS: WorkshopPartner[] = [
  {
    id: 'steamoji-summer-2026',
    slug: 'steamoji-summer-2026',
    name: 'KindleWood × SteamOji Summer 2026',
    partnerName: 'SteamOji',
    tagline: 'Where stories meet drama play, and curious kids become confident creators.',
    logoUrl: '/images/steamoji-logo.png',
    description:
      'A summer storytelling series that blends drama play, hands-on craft, and structured storytelling. The morning program (ages 4–6) turns kids into Time Masters and Little Entrepreneurs across 4 sessions — each topic produces a printed storybook. The afternoon Creative Writer workshop (ages 7–12) guides older kids through a 4-session original chapter book project.',
    partnerDescription:
      'SteamOji is a maker academy for kids ages 6–14 that equips children with hands-on STEM skills and a maker mindset to solve real-world problems. Their curriculum spans coding, robotics, engineering, 3D printing, and digital arts — everything from the screen to the workbench.',
    theme: 'green',
    status: 'active',
    sessionMode: 'dual',
    enrollmentMode: 'individual', // partner-level fallback; per-program modes override
    morningProgram: {
      name: 'Creative Storyteller',
      ageLabel: 'Ages 4–6',
      timeLabel: '9:45–10:45 AM or 11:00 AM–12:00 PM',
      shortDescription:
        'Each Sunday is a standalone session — kids craft a story and take home their own printed mini-book',
      enrollmentMode: 'individual',
    },
    afternoonProgram: {
      name: 'Creative Writer',
      ageLabel: 'Ages 7–12',
      timeLabel: '1:00 – 3:00 PM · 2 hours',
      shortDescription:
        'Chapter Book Project — try a half-price preview on May 31, then commit to the 4-session journey',
      enrollmentMode: 'series',
      introPrice: 3500, // $35 — May 31 preview session
      seriesPackagePrice: 25000, // $250 — Jun 7–28 four-session commitment
    },
    partnerUrl: 'https://www.steamoji.com/',
    sessions: [
      // 4 Sundays — each entry holds both the morning (Creative Storyteller, ages 4–6)
      // and afternoon (Creative Writer, ages 7–11) program for that date.
      // topicId on each session groups MORNING sessions into topic pairs for enrollment.
      // Afternoon side uses series enrollment (whole 4-session bundle).
      {
        id: 'steamoji-summer-wk1',
        dateLabel: 'Sun, May 31, 2026',
        theme: 'Time Master',
        topicId: 'time-management',
        topicLabel: 'Time Master',
        themeDescription:
          'Kids learn how to manage time — prioritize what matters, plan ahead, and follow through — wrapped into a drama-play adventure that becomes a printed storybook.',
        morning: {
          time: '9:45–10:45 AM or 11:00 AM–12:00 PM',
          ageRange: 'Ages 4–6',
          title: 'Time Master — Story Spark & Drama Play',
          description:
            'Kids step into a drama-play scenario about time, then build a story spark, design a character through craft, and shape the beginning of a guided story.',
          highlights: [
            'Guided drama play to explore real-world time',
            'Story spark + character craft',
            'Beginning of a structured story plot',
          ],
        },
        afternoon: {
          time: '1:00 – 3:00 PM',
          ageRange: 'Ages 7–12',
          title: 'Chapter Book Preview — Meet the Journey',
          description:
            'A half-price preview for families to experience the workshop format, sample a chapter-book activity, and ask questions before committing to the 4-session series.',
          highlights: [
            'Workshop format overview & sample activity',
            'Hands-on writing & illustration warm-up',
            'Q&A so families can commit (or not) with confidence',
          ],
        },
      },
      {
        id: 'steamoji-summer-wk2',
        dateLabel: 'Sun, Jun 7, 2026',
        theme: 'Plan My Day',
        morning: {
          time: '9:45–10:45 AM or 11:00 AM–12:00 PM',
          ageRange: 'Ages 4–6',
          title: 'Plan My Day',
          description:
            'A story-style planning game — set goals, prioritize, and follow through.',
          highlights: [
            'Hands-on planning game',
            'Story craft about a busy day',
            'Take home a printed mini-book',
          ],
        },
        afternoon: {
          time: '1:00 – 3:00 PM',
          ageRange: 'Ages 7–12',
          title: 'Story Structure & Character Development',
          description:
            'Children learn the bones of a chapter book — characters, setting, conflict — and start mapping their own multi-chapter story.',
          highlights: [
            'Chapter book structure & outlining',
            'Character development workshop',
            'Worldbuilding & setting design',
          ],
        },
      },
      {
        id: 'steamoji-summer-wk3',
        dateLabel: 'Sun, Jun 14, 2026',
        theme: 'Daddy & Me',
        morning: {
          time: '9:45–10:45 AM or 11:00 AM–12:00 PM',
          ageRange: 'Ages 4–6',
          title: 'Daddy & Me — Father\'s Day Book',
          description:
            'Design a personalized Father\'s Day book for Dad — ready for the big day.',
          highlights: [
            'Personalized Father\'s Day storybook',
            'Drawings & favorite memories of Dad',
            'Take it home in time for Father\'s Day',
          ],
        },
        afternoon: {
          time: '1:00 – 3:00 PM',
          ageRange: 'Ages 7–12',
          title: 'Creative Writing & Visual Storytelling',
          description:
            'Children draft chapters, find their narrative voice, and explore how illustrations and prose strengthen each other.',
          highlights: [
            'Chapter drafting & narrative voice',
            'Visual storytelling techniques',
            'Sensory description & detail craft',
          ],
        },
      },
      {
        // Father's Day weekend — both morning Space Explorer (new standalone)
        // and afternoon Creative Writer Chapter 3 run.
        id: 'steamoji-summer-wk-jun21',
        dateLabel: 'Sun, Jun 21, 2026',
        theme: 'Space Explorer',
        morning: {
          time: '9:45–10:45 AM or 11:00 AM–12:00 PM',
          ageRange: 'Ages 4–6',
          title: 'Space Explorer',
          description:
            'Explore planets and astronauts, then craft a space adventure story.',
          highlights: [
            'Space facts + hands-on activity',
            'Design a spaceship & alien character',
            'Take home a space-themed mini-book',
          ],
        },
        afternoon: {
          time: '1:00 – 3:00 PM',
          ageRange: 'Ages 7–12',
          title: 'Artistic Design & Book Creation',
          description:
            'Children design book covers, lay out interior pages, and shape the visual identity of their chapter book.',
          highlights: [
            'Cover design & typography',
            'Page layout & illustration',
            'Visual identity of the book',
          ],
        },
      },
      {
        id: 'steamoji-summer-wk4',
        dateLabel: 'Sun, Jun 28, 2026',
        theme: 'Little Market',
        morning: {
          time: '9:45–10:45 AM or 11:00 AM–12:00 PM',
          ageRange: 'Ages 4–6',
          title: 'Little Market',
          description:
            'Craft your own market goods and trade them with friends.',
          highlights: [
            'Craft your own market goods',
            'Mini exchange with classmates',
            'Take home a printed market booklet',
          ],
        },
        afternoon: {
          time: '1:00 – 3:00 PM',
          ageRange: 'Ages 7–12',
          title: 'Real-World Connections & Showcase',
          description:
            'Children deepen their books with real-world connections — science, technology, observation, and reflection — then present finished chapter books in a family showcase.',
          highlights: [
            'Story ↔ science / tech connections',
            'Observation, imagination & critical thinking',
            'Family showcase of finished chapter books',
          ],
        },
      },
    ],
    pricing: {
      morning: { originalPrice: 4000, promoPrice: 4000 }, // $40/session — no promo strikethrough
      afternoon: { originalPrice: 7000, promoPrice: 7000 }, // $70/session
      currency: 'usd',
    },
    capacity: { morning: 8, afternoon: 10 },
    location: {
      slug: 'bellevue',
      name: 'SteamOji Bellevue Store',
      address: '14315 NE 20th Street, Suite C-E, Bellevue, WA 98007',
      mapUrl: 'https://maps.google.com/?q=14315+NE+20th+Street+Suite+C-E+Bellevue+WA+98007',
      taxRate: 0.103, // WA state sales tax (ESSB 5814 — enrichment workshops), Bellevue
      dayOfWeek: 'sunday',
      startDate: '2026-05-31',
      // Calendar runs straight through 5 Sundays (May 31 → Jun 28). Father's
      // Day Jun 21 is included for afternoon Creative Writer; morning is dark
      // that day (the Jun 21 session entry has no topicId so morning's
      // topic-pair UI naturally excludes it).
      skipDates: [],
      timeSlots: [
        { slug: 'slot-1', label: '9:45 – 10:45 AM', startTime: '09:45', endTime: '10:45' },
        { slug: 'slot-2', label: '11:00 AM – 12:00 PM', startTime: '11:00', endTime: '12:00' },
      ],
    },
  },
  {
    id: 'steamoji',
    slug: 'steamoji',
    name: 'KindleWood × SteamOji',
    partnerName: 'SteamOji',
    tagline: 'Where every story builds a thinker, and every adventure grows a creator.',
    logoUrl: '/images/steamoji-logo.png',
    description:
      'A 5-week themed storytelling series that strengthens executive function, literacy, and creative problem-solving through structured creativity. Each week explores a new theme — Nature, Habits & Health, Innovation, Value & Choices, and Community.',
    partnerDescription:
      'SteamOji is a maker academy for kids ages 6–14 that equips children with hands-on STEM skills and a maker mindset to solve real-world problems. Their curriculum spans coding, robotics, engineering, 3D printing, and digital arts — everything from the screen to the workbench.',
    theme: 'green',
    status: 'completed',
    sessionMode: 'dual',
    enrollmentMode: 'individual',
    morningProgram: {
      name: 'Morning Session',
      ageLabel: 'Ages 4–6',
      timeLabel: '10:00 – 11:00 AM · 1 hour',
      shortDescription:
        'Turn imagination into story characters, make physical books, show & tell',
      enrollmentMode: 'individual',
    },
    afternoonProgram: {
      name: 'Afternoon Session',
      ageLabel: 'Ages 7–9',
      timeLabel: '1:00 – 3:00 PM · 2 hours',
      shortDescription:
        'Nature exploration, creative thinking & story making',
      enrollmentMode: 'individual',
    },
    partnerUrl: 'https://www.steamoji.com/',
    sessions: [
      {
        id: 'steamoji-wk1',
        dateLabel: 'Sunday, March 8, 2026',
        theme: 'Nature',
        morning: {
          time: '10:00 – 11:00 AM',
          ageRange: 'Ages 4–6',
          title: 'Nature Craft + Simple Story',
          description:
            'Kids explore the natural world through a story spark, create a nature-themed craft, and build their first structured story in a guided share circle.',
          highlights: [
            'Themed story spark & craft each week',
            'Guided story building (beginning → problem → solution)',
            'Share circle with full-sentence storytelling',
          ],
        },
        afternoon: {
          time: '1:00 PM – 3:00 PM',
          ageRange: 'Ages 7–9',
          title: 'Ecosystem Observation → Storybook',
          description:
            'Families explore nature trails together, observe ecosystems, then return to the studio to weave discoveries into a structured storybook.',
          highlights: [
            'Family nature exploration with guided observation',
            'Real-world problem identification → story mapping',
            'Innovation builds: blueprints, comics & collaborative projects',
          ],
        },
      },
      {
        id: 'steamoji-wk2',
        dateLabel: 'Sunday, March 15, 2026',
        theme: 'Habits & Health',
        morning: {
          time: '10:00 – 11:00 AM',
          ageRange: 'Ages 4–6',
          title: 'Healthy Hero Craft',
          description:
            'Kids create a healthy hero character through craft, then build a story about their hero\'s positive habits and choices.',
          highlights: [
            'Healthy hero character creation',
            'Guided story about positive habits',
            'Share circle & reflection',
          ],
        },
        afternoon: {
          time: '1:00 PM – 3:00 PM',
          ageRange: 'Ages 7–9',
          title: 'Body Awareness → Habit Comic',
          description:
            'Kids explore body awareness and healthy habits outdoors, then create a comic-style story mapping real-world observations to creative solutions.',
          highlights: [
            'Body awareness exploration',
            'Comic-style story creation',
            'Systems thinking & reflection',
          ],
        },
      },
      {
        id: 'steamoji-wk3',
        dateLabel: 'Sunday, March 29, 2026',
        theme: 'Innovation',
        morning: {
          time: '10:00 – 11:00 AM',
          ageRange: 'Ages 4–6',
          title: 'Helper Tool → Try–Fix Story',
          description:
            'Kids invent a helper tool through craft, then build a try-fix story where their character solves a problem through creative iteration.',
          highlights: [
            'Invention & creative problem-solving',
            'Try–fix narrative structure',
            'Craft creation & storytelling',
          ],
        },
        afternoon: {
          time: '1:00 PM – 3:00 PM',
          ageRange: 'Ages 7–9',
          title: 'Problem Spotting → Blueprint',
          description:
            'Kids identify real-world problems outdoors, then design innovative solutions through story mapping and blueprint creation.',
          highlights: [
            'Real-world problem spotting',
            'Blueprint & design thinking',
            'Story-driven innovation',
          ],
        },
      },
      {
        id: 'steamoji-wk4',
        dateLabel: 'Sunday, April 12, 2026',
        theme: 'Value & Choices',
        morning: {
          time: '10:00 – 11:00 AM',
          ageRange: 'Ages 4–6',
          title: 'Treasure Craft → Choice Story',
          description:
            'Kids create a treasure craft and build a story about making choices — exploring what matters most through creative decision-making.',
          highlights: [
            'Value exploration through craft',
            'Decision-making in stories',
            'Emotional labeling & reflection',
          ],
        },
        afternoon: {
          time: '1:00 PM – 3:00 PM',
          ageRange: 'Ages 7–9',
          title: 'Resource Awareness → Decision Map',
          description:
            'Kids observe resource use in real environments, then create decision maps and stories about trade-offs, consequences, and creative solutions.',
          highlights: [
            'Resource observation & awareness',
            'Decision mapping & consequence thinking',
            'Story-driven ethical reasoning',
          ],
        },
      },
      {
        id: 'steamoji-wk5',
        dateLabel: 'Sunday, April 19, 2026',
        theme: 'Community',
        morning: {
          time: '10:00 – 11:00 AM',
          ageRange: 'Ages 4–6',
          title: 'Build Home/Park → Friendship Story',
          description:
            'The grand finale! Kids build a community space through craft, create a friendship story, and present their work in a celebratory share circle.',
          highlights: [
            'Community building craft',
            'Friendship storytelling',
            'Family showcase & celebration',
          ],
        },
        afternoon: {
          time: '1:00 PM – 3:00 PM',
          ageRange: 'Ages 7–9',
          title: 'Public Space Observation → Design Story',
          description:
            'Kids observe public spaces, then design improvements through collaborative story-driven projects. Families celebrate the creative journey together.',
          highlights: [
            'Public space observation & design',
            'Collaborative project presentation',
            'Family celebration & showcase',
          ],
        },
      },
    ],
    pricing: {
      morning: { originalPrice: 5000, promoPrice: 4000 }, // $50 → $40
      afternoon: { originalPrice: 8000, promoPrice: 7000 }, // $80 → $70
      currency: 'usd',
    },
    capacity: { morning: 10, afternoon: 10 },
    location: {
      slug: 'bellevue',
      name: 'SteamOji Bellevue Store',
      address: '14315 NE 20th Street, Suite C-E, Bellevue, WA 98007',
      mapUrl: 'https://maps.google.com/?q=14315+NE+20th+Street+Suite+C-E+Bellevue+WA+98007',
    },
  },
  {
    id: 'avocado',
    slug: 'avocado',
    name: 'KindleWood × Avocado Montessori',
    partnerName: 'Avocado Montessori Academy',
    tagline: 'Nurturing curious minds through stories, nature, and hands-on discovery.',
    logoUrl: '/images/avocado-logo.png',
    description:
      'A Montessori-aligned storytelling program where children ages 3–6 explore real-world themes through craft, guided storytelling, and creative expression. Series 1 includes 6 sessions and produces 3 physical storybooks — one every two sessions — that children take home as keepsakes of their learning journey.',
    partnerDescription:
      'Avocado Montessori Academy nurtures young learners through the Montessori philosophy of independence, hands-on discovery, and respect for each child\'s natural development. With campuses in Bellevue and Kirkland, they serve families across the Eastside.',
    theme: 'amber',
    status: 'active',
    sessionMode: 'single',
    enrollmentMode: 'series',
    partnerUrl: 'https://avocado-montessori.com/',
    sessions: [
      // Series 1: Core Life Skills (enrollable now)
      // Each topic spans 2 weeks: Week A = story spark & character craft, Week B = book production & show-and-tell
      {
        id: 'avocado-s1-wk1',
        dateLabel: 'Week 1',
        theme: 'Social & Emotional Learning',
        themeDescription: 'Story Spark: explore feelings & friendships, craft a character, and build a guided story plot',
        series: 1,
        enrollable: true,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'My Feelings Story — Story Spark',
          description:
            'Children explore emotions through expressive craft, create a story character, and build a guided story plot about feelings, friendships, and empathy.',
          highlights: [
            'Emotion recognition through craft & storytelling',
            'Story character creation & plot building',
            'Guided narrative: beginning → feeling → resolution',
          ],
        },
      },
      {
        id: 'avocado-s1-wk2',
        dateLabel: 'Week 2',
        theme: 'Social & Emotional Learning',
        themeDescription: 'Book Making: complete the story, produce a physical storybook, sign & show-and-tell',
        series: 1,
        enrollable: true,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'My Feelings Story — Storybook',
          description:
            'Children complete their feelings story with detailed illustrations, produce a physical storybook, sign their work, and share it in a show-and-tell circle.',
          highlights: [
            'Detailed story completion & illustration',
            'Physical storybook production',
            'Book signing & show-and-tell celebration',
          ],
        },
      },
      {
        id: 'avocado-s1-wk3',
        dateLabel: 'Week 3',
        theme: 'Daily Habits & Health',
        themeDescription: 'Story Spark: explore routines & self-care, craft a healthy hero character, and build a guided story plot',
        series: 1,
        enrollable: true,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'Healthy Habits Hero — Story Spark',
          description:
            'Kids create a healthy hero character through craft, spark a story about daily routines and self-care, and build a guided plot around making safe choices.',
          highlights: [
            'Healthy hero character creation',
            'Story spark & guided plot building',
            'Cause-and-effect storytelling',
          ],
        },
      },
      {
        id: 'avocado-s1-wk4',
        dateLabel: 'Week 4',
        theme: 'Daily Habits & Health',
        themeDescription: 'Book Making: complete the story, produce a physical storybook, sign & show-and-tell',
        series: 1,
        enrollable: true,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'Healthy Habits Hero — Storybook',
          description:
            'Kids complete their healthy habits story with detailed illustrations, produce a physical storybook, sign their work, and present it in a show-and-tell circle.',
          highlights: [
            'Detailed story completion & illustration',
            'Physical storybook production',
            'Book signing & show-and-tell celebration',
          ],
        },
      },
      {
        id: 'avocado-s1-wk5',
        dateLabel: 'Week 5',
        theme: 'Animal & World Exploration',
        themeDescription: 'Story Spark: discover animals & habitats, craft a character, and build a guided story plot',
        series: 1,
        enrollable: true,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'My Animal Adventure — Story Spark',
          description:
            'Children explore the animal kingdom through hands-on activities, create a story character inspired by their favorite animal, and build a guided plot about habitats, adaptations, and the natural world.',
          highlights: [
            'Animal & habitat discovery through craft',
            'Story character creation & plot building',
            'Guided narrative: observation → wonder → story',
          ],
        },
      },
      {
        id: 'avocado-s1-wk6',
        dateLabel: 'Week 6',
        theme: 'Animal & World Exploration',
        themeDescription: 'Book Making: complete the story, produce a physical storybook, sign & show-and-tell',
        series: 1,
        enrollable: true,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'My Animal Adventure — Storybook',
          description:
            'Children complete their animal adventure story with detailed illustrations, produce a physical storybook, sign their work, and present it in a show-and-tell circle.',
          highlights: [
            'Detailed story completion & illustration',
            'Physical storybook production',
            'Book signing & show-and-tell celebration',
          ],
        },
      },
      // Series 2: Curious Minds (now enrolling — Community Helpers + Finance & Value)
      {
        id: 'avocado-s2-wk1',
        dateLabel: 'Week 7',
        theme: 'Community Helpers',
        themeDescription: 'Story Spark: discover community roles & connections, craft a helper character, and build a guided story plot',
        series: 2,
        enrollable: true,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'Community Helpers — Story Spark',
          description:
            'Children explore the people who shape their community — firefighters, teachers, doctors, neighbors — and discover how each role connects to caring for others. They craft a helper character and build a guided story plot about helping.',
          highlights: [
            'Discover community roles & connections',
            'Story character creation & plot building',
            'Empathy & helping through narrative',
          ],
        },
      },
      {
        id: 'avocado-s2-wk2',
        dateLabel: 'Week 8',
        theme: 'Community Helpers',
        themeDescription: 'Book Making: complete the story, produce a physical storybook, sign & show-and-tell',
        series: 2,
        enrollable: true,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'Community Helpers — Storybook',
          description:
            'Children complete their community helpers story with detailed illustrations, produce a physical storybook, sign their work, and share it in a show-and-tell circle.',
          highlights: [
            'Detailed story completion & illustration',
            'Physical storybook production',
            'Book signing & show-and-tell celebration',
          ],
        },
      },
      {
        id: 'avocado-s2-wk3',
        dateLabel: 'Week 9',
        theme: 'Finance & Value',
        themeDescription: 'Story Spark: explore saving, sharing & value, craft a character, and build a guided story plot',
        series: 2,
        enrollable: true,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'Finance & Value — Story Spark',
          description:
            'Kids explore saving, sharing, and what makes things valuable through creative play. They craft a story character and build a guided plot about choices and trade-offs.',
          highlights: [
            'Saving, sharing & value awareness',
            'Story character creation & plot building',
            'Decision-making narrative',
          ],
        },
      },
      {
        id: 'avocado-s2-wk4',
        dateLabel: 'Week 10',
        theme: 'Finance & Value',
        themeDescription: 'Book Making: complete the story, produce a physical storybook, sign & show-and-tell',
        series: 2,
        enrollable: true,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'Finance & Value — Storybook',
          description:
            'Kids complete their finance & value story with detailed illustrations, produce a physical storybook, sign their work, and present it in a show-and-tell circle.',
          highlights: [
            'Detailed story completion & illustration',
            'Physical storybook production',
            'Book signing & show-and-tell celebration',
          ],
        },
      },
    ],
    pricing: {
      morning: { originalPrice: 2800, promoPrice: 2800 }, // used as fallback
      afternoon: { originalPrice: 0, promoPrice: 0 },
      single: { originalPrice: 2800, promoPrice: 2800 }, // $28/session
      currency: 'usd',
    },
    capacity: {
      morning: 0,
      afternoon: 0,
      single: 10,
      perLocation: { bellevue: 10, kirkland: 10 },
    },
    locations: [
      {
        slug: 'bellevue',
        name: 'Bellevue Campus',
        address: 'TBD',
        taxRate: 0.103,
        dayOfWeek: 'wednesday',
        startDate: '2026-04-01',
        skipDates: ['2026-04-08'], // Spring break week
        timeSlots: [
          { slug: 'slot-1', label: '3:30 – 4:05 PM', startTime: '15:30', endTime: '16:05' },
          { slug: 'slot-2', label: '4:10 – 4:45 PM', startTime: '16:10', endTime: '16:45' },
        ],
      },
      {
        slug: 'kirkland',
        name: 'Kirkland Campus',
        address: 'TBD',
        taxRate: 0.102,
        dayOfWeek: 'monday',
        startDate: '2026-03-30',
        skipDates: ['2026-04-06'], // Spring break week
        timeSlots: [
          { slug: 'slot-1', label: '3:30 – 4:05 PM', startTime: '15:30', endTime: '16:05' },
          { slug: 'slot-2', label: '4:10 – 4:45 PM', startTime: '16:10', endTime: '16:45' },
        ],
      },
    ],
  },
];

export const WORKSHOP_FAQS = [
  {
    question: 'What should my child bring to the workshop?',
    answer:
      'Just bring your imagination! All materials and supplies are provided. We recommend comfortable clothes that can get a little messy from art projects. For outdoor activities, please wear weather-appropriate clothing and closed-toe shoes.',
  },
  {
    question: 'Can I stay and watch during the workshop?',
    answer:
      'Parents are welcome to stay during the workshop sessions. The last 10 minutes of each session is a Show & Tell where children share what they created — we encourage families to join for this special moment!',
  },
  {
    question: 'How does pricing work?',
    answer:
      'Pricing varies by partner and program. SteamOji workshops are priced per session (morning and afternoon). Avocado Montessori workshops are enrolled by series — Series 1 includes 6 sessions and 3 physical storybooks, while Series 2 includes 4 sessions and 2 physical storybooks. If you have a promo code, you can enter it on the Stripe checkout page.',
  },
  {
    question: 'What is the cancellation and refund policy?',
    answer:
      'Full refunds are available up to 48 hours before the workshop date. Within 48 hours, we offer a credit toward future workshops. Series purchases can be partially refunded for unattended sessions. Please contact us for specific situations.',
  },
  {
    question: 'What age groups are the workshops for?',
    answer:
      'SteamOji Creative Storyteller (Ages 4–6, 1 hour) focuses on drama play, storytelling, and physical storybook creation. Creative Writer (Ages 7–12, 2 hours) is a chapter book project with story structure, creative writing, and real-world connections. Avocado Montessori sessions are designed for Ages 3–6 with a Montessori-aligned approach to creative storytelling.',
  },
  {
    question: 'Where do the workshops take place?',
    answer:
      'SteamOji workshops are held at their Bellevue store (14315 NE 20th Street, Suite C-E). Avocado Montessori workshops take place at the school\'s Bellevue and Kirkland campuses — you choose your preferred location during registration.',
  },
  {
    question: 'Is there a digital waiver required?',
    answer:
      'Yes, a parent or guardian must accept our digital waiver during registration. The waiver covers standard activity participation, photo/video consent for educational documentation, and emergency procedures.',
  },
];

// Helper to format price from cents
export function formatWorkshopPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Helper to get session pricing by type
export function getSessionPricing(
  pricing: WorkshopPricing,
  sessionType: 'morning' | 'afternoon',
): WorkshopSessionPricing {
  return pricing[sessionType];
}

// Helper to get pricing for a partner based on session mode
export function getPartnerSessionPricing(
  partner: WorkshopPartner,
  sessionType?: 'morning' | 'afternoon' | 'single',
): WorkshopSessionPricing {
  if (partner.sessionMode === 'single') {
    return partner.pricing.single || partner.pricing.morning;
  }
  const type = sessionType === 'single' ? 'morning' : (sessionType || 'morning');
  return partner.pricing[type];
}

// Helper to get capacity for a partner, optionally per location
export function getPartnerCapacity(
  partner: WorkshopPartner,
  sessionType?: 'morning' | 'afternoon' | 'single',
  locationSlug?: string,
): number {
  if (partner.sessionMode === 'single' && locationSlug && partner.capacity.perLocation) {
    return partner.capacity.perLocation[locationSlug] || 0;
  }
  if (partner.sessionMode === 'single') {
    return partner.capacity.single || 0;
  }
  const type = sessionType === 'single' ? 'morning' : (sessionType || 'morning');
  return partner.capacity[type];
}

// Helper to get enrollable sessions for a series
export function getEnrollableSessions(partner: WorkshopPartner, series?: number): WorkshopSession[] {
  return partner.sessions.filter(s => {
    if (s.enrollable === false) return false;
    if (series !== undefined && s.series !== series) return false;
    return true;
  });
}

// Helper to get the enrollment mode for a specific session type, falling back
// to the partner-level mode when no per-program override is set.
export function getEnrollmentMode(
  partner: WorkshopPartner,
  sessionType: 'morning' | 'afternoon' | 'single',
): 'individual' | 'series' | 'topic-pair' {
  if (sessionType === 'morning' && partner.morningProgram?.enrollmentMode) {
    return partner.morningProgram.enrollmentMode;
  }
  if (sessionType === 'afternoon' && partner.afternoonProgram?.enrollmentMode) {
    return partner.afternoonProgram.enrollmentMode;
  }
  return partner.enrollmentMode || 'individual';
}

// Helper to group enrollable sessions into topic pairs (topic-pair enrollment mode).
// Returns one entry per distinct topicId, ordered by first appearance in sessions[].
export interface TopicPair {
  topicId: string;
  topicLabel: string;
  sessions: WorkshopSession[]; // sessions belonging to this topic, in order
}

export function getTopicPairs(partner: WorkshopPartner): TopicPair[] {
  const enrollable = getEnrollableSessions(partner);
  const pairsById = new Map<string, TopicPair>();
  for (const session of enrollable) {
    if (!session.topicId) continue;
    const existing = pairsById.get(session.topicId);
    if (existing) {
      existing.sessions.push(session);
    } else {
      pairsById.set(session.topicId, {
        topicId: session.topicId,
        topicLabel: session.topicLabel || session.topicId,
        sessions: [session],
      });
    }
  }
  return Array.from(pairsById.values());
}

// Helper to compute actual session dates from a location's schedule config.
// Returns one entry per session with the formatted date string.
export function getSessionDates(
  location: WorkshopLocation,
  sessionCount: number,
): { weekLabel: string; date: string; formatted: string }[] {
  if (!location.startDate || !location.dayOfWeek) return [];

  const results: { weekLabel: string; date: string; formatted: string }[] = [];
  const skipSet = new Set(location.skipDates || []);

  // Parse start date as local date (YYYY-MM-DD)
  const [startYear, startMonth, startDay] = location.startDate.split('-').map(Number);
  const current = new Date(startYear, startMonth - 1, startDay);

  const shortDays: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
  };
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayPrefix = shortDays[location.dayOfWeek] || '';

  let weekNum = 0;
  while (results.length < sessionCount) {
    // Format as YYYY-MM-DD for skip check
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    const isoDate = `${y}-${m}-${d}`;

    if (!skipSet.has(isoDate)) {
      weekNum++;
      results.push({
        weekLabel: `Week ${weekNum}`,
        date: isoDate,
        formatted: `${dayPrefix}, ${months[current.getMonth()]} ${current.getDate()}`,
      });
    }

    // Advance by 7 days
    current.setDate(current.getDate() + 7);
  }

  return results;
}
