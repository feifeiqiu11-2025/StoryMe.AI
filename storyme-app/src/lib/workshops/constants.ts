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
  dateLabel: string; // e.g. "Sunday, March 15, 2026"
  theme: string; // e.g. "Nature", "Innovation"
  morning: WorkshopSessionSlot;
  afternoon: WorkshopSessionSlot;
}

export interface WorkshopSessionPricing {
  originalPrice: number; // cents — displayed with strikethrough
  promoPrice: number; // cents — current/sale price
}

export interface WorkshopPricing {
  morning: WorkshopSessionPricing;
  afternoon: WorkshopSessionPricing;
  currency: string;
}

export interface WorkshopCapacity {
  morning: number;
  afternoon: number;
}

export interface WorkshopLocation {
  name: string;
  address: string;
  mapUrl?: string;
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
  sessions: WorkshopSession[];
  pricing: WorkshopPricing;
  capacity: WorkshopCapacity;
  location?: WorkshopLocation;
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
      afternoon: { originalPrice: 7500, promoPrice: 6000 }, // $75 → $60
      currency: 'usd',
    },
    capacity: { morning: 10, afternoon: 10 },
    location: {
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
    tagline: 'Creative Storytelling in the Montessori Classroom',
    description: 'Workshop details coming soon. We\'re developing a creative storytelling curriculum tailored to the Montessori learning approach.',
    partnerDescription: '',
    theme: 'amber',
    comingSoon: true,
    sessions: [],
    pricing: {
      morning: { originalPrice: 0, promoPrice: 0 },
      afternoon: { originalPrice: 0, promoPrice: 0 },
      currency: 'usd',
    },
    capacity: { morning: 0, afternoon: 0 },
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
      'Parents are welcome to stay during the workshop sessions. For the final Show & Tell / Maker Showcase sessions (Week 5), we especially encourage family attendance to celebrate your child\'s creative journey.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'Morning sessions (1 hour) and afternoon sessions (2 hours) are priced per session. Promotional pricing is already applied to the displayed prices. If you have an additional promo code from a partner or special promotion, you can enter it on the Stripe checkout page for further savings.',
  },
  {
    question: 'What is the cancellation and refund policy?',
    answer:
      'Full refunds are available up to 48 hours before the workshop date. Within 48 hours, we offer a credit toward future workshops. Bundle purchases can be partially refunded for unattended sessions. Please contact us for specific situations.',
  },
  {
    question: 'What age groups are the workshops for?',
    answer:
      'Morning sessions (10:00–11:00 AM, 1 hour) are designed for younger children (ages 4–6) with a focus on imaginative play, storytelling, and art. Afternoon sessions (1:00–3:00 PM, 2 hours) are for older children (ages 7–9) with more complex activities including nature exploration, maker projects, and digital storytelling.',
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

// --- Bundle pricing (commented out for future use) ---
// export function getBundleSavingsPercent(pricing: WorkshopPricing): number {
//   if (pricing.bundleCount === 0) return 0;
//   const fullPrice = pricing.singleWorkshop * pricing.bundleCount;
//   return Math.round(((fullPrice - pricing.bundlePrice) / fullPrice) * 100);
// }
