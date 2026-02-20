/**
 * Products Page
 * Showcases KindleWood Studio, Kids app, and In-Person Learning Lab
 * Consistent styling with home page
 */

'use client';

import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Navigation */}
      <LandingNav />

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            KindleWood <span className="text-amber-700 underline decoration-amber-700 decoration-2 underline-offset-4">Ecosystem</span>
          </h1>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            A complete creativity-based learning platform where <strong>online tools</strong> (KindleWood Studio & Kids app) and <strong>in-person learning experience</strong> work together to nurture imagination, inspire learning, and celebrate every child's unique creations.
          </p>
        </div>

        {/* Online Tools Section Header */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
            Online Tools
          </h2>
        </div>

        {/* Main Products */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* KindleWood Studio */}
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">KindleWood Studio</h2>
                <p className="text-sm text-gray-600">For Parents & Educators</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              The creative powerhouse where imagination becomes reality. Create personalized storybooks, educational content, and photo-based keepsakes — all with AI-powered tools that make it easy.
            </p>

            <h3 className="font-bold text-gray-900 mb-3">Key Features:</h3>
            <ul className="space-y-3 mb-6 flex-grow">
              <li className="flex items-start gap-3">
                <span className="text-purple-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>AI-Powered Content Creation</strong> — Create stories, educational materials, and photo-based books from voice, video, drawings, or text</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-purple-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Consistent Characters</strong> — Upload a photo once, your child becomes the hero of every story</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-purple-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Bilingual Support</strong> — Stories in both English and Chinese with professional-quality illustrations</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-purple-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Voice Narration</strong> — Use AI generated voice or record Mom's, Dad's, or a teacher's voice to bring stories to life</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-purple-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Publish to Spotify</strong> — Share your stories as audio podcasts on Spotify for listening anywhere</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-purple-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Selective Publishing</strong> — Pick and choose which stories to publish to the KindleWood Kids app</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-purple-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Export & Print</strong> — Download high-quality PDFs ready for printing as keepsake books</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-purple-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Educator Tools</strong> — Create and share educational content with families and classrooms</span>
              </li>
            </ul>

            <div className="flex justify-center">
              <Link
                href="/signup"
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold text-center text-base transition-colors min-w-[200px]"
              >
                Start Creating
              </Link>
            </div>
          </div>

          {/* KindleWood Kids */}
          <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">KindleWood Kids</h2>
                <p className="text-sm text-gray-600">For Children</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              A safe, ad-free reading app where children explore their personalized story library. Read, listen, learn, and play — all in one magical space.
            </p>

            <h3 className="font-bold text-gray-900 mb-3">Key Features:</h3>
            <ul className="space-y-3 mb-6 flex-grow">
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Multiple Child Profiles</strong> — Create separate profiles for each child to track reading and learning independently</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Interactive Reading & Vocabulary Building</strong> — Tap words to hear pronunciation in English or Chinese, and automatically build personalized vocabulary lists</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Audio Narration</strong> — Listen to stories anywhere — perfect for car rides and bedtime</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Fun Quizzes & Learning</strong> — AI-powered questions that adapt to reading level</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Goal Setting & Progress Tracking</strong> — Parents and kids define goals together, earn badges, celebrate milestones</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>100% Safe</strong> — No ads, no in-app purchases, no external links</span>
              </li>
            </ul>

            <div className="flex justify-center">
              <a
                href="https://apps.apple.com/us/app/kindlewood-kids/id6755075039"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-center text-base transition-colors min-w-[200px]"
              >
                Download App from iOS
              </a>
            </div>
          </div>
        </div>

        {/* In-Person Learning Lab Section */}
        <div className="mb-16">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
              In-Person Learning Lab
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Partner School Enrichment */}
            <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 bg-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Partner School Enrichment</h3>
                  <p className="text-sm text-gray-600">Creative classes at your school</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                We bring KindleWood's creative curriculum directly to partner schools. Students experience hands-on storytelling, art projects, and creative technology — all aligned with educational goals.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-600 font-bold">✓</span>
                  Age-appropriate curriculum (PreK-12)
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-600 font-bold">✓</span>
                  Trained instructors & all materials provided
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-600 font-bold">✓</span>
                  Flexible scheduling (after-school, camps, in-class)
                </li>
              </ul>
              <div className="flex justify-center">
                <a
                  href="mailto:admin@kindlewoodstudio.ai?subject=Partner School Enrichment Inquiry"
                  className="inline-block bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-lg font-semibold text-center text-base transition-colors min-w-[200px]"
                >
                  Learn More
                </a>
              </div>
            </div>

            {/* KindleWood Learning Lab */}
            <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">KindleWood Learning Lab</h3>
                  <p className="text-sm text-amber-600 font-medium">Coming Soon</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Our dedicated creative space where children explore imagination through guided workshops, collaborative projects, and hands-on learning experiences.
              </p>
              <h4 className="font-semibold text-gray-900 mb-3">Sample Activities:</h4>
              <ul className="space-y-2 mb-6 text-sm sm:text-base">
                <li className="flex items-center gap-2 text-gray-700 whitespace-nowrap">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  Imagination to Storybook with Show & Tell
                  <span className="text-gray-500">(Ages 3-6)</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700 whitespace-nowrap">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  Bring Story Character into Real World with 3D Modeling
                  <span className="text-gray-500">(Ages 6-7)</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700 whitespace-nowrap">
                  <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                  PBL Engineering: AI Coding, Complex 3D Modeling
                  <span className="text-gray-500">(Ages 7-12+)</span>
                </li>
              </ul>
              <div className="flex justify-center">
                <button
                  disabled
                  className="inline-block bg-gray-300 text-gray-500 px-8 py-3 rounded-lg font-semibold text-center text-base cursor-not-allowed min-w-[200px]"
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Learn Real Skills Through Creation */}
        <div className="mb-16">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
              Learn Real Skills Through Creation
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Read & Write */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Read & Write</h3>
              <p className="text-gray-600">
                Children build literacy skills through creative projects — from storytelling to designing their own content
              </p>
            </div>

            {/* Teamwork & Empathy */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Teamwork & Empathy</h3>
              <p className="text-gray-600">
                Kids practice expressing ideas, listening to others, and collaborating through shared creation
              </p>
            </div>

            {/* Learn from Failure */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Learn from Failure</h3>
              <p className="text-gray-600">
                When something doesn't work as expected, kids build resilience through iteration — whether fixing a story, a 3D model, or code
              </p>
            </div>

            {/* Creative & Confident Thinkers */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Creative & Confident Thinkers</h3>
              <p className="text-gray-600">
                Children become problem-solvers who take ownership of their ideas — from first stories to coding projects
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section - Clean, no background */}
        <div className="text-center py-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
            Ready to Inspire Imagination?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-base transition-colors"
            >
              Start to Create
            </Link>
            <Link
              href="/pricing"
              className="bg-white text-gray-700 px-8 py-3 rounded-lg font-semibold text-base transition-colors border-2 border-gray-300 hover:border-gray-400"
            >
              View Pricing
            </Link>
          </div>
          <p className="text-sm text-gray-600 mt-6">
            No credit card required • Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
