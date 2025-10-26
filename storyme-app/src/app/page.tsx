/**
 * Landing page / Home page
 * Modern, appealing design with emojis
 * Updated with KindleWood branding and ecosystem messaging
 */

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import HeroStoryShowcase from '@/components/landing/HeroStoryShowcase';
import Testimonials from '@/components/landing/Testimonials';
import ErrorHandler from '@/components/ErrorHandler';

export default function HomePage() {
  // Show landing page (removed auth redirect - dashboard handles auth now)
  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Error Banner - Wrapped in Suspense */}
      <Suspense fallback={null}>
        <ErrorHandler />
      </Suspense>

      {/* Header with Sign In button */}
      <header className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-bold hover:opacity-80 transition-opacity cursor-pointer text-gray-900">
            📚 Kindle<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600">Wood</span> Studio ✨
          </Link>
          <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">BETA</span>
        </div>
        <Link
          href="/login"
          className="text-gray-700 hover:text-gray-900 font-medium px-6 py-2 rounded-lg hover:bg-white/50 transition-all"
        >
          Sign In
        </Link>
      </header>

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

          {/* Right Column - Hero Visual (50%) - Shows real saved stories */}
          <HeroStoryShowcase />
        </div>

        {/* Our Mission Section */}
        <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl p-5 sm:p-6 mb-8 sm:mb-10 border border-blue-100">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                <span className="text-2xl sm:text-3xl">🎯</span>
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                Our Mission 🚀
              </h2>
              <div className="text-sm sm:text-base text-gray-700 space-y-2 leading-relaxed">
                <p>
                  KindleWood Studio empowers families, teachers, and creators to turn children&apos;s imagination into bilingual stories and educational experiences.
                </p>
                <p>
                  From story creation to learning apps and Spotify story libraries, we help every child read, listen, and learn — anywhere their imagination takes them.
                </p>
              </div>
            </div>
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
              <div className="text-sm sm:text-base text-gray-700 space-y-2 leading-relaxed">
                <p>
                  One evening, my 4-year-old came running to me, eyes sparkling with excitement.
                  He had just made up a wild story about how his friend got eaten by a dragon 🐉 — and how he and his superhero squad saved the day! 🦸‍♂️
                </p>
                <p>
                  As he told me every detail with so much imagination and joy, I realized these moments are priceless — little sparks of creativity worth keeping forever.
                </p>
                <p>
                  Around the same time, he was just beginning to learn how to read, and I noticed how much more excited he was to read his own stories. Seeing himself as the hero made reading fun, personal, and meaningful.
                </p>
                <p className="italic text-gray-600 bg-white/50 p-3 rounded-lg border-l-4 border-orange-400 text-sm">
                  <span className="text-xl mr-1">✨</span>
                  That moment, KindleWood was born — to help parents capture their child's imagination and turn it into personalized storybooks that inspire a love for reading and create memories to cherish forever.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Why Families and Educators Love KindleWood Studio */}
        <div className="mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-6 sm:mb-8">
            🎯 Why Families and Educators Love KindleWood Studio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Card 1: Your Child Is the Story */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-pink-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">📖</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Your Child Is the Story
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Upload a photo once, and your child becomes the hero of every adventure.
                    Our AI keeps them recognizable across every page — as they grow, their story library grows with them.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Create in Minutes, Inspire for Years */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-purple-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🎨</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Create in Minutes, Inspire for Years
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Record your voice, upload a video, or type a few sentences — our AI turns rough ideas into beautiful bilingual storybooks.
                    In just 5 minutes, you can create professional-quality stories and learning materials. No design skills needed.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Fun, Bilingual Learning That Feels Like Play */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-blue-100 relative">
              <span className="absolute top-4 right-4 text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                Coming Soon
              </span>
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
                    Stories sync with the KindleWood Kids app for interactive reading in English and Chinese.
                    Kids tap words to hear pronunciation, take fun quizzes, and get AI-powered explanations.
                    Learning feels like playing — and every story teaches something new.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Created by Families, Enriched by Educators */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-teal-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🧩</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Created by Families, Enriched by Educators
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Teachers can co-create and share educational storybooks — from phonics to science concepts — while maintaining classroom control.
                    Parents can blend teacher-created lessons with family stories for a personalized learning journey.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 5: Safe, Ad-Free Reading You Control */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-green-100 relative">
              <span className="absolute top-4 right-4 text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full">
                Coming Soon
              </span>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">💬</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Safe, Ad-Free Reading You Control
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    A kid-friendly space with no ads, no outside links, and no in-app purchases.
                    Your child only sees the stories you or their teacher publish.
                    Supports bilingual reading in English and Chinese, giving you complete peace of mind.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 6: Set Goals Together, Celebrate Progress */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-orange-100 relative">
              <span className="absolute top-4 right-4 text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                Coming Soon
              </span>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🎯</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Set Goals Together, Celebrate Progress
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Set reading or learning goals, earn badges, and celebrate milestones.
                    Parents and teachers can track progress, quiz scores, and reading streaks — turning motivation into meaningful growth.
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
                    Read at home, listen on Spotify, or print as keepsake books.
                    One story can travel from bedtime to classroom to car rides — helping kids stay curious and connected everywhere.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 8: Partner to Empower Every Young Author */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-violet-100 relative">
              <span className="absolute top-4 right-4 text-xs font-semibold px-2 py-1 bg-violet-100 text-violet-700 rounded-full">
                Coming Soon
              </span>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">✨</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Partner to Empower Every Young Author
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Schools and educators can publish their own learning collections, connect home and classroom learning, and inspire children to become confident storytellers in both languages.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-lg text-gray-700 mt-8">
            💫 <em>Because the best way to learn to love reading is to see yourself inside the story.</em>
          </p>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-2xl p-6 sm:p-10 md:p-12 mb-12 sm:mb-16 border border-blue-100">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 text-center flex items-center justify-center gap-3">
            <span>🔮 How It Works</span>
          </h2>
          <p className="text-center text-gray-600 mb-8 text-base sm:text-lg">
            Creating a KindleWood book is simple, fun, and magical — for both you and your child.
          </p>
          <div className="space-y-6">
            <div className="flex items-start gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg flex items-center gap-2">
                  Create Your Characters <span className="text-xl">👦👧</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Upload a photo or describe your child and family members. KindleWood keeps their look consistent across every page and every book.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg flex items-center gap-2">
                  Tell the Story <span className="text-xl">🎤</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Record your child's voice, upload a short video, snap a picture of their drawing, or type a quick story idea. Our AI understands their imagination — even if it starts with just a few doodles or sentences.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg flex items-center gap-2">
                  Watch the Magic Happen <span className="text-xl">🎨</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  KindleWood brings each story to life with beautiful, age-appropriate illustrations that capture your child's world and emotions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg flex items-center gap-2">
                  Review, Edit & Perfect <span className="text-xl">📖</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Preview your storybook, make edits, and regenerate any pages until it's perfect. Then download as a high-quality PDF — ready for bedtime reading, printing as a keepsake, or gifting to grandparents.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                5
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg flex items-center gap-2">
                  Publish & Share Everywhere <span className="text-xl">🌍</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Publish to the KindleWood Kids app for interactive reading. Send to Spotify for car rides and bedtime. Share with family and friends. Your stories follow your child everywhere they learn. (Coming soon)
                </p>
              </div>
            </div>
          </div>
          <p className="text-center text-gray-700 mt-8 text-base sm:text-lg">
            💫 <em>From imagination to a beautifully illustrated storybook — in just minutes. Then share it everywhere your child learns.</em>
          </p>
        </div>

      </div>

      {/* Testimonials Section - Above Footer */}
      <Testimonials />

      {/* Footer */}
      <div className="bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-6xl mx-auto px-4 text-center py-6 text-gray-500 text-sm">
          <p className="flex items-center justify-center gap-2">
            Made with <span className="text-red-500 animate-pulse">❤️</span> for parents and their little storytellers
          </p>
          <p className="mt-2 text-xs">
            KindleWood Studio • Beta
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
