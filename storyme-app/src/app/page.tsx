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
import { BOOK_TILES } from '@/lib/marketing/bookTiles';
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-x-hidden">
      {/* Error Banner - Wrapped in Suspense */}
      <Suspense fallback={null}>
        <ErrorHandler />
      </Suspense>

      {/* Navigation */}
      <LandingNav />

      {/* Hero Section - Carousel (constrained width) */}
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-2">
        <div className="mb-8 sm:mb-10">
          <HeroCarousel />
        </div>
      </div>

      {/* Why Creativity Matters Section (constrained, gradient bg) */}
      <section className="max-w-6xl mx-auto px-4 py-3 sm:py-5">
        <Reveal>
          <WhyCreativitySection />
        </Reveal>
      </section>

        {/* The Creation Journey Section — TEMPORARILY HIDDEN.
            Replaced visually by the new "What you can make" strip inside Online Tools below.
            Restore by uncommenting if needed. */}
        {/*
        <Reveal>
          <div className="mb-12 sm:mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                The Creation Journey
              </h2>
            </div>

            <div className="mb-12">
              <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4 md:gap-2 mb-8">

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

                <div className="hidden md:flex items-center justify-center px-2">
                  <span className="text-2xl text-gray-400">→</span>
                </div>
                <div className="md:hidden flex items-center justify-center py-2">
                  <span className="text-2xl text-gray-400">↓</span>
                </div>

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

                <div className="hidden md:flex items-center justify-center px-2">
                  <span className="text-2xl text-gray-400">→</span>
                </div>
                <div className="md:hidden flex items-center justify-center py-2">
                  <span className="text-2xl text-gray-400">↓</span>
                </div>

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
        */}

        {/* Online Tools - Creative Loop (full-width band over the gradient) */}
        <section className="bg-white/75 py-7 sm:py-10">
          <Reveal>
            <div className="text-center mb-12 max-w-5xl mx-auto px-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                Online Tools for the Creative Loop
              </h2>
              <p className="text-gray-700 leading-relaxed">
                <strong className="text-gray-900">KindleWood Studio</strong> web application for parents, educators, and young creators
                to turn imagination into tangible books
                <br />
                and <strong className="text-gray-900">KindleWood Kids</strong> mobile apps for an immersive reading and learning experience.
              </p>
              <p className="mt-5 text-sm text-amber-700 italic">
                Here’s what you can create
              </p>
            </div>

            {/* 4 book covers — full page-width spacing, matching products page */}
            <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 px-4">
              {BOOK_TILES.map((tile) => (
                <div
                  key={tile.key}
                  className={`group relative aspect-[210/297] transform ${tile.tilt} hover:rotate-0 hover:-translate-y-1 transition-all duration-300`}
                >
                  <div className="absolute inset-0 rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 via-pink-100 to-amber-100 shadow-md group-hover:shadow-2xl transition-shadow duration-300">
                    {tile.image && (
                      <Image
                        src={tile.image}
                        alt={tile.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    )}
                    {tile.comingSoon && (
                      <span className="absolute bottom-2 left-2 bg-white/90 backdrop-blur text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <span
                    className={`absolute -top-3 -right-6 ${tile.chipColor} text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ring-2 ring-white rotate-6 group-hover:rotate-3 transition-transform tracking-wide z-10`}
                  >
                    {tile.title}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link
                href="/products"
                className="inline-block bg-amber-600 hover:bg-amber-700 text-white px-7 py-3 rounded-lg font-semibold text-sm transition-colors"
              >
                Explore everything in KindleWood Ecosystem →
              </Link>
            </div>
          </Reveal>
        </section>

        {/* Partnership Section (constrained, gradient bg) */}
        <section className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
          <Reveal>
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                Partnering with Schools & Educators
              </h2>
              <p className="text-gray-600 leading-relaxed max-w-3xl mx-auto">
                We partner with schools, educators, and community organizations to bring creativity-driven storytelling and hands-on learning into classrooms, homes, and the KindleWood Learning Lab.
              </p>
              <p className="mt-6">
                <Link
                  href="/workshops"
                  className="inline-block bg-green-600 hover:bg-green-700 text-white px-7 py-3 rounded-lg font-semibold text-sm transition-colors"
                >
                  Explore Workshops &amp; Programs →
                </Link>
              </p>
            </div>

            <PartnerMarquee />
          </Reveal>
        </section>

        {/* Our Stories - Video Showcase (full-width band over the gradient) */}
        {(videosLoading || videos.length > 0) && (
          <section className="bg-white/75 py-7 sm:py-10">
            <Reveal>
              <div className="max-w-6xl mx-auto px-4">
                {videosLoading ? (
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
                ) : (
                  <VideoShowcase
                    videos={videos}
                    title="Our Stories"
                    introText="Learn about the vision, mission, and the story behind KindleWood Studio."
                    layout="video-left"
                    noMargin
                  />
                )}
              </div>
            </Reveal>
          </section>
        )}

        {/* Watch How It Works - Video Showcase (constrained, gradient bg) */}
        {(demoVideosLoading || demoVideos.length > 0) && (
          <section className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
            <Reveal>
              {demoVideosLoading ? (
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
              ) : (
                <VideoShowcase
                  videos={demoVideos}
                  title="Watch How It Works"
                  introText="See how kids and parents create personalized stories, characters, and more."
                  layout="video-right"
                  noMargin
                />
              )}
            </Reveal>
          </section>
        )}

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
