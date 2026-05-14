'use client';

import { useState, useEffect, useRef } from 'react';
import LandingNav from '@/components/navigation/LandingNav';
import {
  MapPin,
  Clock,
  Mail,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';

const ADMIN_EMAIL = 'admin@kindlewoodstudio.ai';

function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

interface Role {
  slug: string;
  title: string;
  altTitle?: string;
  type: string;
  location: string;
  teaser: string;
  overview: string[];
  responsibilities: string[];
  lookingFor: string;
  bonus: string;
}

const roles: Role[] = [
  {
    slug: 'creative-workshop-facilitator',
    title: 'Creative Workshop Facilitator',
    altTitle: 'Lead Teacher',
    type: 'Part-Time · path to Full-Time',
    location: 'Bellevue / Redmond, WA',
    teaser:
      'Lead small-group creative workshops for children. Storytelling, character design, hands-on making.',
    overview: [
      'KindleWood workshops bring small groups of kids together to tell stories, build characters, draw, role-play, and make things they are proud of. We are looking for facilitators who can hold a room of six to ten children, follow their curiosity, and help every child feel like a maker.',
      'You do not need a teaching credential. You do need warmth, presence, and the ability to read a group of five-year-olds in real time.',
    ],
    responsibilities: [
      'Lead 60–90 minute creative workshops on topics like storytelling, character design, and chapter-book writing.',
      'Adapt session plans on the fly based on what the children bring into the room that day.',
      'Guide longer multi-week projects so kids see their work through from spark to finished piece.',
      'Hold space for messy creativity while keeping the group emotionally safe.',
      'Greet parents at pickup and share what their child made.',
    ],
    lookingFor:
      'Backgrounds in early-childhood education, art or drama instruction, or Montessori/Reggio classrooms are a natural fit — but not required. We have hired wonderful facilitators who came from theater, illustration, library storytime, summer camps, and parenting communities.',
    bonus:
      'Theater or drama experience, nature education, creative writing, visual arts, bilingual abilities (Mandarin especially welcome), digital storytelling, prior workshop facilitation.',
  },
  {
    slug: 'teaching-assistant',
    title: 'Teaching Assistant',
    altTitle: 'Creative Classroom Support',
    type: 'Part-Time',
    location: 'Bellevue / Redmond, WA',
    teaser:
      'Support facilitators during workshops. Help kids with crafts, storytelling, and the small moments that make a session work.',
    overview: [
      'Our facilitators run the room. Our assistants make the room run.',
      'You will be the one helping a child finish their drawing while the lead is reading aloud, refilling glue sticks before anyone notices we are low, and quietly redirecting the kid who is about to climb under the table.',
    ],
    responsibilities: [
      'Support facilitators during workshop sessions.',
      'Help children with crafts, writing, and hands-on activities.',
      'Handle classroom setup and teardown.',
      'Notice the quiet child who needs encouragement and the over-stimulated child who needs a break.',
    ],
    lookingFor:
      'Education majors, art or design students, summer-camp counselors, childcare-experienced parents, and aspiring teachers are all encouraged to apply. We care more about your patience and playfulness than your résumé.',
    bonus:
      'Crafting skills, photography, theater, music or dance background, bilingual abilities, storytelling interests.',
  },
  {
    slug: 'operations-program-coordinator',
    title: 'Operations & Program Coordinator',
    type: 'Full-Time or strong Part-Time',
    location: 'Bellevue / Redmond, WA',
    teaser:
      'Take ownership of the operational side so our facilitators can focus on teaching.',
    overview: [
      'KindleWood is growing in the Seattle area, and the operational side is currently held together by a small founding team and a lot of spreadsheets. We need someone who can take ownership of the moving parts so our facilitators can focus on the kids in the room.',
      'This role is the bridge between families, instructors, venues, and our internal systems. If you like turning chaos into something that actually works, this is your role.',
    ],
    responsibilities: [
      'Coordinate scheduling, registrations, and logistics for ongoing workshop series.',
      'Manage parent communications: confirmations, reminders, follow-ups.',
      'Support instructors with materials, prep, and venue setup.',
      'Build and maintain the operational workflows that let us run more programs with the same care.',
    ],
    lookingFor:
      'Backgrounds in operations, education administration, event management, or early-stage startup coordination are all relevant. We value people who can hold many threads at once without losing the human warmth in any single one of them.',
    bonus:
      'Airtable, Notion, Canva, Google Workspace, event production, school or community partnership experience.',
  },
  {
    slug: 'ai-product-edtech-specialist',
    title: 'AI Product & Educational Technology Specialist',
    type: 'Full-Time or Contract',
    location: 'Hybrid · Remote-flexible',
    teaser:
      'Prototype AI-assisted creative learning experiences. Help kids create with AI without letting AI do the creating.',
    overview: [
      'KindleWood sits at the intersection of children’s learning and AI. We use AI to help kids create — generating illustrations from their drawings, narrating their stories, shaping their characters — without letting AI do the creative thinking for them. Holding that line is the central design challenge of this role.',
      'You will prototype new experiences, refine existing product workflows, and explore how AI tools can serve learners aged 5 to 8 specifically, where most of the AI industry is not looking.',
    ],
    responsibilities: [
      'Prototype AI-assisted creative learning experiences across image, text, and audio.',
      'Improve the educator-facing and parent-facing product surfaces.',
      'Evaluate new models and integrations for child-safety, quality, and learning value.',
      'Partner closely with the founder on what to build next and why.',
    ],
    lookingFor:
      'Backgrounds in EdTech, product design, AI prototyping, UX/UI, or creative technology. We value imagination, systems thinking, willingness to experiment, and a real point of view on what good AI for children should look like.',
    bonus:
      'Hands-on AI workflow experience (Claude, GPT, Gemini, image/audio generation), early-stage startup experience, creative coding, design thinking, storytelling background.',
  },
  {
    slug: 'community-social-media-manager',
    title: 'Community & Social Media Manager',
    type: 'Part-Time / Contract',
    location: 'Hybrid',
    teaser:
      'Tell our story honestly across social, video, and email. Storytelling first, posting cadence second.',
    overview: [
      'We have a story to tell — workshops full of kids making real things, families discovering creativity together, parents finding a saner relationship to AI and screens. We are looking for someone who can tell that story across social, video, and email.',
      'This is not a "post three times a week to the algorithm" role. It is a storytelling role with social as the medium.',
    ],
    responsibilities: [
      'Capture workshop moments on photo and video — and turn them into short-form content that feels real, not corporate.',
      'Build and maintain our presence on the social platforms parents and educators actually use.',
      'Draft newsletters and parent-facing updates.',
      'Help grow our community of families and educators in the Pacific Northwest and beyond.',
    ],
    lookingFor:
      'Experience in content creation, photography or videography, marketing in education, or community storytelling. We value authentic voice, visual taste, and the ability to write the way a real person talks.',
    bonus:
      'Video editing, Canva or Adobe Suite fluency, copywriting, parent or educator community experience.',
  },
];

function buildApplyMailto(role: Role): string {
  const subject = `Application: ${role.title}`;
  const body = [
    'Hi KindleWood team,',
    '',
    `I would like to apply for the ${role.title} role.`,
    '',
    '[Tell us a bit about yourself, your experience with kids and/or creative work, and what draws you to KindleWood. Feel free to attach a résumé, portfolio, or anything else you would like us to see.]',
    '',
    'Thanks,',
    '',
  ].join('\n');
  return `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildGeneralInquiryMailto(): string {
  const subject = 'General Inquiry — KindleWood Careers';
  const body = [
    'Hi KindleWood team,',
    '',
    '[Tell us a bit about yourself and what kind of work you would love to do with us.]',
    '',
    'Thanks,',
    '',
  ].join('\n');
  return `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function HeroSection() {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={`text-center mb-16 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
        Join us in shaping a new kind of{' '}
        <span className="text-amber-700 underline decoration-amber-700 decoration-2 underline-offset-4">
          creative learning
        </span>
        .
      </h1>
      <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto mb-6">
        KindleWood is a creativity-driven learning studio that blends storytelling, hands-on
        exploration, project-based learning, and thoughtfully integrated AI tools to help children
        become creators, not just consumers. We are looking for the educators, operators, and
        builders who will help shape what comes next.
      </p>
      <div className="inline-flex items-center gap-2 text-sm text-gray-600">
        <MapPin className="w-4 h-4" aria-hidden="true" />
        <span>Bellevue · Redmond · Hybrid roles available</span>
      </div>
    </div>
  );
}

interface Value {
  title: string;
  body: string;
}

const values: Value[] = [
  {
    title: 'A forward-thinking learning studio',
    body: 'Built for the world children are actually growing up in. AI is a tool we use thoughtfully — to support a child’s creative process, never to replace it. The program keeps evolving as the world does, and we look for teammates energized by what comes next.',
  },
  {
    title: 'We grow alongside the kids we serve',
    body: 'Our programs support a child’s continuous creative journey — first stories, bigger projects, confident self-expression. The team works the same way: open-minded, curious, with room to stretch as the studio grows. The people we hire today will help shape what KindleWood becomes.',
  },
  {
    title: 'Preparing future-ready kids',
    body: 'The children we serve will inherit a world we cannot fully predict. Our work is to give them the creative, expressive, and adaptive muscles to meet it — and we hire teammates with the same growth mindset we want to cultivate in our learners.',
  },
];

function ValuesSection() {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <section
      ref={ref}
      aria-labelledby="why-heading"
      className={`mb-24 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <h2
        id="why-heading"
        className="text-3xl sm:text-4xl font-bold text-gray-900 mb-12"
      >
        Why work at KindleWood
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {values.map((value) => (
          <div key={value.title} className="bg-white/70 backdrop-blur-sm rounded-2xl p-7 border border-gray-200/80">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">{value.title}</h3>
            <p className="text-gray-700 leading-relaxed">{value.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RoleCard({ role }: { role: Role }) {
  return (
    <details className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/80 overflow-hidden open:shadow-sm transition-shadow">
      <summary
        className="cursor-pointer list-none p-7 sm:p-8 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 rounded-2xl"
        aria-label={`${role.title}. Click to expand details.`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
              {role.title}
              {role.altTitle && (
                <span className="block sm:inline text-base sm:text-lg font-normal text-gray-500 sm:ml-2">
                  <span className="hidden sm:inline">· </span>
                  {role.altTitle}
                </span>
              )}
            </h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 mb-3">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4" aria-hidden="true" />
                {role.type}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4" aria-hidden="true" />
                {role.location}
              </span>
            </div>
            <p className="text-gray-700 leading-relaxed">{role.teaser}</p>
          </div>
          <div className="shrink-0 mt-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 group-open:hidden">
              View details
              <ChevronDown className="w-4 h-4 transition-transform" aria-hidden="true" />
            </span>
            <span className="hidden group-open:inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
              Hide details
              <ChevronDown className="w-4 h-4 rotate-180 transition-transform" aria-hidden="true" />
            </span>
          </div>
        </div>
      </summary>

      <div className="px-7 sm:px-8 pb-8 pt-2 border-t border-gray-100">
        <div className="max-w-3xl space-y-6 pt-6">
          {role.overview.map((para, i) => (
            <p key={i} className="text-gray-800 leading-relaxed">
              {para}
            </p>
          ))}

          <div>
            <h4 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-3">
              What you&apos;ll do
            </h4>
            <ul className="space-y-2.5">
              {role.responsibilities.map((item, i) => (
                <li key={i} className="flex gap-3 text-gray-800 leading-relaxed">
                  <span className="text-amber-700 mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-amber-700" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-3">
              Who we&apos;re looking for
            </h4>
            <p className="text-gray-800 leading-relaxed">{role.lookingFor}</p>
          </div>

          <div>
            <h4 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-3">
              Bonus
            </h4>
            <p className="text-gray-700 leading-relaxed">{role.bonus}</p>
          </div>

          <div className="pt-2">
            <a
              href={buildApplyMailto(role)}
              className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold px-6 py-3 rounded-lg transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
              aria-label={`Apply for ${role.title} by email`}
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              Apply by email
            </a>
            <p className="mt-3 text-sm text-gray-500">
              Opens your email client with a pre-filled message to{' '}
              <span className="text-gray-700 font-medium">{ADMIN_EMAIL}</span>.
            </p>
          </div>
        </div>
      </div>
    </details>
  );
}

function RolesSection() {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <section
      ref={ref}
      aria-labelledby="roles-heading"
      className={`mb-24 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <h2
          id="roles-heading"
          className="text-3xl sm:text-4xl font-bold text-gray-900"
        >
          Open roles
        </h2>
        <p className="text-sm text-gray-600">
          {roles.length} positions · Updated regularly
        </p>
      </div>
      <div className="space-y-4">
        {roles.map((role) => (
          <RoleCard key={role.slug} role={role} />
        ))}
      </div>
    </section>
  );
}

function GeneralInquirySection() {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <section
      ref={ref}
      aria-labelledby="general-inquiry-heading"
      className={`mb-20 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="max-w-3xl">
        <h2
          id="general-inquiry-heading"
          className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4"
        >
          Don&apos;t see your role?
        </h2>
        <p className="text-gray-700 leading-relaxed mb-6">
          We are always interested in meeting creative, thoughtful people — educators, designers,
          engineers, parents, storytellers — who care about how children learn. If you would like
          to be considered for something we have not posted yet, send us a note.
        </p>
        <a
          href={buildGeneralInquiryMailto()}
          className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 font-semibold text-lg group/cta"
          aria-label="Send a general inquiry by email"
        >
          Get in touch
          <ArrowRight className="w-5 h-5 transition-transform group-hover/cta:translate-x-1" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12 pb-20">
        <HeroSection />
        <ValuesSection />
        <RolesSection />
        <GeneralInquirySection />
      </main>
    </div>
  );
}
