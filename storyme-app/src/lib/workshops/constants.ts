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

export interface WorkshopLocation {
  slug: string; // e.g. 'bellevue', 'kirkland'
  name: string;
  address: string;
  mapUrl?: string;
  taxRate?: number; // e.g. 0.103 for 10.3% WA sales tax
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
  theme: 'green' | 'amber' | 'blue' | 'purple';
  comingSoon: boolean;
  sessionMode: 'single' | 'dual'; // single = one session type; dual = morning + afternoon
  enrollmentMode?: 'individual' | 'series'; // individual = pick sessions; series = enroll in full series
  sessions: WorkshopSession[];
  pricing: WorkshopPricing;
  capacity: WorkshopCapacity;
  location?: WorkshopLocation; // Single location (SteamOji)
  locations?: WorkshopLocation[]; // Multiple locations (Avocado)
  partnerUrl?: string; // Link to partner website
}

export const WORKSHOP_PARTNERS: WorkshopPartner[] = [
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
    comingSoon: false,
    sessionMode: 'dual',
    enrollmentMode: 'individual',
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
      'A Montessori-aligned storytelling program where children ages 3–6 explore real-world themes through craft, guided storytelling, and creative expression. Each 4-session series produces 2 physical storybooks — one every two sessions — that children take home as keepsakes of their learning journey.',
    partnerDescription:
      'Avocado Montessori Academy nurtures young learners through the Montessori philosophy of independence, hands-on discovery, and respect for each child\'s natural development. With campuses in Bellevue and Kirkland, they serve families across the Eastside.',
    theme: 'amber',
    comingSoon: false,
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
      // Series 2: Curious Minds (preview — not enrollable yet)
      {
        id: 'avocado-s2-wk1',
        dateLabel: 'Week 5',
        theme: 'STEM Thinking',
        themeDescription: 'Story Spark: discover patterns & logic, craft a detective character, and build a guided story plot',
        series: 2,
        enrollable: false,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'Pattern Detective — Story Spark',
          description:
            'Children discover patterns and logic through hands-on activities, create a detective character, and build a guided problem-solving story plot.',
          highlights: [
            'Pattern recognition & logical thinking',
            'Story character creation & plot building',
            'Problem-solving narrative structure',
          ],
        },
      },
      {
        id: 'avocado-s2-wk2',
        dateLabel: 'Week 6',
        theme: 'STEM Thinking',
        themeDescription: 'Book Making: complete the story, produce a physical storybook, sign & show-and-tell',
        series: 2,
        enrollable: false,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'Pattern Detective — Storybook',
          description:
            'Children complete their pattern detective story with detailed illustrations, produce a physical storybook, sign their work, and share it in a show-and-tell circle.',
          highlights: [
            'Detailed story completion & illustration',
            'Physical storybook production',
            'Book signing & show-and-tell celebration',
          ],
        },
      },
      {
        id: 'avocado-s2-wk3',
        dateLabel: 'Week 7',
        theme: 'Financial Awareness',
        themeDescription: 'Story Spark: explore saving & sharing, craft a character, and build a guided story plot',
        series: 2,
        enrollable: false,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'My First Piggy Bank — Story Spark',
          description:
            'Kids explore saving, spending, and sharing through creative play, craft a story character, and build a guided plot about making choices with resources.',
          highlights: [
            'Value awareness through creative play',
            'Story character creation & plot building',
            'Decision-making & trade-off thinking',
          ],
        },
      },
      {
        id: 'avocado-s2-wk4',
        dateLabel: 'Week 8',
        theme: 'Financial Awareness',
        themeDescription: 'Book Making: complete the story, produce a physical storybook, sign & show-and-tell',
        series: 2,
        enrollable: false,
        morning: {
          time: 'TBD',
          ageRange: 'Ages 3–6',
          title: 'My First Piggy Bank — Storybook',
          description:
            'Kids complete their piggy bank story with detailed illustrations, produce a physical storybook, sign their work, and present it in a show-and-tell circle.',
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
      single: 12,
      perLocation: { bellevue: 12, kirkland: 12 },
    },
    locations: [
      { slug: 'bellevue', name: 'Bellevue Campus', address: 'TBD', taxRate: 0.103 },
      { slug: 'kirkland', name: 'Kirkland Campus', address: 'TBD', taxRate: 0.102 },
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
      'Pricing varies by partner and program. SteamOji workshops are priced per session (morning and afternoon). Avocado Montessori workshops are enrolled by series — each series includes 4 sessions and 2 physical storybooks. If you have a promo code, you can enter it on the Stripe checkout page.',
  },
  {
    question: 'What is the cancellation and refund policy?',
    answer:
      'Full refunds are available up to 48 hours before the workshop date. Within 48 hours, we offer a credit toward future workshops. Series purchases can be partially refunded for unattended sessions. Please contact us for specific situations.',
  },
  {
    question: 'What age groups are the workshops for?',
    answer:
      'SteamOji morning sessions (Ages 4–6, 1 hour) focus on imaginative play and storytelling. Afternoon sessions (Ages 7–9, 2 hours) include nature exploration and maker projects. Avocado Montessori sessions are designed for Ages 3–6 with a Montessori-aligned approach to creative storytelling.',
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
