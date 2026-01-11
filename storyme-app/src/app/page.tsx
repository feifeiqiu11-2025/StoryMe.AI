/**
 * Landing page / Home page
 * Figma-inspired design with hero carousel
 * Updated with KindleWood branding and ecosystem messaging
 */

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import Testimonials from '@/components/landing/Testimonials';
import ErrorHandler from '@/components/ErrorHandler';
import PricingCards from '@/components/pricing/PricingCards';
import LandingNav from '@/components/navigation/LandingNav';
import HeroCarousel from '@/components/landing/HeroCarousel';

export default function HomePage() {
  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Error Banner - Wrapped in Suspense */}
      <Suspense fallback={null}>
        <ErrorHandler />
      </Suspense>

      {/* Navigation */}
      <LandingNav />

      <div className="max-w-6xl mx-auto px-4 pt-8 pb-2">
        {/* Hero Section - Carousel */}
        <div className="mb-8 sm:mb-10">
          {/* Hero Carousel */}
          <HeroCarousel />
        </div>

        {/* KindleWood Principles - Visual Journey Section */}
        <div className="mb-12 sm:mb-16">
          {/* Section Title */}
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Our Principles
            </h2>
            <p className="text-base sm:text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto">
              At <strong className="text-amber-700">KindleWood</strong>, we believe every child is born creative. Our role is to protect and amplify it through a journey of sparking ideas, creating boldly, and growing into confident thinkers.
            </p>
          </div>

          {/* Clean Journey Flow - Inspired by Slides */}
          <div className="mb-12">
            {/* Three Column Grid with Arrows */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2 mb-8">

              {/* Column 1: Spark */}
              <div className="bg-white rounded-xl p-6 shadow-md border border-yellow-200 flex-1 max-w-sm">
                {/* Title - Top Center */}
                <h4 className="text-xl font-bold text-gray-900 text-center mb-4">Spark</h4>

                {/* Image */}
                <div className="mb-4 rounded-lg overflow-hidden">
                  <img
                    src="/images/spark-hands.jpg"
                    alt="Hands holding a spark of light"
                    className="w-full h-40 object-cover"
                  />
                </div>

                {/* Bullet Points */}
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span>A wild idea whispered before bedtime</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span>A creative drawing scribbled on a napkin</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span>A curious question that won't stop</span>
                  </li>
                </ul>
              </div>

              {/* Arrow 1 */}
              <div className="hidden md:flex items-center justify-center px-2">
                <span className="text-2xl text-gray-400">→</span>
              </div>
              <div className="md:hidden flex items-center justify-center py-2">
                <span className="text-2xl text-gray-400">↓</span>
              </div>

              {/* Column 2: Create */}
              <div className="bg-white rounded-xl p-6 shadow-md border border-pink-200 flex-1 max-w-sm">
                {/* Title - Top Center */}
                <h4 className="text-xl font-bold text-gray-900 text-center mb-4">Create</h4>

                {/* Image - object-bottom to show hands crafting */}
                <div className="mb-4 rounded-lg overflow-hidden">
                  <img
                    src="/images/kids-creating.jpg"
                    alt="Children creating and drawing together"
                    className="w-full h-40 object-cover object-bottom"
                  />
                </div>

                {/* Bullet Points */}
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-pink-600 mt-1">•</span>
                    <span>Storybooks they read and share</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-pink-600 mt-1">•</span>
                    <span>Art projects they proudly display</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-pink-600 mt-1">•</span>
                    <span>Digital and physical creations that last</span>
                  </li>
                </ul>
              </div>

              {/* Arrow 2 */}
              <div className="hidden md:flex items-center justify-center px-2">
                <span className="text-2xl text-gray-400">→</span>
              </div>
              <div className="md:hidden flex items-center justify-center py-2">
                <span className="text-2xl text-gray-400">↓</span>
              </div>

              {/* Column 3: Grow */}
              <div className="bg-white rounded-xl p-6 shadow-md border border-green-200 flex-1 max-w-sm">
                {/* Title - Top Center */}
                <h4 className="text-xl font-bold text-gray-900 text-center mb-4">Grow</h4>

                {/* Image - object-bottom to show books complete */}
                <div className="mb-4 rounded-lg overflow-hidden">
                  <img
                    src="/images/kids-reading.jpg"
                    alt="Children reading books together"
                    className="w-full h-40 object-cover object-bottom"
                  />
                </div>

                {/* Bullet Points */}
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Confident in their own voice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Resilient when ideas don't work</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Empathetic storytellers</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>

        {/* Partnership Section */}
        <div className="mb-12 sm:mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Partnering with Schools & Educators
            </h2>
            <p className="text-gray-600 leading-relaxed max-w-3xl mx-auto">
              We partner with schools, educators, and community organizations to bring creativity-driven storytelling into classrooms and homes. Together, we inspire children's imagination, empower teachers as educational creators, and help kids become confident storytellers who trust their ideas and believe in their own voice.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {/* Avocado Montessori Academy */}
            <div className="flex flex-col items-center">
              <div className="h-20 mb-3 flex items-center justify-center">
                <img
                  src="/images/avocado-logo-cropped.png"
                  alt="Avocado Montessori Academy"
                  className="h-full w-auto object-contain"
                />
              </div>
            </div>

            {/* Puget Sound Foundation */}
            <div className="flex flex-col items-center">
              <div className="h-20 mb-3 flex items-center justify-center px-4">
                <div className="text-center">
                  <div className="font-bold text-amber-800 text-3xl leading-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}>
                    Puget Sound
                  </div>
                  <div className="text-amber-700 text-lg leading-tight italic" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}>
                    Children & Youth Foundation
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Demo Video */}
        <div className="mb-12 sm:mb-16">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              What Inspired KindleWood
            </h2>
          </div>
          <div className="max-w-3xl mx-auto">
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-xl">
              <iframe
                src="https://www.youtube.com/embed/7ISlDfVdTdk"
                title="KindleWood Studio Product Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>

        {/* How KindleWood Works */}
        <div className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">
            How KindleWood Works
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
                Turn your child's stories, drawings, and wild ideas into beautiful bilingual storybooks — in just minutes.
              </p>

              <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-grow text-xs sm:text-sm">
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>AI-Powered Story Creation</strong> — Voice, video, text, or photos</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Consistent Characters</strong> — Your child becomes the hero</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Bilingual Support</strong> — English and Chinese</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Voice Narration</strong> — Record your own or use AI</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Export & Print</strong> — Download PDFs ready for printing</span>
                </li>
              </ul>

              <div className="mt-auto pt-4">
                <Link
                  href="/signup"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-center shadow-md hover:shadow-lg transition-all text-sm sm:text-base whitespace-nowrap"
                >
                  Start Creating Stories
                </Link>
              </div>
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
                A native mobile app where children explore their personalized story library. Read, listen, learn, and play — all in one magical space.
              </p>

              <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-grow text-xs sm:text-sm">
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Multiple Child Profiles</strong> — Separate profiles for each child</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Interactive Reading</strong> — Tap words to hear pronunciation</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Audio Narration</strong> — Listen to stories anywhere</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Fun Quizzes</strong> — AI-powered questions that adapt</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>100% Safe</strong> — No ads, no in-app purchases</span>
                </li>
              </ul>

              <div className="mt-auto pt-4">
                <a
                  href="https://apps.apple.com/us/app/kindlewood-kids/id6755075039"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-center transition-colors text-sm sm:text-base whitespace-nowrap"
                >
                  Download the Free Kids App
                </a>
              </div>
            </div>
          </div>

        </div>

      </div>

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

      {/* Testimonials Section - After Pricing */}
      <Testimonials />

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
