/**
 * Landing page / Home page
 * Figma-inspired design with hero carousel
 * Updated with KindleWood branding and ecosystem messaging
 */

'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Testimonials from '@/components/landing/Testimonials';
import ErrorHandler from '@/components/ErrorHandler';
import LandingNav from '@/components/navigation/LandingNav';
import HeroCarousel from '@/components/landing/HeroCarousel';
import WhyCreativitySection from '@/components/landing/WhyCreativitySection';
import VideoShowcase from '@/components/landing/VideoShowcase';
import Reveal from '@/components/ui/Reveal';
import PartnerMarquee from '@/components/landing/PartnerMarquee';
import type { YouTubeVideo } from '@/app/api/v1/youtube/playlist/route';

const LANDING_PLAYLIST_ID = 'PLyDpAVbXE4SUAEuc2SnXwhsbUMg9j3dy9';
const DEMO_PLAYLIST_ID = 'PLyDpAVbXE4SWPWFFiQUdo8FyMAhi90fA5';
const TESTIMONIAL_PLAYLIST_ID = 'PLyDpAVbXE4SWavZNKd0RNlhDuEJqpBkY0';

export default function HomePage() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [demoVideos, setDemoVideos] = useState<YouTubeVideo[]>([]);
  const [demoVideosLoading, setDemoVideosLoading] = useState(true);
  const [testimonialVideos, setTestimonialVideos] = useState<YouTubeVideo[]>([]);

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

    async function fetchDemoVideos() {
      try {
        const response = await fetch(`/api/v1/youtube/playlist?playlistId=${DEMO_PLAYLIST_ID}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.videos) {
            setDemoVideos(data.videos);
          }
        }
      } catch (error) {
        console.error('Error fetching demo playlist videos:', error);
      } finally {
        setDemoVideosLoading(false);
      }
    }

    async function fetchTestimonialVideos() {
      try {
        const response = await fetch(`/api/v1/youtube/playlist?playlistId=${TESTIMONIAL_PLAYLIST_ID}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.videos) {
            setTestimonialVideos(data.videos);
          }
        }
      } catch (error) {
        console.error('Error fetching testimonial playlist videos:', error);
      }
    }

    fetchVideos();
    fetchDemoVideos();
    fetchTestimonialVideos();
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
        <Reveal>
          <WhyCreativitySection />
        </Reveal>

        {/* The Creation Journey Section */}
        <Reveal>
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
              <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4 md:gap-2 mb-8">

                {/* Column 1: Spark */}
                <Reveal delay={0}>
                  <div className="bg-white rounded-xl p-6 shadow-md border border-yellow-200 flex-1 max-w-sm h-full">
                    <h4 className="text-xl font-bold text-gray-900 text-center mb-4">Spark</h4>
                    <div className="mb-4 rounded-lg overflow-hidden">
                      <img
                        src="/images/crayon-drawing.jpg"
                        alt="Child's crayon drawing of a dragon and house"
                        className="w-full h-52 object-cover"
                      />
                    </div>
                    <p className="text-gray-700 leading-relaxed text-center">
                      A curious question, a wild idea, a drawing on a napkin — any kind of imagination.
                    </p>
                  </div>
                </Reveal>

                {/* Arrow 1 */}
                <div className="hidden md:flex items-center justify-center px-2">
                  <span className="text-2xl text-gray-400">→</span>
                </div>
                <div className="md:hidden flex items-center justify-center py-2">
                  <span className="text-2xl text-gray-400">↓</span>
                </div>

                {/* Column 2: Create */}
                <Reveal delay={150}>
                  <div className="bg-white rounded-xl p-6 shadow-md border border-pink-200 flex-1 max-w-sm h-full">
                    <h4 className="text-xl font-bold text-gray-900 text-center mb-4">Create</h4>
                    <div className="mb-4 rounded-lg overflow-hidden">
                      <img
                        src="/images/ipad-storytelling.jpg"
                        alt="iPad app turning drawing into interactive story"
                        className="w-full h-52 object-cover object-center"
                      />
                    </div>
                    <p className="text-gray-700 leading-relaxed text-center">
                      Turn sparks into personalized storybooks, art projects and 3D models.
                    </p>
                  </div>
                </Reveal>

                {/* Arrow 2 */}
                <div className="hidden md:flex items-center justify-center px-2">
                  <span className="text-2xl text-gray-400">→</span>
                </div>
                <div className="md:hidden flex items-center justify-center py-2">
                  <span className="text-2xl text-gray-400">↓</span>
                </div>

                {/* Column 3: Grow */}
                <Reveal delay={300}>
                  <div className="bg-white rounded-xl p-6 shadow-md border border-green-200 flex-1 max-w-sm h-full">
                    <h4 className="text-xl font-bold text-gray-900 text-center mb-4">Grow</h4>
                    <div className="mb-4 rounded-lg overflow-hidden">
                      <img
                        src="/images/handmade-storybooks.jpg"
                        alt="Stack of handmade storybooks with child's hand"
                        className="w-full h-52 object-cover"
                      />
                    </div>
                    <p className="text-gray-700 leading-relaxed text-center">
                      Build literacy, confidence, resilience, and empathy — one story at a time.
                    </p>
                  </div>
                </Reveal>

              </div>
            </div>
          </div>
        </Reveal>

        {/* Online Tools - Reader to Creator Loop */}
        <Reveal>
          <div className="mb-12 sm:mb-16">
            <div className="text-center mb-14 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Online Tools for the Creative Loop
              </h2>
            </div>

            {/* Two cards with loop arrow between */}
            <div className="max-w-6xl mx-auto grid md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-center">

              {/* KindleWood Studio Card */}
              <Reveal delay={0}>
                <div className="relative bg-white rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all pt-20 sm:pt-24 px-6 pb-6 sm:px-8 sm:pb-8">
                  {/* Creator dragon popping out top-left */}
                  <div className="absolute -top-12 -left-2 sm:-top-24 sm:-left-6 w-28 h-28 sm:w-48 sm:h-48 pointer-events-none">
                    <Image
                      src="/images/dragon-creator.png"
                      alt="Dragon writing with quill"
                      fill
                      className="object-contain drop-shadow-lg"
                    />
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <h4 className="text-xl font-bold text-gray-900">KindleWood Studio</h4>
                      <span className="inline-block bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Web
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed mt-3">
                      Where imagination becomes digital storybooks — for parents, educators, and young creators.
                    </p>
                    <p className="mt-4 text-sm text-amber-700 italic">
                      We empower confident creators and writers.
                    </p>
                    <p className="mt-4">
                      <Link href="/signup" className="text-purple-600 hover:text-purple-700 font-medium transition-colors">
                        Start to Create →
                      </Link>
                    </p>
                  </div>
                </div>
              </Reveal>

              {/* Loop Arrow - Two long arrows showing bidirectional flow */}
              <div className="flex md:flex-col items-center justify-center gap-2 py-2 md:py-0 md:px-2">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Share</span>
                <div className="flex md:flex-col gap-2 md:gap-2 items-center">
                  {/* Right-pointing arrow (long shaft) */}
                  <svg
                    viewBox="0 0 90 18"
                    className="w-20 h-4 md:w-24 md:h-5 text-amber-600 rotate-90 md:rotate-0"
                    aria-hidden="true"
                  >
                    <line x1="4" y1="9" x2="72" y2="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <polygon points="86,9 72,2 72,16" fill="currentColor" />
                  </svg>
                  {/* Left-pointing arrow (long shaft) */}
                  <svg
                    viewBox="0 0 90 18"
                    className="w-20 h-4 md:w-24 md:h-5 text-amber-600 rotate-90 md:rotate-0"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="9" x2="86" y2="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <polygon points="4,9 18,2 18,16" fill="currentColor" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Inspire</span>
              </div>

              {/* KindleWood Kids Card */}
              <Reveal delay={150}>
                <div className="relative bg-white rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all pt-20 sm:pt-24 px-6 pb-6 sm:px-8 sm:pb-8">
                  {/* Reader dragon popping out top-right (flipped to face left) */}
                  <div className="absolute -top-12 -right-2 sm:-top-24 sm:-right-6 w-28 h-28 sm:w-48 sm:h-48 pointer-events-none scale-x-[-1]">
                    <Image
                      src="/images/dragon-reader.png"
                      alt="Dragon reading a book"
                      fill
                      className="object-contain drop-shadow-lg"
                    />
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <h4 className="text-xl font-bold text-gray-900">KindleWood Kids</h4>
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Mobile
                      </span>
                      <span className="inline-block bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Ages 3–12
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed mt-3">
                      Where kids read their stories and discover new ones from friends.
                    </p>
                    <p className="mt-4 text-sm text-amber-700 italic">
                      We inspire a love of reading.
                    </p>
                    <p className="mt-4 text-gray-700">
                      Download:{' '}
                      <a
                        href="https://apps.apple.com/us/app/kindlewood-kids/id6755075039"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                      >
                        App Store →
                      </a>
                      <span className="mx-2 text-gray-400">·</span>
                      <a
                        href="https://play.google.com/store/apps/details?id=com.kindlewood.kindlewood_kids"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                      >
                        Google Play →
                      </a>
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>

          </div>
        </Reveal>

        {/* Partnership Section */}
        <Reveal>
          <div className="mb-12 sm:mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                Partnering with Schools & Educators
              </h2>
              <p className="text-gray-600 leading-relaxed max-w-3xl mx-auto">
                We partner with schools, educators, and community organizations to bring creativity-driven storytelling and hands-on learning into classrooms, homes, and the KindleWood Learning Lab.
              </p>
              <p className="mt-3">
                <Link
                  href="/workshops"
                  className="text-green-600 hover:text-green-700 font-medium transition-colors"
                >
                  Explore Workshops &amp; Programs →
                </Link>
              </p>
            </div>

            <PartnerMarquee />
          </div>
        </Reveal>

        {/* Our Stories - Video Showcase (video left, text right) */}
        <Reveal>
          {videosLoading ? (
            <div className="mb-12 sm:mb-16">
              <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
                <div className="w-full md:w-[55%]">
                  <div className="aspect-video bg-gray-200 rounded-xl animate-pulse" />
                </div>
                <div className="w-full md:w-[45%] space-y-4">
                  <div className="h-8 bg-gray-200 rounded animate-pulse w-1/2" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                </div>
              </div>
            </div>
          ) : videos.length > 0 ? (
            <VideoShowcase
              videos={videos}
              title="Our Stories"
              introText="Learn about the vision, mission, and the story behind KindleWood Studio."
              layout="video-left"
            />
          ) : null}
        </Reveal>

        {/* Watch How It Works - Video Showcase (text left, video right) */}
        <Reveal>
          {demoVideosLoading ? (
            <div className="mb-12 sm:mb-16">
              <div className="flex flex-col md:flex-row-reverse gap-8 md:gap-12 items-center">
                <div className="w-full md:w-[55%]">
                  <div className="aspect-video bg-gray-200 rounded-xl animate-pulse" />
                </div>
                <div className="w-full md:w-[45%] space-y-4">
                  <div className="h-8 bg-gray-200 rounded animate-pulse w-1/2" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                </div>
              </div>
            </div>
          ) : demoVideos.length > 0 ? (
            <VideoShowcase
              videos={demoVideos}
              title="Watch How It Works"
              introText="See how kids and parents create personalized stories, characters, and more."
              layout="video-right"
            />
          ) : null}
        </Reveal>

      </div>

      {/* Testimonials Section */}
      <Reveal>
        <Testimonials videoTestimonials={testimonialVideos} />
      </Reveal>

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
