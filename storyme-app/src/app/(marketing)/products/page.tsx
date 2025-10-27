/**
 * Products Page
 * Showcases all KindleWood Studio and Kids features and value propositions
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
            📚 Kindle<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600">Wood</span> Ecosystem
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600 rounded-full mx-auto mb-6"></div>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            A complete creative ecosystem designed to nurture imagination, inspire learning, and celebrate every child's unique story.
          </p>
        </div>

        {/* Main Products */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* KindleWood Studio */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-purple-200 hover:shadow-2xl transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-3xl">🎨</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">KindleWood Studio</h2>
                <p className="text-sm text-gray-600">For Parents & Educators</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              The creative powerhouse where imagination becomes reality. Turn your child's stories, drawings, and wild ideas into beautiful bilingual storybooks — in just minutes.
            </p>

            <h3 className="font-bold text-gray-900 mb-3">Key Features:</h3>
            <ul className="space-y-3 mb-6 flex-grow">
              <li className="flex items-start gap-3">
                <span className="text-purple-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>AI-Powered Story Creation</strong> — Record voice, upload videos, type ideas, or snap photos of drawings</span>
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
                <span className="text-gray-700"><strong>Voice Narration</strong> — Use AI generated voice or record Mom's, Dad's, or a teacher's voice to bring stories to life. Kids feel connected when they hear familiar voices — building emotional bonds and bilingual learning confidence</span>
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
                <span className="text-gray-700"><strong>Performance Dashboard</strong> — Track kids' reading and learning performance <span className="text-xs text-purple-600 font-semibold">(Coming Soon)</span></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-purple-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Educator Tools</strong> — Create and share educational content with families and classrooms</span>
              </li>
            </ul>

            <Link
              href="/signup"
              className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 font-semibold text-center shadow-md hover:shadow-lg transition-all"
            >
              Start Creating Stories
            </Link>
          </div>

          {/* KindleWood Kids */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-blue-200 hover:shadow-2xl transition-all relative flex flex-col">
            <span className="absolute top-6 right-6 text-xs font-semibold px-3 py-1 bg-green-100 text-green-700 rounded-full">
              Coming Soon
            </span>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-3xl">📱</span>
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
                <span className="text-gray-700"><strong>Interactive Reading & Vocabulary Building</strong> — Tap words to hear pronunciation in English or Chinese, and automatically build personalized vocabulary lists for unfamiliar words</span>
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
                <span className="text-gray-700"><strong>Goal Setting & Progress Tracking</strong> — Parents and kids define goals together, earn badges, celebrate milestones, and track reading progress</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>Role-Play Interactive Learning</strong> — Immersive, interactive learning experiences <span className="text-xs text-blue-600 font-semibold">(Coming Soon)</span></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold flex-shrink-0 mt-1">✓</span>
                <span className="text-gray-700"><strong>100% Safe</strong> — No ads, no in-app purchases, no external links</span>
              </li>
            </ul>

            <div className="block w-full bg-gray-100 text-gray-500 px-6 py-3 rounded-lg font-semibold text-center border border-gray-300">
              Coming Soon - FREE for All Users
            </div>
          </div>
        </div>

        {/* How They Work Together */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-xl p-8 mb-16 border border-amber-200">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              🌟 How They Work Together
            </h2>
            <p className="text-lg text-gray-700">
              A seamless creative ecosystem from imagination to learning
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl mb-4 mx-auto">
                1
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-center">Create in Studio</h3>
              <p className="text-sm text-gray-600 text-center">
                Parents and educators use KindleWood Studio to create personalized, bilingual stories in minutes
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-2xl mb-4 mx-auto">
                2
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-center">Publish to Kids</h3>
              <p className="text-sm text-gray-600 text-center">
                Stories instantly sync to the KindleWood Kids app, ready for children to explore and enjoy
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-2xl mb-4 mx-auto">
                3
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-center">Learn Everywhere</h3>
              <p className="text-sm text-gray-600 text-center">
                Children read, listen, and learn at home, in the car, or at school — their stories follow them everywhere
              </p>
            </div>
          </div>
        </div>

        {/* Additional Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">
            ✨ Why Families Love KindleWood
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center text-2xl mb-4">
                📖
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Your Child Is the Story</h3>
              <p className="text-sm text-gray-600">
                See themselves as the hero in every adventure. AI keeps their look consistent across every page and every book.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center text-2xl mb-4">
                ⚡
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Create in Minutes</h3>
              <p className="text-sm text-gray-600">
                From rough idea to beautiful bilingual storybook in just 5 minutes. No design skills needed.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center text-2xl mb-4">
                🌍
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Bilingual Learning</h3>
              <p className="text-sm text-gray-600">
                Every story available in English and Chinese with professional narration and interactive learning.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl flex items-center justify-center text-2xl mb-4">
                👨‍👩‍👧‍👦
              </div>
              <h3 className="font-bold text-gray-900 mb-2">For Families & Educators</h3>
              <p className="text-sm text-gray-600">
                Parents create family stories. Teachers share educational content. All connected to enrich learning.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center text-2xl mb-4">
                🔒
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Safe & Ad-Free</h3>
              <p className="text-sm text-gray-600">
                No ads, no external links, no in-app purchases. Children only see stories you or their teacher publish.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-2xl mb-4">
                🎯
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Track & Celebrate</h3>
              <p className="text-sm text-gray-600">
                Set reading goals, earn badges, celebrate milestones. Turn motivation into meaningful growth.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-xl p-8 sm:p-12 text-center border border-indigo-200">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Ready to Inspire Imagination?
          </h2>
          <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
            Join families and educators who are nurturing creativity, building confidence, and celebrating every child's unique story.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              🎁 Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="bg-white text-gray-700 px-8 py-4 rounded-lg hover:bg-gray-50 font-semibold text-lg shadow-lg hover:shadow-xl transition-all border-2 border-gray-300 transform hover:-translate-y-1"
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
