/**
 * Products Page — Option A layout (stacked Studio → loop bridge → Kids)
 * Visual-first redesign. Mirrors landing's "Creative Loop" tone.
 * Pulls live featured thumbs from public APIs (stories + characters).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import LandingNav from '@/components/navigation/LandingNav';
import Reveal from '@/components/ui/Reveal';
import { BOOK_TILES } from '@/lib/marketing/bookTiles';

// Tilted soft-color cards. Title is normal text in an accent color; body sits below.
const HOW_IT_COMES_TOGETHER = [
  {
    title: 'Spark from anything',
    body: 'A drawing, a photo, a single sentence or full writing — bring whatever your child imagines.',
    bg: 'bg-purple-50',
    titleColor: 'text-purple-700',
    border: 'border-purple-100',
    tilt: '-rotate-2',
  },
  {
    title: 'Kids are the storytellers',
    body: 'Story templates and a writing coach guide creativity and thinking — your child stays the author.',
    bg: 'bg-pink-50',
    titleColor: 'text-pink-700',
    border: 'border-pink-100',
    tilt: 'rotate-1',
  },
  {
    title: 'Bring it to life',
    body: 'AI narration in three languages — or record Mom, a teacher, or your child’s own voice for a keepsake worth replaying.',
    bg: 'bg-amber-50',
    titleColor: 'text-amber-700',
    border: 'border-amber-100',
    tilt: '-rotate-1',
  },
  {
    title: 'Share it with the world',
    body: 'Read in the Kids app, export a print-ready PDF, or publish as a Spotify podcast.',
    bg: 'bg-emerald-50',
    titleColor: 'text-emerald-700',
    border: 'border-emerald-100',
    tilt: 'rotate-2',
  },
] as const;

const KIDS_FEATURES = [
  {
    title: 'Interactive Reading',
    body: 'Tap any word for pronunciation in English, 中文, or 한국어.',
    bg: 'bg-blue-50',
    titleColor: 'text-blue-700',
    border: 'border-blue-100',
    tilt: '-rotate-2',
  },
  {
    title: 'Vocabulary Building',
    body: 'Auto-built word lists from the stories your child reads.',
    bg: 'bg-sky-50',
    titleColor: 'text-sky-700',
    border: 'border-sky-100',
    tilt: 'rotate-1',
  },
  {
    title: 'Fun Quizzes',
    body: 'AI questions that adapt to your child’s reading level.',
    bg: 'bg-indigo-50',
    titleColor: 'text-indigo-700',
    border: 'border-indigo-100',
    tilt: '-rotate-1',
  },
  {
    title: 'Word Learning Games',
    body: 'Playful drills that lock in new vocabulary.',
    bg: 'bg-purple-50',
    titleColor: 'text-purple-700',
    border: 'border-purple-100',
    tilt: 'rotate-2',
  },
  {
    title: 'Goals & Progress',
    body: 'Set goals together, earn badges, celebrate milestones.',
    bg: 'bg-emerald-50',
    titleColor: 'text-emerald-700',
    border: 'border-emerald-100',
    tilt: '-rotate-2',
  },
  {
    title: 'Multiple Profiles',
    body: 'A separate profile and library for every child.',
    bg: 'bg-amber-50',
    titleColor: 'text-amber-700',
    border: 'border-amber-100',
    tilt: 'rotate-1',
  },
] as const;

// Hardcoded community picks — confirmed live via /api/stories/public/[id].
const FEATURED_STORY_IDS = [
  'ff7778a2-e6a3-488d-bfbf-c43cfab73dfa',
  '6b50c1ea-e4b1-415c-9011-75525cd5dc5b',
] as const;

type StoryThumb = {
  id: string;
  title: string;
  authorName: string | null;
  authorAge: number | null;
  coverImageUrl: string | null;
};

type ArtistThumb = {
  id: string;
  name: string;
  reference_image_url: string | null;
  animated_preview_url: string | null;
};

export default function ProductsPage() {
  const [stories, setStories] = useState<StoryThumb[]>([]);
  const [artists, setArtists] = useState<ArtistThumb[]>([]);

  useEffect(() => {
    // Hand-picked story IDs (public single-story endpoint, no auth needed).
    Promise.all(
      FEATURED_STORY_IDS.map((id) =>
        fetch(`/api/stories/public/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.story ?? null)
          .catch(() => null)
      )
    ).then((results) => {
      setStories(results.filter(Boolean) as StoryThumb[]);
    });

    // Featured public characters — top 2 for the artwork tiles.
    fetch('/api/public-characters?featured=true')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.characters) setArtists(d.characters.slice(0, 2));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-x-hidden">
      <LandingNav />

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero — single line title, no description */}
        <Reveal>
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Online Tools for the{' '}
              <span className="text-amber-700 underline decoration-amber-700 decoration-2 underline-offset-4">
                Creative Loop
              </span>
            </h1>
          </div>
        </Reveal>

        {/* ───────── Studio block (dragon pops out top-left, matching landing) ───────── */}
        <Reveal>
          <section className="relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all pt-10 sm:pt-12 px-6 pb-8 sm:px-10 sm:pb-10 mb-4">
            {/* Creator dragon popping out top-left */}
            <div className="absolute -top-10 -left-2 sm:-top-16 sm:-left-4 w-24 h-24 sm:w-36 sm:h-36 pointer-events-none">
              <Image
                src="/images/dragon-writing.png"
                alt="Dragon writing with a quill"
                fill
                className="object-contain drop-shadow-lg"
              />
            </div>

            {/* Section header — centered, dragon overlaps top-left corner */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">KindleWood Studio</h3>
                <span className="inline-block bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Web
                </span>
              </div>
              <p className="text-gray-700 max-w-2xl mx-auto leading-relaxed">
                Turn drawings, photos, image notes, or any spark of imagination into beautiful storybooks kids can read and learn.
              </p>
              <p className="mt-2 text-sm text-amber-700 italic">
                We empower confident creators and writers.
              </p>
            </div>

            {/* What you can make — tilted thumbnails, chip-only labels */}
            <div className="mt-12">
              <h4 className="text-lg font-bold text-gray-900 mb-6 text-center">What you can make</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 px-2">
                {BOOK_TILES.map((tile) => (
                  <div
                    key={tile.key}
                    className={`group relative aspect-[210/297] transform ${tile.tilt} hover:rotate-0 hover:-translate-y-1 transition-all duration-300`}
                  >
                    {/* Image clipping container — chip lives outside this so it can pop past the edge */}
                    <div className="absolute inset-0 rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 via-pink-100 to-amber-100 shadow-md group-hover:shadow-2xl transition-shadow duration-300">
                      {tile.image ? (
                        <Image
                          src={tile.image}
                          alt={tile.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 px-4">
                          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <span className="text-xs text-center font-medium">Cover art coming soon</span>
                        </div>
                      )}

                      {tile.comingSoon && (
                        <span className="absolute bottom-2 left-2 bg-white/90 backdrop-blur text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow">
                          Coming soon
                        </span>
                      )}
                    </div>

                    {/* Sticker-style chip — pops out top-right, tilted, ringed for pop */}
                    <span className={`absolute -top-3 -right-6 ${tile.chipColor} text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ring-2 ring-white rotate-6 group-hover:rotate-3 transition-transform tracking-wide z-10`}>
                      {tile.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* How it comes together — same chip-on-tilted-card style as book tiles */}
            <div className="mt-12">
              <h4 className="text-lg font-bold text-gray-900 mb-1 text-center">How it comes together</h4>
              <p className="text-sm text-gray-600 text-center mb-8 max-w-xl mx-auto">
                A creative loop that keeps your child in the driver’s seat.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 px-2">
                {HOW_IT_COMES_TOGETHER.map((step) => (
                  <div
                    key={step.title}
                    className={`rounded-xl ${step.bg} border ${step.border} shadow-md hover:shadow-xl p-5 transform ${step.tilt} hover:rotate-0 hover:-translate-y-1 transition-all duration-300`}
                  >
                    <p className={`font-bold text-base ${step.titleColor} leading-snug mb-2`}>
                      {step.title}
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bilingual + CTA */}
            <div className="mt-10 flex flex-col items-center gap-4">
              <span className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">
                Bilingual: English primary · 中文 / 한국어 secondary
              </span>
              <Link
                href="/signup"
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold text-base transition-colors min-w-[200px] text-center"
              >
                Start Creating
              </Link>
            </div>
          </section>
        </Reveal>

        {/* ───────── Loop bridge — clean refresh-cycle icon ───────── */}
        <Reveal>
          <div className="flex items-center justify-center gap-3 my-3" aria-hidden="true">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Share</span>
            <svg
              viewBox="0 0 40 40"
              className="w-9 h-9 text-amber-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Top arc: left → right */}
              <path d="M 8 16 A 12 12 0 0 1 32 16" />
              <polyline points="32,9 32,16 25,16" />
              {/* Bottom arc: right → left */}
              <path d="M 32 24 A 12 12 0 0 1 8 24" />
              <polyline points="8,31 8,24 15,24" />
            </svg>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Inspire</span>
          </div>
        </Reveal>

        {/* ───────── Kids block (dragon pops out top-right, flipped) ───────── */}
        <Reveal>
          <section className="relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all pt-10 sm:pt-12 px-6 pb-8 sm:px-10 sm:pb-10 mb-12">
            {/* Reader dragon popping out top-right (flipped to face left) */}
            <div className="absolute -top-10 -right-2 sm:-top-16 sm:-right-4 w-24 h-24 sm:w-36 sm:h-36 pointer-events-none scale-x-[-1]">
              <Image
                src="/images/dragon-reader.png"
                alt="Dragon reading a book"
                fill
                className="object-contain drop-shadow-lg"
              />
            </div>

            {/* Section header — centered, dragon overlaps top-right corner */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">KindleWood Kids</h3>
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Mobile
                </span>
                <span className="inline-block bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Ages 3–12
                </span>
              </div>
              <p className="text-gray-700 max-w-2xl mx-auto leading-relaxed">
                A safe, ad-free reading app where children explore their personalized library and
                community stories — to read, learn, play, and grow in one magical space.
              </p>
              <p className="mt-2 text-sm text-amber-700 italic">We inspire a love of reading and learning.</p>
            </div>

            {/* Feature cards — soft pastel bg, normal-text colored title */}
            <div className="mt-12">
              <h4 className="text-lg font-bold text-gray-900 mb-6 text-center">Why kids love it</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 px-2">
                {KIDS_FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className={`rounded-xl ${f.bg} border ${f.border} shadow-md hover:shadow-xl p-5 transform ${f.tilt} hover:rotate-0 hover:-translate-y-1 transition-all duration-300`}
                  >
                    <p className={`font-bold text-base ${f.titleColor} leading-snug mb-2`}>{f.title}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{f.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 100% Safe · 100% Free badge */}
            <div className="mt-8 flex justify-center">
              <span className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm font-bold px-4 py-2 rounded-full">
                100% Safe · 100% Free for kids
              </span>
            </div>

            {/* Download row */}
            <div className="mt-8">
              <h4 className="text-center text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
                Download the Kids app
              </h4>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
                {/* Buttons column */}
                <div className="flex flex-col gap-3">
                  <a
                    href="https://apps.apple.com/us/app/kindlewood-kids/id6755075039"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-colors min-w-[200px]"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    App Store
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.kindlewood.kindlewood_kids"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-colors min-w-[200px]"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.196-3.193l2.553 1.479c.79.457.79 1.6 0 2.057l-2.563 1.485-2.626-2.626 2.636-2.395zM5.864 2.658L16.802 8.99l-2.301 2.302L5.864 2.658z" />
                    </svg>
                    Google Play
                  </a>
                </div>

                {/* QR codes */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                      <Image
                        src="/images/qr-kindlewood-ios.png"
                        alt="App Store QR code"
                        width={112}
                        height={112}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1 font-medium">iOS</p>
                  </div>
                  <div className="text-center">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                      <Image
                        src="/images/qr-kindlewood-android.png"
                        alt="Google Play QR code"
                        width={112}
                        height={112}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1 font-medium">Android</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ───────── Community band ───────── */}
        <Reveal>
          <section className="mb-16">
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Community Stories & Little Artists
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                See what other kids are creating — and let it inspire your own.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Story covers — click → public community gallery to encourage discovery */}
              {stories.map((s) => (
                <Link
                  key={s.id}
                  href="/stories"
                  className="group rounded-xl overflow-hidden bg-white border border-gray-200 hover:shadow-lg transition-all"
                >
                  <div className="relative aspect-[3/4] bg-gray-100">
                    {s.coverImageUrl && (
                      <Image
                        src={s.coverImageUrl}
                        alt={s.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    )}
                    <span className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Story
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-gray-900 text-sm line-clamp-1">{s.title}</p>
                    {s.authorName && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        by {s.authorName}
                        {s.authorAge ? `, age ${s.authorAge}` : ''}
                      </p>
                    )}
                  </div>
                </Link>
              ))}

              {/* Artist characters — click → little artists gallery */}
              {artists.map((a) => {
                const img = a.animated_preview_url || a.reference_image_url;
                return (
                  <Link
                    key={a.id}
                    href="/little-artists"
                    className="group rounded-xl overflow-hidden bg-white border border-gray-200 hover:shadow-lg transition-all"
                  >
                    <div className="relative aspect-[3/4] bg-gray-100">
                      {img && (
                        <Image
                          src={img}
                          alt={a.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      )}
                      <span className="absolute top-2 left-2 bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Artist
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-gray-900 text-sm line-clamp-1">{a.name}</p>
                      <p className="text-xs text-gray-600 mt-0.5">Little artist creation</p>
                    </div>
                  </Link>
                );
              })}

              {/* Skeletons while loading */}
              {stories.length === 0 &&
                artists.length === 0 &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden bg-white border border-gray-200">
                    <div className="aspect-[3/4] bg-gray-100 animate-pulse" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-gray-100 rounded animate-pulse" />
                      <div className="h-2 bg-gray-100 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-6 text-sm">
              <Link href="/stories" className="text-purple-600 hover:text-purple-700 font-medium">
                Browse all stories →
              </Link>
              <Link href="/little-artists" className="text-pink-600 hover:text-pink-700 font-medium">
                Meet the little artists →
              </Link>
            </div>
          </section>
        </Reveal>

        {/* ───────── In-Person Learning hook ───────── */}
        <Reveal>
          <div className="mb-16 max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              We Also Offer In-Person Learning
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto mb-6">
              Hands-on creative workshops at partner schools and the KindleWood Learning Lab — where
              kids create, collaborate, and learn beyond the screen.
            </p>
            <Link
              href="/workshops"
              className="inline-block bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              View Workshops & Events
            </Link>
          </div>
        </Reveal>

      </div>
    </div>
  );
}
