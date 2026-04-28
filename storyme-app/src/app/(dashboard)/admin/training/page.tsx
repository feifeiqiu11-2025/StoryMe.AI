/**
 * KindleWood × School Partnership · Teacher Training
 * Vertical scroll deck organized around the two-session training plan.
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { isAdminEmail } from '@/lib/auth/isAdmin';

type SectionKey = 'why' | 'training' | 'howto' | 'start';

const SECTIONS: { key: SectionKey; label: string; roman: string }[] = [
  { key: 'why', label: 'Why Partner', roman: 'I' },
  { key: 'training', label: 'School Training', roman: 'II' },
  { key: 'howto', label: 'How-To', roman: 'III' },
  { key: 'start', label: 'Get Started', roman: 'IV' },
];

type Slide = {
  id: string;
  section: SectionKey;
  eyebrow?: string;
  title: string;
  hook?: string;
  body: React.ReactNode;
};

function ScreenshotSlot({ label, hint }: { label: string; hint?: string }) {
  return (
    <figure className="mt-6 border border-[#d9d4c8] bg-[#f5f1e8]">
      <div className="aspect-[16/9] flex items-center justify-center text-[#8c8478] text-sm">
        [ {label} ]
      </div>
      {hint ? (
        <figcaption className="border-t border-[#d9d4c8] px-4 py-2 text-xs text-[#8c8478]">
          {hint}
        </figcaption>
      ) : null}
    </figure>
  );
}

function HeroImage({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setRevealed(true);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <figure
      ref={ref}
      className="mt-6 border border-[#d9d4c8] bg-[#f5f1e8] overflow-hidden"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 820px"
          style={{
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          className={`object-cover transition-[opacity,transform] duration-1000 ease-out motion-reduce:transition-none will-change-[opacity,transform] ${
            revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
          }`}
        />
      </div>
      {caption ? (
        <figcaption className="border-t border-[#d9d4c8] px-4 py-2 text-xs text-[#8c8478] italic">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function StepList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="mt-5 space-y-3.5">
      {steps.map((step, i) => (
        <li
          key={i}
          className="flex gap-4 border-b border-dotted border-[#d9d4c8] pb-3 last:border-b-0"
        >
          <span className="flex-shrink-0 font-serif text-xl text-[#b5533c] leading-none w-6 tabular-nums">
            {i + 1}.
          </span>
          <div className="pt-0.5 text-[#2b2a27] leading-relaxed">{step}</div>
        </li>
      ))}
    </ol>
  );
}

function Aside({
  label = 'Note',
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="mt-6 border-l-2 border-[#b5533c] pl-4 py-1">
      <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold mb-1">
        {label}
      </div>
      <div className="text-[#2b2a27] leading-relaxed text-[15px]">
        {children}
      </div>
    </aside>
  );
}

function Warn({
  label = 'Important',
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="mt-6 border-l-2 border-[#1a1917] pl-4 py-1">
      <div className="text-[11px] uppercase tracking-[0.15em] text-[#1a1917] font-semibold mb-1">
        {label}
      </div>
      <div className="text-[#2b2a27] leading-relaxed text-[15px]">
        {children}
      </div>
    </aside>
  );
}

function TryIt({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-baseline gap-1 mt-5 text-[#b5533c] underline underline-offset-4 decoration-[#b5533c]/40 hover:decoration-[#b5533c] text-sm"
    >
      Open {label}
      <span aria-hidden>→</span>
    </Link>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-[#d9d4c8] bg-[#fbf8f1] p-5">{children}</div>
  );
}

function Reveal({
  show,
  delay = 0,
  duration = 700,
  className = '',
  children,
}: {
  show: boolean;
  delay?: number;
  duration?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        transitionDelay: `${delay}ms`,
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      className={`transition-[opacity,transform] motion-reduce:transition-none will-change-[opacity,transform] ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function StructureDiagram() {
  const steps = ['Character', 'Setting', 'Problem', 'Solution', 'Reflection'];
  return (
    <div className="mt-6 border-t border-b border-[#d9d4c8] py-5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-[#8c8478] font-semibold mb-3 text-center">
        Story structure
      </div>
      <ol className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-serif text-[#1a1917]">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className="text-lg">{s}</span>
            {i < steps.length - 1 ? (
              <span className="text-[#b5533c]" aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

const SLIDES: Slide[] = [
  // ─── Why Partner ───────────────────────────────────────
  {
    id: 'partnership-purpose',
    section: 'why',
    eyebrow: 'KindleWood × School Partnership',
    title: 'Why this partnership exists.',
    body: (
      <>
        <p className="text-[#2b2a27] leading-relaxed">
          KindleWood Studios partners with schools to co-create high-quality
          bilingual storybooks, learning materials, and creativity-based
          workshops — aligned with both KindleWood and your school's
          principles.
        </p>
        <div className="mt-6 grid sm:grid-cols-2 gap-px bg-[#d9d4c8] border border-[#d9d4c8]">
          {[
            {
              h: 'Inspire',
              d: 'Imagination and creativity through storytelling and physical making.',
            },
            {
              h: 'Empower',
              d: 'Teachers as educational creators. Streamlined prep + classroom documentation.',
            },
            {
              h: 'Reduce workload',
              d: 'AI turns classroom moments into high-quality materials, instantly.',
            },
            {
              h: 'Bridge',
              d: 'Seamless sharing between classroom and home learning.',
            },
          ].map((aim, i) => (
            <div key={aim.h} className="bg-[#fbf8f1] p-5">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-xl text-[#b5533c] tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-serif text-xl text-[#1a1917]">
                  {aim.h}
                </span>
              </div>
              <p className="text-sm text-[#4a463d] mt-2 leading-relaxed">
                {aim.d}
              </p>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'partnership-scope',
    section: 'why',
    eyebrow: 'Partnership · Scope',
    title: 'What\'s covered.',
    hook: 'Examples of what an active monthly School License delivers.',
    body: (
      <>
        <div className="mt-2 border border-[#d9d4c8] bg-[#fbf8f1]">
          <div className="px-5 py-4 border-b border-[#d9d4c8]">
            <div className="font-serif text-xl text-[#1a1917]">
              Software & Content
            </div>
          </div>
          <ul className="divide-y divide-[#d9d4c8]">
            {[
              [
                'Educational books',
                'Bilingual learning materials by theme — language, reading, math, practical life, culture, classroom behaviors.',
              ],
              [
                'Creative stories',
                'Classroom moments and student artwork as storybooks; children become co-creators.',
              ],
              [
                'Year StoryBook',
                'A year of memorable learning and growing moments per class or per child.',
              ],
              [
                'Birthday book',
                'A personalized story for each child — a keepsake for the family.',
              ],
            ].map(([h, d]) => (
              <li key={h} className="grid sm:grid-cols-3 gap-4 px-5 py-3.5">
                <div className="font-serif text-base text-[#1a1917]">{h}</div>
                <div className="sm:col-span-2 text-sm text-[#4a463d] leading-relaxed">
                  {d}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Aside label="Active license required">
          All deliverables run inside the school's active monthly KindleWood
          license.
        </Aside>
      </>
    ),
  },
  {
    id: 'scenarios',
    section: 'why',
    eyebrow: 'Who this is for',
    title: 'Schools we work well with.',
    hook: 'Different programs, same building blocks.',
    body: (
      <>
        <p className="text-[#2b2a27] leading-relaxed">
          Wherever children are making, teachers are repeating, and
          families want to see the year unfold — KindleWood fits.
        </p>
        <div className="mt-6 grid sm:grid-cols-2 gap-px bg-[#d9d4c8] border border-[#d9d4c8]">
          {[
            {
              h: 'Bilingual preschool',
              d: 'Daily routines · emotions · circle time books in two languages.',
            },
            {
              h: 'Language immersion K–2',
              d: 'Themed reading + cultural stories that bridge home and school.',
            },
            {
              h: 'Montessori / Waldorf',
              d: 'Student-creation storytelling. Nature, clay, imagination as story material.',
            },
            {
              h: 'After-school enrichment',
              d: 'Birthday books, craft-to-story workshops, family keepsakes.',
            },
          ].map((s) => (
            <div key={s.h} className="bg-[#fbf8f1] p-5">
              <div className="font-serif text-xl text-[#1a1917]">{s.h}</div>
              <p className="text-sm text-[#4a463d] mt-2 leading-relaxed">
                {s.d}
              </p>
            </div>
          ))}
        </div>
        <Aside label="Not on the list?">
          Most early-learning environments fit. Reach out and we'll map
          the specifics together.
        </Aside>
      </>
    ),
  },

  // ─── Training ──────────────────────────────────────────
  {
    id: 'training-overview',
    section: 'training',
    eyebrow: 'About this training',
    title: 'Two sessions, hands-on.',
    hook: 'Create your first bilingual book today. Build a long-term system next.',
    body: (
      <>
        <HeroImage
          src="/images/training-overview.jpg"
          alt="School Training overview"
          caption="What we'll build together over the two sessions."
        />
        <div className="mt-6 grid md:grid-cols-2 border border-[#d9d4c8] divide-y md:divide-y-0 md:divide-x divide-[#d9d4c8]">
          <div className="p-6 bg-[#fbf8f1]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold">
              Session 1 · 60 min
            </div>
            <div className="mt-1 font-serif text-2xl text-[#1a1917]">
              Create & Use
            </div>
            <ul className="mt-4 space-y-1.5 text-[#2b2a27]">
              <li>Educational books · 25 min</li>
              <li>Creative storytelling from crafts · 25 min</li>
            </ul>
            <div className="mt-3 text-xs text-[#8c8478]">
              Hands-on. You'll ship one book.
            </div>
          </div>
          <div className="p-6 bg-[#fbf8f1]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#4a6b4a] font-semibold">
              Session 2
            </div>
            <div className="mt-1 font-serif text-2xl text-[#1a1917]">
              Capture & Build
            </div>
            <ul className="mt-4 space-y-1.5 text-[#2b2a27]">
              <li>Six long-term formats</li>
              <li>A simple weekly system</li>
            </ul>
            <div className="mt-3 text-xs text-[#8c8478]">
              Small moments → powerful records.
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 border border-[#d9d4c8] divide-y sm:divide-y-0 sm:divide-x divide-[#d9d4c8]">
          {[
            ['1 bilingual mini-book', 'made during Session 1'],
            ['1 storytelling activity', 'practiced, not just heard'],
            ['Next-day confidence', 'use it Monday morning'],
          ].map(([h, d]) => (
            <div key={h} className="p-4 bg-[#fbf8f1]">
              <div className="font-serif text-base text-[#1a1917]">{h}</div>
              <div className="text-xs text-[#6b655a] mt-1 leading-snug">
                {d}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 border border-[#d9d4c8] bg-[#fbf8f1]">
          <div className="px-5 py-3 border-b border-[#d9d4c8]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold">
              Example output
            </div>
            <div className="mt-0.5 font-serif text-base text-[#1a1917]">
              Books made with this exact flow
            </div>
          </div>
          <ul className="divide-y divide-[#d9d4c8]">
            {[
              {
                kind: 'Educational book',
                title: 'The Life Cycle of a Butterfly',
                href: 'https://www.kindlewoodstudio.ai/stories/751ab15e-e88f-49e6-9c5e-554704b87f21?mode=reading',
              },
              {
                kind: 'Educational book',
                title: 'Inside the Ant World',
                href: 'https://www.kindlewoodstudio.ai/stories/9f1ed7a4-4b9f-423b-89b5-32398d7dc2da?mode=reading',
              },
              {
                kind: 'Creative storytelling from crafts',
                title: 'Brave Hearts and Healthy Choices',
                href: 'https://drive.google.com/file/d/1ST-bmYE1qkohIPVR5bcS_IbwsA96hDG4/view?usp=sharing',
              },
            ].map((ex) => (
              <li key={ex.title} className="px-5 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#8c8478] font-semibold mb-1">
                  {ex.kind}
                </div>
                <a
                  href={ex.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-serif text-lg text-[#b5533c] underline underline-offset-4 decoration-[#b5533c]/40 hover:decoration-[#b5533c] inline-flex items-baseline gap-1"
                >
                  {ex.title}
                  <span aria-hidden className="text-sm">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </>
    ),
  },

  // Session 1 ·  Create & Use
  {
    id: 's1-opener',
    section: 'training',
    eyebrow: 'Session 1 · Goal',
    title: 'Create & Use in the Classroom.',
    hook: 'By the end: one bilingual mini-book, one storytelling activity, and the confidence to use both tomorrow.',
    body: (
      <>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#d9d4c8] border border-[#d9d4c8]">
          <a
            href="https://www.kindlewoodstudio.ai/stories/751ab15e-e88f-49e6-9c5e-554704b87f21?mode=reading"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#fbf8f1] flex flex-col group"
          >
            <div className="relative aspect-[4/3] overflow-hidden border-b border-[#d9d4c8]">
              <Image
                src="/images/educational-butterfly.jpg"
                alt="The Life Cycle of a Butterfly — educational book cover"
                fill
                sizes="(max-width: 640px) 100vw, 320px"
                className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-5">
              <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold mb-1">
                Use Case 1 · 25 min
              </div>
              <div className="font-serif text-xl text-[#1a1917] inline-flex items-baseline gap-1">
                Educational Books
                <span
                  aria-hidden
                  className="text-sm text-[#b5533c] transition-transform duration-300 group-hover:translate-x-0.5"
                >
                  ↗
                </span>
              </div>
              <p className="text-sm text-[#4a463d] mt-2">
                Simple bilingual books for daily classroom use. Read{' '}
                <em>The Life Cycle of a Butterfly</em> →
              </p>
            </div>
          </a>
          <a
            href="https://www.kindlewoodstudio.ai/stories/39fdc78f-9881-436d-996b-bc42adcfc43d?mode=reading"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#fbf8f1] flex flex-col group"
          >
            <div className="relative aspect-[4/3] overflow-hidden border-b border-[#d9d4c8]">
              <Image
                src="/images/creative-happyplace.jpg"
                alt="My Happy Place — creative storytelling from crafts"
                fill
                sizes="(max-width: 640px) 100vw, 320px"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-5">
              <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold mb-1">
                Use Case 2 · 25 min
              </div>
              <div className="font-serif text-xl text-[#1a1917] inline-flex items-baseline gap-1">
                Creative Storytelling
                <span
                  aria-hidden
                  className="text-sm text-[#b5533c] transition-transform duration-300 group-hover:translate-x-0.5"
                >
                  ↗
                </span>
              </div>
              <p className="text-sm text-[#4a463d] mt-2">
                Turn student creations into stories they tell. Read{' '}
                <em>My Happy Place</em> →
              </p>
            </div>
          </a>
        </div>
      </>
    ),
  },
  {
    id: 'uc1-overview',
    section: 'training',
    eyebrow: 'Use Case 1',
    title: 'Educational books.',
    hook: 'Simple bilingual books for daily classroom use.',
    body: (
      <>
        <p className="text-[#2b2a27] leading-relaxed">
          The books you wish existed — written in <em>your</em> voice, in
          both languages, about the exact situation happening in your room
          right now. Hand-washing, clean-up, asking for help. Keep them
          short. Reuse them daily.
        </p>
        <Aside label="Why bilingual by default">
          Your class is bilingual. Every book should be too. One track in
          English, one in the home language. Kids toggle on each page.
        </Aside>
      </>
    ),
  },
  {
    id: 'uc1-topics',
    section: 'training',
    eyebrow: 'Pick one real need',
    title: 'Six topic areas.',
    hook: 'Start with whatever you repeated yesterday.',
    body: (
      <>
        <div className="mt-2 grid sm:grid-cols-2 gap-px bg-[#d9d4c8] border border-[#d9d4c8]">
          {[
            ['Daily routines', 'clean-up · hand washing · lining up'],
            ['Social skills', 'sharing · taking turns · asking for help'],
            ['Emotions', 'happy · sad · frustrated · calm'],
            ['Math', 'counting · shapes · patterns'],
            ['Practical life', 'putting on shoes · packing backpack'],
            ['Classroom rules', 'listening · quiet voice · safe hands'],
          ].map(([h, d]) => (
            <div key={h} className="bg-[#fbf8f1] p-5">
              <div className="font-serif text-lg text-[#1a1917]">{h}</div>
              <div className="text-sm text-[#6b655a] mt-1">{d}</div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'uc1-task',
    section: 'training',
    eyebrow: 'Teacher task · 25 min',
    title: 'Make it now.',
    hook: 'One real need. Five to eight pages. Your words.',
    body: (
      <>
        <StepList
          steps={[
            <>Pick one real classroom need from your week.</>,
            <>Create a <em>5–8 page</em> mini-book.</>,
            <>Adjust the wording to match how <em>you</em> speak — not a textbook.</>,
            <>Add one interactive moment (a question, a sound, a pause).</>,
            <>Generate English narration, then the home-language track.</>,
            <>Export an A5 or A4 PDF for the classroom shelf.</>,
          ]}
        />
        <Aside label="Interactive moment ideas">
          "Can you show me safe hands?" · "What sound does clean-up make?" ·
          "Where do shoes go?"
        </Aside>
        <TryIt href="/create" label="Create story" />
      </>
    ),
  },
  {
    id: 'uc2-overview',
    section: 'training',
    eyebrow: 'Use Case 2',
    title: 'Creative storytelling from crafts.',
    hook: 'The creation becomes the main character.',
    body: (
      <>
        <p className="text-[#2b2a27] leading-relaxed">
          Kids build something. You ask a few good questions. Their creation
          walks into a story — and so do they.
        </p>
        <div className="mt-6 border border-[#d9d4c8] divide-y divide-[#d9d4c8]">
          {[
            'Clay animals or creatures',
            'Paper rockets or inventions',
            'Nature collage — leaves, sticks',
            'Block / LEGO structures',
            'Puppets or masks',
            'Drawings of imagined worlds',
          ].map((x) => (
            <div key={x} className="bg-[#fbf8f1] px-5 py-2.5 text-[#2b2a27]">
              {x}
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'uc2-task',
    section: 'training',
    eyebrow: 'Teacher task',
    title: 'Guide, don\'t correct.',
    hook: 'Your job: expand ideas, not tidy them up.',
    body: (
      <>
        <StepList
          steps={[
            <>Let students create during craft or play. No agenda yet.</>,
            <>Ask guiding questions. Listen longer than you speak.</>,
            <>Use the five-beat story structure.</>,
            <>Encourage the child's voice and imagination.</>,
            <>Never correct — expand, repeat, add.</>,
          ]}
        />
        <StructureDiagram />
        <Warn label="The one rule">
          If a dragon is pink and has shoes, the dragon is pink and has
          shoes. "Tell me more about the shoes" beats "but dragons don't…"
        </Warn>
      </>
    ),
  },
  {
    id: 'uc2-prompts',
    section: 'training',
    eyebrow: 'Ask these',
    title: 'Six prompts for students.',
    hook: 'Enough to build any story.',
    body: (
      <>
        <ol className="mt-2 border border-[#d9d4c8]">
          {[
            'What is your creation?',
            'Where does it live?',
            'What happened to it?',
            'Was there a problem?',
            'What did it do?',
            'How did it feel?',
          ].map((q, i) => (
            <li
              key={q}
              className="bg-[#fbf8f1] px-5 py-3 flex gap-4 items-baseline border-b border-[#d9d4c8] last:border-b-0"
            >
              <span className="font-serif text-xl text-[#b5533c] tabular-nums w-6">
                {i + 1}
              </span>
              <span className="text-[#1a1917] font-serif text-lg">{q}</span>
            </li>
          ))}
        </ol>
        <Aside label="Output">
          A short oral story or a simple written one. Optional drawing or a
          printed KindleWood story page. Whatever the child brought, leaves
          as a memory.
        </Aside>
      </>
    ),
  },

  // Session 2 · Capture & Build
  {
    id: 's2-opener',
    section: 'training',
    eyebrow: 'Session 2 · Goal',
    title: 'Capture & Build Long-Term Value.',
    hook: 'Turn daily moments into meaningful long-term records.',
    body: (
      <>
        <p className="text-[#2b2a27] leading-relaxed">
          Session 1 is about one book. Session 2 is about a habit. The
          difference between a nice afternoon activity and a classroom
          archive families will keep forever.
        </p>
        <HeroImage
          src="/images/handmade-storybooks.jpg"
          alt="Handmade storybooks"
          caption="What a year of small moments looks like on a shelf."
        />
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 border border-[#d9d4c8] divide-y sm:divide-y-0 sm:divide-x divide-[#d9d4c8]">
          {[
            ['Meaningful records', 'daily → keepsake'],
            ['Reusable systems', 'capture once, compile often'],
            ['Parent engagement', 'families see the year unfold'],
          ].map(([h, d]) => (
            <div key={h} className="p-4 bg-[#fbf8f1]">
              <div className="font-serif text-base text-[#1a1917]">{h}</div>
              <div className="text-xs text-[#6b655a] mt-1">{d}</div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'format-yearbook',
    section: 'training',
    eyebrow: 'Long-term format · 01',
    title: 'Yearbook.',
    hook: 'Class or individual. Monthly highlights → year-end book.',
    body: (
      <>
        <ul className="mt-2 space-y-2 text-[#2b2a27] list-disc pl-5 text-[15px]">
          <li>Monthly highlights of classroom activities</li>
          <li>Photos + short stories</li>
          <li>End-of-year printed book for families</li>
        </ul>
        <Aside label="Privacy note">
          Use class mascots for the "whole class" version. Photo-based
          characters only with signed consent, and for individual yearbooks.
        </Aside>
      </>
    ),
  },
  {
    id: 'format-growth',
    section: 'training',
    eyebrow: 'Long-term format · 02',
    title: 'Growth records.',
    hook: 'Portfolio style. Before and after.',
    body: (
      <>
        <ul className="mt-2 space-y-2 text-[#2b2a27] list-disc pl-5 text-[15px]">
          <li>Track milestones: social, emotional, academic</li>
          <li>Before / after comparisons — drawing, writing, counting</li>
          <li>Teacher observations turned into short stories</li>
        </ul>
        <Aside label="Parent conferences">
          A bound printout beats a slide deck every time. Parents take them
          home.
        </Aside>
      </>
    ),
  },
  {
    id: 'format-annual',
    section: 'training',
    eyebrow: 'Long-term format · 03',
    title: 'Annual classroom book.',
    hook: 'The whole class as characters in one shared story.',
    body: (
      <>
        <ul className="mt-2 space-y-2 text-[#2b2a27] list-disc pl-5 text-[15px]">
          <li>Everyone is a character — cartoon mascots per student</li>
          <li>Themes like <em>Our Year Together</em>, <em>Our Adventures</em></li>
          <li>Collaborative storytelling across the year</li>
        </ul>
        <Aside label="Ensemble casting">
          Match each mascot to a trait, not a likeness. "Mira is our helper
          bunny" is privacy-safe and more fun than a photo avatar.
        </Aside>
      </>
    ),
  },
  {
    id: 'format-journey',
    section: 'training',
    eyebrow: 'Long-term format · 04',
    title: 'Learning journey book.',
    hook: 'One child\'s arc over time.',
    body: (
      <>
        <ul className="mt-2 space-y-2 text-[#2b2a27] list-disc pl-5 text-[15px]">
          <li>Focus on one child's path</li>
          <li>Challenges · growth · breakthroughs</li>
          <li>Structured reflection: <em>Today I… · I felt… · I learned…</em></li>
        </ul>
        <Aside label="When to gift it">
          End of preschool. Moving-up ceremony. The day a family moves
          away.
        </Aside>
      </>
    ),
  },
  {
    id: 'format-birthday',
    section: 'training',
    eyebrow: 'Long-term format · 05',
    title: 'Birthday books.',
    hook: 'A personalized story for each child.',
    body: (
      <>
        <ul className="mt-2 space-y-2 text-[#2b2a27] list-disc pl-5 text-[15px]">
          <li>Child as the hero (consent first — see <em>How-To</em>)</li>
          <li>Include peer messages and teacher notes</li>
          <li>Keepsake the family will keep</li>
        </ul>
        <Warn label="Keep private">
          Birthday books never go public. Share the link privately with the
          family.
        </Warn>
      </>
    ),
  },
  {
    id: 'format-themed',
    section: 'training',
    eyebrow: 'Long-term format · 06',
    title: 'Themed learning books.',
    hook: 'Project-based learning, in story format.',
    body: (
      <>
        <ul className="mt-2 space-y-2 text-[#2b2a27] list-disc pl-5 text-[15px]">
          <li>Science week · nature exploration · emotions unit</li>
          <li>Document project-based learning as it happens</li>
          <li>Turn the curriculum into a story families can read</li>
        </ul>
      </>
    ),
  },
  {
    id: 'system',
    section: 'training',
    eyebrow: 'Make it sustainable',
    title: 'A simple weekly system.',
    hook: 'Small moments → consistent capture → powerful long-term value.',
    body: (
      <>
        <StepList
          steps={[
            <>Capture <em>2–3 moments</em> per week. Photo, voice note, or just a sentence.</>,
            <>Turn <em>one</em> into a short story — two to three minutes in Studio.</>,
            <>Store in a shared class folder.</>,
            <>Compile monthly or quarterly into a bound PDF.</>,
          ]}
        />
        <Aside label="Key principle">
          It isn't about volume. Consistency wins. One story a week beats
          a frantic twenty in May.
        </Aside>
      </>
    ),
  },

  // ─── How-To ────────────────────────────────────────────
  {
    id: 'ht-characters',
    section: 'howto',
    eyebrow: 'Core skill',
    title: 'Build your cast once.',
    hook: 'Every story pulls from your library.',
    body: (
      <>
        <p className="text-[#2b2a27] leading-relaxed">
          A character is a named, styled creature the AI keeps consistent
          across every page of every story. Once Emma is Emma, every book
          with Emma looks like the same Emma.
        </p>
        <Warn label="Never start with photos">
          For classroom and educational books, default to described
          characters — to avoid privacy concerns and keep the cast
          reusable.
        </Warn>
        <Aside label="Starter set">
          Three mascots matched to traits — helper, explorer, feeler.
          Add more as the year goes on.
        </Aside>
        <TryIt href="/characters" label="Character Library" />
      </>
    ),
  },
  {
    id: 'ht-privacy',
    section: 'howto',
    eyebrow: 'School-safe',
    title: 'Described, not photographed.',
    hook: 'Classroom books → described characters. Individual books → photos with consent.',
    body: (
      <>
        <p className="text-[#2b2a27] leading-relaxed">
          For circle time and educational books, define <em>arbitrary
          characters with a description</em> — never real student photos.
          Build a small recurring cast (e.g. <em>Emma</em>, <em>Leo</em>)
          and reuse them across every classroom book.
        </p>
        <div className="mt-6 grid md:grid-cols-2 gap-px bg-[#d9d4c8] border border-[#d9d4c8]">
          <div className="bg-[#fbf8f1] p-5">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#4a6b4a] font-semibold mb-2">
              Classroom · description only
            </div>
            <ul className="space-y-1 text-[#2b2a27] text-sm">
              <li>Circle time books</li>
              <li>Educational books</li>
              <li>Annual classroom book</li>
              <li>Themed learning books</li>
            </ul>
            <div className="mt-3 text-xs text-[#6b655a] italic">
              Reusable cast: Emma, Leo, Nori…
            </div>
          </div>
          <div className="bg-[#fbf8f1] p-5">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold mb-2">
              Individual · photo with consent
            </div>
            <ul className="space-y-1 text-[#2b2a27] text-sm">
              <li>Yearbook (individual)</li>
              <li>Growth records</li>
              <li>Birthday books</li>
              <li>Learning journey books</li>
            </ul>
            <div className="mt-3 text-xs text-[#6b655a] italic">
              Get parent consent first — every time.
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'ht-create-character',
    section: 'howto',
    eyebrow: 'Walkthrough',
    title: 'Create a character.',
    hook: 'Two paths — describe one, or upload a photo.',
    body: (
      <>
        <div className="mt-2 border border-[#d9d4c8] bg-[#fbf8f1] p-5">
          <div className="text-[11px] uppercase tracking-[0.15em] text-[#4a6b4a] font-semibold mb-1">
            Path A · From description
          </div>
          <div className="font-serif text-lg text-[#1a1917] mb-3">
            Default for classroom books
          </div>
          <ol className="space-y-2.5 text-[15px] text-[#2b2a27]">
            {[
              <><em>Characters</em> → <em>Create New Character</em>.</>,
              <>Switch to <em>From Description</em>.</>,
              <>Enter <em>Name</em> + <em>Type</em> ("a cheerful bunny in overalls").</>,
              <>Optional <em>Details</em> — personality, quirks.</>,
              <><em>Click to Generate</em> on <em>3D Pixar</em>, <em>Classic 2D</em>, or <em>Coloring</em>.</>,
              <>Approve and <em>Save Character</em>.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-serif text-[#b5533c] tabular-nums w-5 flex-shrink-0">
                  {i + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-4 border border-[#d9d4c8] bg-[#fbf8f1] p-5">
          <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold mb-1">
            Path B · From photo
          </div>
          <div className="font-serif text-lg text-[#1a1917] mb-3">
            Individual books only — with consent
          </div>
          <ol className="space-y-2.5 text-[15px] text-[#2b2a27]">
            {[
              <><em>Create New Character</em>, stay on <em>From Photo</em>.</>,
              <>Upload — AI fills hair, skin, age, clothing.</>,
              <>Review and correct any field the AI misread.</>,
              <>Pick style → <em>Click to Generate</em>.</>,
              <>Approve and save.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-serif text-[#b5533c] tabular-nums w-5 flex-shrink-0">
                  {i + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Warn label="Before you upload">
            Written parent consent. One student at a time.
          </Warn>
        </div>
        <TryIt href="/characters/new" label="Create character" />
      </>
    ),
  },
  {
    id: 'ht-character-actions',
    section: 'howto',
    eyebrow: 'Manage existing',
    title: 'Character actions.',
    hook: 'Everything you can do to a character already in your library.',
    body: (
      <>
        <p className="text-[#2b2a27] leading-relaxed">
          Each card on{' '}
          <code className="px-1 bg-[#ede7d7] text-xs">/characters</code> has
          a row of icon buttons. Hover for tooltips.
        </p>
        <div className="mt-6 border border-[#d9d4c8] bg-[#fbf8f1]">
          <ul className="divide-y divide-[#d9d4c8]">
            {[
              [
                'Use in Story',
                'One click → Create flow opens with this character preselected.',
              ],
              [
                'Edit',
                'Rename, change description, swap reference image. Updates the look across all stories that use the character.',
              ],
              [
                'Make Public / Private',
                'Share with the Little Artists gallery, or keep private. Confirmation guards before going public.',
              ],
              [
                'Create Stickers',
                '3×4 printable sticker sheet. Pick Decompose (parts) or Variations (poses).',
              ],
              [
                'Break into Parts',
                'Inside the Edit modal: extract individual characters or scene items from a complex drawing. Only on non-derived characters.',
              ],
              [
                'Delete',
                'Removes the character. Stories that already use it keep their existing renders.',
              ],
            ].map(([h, d]) => (
              <li key={h} className="grid sm:grid-cols-3 gap-4 px-5 py-3">
                <div className="font-serif text-base text-[#1a1917]">{h}</div>
                <div className="sm:col-span-2 text-sm text-[#4a463d] leading-relaxed">
                  {d}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Aside label="Two tabs">
          <em>My Characters</em> shows your library. <em>Community</em>{' '}
          shows public characters from other users — read-only.
        </Aside>
        <TryIt href="/characters" label="Character Library" />
      </>
    ),
  },
  {
    id: 'ht-create-story',
    section: 'howto',
    eyebrow: 'Walkthrough',
    title: 'Create a story.',
    hook: 'Script → enhance → review → generate → edit. Each step is yours to approve.',
    body: (
      <>
        <StepList
          steps={[
            <>Open <em>Create</em>.</>,
            <><em>Import from Library</em> or <em>+ Add Character</em> to set the cast.</>,
            <>Write your script in <em>Write Story Scenes</em>. One paragraph is enough — the AI expands later.</>,
            <>Set <em>Reading Age</em> (1–12) · <em>Story Tone</em> (Playful · Friendly · Adventure · Educational) · <em>Character Clothing</em> (Consistent or Scene-Based) · optional <em>Secondary Language</em>.</>,
            <>Click <em>Enhance Scenes & Captions</em>. The AI parses your script into scenes with captions, image prompts, character assignments, and a story bible.</>,
            <>Review and edit each scene's <em>caption</em>, <em>image prompt</em>, and <em>character / location references</em>. Adjust the story title and description if needed.</>,
            <>Pick an <em>Art Style</em> on the same review screen: <em>3D Pixar</em> (vibrant) · <em>Classic 2D</em> (storybook) · <em>Coloring</em> (B&W sketch — kids color it after).</>,
            <>Click <em>Generate Images</em>. Watch real-time progress per scene.</>,
            <>Once generated, refine any scene with <em>✏️ Edit Image</em> — describe the change in plain English ("remove the cat, add a tree"). Reference a character by name and the AI auto-pulls their image; or paste/upload a fresh reference for that scene.</>,
            <>Preview the proposal. Click <em>Use This</em> or <em>Keep Original</em>.</>,
            <>Click <em>Save Story</em>. You land on the project page at <code className="px-1 bg-[#ede7d7] text-xs">/projects/[id]</code>.</>,
            <>Optional: click <em>Generate Quiz</em> for comprehension or reflection questions. More post-save actions on the next slide.</>,
          ]}
        />
        <TryIt href="/create" label="Create story" />
      </>
    ),
  },
  {
    id: 'ht-actions',
    section: 'howto',
    eyebrow: 'After saving',
    title: 'Story actions.',
    hook: 'Everything you can do once a story is in your library.',
    body: (
      <>
        <p className="text-[#2b2a27] leading-relaxed">
          Open the story at{' '}
          <code className="px-1 bg-[#ede7d7] text-xs">/projects/[id]</code>.
          Actions group into Content · Publishing · Tags · Export.
        </p>

        <div className="mt-6 border border-[#d9d4c8] bg-[#fbf8f1]">
          <div className="px-5 py-2.5 border-b border-[#d9d4c8]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold">
              Content
            </div>
          </div>
          <ul className="divide-y divide-[#d9d4c8]">
            {[
              [
                'Generate Audio',
                'AI narration in English or your secondary language. Dropdown picks the track. Both save to the same story; kids toggle in reading mode.',
              ],
              [
                'Record Narration',
                'Use your own voice. Best for circle-time and birthday books — your voice is what kids remember.',
              ],
              [
                'Generate Quiz',
                'Comprehension or reflection questions. Becomes interactive pages inside reading mode.',
              ],
            ].map(([h, d]) => (
              <li key={h} className="grid sm:grid-cols-3 gap-4 px-5 py-3">
                <div className="font-serif text-base text-[#1a1917]">{h}</div>
                <div className="sm:col-span-2 text-sm text-[#4a463d] leading-relaxed">
                  {d}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-px border border-[#d9d4c8] border-t-0 bg-[#fbf8f1]">
          <div className="px-5 py-2.5 border-b border-[#d9d4c8]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold">
              Publishing
            </div>
          </div>
          <ul className="divide-y divide-[#d9d4c8]">
            {[
              [
                'Make Public',
                'Story shows up in the community stories. Confirmation guards against personal info.',
              ],
              [
                'Publish to Spotify',
                'Compiles audio into a podcast episode. Live on Spotify within 1–6 hours.',
              ],
              [
                'Kids App',
                'Push to specific child accounts on the iOS app. Unpublish any time.',
              ],
            ].map(([h, d]) => (
              <li key={h} className="grid sm:grid-cols-3 gap-4 px-5 py-3">
                <div className="font-serif text-base text-[#1a1917]">{h}</div>
                <div className="sm:col-span-2 text-sm text-[#4a463d] leading-relaxed">
                  {d}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-px border border-[#d9d4c8] border-t-0 bg-[#fbf8f1]">
          <div className="px-5 py-2.5 border-b border-[#d9d4c8]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold">
              Tags & Categories
            </div>
          </div>
          <ul className="divide-y divide-[#d9d4c8]">
            <li className="grid sm:grid-cols-3 gap-4 px-5 py-3">
              <div className="font-serif text-base text-[#1a1917]">
                Add tags
              </div>
              <div className="sm:col-span-2 text-sm text-[#4a463d] leading-relaxed">
                Pick from built-in tags (<em>classroom</em>,{' '}
                <em>circle-time</em>, <em>behavior</em>, <em>yearbook</em>…)
                or add your own custom tag. Become filter chips on Little
                Artists; help you find the story later.
              </div>
            </li>
          </ul>
        </div>

        <div className="mt-px border border-[#d9d4c8] border-t-0 bg-[#fbf8f1]">
          <div className="px-5 py-2.5 border-b border-[#d9d4c8]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold">
              Customize & Export · PDF
            </div>
          </div>
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#d9d4c8]">
            <div className="px-5 py-3">
              <div className="text-[11px] uppercase tracking-[0.15em] text-[#8c8478] font-semibold mb-2">
                Format
              </div>
              <ul className="space-y-1 text-sm text-[#2b2a27]">
                <li><em>A5</em> — picture book (recommended)</li>
                <li><em>A4</em> — school printer</li>
                <li><em>Legal</em> — wider spreads</li>
              </ul>
            </div>
            <div className="px-5 py-3">
              <div className="text-[11px] uppercase tracking-[0.15em] text-[#8c8478] font-semibold mb-2">
                Layout
              </div>
              <ul className="space-y-1 text-sm text-[#2b2a27]">
                <li><em>Classic</em> — one page (for reading)</li>
                <li><em>Comic</em> — two panels</li>
                <li><em>Grid</em> — four panels (save paper)</li>
              </ul>
            </div>
          </div>
        </div>

        <Aside label="For the classroom shelf">
          A5 · Classic · bound with yarn. Kids treat them like real books
          because they are real books.
        </Aside>
      </>
    ),
  },
  {
    id: 'ht-reading',
    section: 'howto',
    eyebrow: 'In the room',
    title: 'Reading mode + Kids App.',
    hook: 'Screen or paper — the story works both ways.',
    body: (
      <>
        <div className="mt-6 grid sm:grid-cols-[3fr_5fr] gap-3 items-stretch">
          <figure className="border border-[#d9d4c8] bg-[#f5f1e8]">
            <div className="relative aspect-[3/4]">
              <Image
                src="/images/kidsapp-login.jpg"
                alt="Kids App profile selector with kid avatars and progress milestones"
                fill
                sizes="(max-width: 640px) 100vw, 400px"
                className="object-contain"
              />
            </div>
            <figcaption className="border-t border-[#d9d4c8] px-3 py-2 text-xs text-[#8c8478] italic">
              Choose Your Profile · per-child accounts + milestones
            </figcaption>
          </figure>
          <figure className="border border-[#d9d4c8] bg-[#f5f1e8]">
            <div className="relative aspect-[5/4]">
              <Image
                src="/images/kidsapp-home.jpg"
                alt="Kids App home with a bookshelf of published stories"
                fill
                sizes="(max-width: 640px) 100vw, 400px"
                className="object-contain"
              />
            </div>
            <figcaption className="border-t border-[#d9d4c8] px-3 py-2 text-xs text-[#8c8478] italic">
              Bookshelf · published stories show up here
            </figcaption>
          </figure>
        </div>
        <ul className="mt-6 space-y-2 text-[#2b2a27] list-disc pl-5 text-[15px]">
          <li>
            <em>Reading mode</em> — full-screen, swipe, audio toggle, quiz
            pages
          </li>
          <li>
            <em>Kids App (iOS)</em> — publish to a child's bookshelf for home
            reading
          </li>
          <li>
            <em>Share link</em> — share stories with friends and families
          </li>
        </ul>
      </>
    ),
  },

  // ─── Get Started ───────────────────────────────────────
  {
    id: 'cheatsheet',
    section: 'start',
    eyebrow: 'Cheat sheet',
    title: 'Where each feature lives.',
    hook: 'Keep this open during your first few books.',
    body: (
      <>
        <div className="mt-2 border border-[#d9d4c8]">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[#d9d4c8]">
              {[
                ['Character Library', '/characters'],
                ['Create character', '/characters/new'],
                ['Sketch guide (coloring)', '/characters/new · drawing guide link'],
                ['Sticker sheet', '/characters/[id]/stickers'],
                ['Create story', '/create'],
                ['Edit story', '/projects/[id]'],
                ['Bilingual audio · Quiz · PDF · Share', '/projects/[id] toolbar'],
                ['Reading mode', '/stories/[id]?mode=reading'],
                ['Community gallery', '/little-artists'],
              ].map(([feature, where]) => (
                <tr key={feature} className="bg-[#fbf8f1]">
                  <td className="px-4 py-2.5 font-serif text-[#1a1917]">
                    {feature}
                  </td>
                  <td className="px-4 py-2.5 text-[#6b655a] font-mono text-xs">
                    {where}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: 'first-week',
    section: 'start',
    eyebrow: 'Go build something',
    title: 'Your first week.',
    hook: 'Small. Frequent. Real.',
    body: (
      <>
        <StepList
          steps={[
            <><em>Day 1.</em> Build three classroom mascots — description only.</>,
            <><em>Day 2.</em> One bilingual educational book (routine or emotion).</>,
            <><em>Day 3.</em> Invite kids to make something. Practice the six prompts.</>,
            <><em>Day 4.</em> Turn yesterday's creation into a KindleWood story.</>,
            <><em>Day 5.</em> Print both books (A5, Classic). Add to the classroom shelf.</>,
          ]}
        />
        <Aside label="Weekly rhythm — from Session 2">
          Capture 2–3 moments · turn 1 into a story · compile monthly.
        </Aside>
        <Aside label="Stuck?">
          Email <em>admin@kindlewoodstudio.ai</em> — screenshot + one
          sentence.
        </Aside>
        <div className="mt-8 flex flex-wrap gap-6 border-t border-[#d9d4c8] pt-6">
          <TryIt href="/characters" label="Characters" />
          <TryIt href="/create" label="Create" />
          <TryIt href="/little-artists" label="Little Artists" />
        </div>
      </>
    ),
  },
  {
    id: 'long-view',
    section: 'start',
    eyebrow: 'The long view',
    title: 'What this looks like in May.',
    hook: 'Six months in, here\'s what the partnership has produced.',
    body: (
      <>
        <div className="mt-2 grid md:grid-cols-3 gap-px bg-[#d9d4c8] border border-[#d9d4c8]">
          <div className="bg-[#fbf8f1] p-5">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold mb-2">
              For teachers
            </div>
            <p className="text-sm text-[#2b2a27] leading-relaxed">
              Less repetitive prep. More time on presence. A shelf of
              books that came from your year — not a textbook.
            </p>
          </div>
          <div className="bg-[#fbf8f1] p-5">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold mb-2">
              For the class
            </div>
            <p className="text-sm text-[#2b2a27] leading-relaxed">
              Recurring characters kids recognize. Bilingual access on
              every page. Their drawings, their stories, their voice.
            </p>
          </div>
          <div className="bg-[#fbf8f1] p-5">
            <div className="text-[11px] uppercase tracking-[0.15em] text-[#b5533c] font-semibold mb-2">
              For families
            </div>
            <p className="text-sm text-[#2b2a27] leading-relaxed">
              Real keepsakes. Visible learning. A reason to read
              together that isn't a worksheet.
            </p>
          </div>
        </div>
        <Aside label="One last thing">
          The system isn't the books — it's the rhythm. Capture small.
          Compile often. The rest takes care of itself.
        </Aside>
      </>
    ),
  },
];

export default function TrainingPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('why');
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set([0]));
  const slideRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!isAdminEmail(user.email)) {
        router.push('/dashboard');
        return;
      }
      setAuthorized(true);
    });
  }, [router]);

  useEffect(() => {
    if (!authorized) return;

    const activeObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) {
              setActiveIndex(idx);
              setActiveSection(SLIDES[idx].section);
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) {
              setRevealed((prev) => {
                if (prev.has(idx)) return prev;
                const next = new Set(prev);
                next.add(idx);
                return next;
              });
            }
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );

    slideRefs.current.forEach((el) => {
      if (!el) return;
      activeObserver.observe(el);
      revealObserver.observe(el);
    });

    return () => {
      activeObserver.disconnect();
      revealObserver.disconnect();
    };
  }, [authorized]);

  const sectionFirstIndex = useMemo(() => {
    const map = new Map<SectionKey, number>();
    SLIDES.forEach((s, i) => {
      if (!map.has(s.section)) map.set(s.section, i);
    });
    return map;
  }, []);

  const jumpToSection = (key: SectionKey) => {
    const idx = sectionFirstIndex.get(key);
    if (idx == null) return;
    slideRefs.current[idx]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#faf7f1]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#b5533c]" />
      </div>
    );
  }

  return (
    <div className="relative bg-[#faf7f1] text-[#1a1917] -mt-px">
      {/* Side table of contents (desktop) */}
      <nav className="hidden lg:block fixed top-24 right-6 z-20 w-48 xl:w-56">
        <div className="border-t border-b border-[#1a1917] py-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8c8478] font-semibold mb-3">
            Contents
          </div>
          <ul className="space-y-1">
            {SECTIONS.map((s) => {
              const isActive = s.key === activeSection;
              return (
                <li key={s.key}>
                  <button
                    onClick={() => jumpToSection(s.key)}
                    className={`w-full text-left py-1 text-sm flex items-baseline gap-3 transition-colors ${
                      isActive
                        ? 'text-[#b5533c] font-medium'
                        : 'text-[#4a463d] hover:text-[#1a1917]'
                    }`}
                  >
                    <span className="font-serif text-xs tabular-nums w-6 text-[#8c8478]">
                      {s.roman}
                    </span>
                    <span>{s.label}</span>
                  </button>
                  {isActive ? (
                    <ul className="ml-9 mt-1 mb-2 space-y-0.5">
                      {SLIDES.map((slide, i) =>
                        slide.section === s.key ? (
                          <li key={slide.id}>
                            <button
                              onClick={() =>
                                slideRefs.current[i]?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start',
                                })
                              }
                              className={`block w-full text-left text-xs py-0.5 transition-colors ${
                                i === activeIndex
                                  ? 'text-[#1a1917]'
                                  : 'text-[#8c8478] hover:text-[#1a1917]'
                              }`}
                            >
                              {slide.title}
                            </button>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-[#8c8478] font-semibold">
            {String(activeIndex + 1).padStart(2, '0')}
            <span className="text-[#d9d4c8] mx-1">/</span>
            {String(SLIDES.length).padStart(2, '0')}
          </div>
        </div>
      </nav>

      {/* Top strip (mobile) */}
      <div className="lg:hidden sticky top-0 z-10 bg-[#faf7f1]/95 backdrop-blur border-b border-[#d9d4c8] px-4 py-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#6b655a]">
          <span>{SECTIONS.find((s) => s.key === activeSection)?.label}</span>
          <span className="font-mono">
            {String(activeIndex + 1).padStart(2, '0')} /{' '}
            {String(SLIDES.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Slides */}
      <div className="snap-y snap-proximity">
        {SLIDES.map((slide, i) => {
          const section = SECTIONS.find((s) => s.key === slide.section)!;
          const isOpener = sectionFirstIndex.get(slide.section) === i;
          const isRevealed = revealed.has(i);
          return (
            <section
              key={slide.id}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              data-index={i}
              id={slide.id}
              className="snap-start scroll-mt-4 px-5 sm:px-8 lg:px-12 py-14 sm:py-20 lg:pr-64 xl:pr-72 border-b border-[#ebe6d8] last:border-b-0"
            >
              <div className="max-w-[640px] lg:max-w-[720px] xl:max-w-[820px] w-full mx-auto">
                {isOpener ? (
                  <Reveal show={isRevealed} delay={0} duration={700}>
                    <div className="mb-10 sm:mb-14">
                      <div className="flex items-baseline gap-x-3 sm:gap-x-5">
                        <span
                          className={`font-serif text-[3rem] sm:text-[4rem] lg:text-[4.5rem] text-[#b5533c] leading-none tabular-nums transition-transform duration-[1100ms] ease-out motion-reduce:transition-none origin-left ${
                            isRevealed ? 'scale-100' : 'scale-90'
                          }`}
                        >
                          {section.roman}
                        </span>
                        <span
                          style={{ transitionDelay: '300ms' }}
                          className={`h-px w-8 sm:w-12 bg-[#1a1917] flex-shrink-0 origin-left transition-transform duration-[800ms] ease-out motion-reduce:transition-none ${
                            isRevealed ? 'scale-x-100' : 'scale-x-0'
                          }`}
                        />
                        <span className="font-serif text-[2rem] sm:text-[2.75rem] lg:text-[3.5rem] text-[#1a1917] leading-none whitespace-nowrap">
                          {section.label}
                        </span>
                      </div>
                    </div>
                  </Reveal>
                ) : null}
                <Reveal show={isRevealed} delay={isOpener ? 200 : 0}>
                  <div className="flex items-baseline gap-3 text-[#8c8478]">
                    <span className="font-serif text-xs tabular-nums">
                      {section.roman}.{String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="h-px flex-1 bg-[#d9d4c8] max-w-[3rem]" />
                    {slide.eyebrow ? (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[#8c8478]">
                        {slide.eyebrow}
                      </span>
                    ) : null}
                  </div>
                </Reveal>
                <Reveal show={isRevealed} delay={isOpener ? 280 : 80}>
                  <h2 className="mt-3 font-serif text-[1.75rem] sm:text-3xl lg:text-[2.25rem] leading-[1.15] text-[#1a1917]">
                    {slide.title}
                  </h2>
                </Reveal>
                {slide.hook ? (
                  <Reveal show={isRevealed} delay={isOpener ? 360 : 160}>
                    <p className="mt-3 text-base sm:text-[17px] text-[#4a463d] leading-relaxed italic">
                      {slide.hook}
                    </p>
                  </Reveal>
                ) : null}
                <Reveal show={isRevealed} delay={isOpener ? 440 : 240}>
                  <div className="mt-7 text-[15px] sm:text-base leading-relaxed">
                    {slide.body}
                  </div>
                </Reveal>
                {i === 0 ? (
                  <Reveal show={isRevealed} delay={700}>
                    <div className="mt-16 flex flex-col items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-[#8c8478]">
                        scroll
                      </span>
                      <span className="h-8 w-px bg-[#b5533c]/60 animate-pulse" />
                    </div>
                  </Reveal>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
