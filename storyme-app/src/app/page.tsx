/**
 * Landing page / Home page
 * Figma-inspired design with hero carousel
 * Updated with KindleWood branding and ecosystem messaging
 */

'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Testimonials from '@/components/landing/Testimonials';
import ErrorHandler from '@/components/ErrorHandler';
import LandingNav from '@/components/navigation/LandingNav';
import HeroCarousel from '@/components/landing/HeroCarousel';
import WhyCreativitySection from '@/components/landing/WhyCreativitySection';
import VideoCarousel from '@/components/landing/VideoCarousel';
import type { YouTubeVideo } from '@/app/api/v1/youtube/playlist/route';

const LANDING_PLAYLIST_ID = 'PLyDpAVbXE4SUAEuc2SnXwhsbUMg9j3dy9';

export default function HomePage() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);

  useEffect(() => {
    async function fetchVideos() {
      try {
        const response = await fetch(`/api/v1/youtube/playlist?playlistId=${LANDING_PLAYLIST_ID}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.videos) {
            setVideos(data.videos);
          }
        }
      } catch (error) {
        console.error('Error fetching playlist videos:', error);
      } finally {
        setVideosLoading(false);
      }
    }
    fetchVideos();
  }, []);

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

        {/* Why Creativity Matters Section */}
        <WhyCreativitySection />

        {/* The Creation Journey Section */}
        <div className="mb-12 sm:mb-16">
          {/* Section Title */}
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              The Creation Journey
            </h2>
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
                    src="/images/crayon-drawing.jpg"
                    alt="Child's crayon drawing of a dragon and house"
                    className="w-full h-52 object-cover"
                  />
                </div>

                {/* Simplified Copy */}
                <p className="text-gray-700 leading-relaxed text-center">
                  A wild idea whispered at bedtime, a curious question, a drawing on a napkin.
                </p>
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

                {/* Image - iPad storytelling app */}
                <div className="mb-4 rounded-lg overflow-hidden">
                  <img
                    src="/images/ipad-storytelling.jpg"
                    alt="iPad app turning drawing into interactive story"
                    className="w-full h-52 object-cover object-center"
                  />
                </div>

                {/* Simplified Copy */}
                <p className="text-gray-700 leading-relaxed text-center">
                  Turn sparks into real creations—personalized storybooks, art projects, and 3D models that kids proudly share.
                </p>
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

                {/* Image - handmade storybooks */}
                <div className="mb-4 rounded-lg overflow-hidden">
                  <img
                    src="/images/handmade-storybooks.jpg"
                    alt="Stack of handmade storybooks with child's hand"
                    className="w-full h-52 object-cover"
                  />
                </div>

                {/* Simplified Copy */}
                <p className="text-gray-700 leading-relaxed text-center">
                  Through creating, children become confident, resilient, and empathetic thinkers.
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* How We Do It - With Background Image */}
        <div className="mb-12 sm:mb-16">
          <div className="text-center mb-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              How We Do It
            </h2>
          </div>

          {/* Container with hands background image */}
          <div
            className="relative max-w-5xl mx-auto bg-no-repeat bg-center bg-contain"
            style={{ backgroundImage: 'url(/images/HowWeDoBackground.png)' }}
          >
            <div className="relative grid md:grid-cols-2 gap-4 md:gap-8">
              {/* Left: Online Tools */}
              <div className="p-6 sm:p-10 flex flex-col items-center text-center">
                <h3 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">
                  Online Tools
                </h3>

                <div className="space-y-5 mt-2">
                  {/* KindleWood Studio */}
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">
                      KindleWood Studio <span className="text-sm font-normal text-gray-500">For Parents & Educators</span>
                    </h4>
                    <p className="text-gray-700 leading-relaxed mt-2">
                      The creator platform that turns imagination—wild ideas, drawings, and photos—into digital storybooks and creative projects.{' '}
                      <Link href="/signup" className="text-purple-600 hover:text-purple-700 font-medium transition-colors">
                        Visit Studio →
                      </Link>
                    </p>
                  </div>

                  {/* KindleWood Kids */}
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">
                      KindleWood Kids <span className="text-sm font-normal text-gray-500">For Children</span>
                    </h4>
                    <p className="text-gray-700 leading-relaxed mt-2">
                      A fun, engaging reading and learning app where kids enjoy their own stories and track their creative progress.{' '}
                      <a
                        href="https://apps.apple.com/us/app/kindlewood-kids/id6755075039"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                      >
                        Download App →
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Learning Lab */}
              <div className="p-6 sm:p-10 flex flex-col items-center text-center">
                <h3 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">
                  In-Person Learning Lab <span className="text-sm font-medium text-amber-600 normal-case">(Coming Soon)</span>
                </h3>
                <p className="text-gray-700 leading-relaxed mt-2">
                  In-person creative workshops at <span className="font-bold text-gray-900">partner schools</span> and <span className="font-bold text-gray-900">KindleWood Learning Lab</span>.
                </p>
                <p className="text-gray-700 mt-4 mb-2">Sample activities:</p>
                <ul className="space-y-2 text-gray-700 text-sm sm:text-base">
                  <li className="whitespace-nowrap">• Imagination to storybook with show & tell <span className="text-gray-500">(Ages 3-6)</span></li>
                  <li className="whitespace-nowrap">• Bring story character into real world with 3D Modeling <span className="text-gray-500">(Ages 6-7)</span></li>
                  <li className="whitespace-nowrap">• PBL Engineering: AI coding, complex 3D modeling <span className="text-gray-500">(Ages 7-12+)</span></li>
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
              We partner with schools, educators, and community organizations to bring creativity-driven storytelling and learning into classrooms and homes.
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

        {/* Our Stories - Video Carousel */}
        <div className="mb-12 sm:mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Our Stories
            </h2>
          </div>
          {videosLoading ? (
            <div className="flex gap-6 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-[300px] sm:w-[380px] flex-shrink-0">
                  <div className="aspect-video bg-gray-200 rounded-xl animate-pulse" />
                  <div className="mt-3 h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <VideoCarousel videos={videos} />
          )}
        </div>

      </div>

      {/* Testimonials Section */}
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
