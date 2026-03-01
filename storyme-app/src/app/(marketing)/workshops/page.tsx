/**
 * Workshops & Events Page
 * /workshops
 *
 * KindleWood Learning Lab — in-person creative workshops
 * with partner organizations.
 *
 * Zigzag layout inspired by VideoShowcase component pattern.
 * Scroll-reveal animations using Intersection Observer.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';
import Reveal from '@/components/ui/Reveal';
import {
  WORKSHOP_PARTNERS,
  WORKSHOP_FAQS,
} from '@/lib/workshops/constants';

export default function WorkshopsPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <Reveal>
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              KindleWood{' '}
              <span className="underline decoration-amber-400 decoration-4 underline-offset-4">
                Learning Lab
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Our Learning Lab brings KindleWood&apos;s storytelling magic into
              real classrooms and maker spaces — where kids explore nature, create
              real storybooks and maker projects, and grow as confident creators
              through hands-on workshops with partner schools and STEM academies.
            </p>
          </div>
        </Reveal>

        {/* Partner Sections */}
        <Reveal>
          <div className="text-center mb-10">
            <p className="text-sm font-medium uppercase tracking-widest text-purple-500 mb-2">
              Our Partnerships
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Workshops &amp; Programs
            </h2>
          </div>
        </Reveal>

        {WORKSHOP_PARTNERS.map((partner) => (
          <div key={partner.id} id={partner.slug} className="scroll-mt-24 border-t border-gray-200 pt-12 first:border-t-0 first:pt-0">
            {partner.comingSoon ? (
              /* Coming Soon Partner — Zigzag Layout */
              <Reveal>
                <div className="mb-16">
                  <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
                    {/* Left: Logo pair with organic blob shape (different shape, light yellow) */}
                    <div className="w-full md:w-[45%] flex justify-center">
                      <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
                        <svg
                          viewBox="0 0 600 600"
                          className="absolute inset-0 w-full h-full"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <defs>
                            <linearGradient id={`blobGradient-${partner.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#fef9c3" />
                              <stop offset="40%" stopColor="#fef08a" />
                              <stop offset="100%" stopColor="#fde047" stopOpacity="0.6" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M280,50 C360,30 480,70 530,150 C580,230 550,310 560,380 C570,450 530,530 450,550 C370,570 310,530 240,540 C170,550 90,560 50,480 C10,400 40,320 30,250 C20,180 50,100 130,60 C190,30 220,65 280,50 Z"
                            fill={`url(#blobGradient-${partner.id})`}
                          />
                        </svg>
                        <div className="relative z-10 flex flex-col items-center justify-center gap-3">
                          <img
                            src="/Logo_New.png"
                            alt="KindleWood Studio"
                            className="h-16 sm:h-20 w-auto object-contain"
                          />
                          <span className="text-2xl text-amber-800/30 font-light">+</span>
                          {partner.logoUrl ? (
                            <img
                              src={partner.logoUrl}
                              alt={partner.partnerName}
                              className="h-16 sm:h-20 w-auto object-contain"
                            />
                          ) : (
                            <span className="text-xl sm:text-2xl font-bold text-gray-700">
                              {partner.partnerName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Partner intro */}
                    <div className="w-full md:w-[55%]">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                          {partner.name}
                        </h2>
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium whitespace-nowrap">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-lg text-amber-800 font-medium mb-4">
                        {partner.tagline}
                      </p>
                      <p className="text-gray-700 leading-relaxed mb-4">
                        {partner.description}
                      </p>
                      <p className="text-sm text-gray-500">
                        Interested?{' '}
                        <a
                          href="mailto:Admin@KindleWoodStudio.ai"
                          className="text-purple-600 hover:text-purple-700 font-medium"
                        >
                          Contact us
                        </a>{' '}
                        to learn more.
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ) : (
              /* Active Partner — Zigzag Layout */
              <div className="mb-16">
                {/* Row 1: Partnership Intro (logos left, text right) */}
                <Reveal>
                  <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center mb-16">
                    {/* Left: Logo pair with organic blob shape */}
                    <div className="w-full md:w-[45%] flex justify-center">
                      <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
                        {/* Irregular blob background — wavy organic shape */}
                        <svg
                          viewBox="0 0 600 600"
                          className="absolute inset-0 w-full h-full"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <defs>
                            <linearGradient id="blobGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#dbeafe" />
                              <stop offset="40%" stopColor="#bfdbfe" />
                              <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.7" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M300,520 C200,540 80,480 50,380 C20,280 60,200 40,140 C20,80 80,20 180,40 C240,52 260,90 320,60 C380,30 440,10 500,60 C560,110 560,180 540,260 C520,340 530,380 500,440 C470,500 400,500 300,520 Z"
                            fill="url(#blobGradient)"
                          />
                        </svg>
                        {/* Logos stacked vertically on top of blob */}
                        <div className="relative z-10 flex flex-col items-center justify-center gap-3">
                          <img
                            src="/Logo_New.png"
                            alt="KindleWood Studio"
                            className="h-16 sm:h-20 w-auto object-contain"
                          />
                          <span className="text-2xl text-blue-800/30 font-light">+</span>
                          {partner.logoUrl && (
                            <img
                              src={partner.logoUrl}
                              alt={partner.partnerName}
                              className="h-16 sm:h-20 w-auto object-contain"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Workshop intro */}
                    <div className="w-full md:w-[55%]">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                          Creative Explorers Workshop
                        </h2>
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium whitespace-nowrap">
                          Now Enrolling
                        </span>
                      </div>
                      <p className="text-lg text-amber-800 font-medium mb-4">
                        Where imagination becomes structured thinking, and thinking becomes innovation.
                      </p>
                      <p className="text-gray-700 leading-relaxed mb-4">
                        <span className="font-semibold">KindleWood Studio</span> is excited to partner with{' '}
                        <span className="font-semibold">{partner.partnerName}</span>{' '}
                        to bring a 5-week themed storytelling series to kids in our
                        community. Each week explores a new theme — Nature, Habits &amp;
                        Health, Innovation, Value &amp; Choices, and Community — through
                        structured creativity that builds real skills: executive function,
                        literacy, and creative problem-solving.
                      </p>
                      {partner.partnerDescription && (
                        <a
                          href="https://www.steamoji.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                          Learn more about {partner.partnerName} →
                        </a>
                      )}
                    </div>
                  </div>
                </Reveal>

                {/* Row 2: Morning Session (text left, image right) */}
                <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center mb-16">
                  {/* Left: Morning session info */}
                  <Reveal className="w-full md:w-[55%]">
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">
                      Sunday Morning Session (Ages 4–6)
                    </h3>
                    <p className="text-amber-800 font-medium mb-3">
                      Indoor: Little Crafter and Storyteller
                    </p>
                    <p className="text-gray-500 mb-3">
                      10:00 – 11:00 AM · ~60 min · 5 Sundays
                    </p>
                    <p className="text-gray-700 leading-relaxed mb-4">
                      Each session follows a clear creative arc: Story Spark → Craft
                      Creation → Guided Story Build → Share Circle. Children build
                      sequencing skills, emotional labeling, verbal confidence, and
                      early narrative logic — all through playful, structured creativity.
                    </p>
                    <ul className="space-y-2 mb-6">
                      {partner.sessions[0]?.morning.highlights.map(
                        (highlight, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-gray-600"
                          >
                            <span className="text-amber-500 mt-0.5">•</span>
                            {highlight}
                          </li>
                        ),
                      )}
                    </ul>
                    <Link
                      href="/workshops/register?session=morning"
                      className="inline-block px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                    >
                      Register
                    </Link>
                  </Reveal>

                  {/* Right: Image + Outcomes */}
                  <Reveal className="w-full md:w-[45%] space-y-4" delay={150}>
                    <img
                      src="/images/workshop-morning.png"
                      alt="Morning workshop — kids crafting and storytelling"
                      className="aspect-video w-full object-cover rounded-2xl shadow-md"
                    />
                    <div className="rounded-xl p-4">
                      <p className="text-sm font-semibold text-amber-900 mb-2">What Your Child Takes Home</p>
                      <ul className="space-y-1.5 text-sm text-gray-600">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">✦</span>
                          A completed craft &amp; structured story each week
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">✦</span>
                          Their own story characters &amp; storybook
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">✦</span>
                          Growing confidence in creative expression
                        </li>
                      </ul>
                    </div>
                  </Reveal>
                </div>

                {/* Row 3: Afternoon Session (image left, text right) — reversed */}
                <div className="flex flex-col md:flex-row-reverse gap-8 md:gap-12 items-center mb-8">
                  {/* Right visually: Afternoon session info */}
                  <Reveal className="w-full md:w-[55%]">
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">
                      Sunday Afternoon Session (Ages 7–9)
                    </h3>
                    <p className="text-amber-800 font-medium mb-3">
                      Nature Explorer + Creativity Lab
                    </p>
                    <p className="text-gray-500 mb-3">
                      1:00 – 3:00 PM · 120 min · 5 Sundays
                    </p>
                    <p className="text-gray-700 leading-relaxed mb-4">
                      A two-part session: 45-minute family nature exploration
                      (Bridle Trails / Highland Park) followed by an indoor
                      Creativity Lab. Children observe real-world systems, identify
                      problems, then map stories and build solutions — developing
                      executive function, cognitive flexibility, and creative
                      problem-solving.
                    </p>
                    <ul className="space-y-2 mb-6">
                      {partner.sessions[0]?.afternoon.highlights.map(
                        (highlight, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-gray-600"
                          >
                            <span className="text-green-500 mt-0.5">•</span>
                            {highlight}
                          </li>
                        ),
                      )}
                    </ul>
                    <Link
                      href="/workshops/register?session=afternoon"
                      className="inline-block px-6 py-3 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                    >
                      Register
                    </Link>
                  </Reveal>

                  {/* Left visually: Image + Outcomes */}
                  <Reveal className="w-full md:w-[45%] space-y-4" delay={150}>
                    <img
                      src="/images/workshop-afternoon.png"
                      alt="Afternoon workshop — nature exploration and creativity lab"
                      className="aspect-video w-full object-cover rounded-2xl shadow-md"
                    />
                    <div className="rounded-xl p-4">
                      <p className="text-sm font-semibold text-green-900 mb-2">What Your Child Takes Home</p>
                      <ul className="space-y-1.5 text-sm text-gray-600">
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✦</span>
                          Storybooks, comics, blueprints &amp; maker projects
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✦</span>
                          Real problem-solving and design-thinking skills
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✦</span>
                          A portfolio of creative work across 5 themes
                        </li>
                      </ul>
                    </div>
                  </Reveal>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* FAQ Section */}
        <Reveal>
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="max-w-3xl mx-auto space-y-3">
              {WORKSHOP_FAQS.map((faq, index) => (
                <Reveal key={index} delay={index * 80}>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() =>
                        setOpenFaqIndex(openFaqIndex === index ? null : index)
                      }
                      className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                      aria-expanded={openFaqIndex === index}
                    >
                      <span className="font-medium text-gray-900 pr-4">
                        {faq.question}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                          openFaqIndex === index ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {openFaqIndex === index && (
                      <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-b from-blue-50 to-white border-t border-blue-100">
        <div className="max-w-6xl mx-auto px-4 text-center py-8">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-gray-600 mb-4">
            <a
              href="mailto:Admin@KindleWoodStudio.ai"
              className="hover:text-indigo-600 transition-colors"
            >
              Contact
            </a>
            <Link
              href="/support"
              className="hover:text-indigo-600 transition-colors"
            >
              Support
            </Link>
            <Link
              href="/privacy"
              className="hover:text-indigo-600 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-indigo-600 transition-colors"
            >
              Terms
            </Link>
          </div>
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} KindleWood Studio. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
