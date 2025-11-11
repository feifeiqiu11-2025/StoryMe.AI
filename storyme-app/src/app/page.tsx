/**
 * Landing page / Home page
 * Modern, appealing design with emojis
 * Updated with KindleWood branding and ecosystem messaging
 */

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import Testimonials from '@/components/landing/Testimonials';
import ErrorHandler from '@/components/ErrorHandler';
import PricingCards from '@/components/pricing/PricingCards';
import LandingNav from '@/components/navigation/LandingNav';
import CommunityStoriesCarousel from '@/components/landing/CommunityStoriesCarousel';

export default function HomePage() {
  // Show landing page (removed auth redirect - dashboard handles auth now)
  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Error Banner - Wrapped in Suspense */}
      <Suspense fallback={null}>
        <ErrorHandler />
      </Suspense>

      {/* Navigation */}
      <LandingNav />

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
        {/* Hero Section - Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center mb-12">
          {/* Left Column - Content (50%) */}
          <div className="space-y-5">
            {/* Brand Logo/Title */}
            <div className="mb-6">
              <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-gray-900 leading-tight">
                📚 Kindle<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600">Wood</span> Studio ✨
              </h1>
              <div className="h-1 w-20 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600 rounded-full"></div>
            </div>

            {/* Tagline */}
            <div>
              <h2 className="text-base sm:text-lg lg:text-xl text-gray-700 leading-relaxed">
                Where Imagination Grows into Learning — Read, Listen, and Learn Anywhere
              </h2>
            </div>

            {/* CTA Buttons - Side by Side */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/signup"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-7 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold text-sm text-center shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                🎁 Start Free Trial
              </Link>
              <Link
                href="/login"
                className="bg-white text-gray-700 px-7 py-3 rounded-lg hover:bg-gray-50 font-medium text-sm text-center shadow-md hover:shadow-lg transition-all border border-gray-300 transform hover:-translate-y-0.5"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Right Column - Product Demo Video (50%) */}
          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl lg:block hidden">
            <iframe
              src="https://www.youtube.com/embed/7ISlDfVdTdk"
              title="KindleWood Studio Product Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>

          {/* Mobile Video - Full Width Below Text */}
          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl lg:hidden mt-6">
            <iframe
              src="https://www.youtube.com/embed/7ISlDfVdTdk"
              title="KindleWood Studio Product Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </div>

        {/* Personal Story Section */}
        <div className="bg-gradient-to-br from-white to-yellow-50 rounded-2xl shadow-xl p-5 sm:p-6 mb-8 sm:mb-10 border border-yellow-100">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                <span className="text-2xl sm:text-3xl">💡</span>
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                What Sparked KindleWood 🌟
              </h2>
              <div className="text-sm sm:text-base text-gray-700 space-y-3 leading-relaxed">
                <p>
                  One evening, my 4-year-old came running to me, eyes sparkling with excitement.
                  He had just made up a wild story about how his friend got eaten by a dragon 🐉 — and how he and his superhero squad saved the day! 🦸‍♂️
                </p>
                <p>
                  As he told me every detail with so much imagination and joy, I realized these moments are priceless. When I printed his story as a real book, he couldn't stop reading — because this time, he was the hero.
                </p>
                <p>
                  Then something magical happened: his little brother and their friends started creating their own dragon stories. A viral loop of imagination had begun.
                </p>
                <p className="italic text-gray-600 bg-white/50 p-4 rounded-lg border-l-4 border-orange-400 text-sm">
                  <span className="text-xl mr-1">✨</span>
                  That's when KindleWood Studio was born.
                </p>
                <p className="font-medium text-gray-800">
                  My dream isn't just to help kids read — it's to help them become storytellers and creators who develop confidence, empathy, and resilience: the superpowers AI will never have.
                </p>
                <div className="mt-6 text-center sm:text-left">
                  <a
                    href="/founder-letter"
                    className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold transition-colors group"
                  >
                    Read the Founder's Letter
                    <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Community Stories Carousel - Netflix Style */}
        <CommunityStoriesCarousel />

        {/* Why Kids, Families & Educators Love KindleWood Studio */}
        <div className="mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-6 sm:mb-8">
            🎯 Why Kids, Families & Educators Love KindleWood Studio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Card 1: Your Child Is the Story */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-pink-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">💖</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Your Child Is the Story
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Upload a photo once, and your child becomes the hero of every adventure. Our AI keeps them recognizable across every page — as they grow, their story library grows with them.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Real Voices, Real Connection */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-purple-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🎤</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Real Voices, Real Connection
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Record your own voice — or a teacher's — to narrate each story. Kids light up hearing familiar voices tell their adventures. Because no AI voice can replace the comfort of a parent's "once upon a time." (AI narration also available for convenience in multiple languages.)
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Fun, Bilingual Learning That Feels Like Play */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-blue-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🧠</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Fun, Bilingual Learning That Feels Like Play
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Stories sync with the <Link href="https://kindle-wood-kids.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 underline font-medium">KindleWood Kids</Link> app for interactive reading in English and Chinese. Kids tap words to hear pronunciation, take fun quizzes, and get AI-powered explanations. Learning feels like play — and every story teaches something new.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Created by Families, Enriched by Educators */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-teal-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🌱</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Created by Families, Enriched by Educators
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Teachers can co-create and share educational storybooks — from phonics to science concepts — while parents personalize stories with family characters or voices.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 5: Safe, Ad-Free Reading You Control */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-green-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🛡️</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Safe, Ad-Free Reading You Control
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    A kid-friendly space with no ads or outside links. Your child only sees stories shared by you or trusted teachers — supporting bilingual learning in complete peace of mind.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 6: Set Goals Together, Celebrate Progress */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-orange-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🏆</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Set Goals Together, Celebrate Progress
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Set reading or learning goals, earn badges, and celebrate milestones. Parents and teachers can track progress and celebrate small wins together.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 7: Stories Everywhere They Go */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-indigo-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🌍</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Stories Everywhere They Go
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Read at home, listen on Spotify, or print as keepsake books. Every story can travel from bedtime to car rides — helping kids stay curious and connected.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 8: Partner to Empower Every Young Author */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-violet-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🌟</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Partner to Empower Every Young Author
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Schools and educators can publish classroom story collections and inspire confident storytellers in both languages.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-lg text-gray-700 mt-8">
            💫 <em>Because the best way to learn to love reading is to see yourself inside the story.</em>
          </p>
        </div>

        {/* How the KindleWood Ecosystem Works */}
        <div className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">
            🔮 How the KindleWood Ecosystem Works
          </h2>

          {/* Product Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* KindleWood Studio */}
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border-2 border-purple-200 hover:shadow-2xl transition-all flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl sm:text-3xl">🎨</span>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">KindleWood Studio</h3>
                  <p className="text-xs sm:text-sm text-gray-600">For Parents & Educators</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base">
                The creative powerhouse where imagination becomes reality. Turn your child's stories, drawings, and wild ideas into beautiful bilingual storybooks — in just minutes.
              </p>

              <h4 className="font-bold text-gray-900 mb-3 text-sm sm:text-base">Key Features:</h4>
              <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-grow text-xs sm:text-sm">
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>AI-Powered Story Creation</strong> — Record voice, upload videos, type ideas, or snap photos of drawings</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Consistent Characters</strong> — Upload a photo once, your child becomes the hero of every story</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Bilingual Support</strong> — Stories in both English and Chinese with professional-quality illustrations</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Voice Narration</strong> — Use AI generated voice or record Mom's, Dad's, or a teacher's voice to bring stories to life. Kids feel connected when they hear familiar voices — building emotional bonds and bilingual learning confidence</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Publish to Spotify</strong> — Share your stories as audio podcasts on Spotify for listening anywhere</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Selective Publishing</strong> — Pick and choose which stories to publish to the KindleWood Kids app</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Export & Print</strong> — Download high-quality PDFs ready for printing as keepsake books</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Educator Tools</strong> — Create and share educational content with families and classrooms</span>
                </li>
              </ul>

              <Link
                href="/signup"
                className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 font-semibold text-center shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
              >
                Start Creating Stories
              </Link>
            </div>

            {/* KindleWood Kids */}
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border-2 border-blue-200 hover:shadow-2xl transition-all flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl sm:text-3xl">📱</span>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">KindleWood Kids</h3>
                  <p className="text-xs sm:text-sm text-gray-600">For Children</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base">
                A safe, ad-free reading app where children explore their personalized story library. Read, listen, learn, and play — all in one magical space.
              </p>

              <h4 className="font-bold text-gray-900 mb-3 text-sm sm:text-base">Key Features:</h4>
              <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-grow text-xs sm:text-sm">
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Multiple Child Profiles</strong> — Create separate profiles for each child to track reading and learning independently</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Interactive Reading & Vocabulary Building</strong> — Tap words to hear pronunciation in English or Chinese, and automatically build personalized vocabulary lists for unfamiliar words</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Audio Narration</strong> — Listen to stories anywhere — perfect for car rides and bedtime</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Fun Quizzes & Learning</strong> — AI-powered questions that adapt to reading level</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Goal Setting & Progress Tracking</strong> — Parents and kids define goals together, earn badges, celebrate milestones, and track reading progress</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>100% Safe</strong> — No ads, no in-app purchases, no external links</span>
                </li>
              </ul>

              <div className="block w-full bg-gray-100 text-gray-500 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-center border border-gray-300 text-sm sm:text-base">
                FREE for All Users
              </div>
            </div>
          </div>

          {/* How They Work Together */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-xl p-6 sm:p-8 border border-amber-200">
            <div className="text-center mb-6 sm:mb-8">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
                🌟 How They Work Together
              </h3>
              <p className="text-base sm:text-lg text-gray-700">
                A seamless creative ecosystem from imagination to learning
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xl sm:text-2xl mb-4 mx-auto">
                  1
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-center">Create in Studio</h3>
                <p className="text-xs sm:text-sm text-gray-600 text-center">
                  Parents and educators use KindleWood Studio to create personalized, bilingual stories in minutes
                </p>
              </div>

              <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-xl sm:text-2xl mb-4 mx-auto">
                  2
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-center">Publish to Kids</h3>
                <p className="text-xs sm:text-sm text-gray-600 text-center">
                  Stories instantly sync to the KindleWood Kids app, ready for children to explore and enjoy
                </p>
              </div>

              <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-xl sm:text-2xl mb-4 mx-auto">
                  3
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-center">Learn Everywhere</h3>
                <p className="text-xs sm:text-sm text-gray-600 text-center">
                  Children read, listen, and learn at home, in the car, or at school — their stories follow them everywhere
                </p>
              </div>
            </div>

            <p className="text-center text-gray-700 mt-6 sm:mt-8 text-sm sm:text-base italic">
              💫 From creation to confidence — a complete storytelling and learning journey
            </p>
          </div>
        </div>

      </div>

      {/* A Letter from the Founder Section */}
      <div id="founder-letter" className="max-w-6xl mx-auto px-4 pt-0 pb-12 sm:pb-16">

        {/* Section Title - Outside the card */}
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-6 sm:mb-8">
          💌 A Letter from the Founder
        </h2>

        {/* Single unified letter card */}
        <div className="bg-gradient-to-br from-white to-amber-50 rounded-2xl shadow-xl p-6 sm:p-10 border border-amber-200">

          {/* Letter Content */}
          <div className="space-y-5 text-gray-700 leading-relaxed">

            {/* Opening */}
            <p className="text-base sm:text-lg">
              When I think of the kids I know — my sons Connor and Carter, the neighborhood kids racing off after school — I feel both excitement and a little worry. We're living in a moment where intelligence is no longer enough; AI can write, code, and even "think." But one thing it can't do — and what will truly define our children's future — is <strong>creativity, empathy, and the courage to imagine something new</strong>.
            </p>

            <p className="text-base sm:text-lg">
              The goal for the next generation isn't to compete with machines, but to collaborate with them — to turn technology into a creative amplifier, not a substitute for thinking.
            </p>

            <p className="text-base sm:text-lg font-medium text-gray-800">
              Our children's edge won't be how fast they answer — it'll be the questions they dare to ask.
            </p>

            {/* Research Section */}
            <div className="my-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
                The Hard Numbers Behind What Feels Intuitive
              </h3>

              <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500 mb-6">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold flex-shrink-0 mt-1">•</span>
                    <div>
                      <strong className="text-gray-900">Creative children grow into more adaptable, confident adults.</strong><br />
                      <span className="text-sm text-gray-600">
                        A 2024 Crayola study found that <em>92% of kids aged 6–12 believe being creative boosts their confidence</em>.
                        (<a href="https://www.prnewswire.com/news-releases/new-crayola-childrens-study-reveals-a-powerful-link-between-creativity-and-confidence-302326950.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">PR Newswire</a>)
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold flex-shrink-0 mt-1">•</span>
                    <div>
                      <strong className="text-gray-900">Creativity fuels lifelong success.</strong><br />
                      <span className="text-sm text-gray-600">
                        Research shows it predicts higher academic achievement, career satisfaction, and problem-solving ability.
                        (<a href="https://www.psychologytoday.com/us/blog/work-your-mind/202111/the-long-lasting-benefits-of-childhood-creativity" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Psychology Today</a>,{' '}
                        <a href="https://www.purdue.edu/uns" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Purdue University</a>)
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold flex-shrink-0 mt-1">•</span>
                    <div>
                      <strong className="text-gray-900">Creativity supports mental health and resilience.</strong><br />
                      <span className="text-sm text-gray-600">
                        Studies link creative expression with better emotional well-being and stress regulation.
                        (<a href="https://ncch.org.uk/uploads/Creativity-and-Mental-Health-in-Schools-Briefing.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">National Centre for Creative Health</a>,{' '}
                        <a href="https://online.maryville.edu" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Maryville University</a>)
                      </span>
                    </div>
                  </li>
                </ul>
              </div>

              <p className="text-gray-800 font-medium bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200 mb-6">
                In short, when kids imagine and make, they're not just playing — they're building <em className="text-blue-700">uniquely human strengths</em> that no machine can replicate.
              </p>

              <p className="text-base sm:text-lg">
                As information becomes instantly available, what matters most is <strong>how</strong> children think — not what they memorize. The power to connect ideas, to ask "what if," and to tell new stories will shape the next generation of innovators, scientists, and dreamers.
              </p>
            </div>

            {/* How KindleWood Supports */}
            <div className="my-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
                How KindleWood Supports That Journey
              </h3>

              <p className="text-base sm:text-lg mb-6">
                At <strong className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">KindleWood Studio</strong>, we're building an AI-powered ecosystem designed to help children grow not just smarter, but more creative, imaginative, empathetic, and confident.
              </p>

              <div className="space-y-4">
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-5 border-l-4 border-pink-500">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span>📖</span> Storytelling as a Launchpad
                  </h4>
                  <p className="text-sm sm:text-base text-gray-700">
                    Every child has a story to tell. KindleWood turns their ideas into bilingual, illustrated storybooks — where they are the author, director, and dreamer. This creative act builds voice, confidence, and self-expression.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-5 border-l-4 border-purple-500">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span>🤖</span> AI as a Co-Creator, Not a Replacement
                  </h4>
                  <p className="text-sm sm:text-base text-gray-700">
                    Rather than seeing AI as the "answer machine," we treat it as a creative partner. The child proposes, imagines, tweaks — and the AI helps scaffold, sketch, illustrate, and reflect. This keeps the child in the driver's seat. The message we send: <em className="font-medium text-purple-700">You are the creator; the tool is the amplifier.</em>
                  </p>
                </div>

                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-5 border-l-4 border-teal-500">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span>🌟</span> Beyond Creativity: Building Core Life Skills
                  </h4>
                  <ul className="space-y-2 text-sm sm:text-base text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 font-bold mt-1">→</span>
                      Share stories with friends and family → empathy & communication
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 font-bold mt-1">→</span>
                      Reflect on "What if?" and "Why?" → curiosity & critical thinking
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 font-bold mt-1">→</span>
                      Iterate and experiment → resilience & growth mindset
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 font-bold mt-1">→</span>
                      Expand narratives across languages → global perspective
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border-l-4 border-orange-500">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span>📚</span> Balanced with Traditional Academic Foundations
                  </h4>
                  <p className="text-sm sm:text-base text-gray-700">
                    Foundational skills like reading and writing still matter — but as <em className="font-medium text-orange-700">tools for thinking</em> rather than rote tasks. Kids don't just learn to read stories; they learn to create them.
                  </p>
                </div>
              </div>
            </div>

            {/* Closing Reflection */}
            <div className="my-6 pt-6 border-t border-amber-300">
              <p className="text-base sm:text-lg mb-6">
                When I reflect on my own journey — from building AI-powered products for enterprise customers, to designing and constructing our family home, to co-creating stories with my kids at bedtime — I've realized something simple yet profound:
              </p>

              <blockquote className="bg-gradient-to-r from-amber-100 to-yellow-100 border-l-4 border-amber-500 p-6 rounded-lg my-6">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 italic">
                  "The tools may evolve, but imagination is timeless."
                </p>
              </blockquote>

              <p className="text-base sm:text-lg mb-8">
                It's what bridges innovation and emotion — how we build not just products or houses, but futures worth living in. KindleWood Studio is my way of passing that belief forward — a space where every child can see themselves as a creator, every parent can nurture imagination, and every story becomes a small act of hope for the future.
              </p>
            </div>

            {/* Signature */}
            <div className="mt-10 pt-6 border-t-2 border-amber-300">
              <p className="text-gray-600 mb-6 italic text-base">With gratitude and imagination,</p>
              <p
                className="text-5xl sm:text-6xl text-blue-900 mb-2"
                style={{ fontFamily: "var(--font-signature)" }}
              >
                Feifei Qiu
              </p>
              <p className="text-sm text-gray-600 mt-3">Founder & Mom, KindleWood Studio</p>
            </div>

          </div>
        </div>
      </div>

      {/* Testimonials Section - Above Footer */}
      <Testimonials />

      {/* Pricing CTA Section */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-t border-purple-100">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
          {/* Section Header */}
          <div className="text-center mb-10">
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Every great story starts with a child's imagination
            </p>
            <p className="text-base sm:text-lg text-gray-600">
              Check out our pricing plans and start inspiring your child's imagination journey today
            </p>
          </div>

          {/* Pricing Cards - Using shared component */}
          <div className="mb-10">
            <PricingCards billingCycle="monthly" simpleMode={true} />
          </div>

          {/* Detailed Pricing Link */}
          <div className="text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
            >
              View detailed pricing and features →
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-b from-blue-50 to-white border-t border-blue-100">
        <div className="max-w-6xl mx-auto px-4 text-center py-8">
          {/* Footer Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-gray-600 mb-4">
            <a href="mailto:Admin@KindleWoodStudio.ai" className="hover:text-indigo-600 transition-colors">Contact</a>
            <Link href="/support" className="hover:text-indigo-600 transition-colors">Support</Link>
            <Link href="/privacy" className="hover:text-indigo-600 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo-600 transition-colors">Terms</Link>
          </div>

          {/* Copyright */}
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} KindleWood Studio. All rights reserved.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
