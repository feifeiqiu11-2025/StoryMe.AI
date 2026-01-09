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
        {/* Hero Section - Carousel + Tagline */}
        <div className="mb-16">
          {/* Hero Carousel */}
          <HeroCarousel className="mb-6" />

          {/* Tagline - Larger font like Figma */}
          <div className="text-center">
            <p className="text-xl sm:text-2xl md:text-3xl text-gray-600 leading-relaxed max-w-3xl mx-auto italic">
              A creativity-based learning platform where kids imagine, create, learn, and grow into confident thinkers
            </p>
          </div>
        </div>

        {/* KindleWood Principles - Visual Journey Section */}
        <div className="mb-12 sm:mb-16">
          {/* Section Title */}
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Our Principles
            </h2>
            <p className="text-base sm:text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto">
              At <strong className="text-blue-600">KindleWood</strong>, we believe every child is born creative. Our role is not to teach creativity—but to protect and amplify it.
            </p>
          </div>

          {/* Clean Journey Flow - Inspired by Slides */}
          <div className="mb-12">
            {/* Three Column Grid with Arrows */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2 mb-8">

              {/* Column 1: Spark */}
              <div className="bg-white rounded-xl p-6 shadow-md border border-yellow-200 flex-1 max-w-sm">
                {/* Image */}
                <div className="mb-4 rounded-lg overflow-hidden">
                  <img
                    src="/images/spark-hands.jpg"
                    alt="Hands holding a spark of light"
                    className="w-full h-40 object-cover"
                  />
                </div>

                {/* Icon & Title */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-2xl">✨</span>
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">Spark</h4>
                </div>

                {/* Bullet Points */}
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span>Bold ideas whispered before bedtime</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span>Worlds imagined on the way to school</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span>Questions too curious to ignore</span>
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
                {/* Image */}
                <div className="mb-4 rounded-lg overflow-hidden">
                  <img
                    src="/images/kids-creating.jpg"
                    alt="Children creating and drawing together"
                    className="w-full h-40 object-cover"
                  />
                </div>

                {/* Icon & Title */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-300 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-2xl">🎨</span>
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">Create</h4>
                </div>

                {/* Bullet Points */}
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-pink-600 mt-1">•</span>
                    <span>Dream up stories with their own characters</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-pink-600 mt-1">•</span>
                    <span>Record voices, add drawings, craft books</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-pink-600 mt-1">•</span>
                    <span>Share with friends, become storytellers</span>
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
                {/* Image */}
                <div className="mb-4 rounded-lg overflow-hidden">
                  <img
                    src="/images/kids-reading.jpg"
                    alt="Children reading books together"
                    className="w-full h-40 object-cover"
                  />
                </div>

                {/* Icon & Title */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-300 to-green-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-2xl">🌱</span>
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">Grow</h4>
                </div>

                {/* Bullet Points */}
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Trust their ideas, believe in their voice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Become confident thinkers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Resilient creators ready for anything</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>

        {/* Founder Stories & KindleWood Vision Section */}
        <div className="mb-12 sm:mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              The KindleWood Story
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              See how we're helping families create magical stories together
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Video */}
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-xl">
              <iframe
                src="https://www.youtube.com/embed/7ISlDfVdTdk"
                title="KindleWood Studio Product Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>

            {/* Brief Story + Link to Founder Letter */}
            <div className="bg-gradient-to-br from-white to-yellow-50 rounded-2xl shadow-lg p-6 border border-yellow-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">💡</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900">What Sparked KindleWood</h3>
              </div>

              <div className="text-gray-700 space-y-3 text-sm sm:text-base leading-relaxed">
                <p>
                  One evening, my 4-year-old came running to me with eyes sparkling. He had made up a wild story about his friend getting eaten by a dragon — and how his superhero squad saved the day!
                </p>
                <p>
                  When I printed his story as a real book, he couldn't stop reading — because this time, <em>he</em> was the hero.
                </p>
                <p className="font-medium text-gray-800">
                  My dream is to help kids become storytellers who develop confidence, empathy, and resilience: the superpowers AI will never have.
                </p>
              </div>

              <div className="mt-6">
                <Link
                  href="/founder-letter"
                  className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold transition-colors group"
                >
                  Read the Full Founder's Letter
                  <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Why Kids, Families & Educators Love KindleWood Studio */}
        <div className="mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-6 sm:mb-8">
            Why Kids, Families & Educators Love KindleWood Studio
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
                    Record your own voice — or a teacher's — to narrate each story. Kids light up hearing familiar voices tell their adventures. Because no AI voice can replace the comfort of a parent's "once upon a time."
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
                    Stories sync with the KindleWood Kids app for interactive reading in English and Chinese. Kids tap words to hear pronunciation, take fun quizzes, and get AI-powered explanations.
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

            {/* Card 6: Stories Everywhere They Go */}
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
          </div>
        </div>

        {/* How the KindleWood Ecosystem Works */}
        <div className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">
            How the KindleWood Ecosystem Works
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
                  <span className="text-gray-700"><strong>AI-Powered Story Creation</strong> — Record voice, upload videos, type ideas, or snap photos</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Consistent Characters</strong> — Upload a photo once, your child becomes the hero</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Bilingual Support</strong> — Stories in both English and Chinese</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="text-purple-600 font-bold flex-shrink-0 mt-0.5 sm:mt-1">✓</span>
                  <span className="text-gray-700"><strong>Voice Narration</strong> — Record your own voice or use AI narration</span>
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
                A safe, ad-free reading app where children explore their personalized story library. Read, listen, learn, and play — all in one magical space.
              </p>

              <h4 className="font-bold text-gray-900 mb-3 text-sm sm:text-base">Key Features:</h4>
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

          {/* How They Work Together */}
          <div>
            <div className="text-center mb-6 sm:mb-8">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                How They Work Together
              </h3>
            </div>

            <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md border border-gray-200">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xl sm:text-2xl mb-4 mx-auto text-white font-bold">
                  1
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-center">Create in Studio</h3>
                <p className="text-xs sm:text-sm text-gray-600 text-center">
                  Parents and educators use KindleWood Studio to create personalized, bilingual stories in minutes
                </p>
              </div>

              <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md border border-gray-200">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-xl sm:text-2xl mb-4 mx-auto text-white font-bold">
                  2
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-center">Publish to Kids</h3>
                <p className="text-xs sm:text-sm text-gray-600 text-center">
                  Stories instantly sync to the KindleWood Kids app, ready for children to explore and enjoy
                </p>
              </div>

              <div className="bg-white rounded-xl p-5 sm:p-6 shadow-md border border-gray-200">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-xl sm:text-2xl mb-4 mx-auto text-white font-bold">
                  3
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-center">Learn Everywhere</h3>
                <p className="text-xs sm:text-sm text-gray-600 text-center">
                  Children read, listen, and learn at home, in the car, or at school — their stories follow them everywhere
                </p>
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
