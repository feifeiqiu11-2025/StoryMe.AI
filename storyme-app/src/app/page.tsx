/**
 * Landing page / Home page
 * Modern, appealing design with emojis
 */

'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HeroStoryShowcase from '@/components/landing/HeroStoryShowcase';

export default function HomePage() {
  const router = useRouter();

  // Show landing page (removed auth redirect - dashboard handles auth now)
  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header with Sign In button */}
      <header className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity cursor-pointer text-gray-900">
            📚 Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600">Me</span> ✨
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

      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero Section - Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-16">
          {/* Left Column - Content (50%) */}
          <div className="space-y-6">
            {/* Brand Logo/Title */}
            <div className="mb-8">
              <h1 className="text-5xl sm:text-6xl font-bold mb-2 text-gray-900">
                📚 Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600">Me</span> ✨
              </h1>
              <div className="h-1 w-24 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600 rounded-full"></div>
            </div>

            {/* Tagline */}
            <div className="space-y-3">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 leading-tight">
                Where Your Child&apos;s Stories Come to Life
              </h2>
            </div>

            {/* Mission Statement */}
            <div className="bg-gradient-to-r from-yellow-50 to-pink-50 border-2 border-yellow-200 rounded-xl p-5 shadow-md">
              <p className="text-sm font-semibold text-gray-500 mb-2">💫 Our Mission:</p>
              <p className="text-base text-gray-800 leading-relaxed">
                To turn your child's imagination into personalized storybooks that inspire a love for reading — and create memories you'll cherish forever.
              </p>
            </div>

            {/* CTA Buttons - Side by Side */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Guest mode - commented out for future use */}
              {/* <Link
                href="/guest"
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3.5 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold text-base text-center shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-0.5"
              >
                🚀 Try It Free – No Sign-Up Needed
              </Link> */}
              <Link
                href="/signup"
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3.5 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold text-base text-center shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-0.5"
              >
                🎁 Sign up for free 7 days trial
              </Link>
              <Link
                href="/login"
                className="flex-1 bg-white text-gray-800 px-6 py-3.5 rounded-xl hover:bg-gray-50 font-semibold text-base text-center shadow-lg hover:shadow-xl transition-all border-2 border-gray-200 transform hover:-translate-y-0.5"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Right Column - Hero Visual (50%) - Shows real saved stories */}
          <HeroStoryShowcase />
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
                What Sparked StoryMe 🌟
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
                  That moment, StoryMe was born — to help parents capture their child's imagination and turn it into personalized storybooks that inspire a love for reading and create memories to cherish forever.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Why Parents Love StoryMe */}
        <div className="mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-8 sm:mb-12">
            🎯 Why Parents Love StoryMe
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {/* Benefit 1 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-pink-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">📖</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    A Storybook About Your Child
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Every StoryMe book begins with your child's imagination — their adventures, dreams, and silly what-ifs. Each story becomes a reflection of who they are and what they love, turning fleeting moments into keepsakes you'll treasure forever.
                  </p>
                </div>
              </div>
            </div>

            {/* Benefit 2 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-blue-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🎓</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Made to Make Reading Fun
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Kids are most motivated to read when the story feels like their own. StoryMe adapts every story to your child's age and reading level — blending playful language, familiar words, and their creativity to make reading engaging, personal, and joyful.
                  </p>
                </div>
              </div>
            </div>

            {/* Benefit 3 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-green-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">👦👧</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Consistent Characters, Endless Adventures
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Upload a photo once, and StoryMe remembers your child and family characters — keeping them consistent across every page and every story. As your collection grows, your little hero grows right along with it.
                  </p>
                </div>
              </div>
            </div>

            {/* Benefit 4 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-purple-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🎨</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Create in Any Way They Imagine
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Record their voice telling a story, upload a quick video, snap a photo of a crayon sketch, or type a few lines of a rough script — StoryMe brings it all to life. Our AI turns every idea, drawing, and doodle into a polished, illustrated storybook.
                  </p>
                </div>
              </div>
            </div>

            {/* Benefit 5 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-orange-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">⚡</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Fast, Magical, and Print-Ready
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    From imagination to illustrated book in minutes — with beautiful, high-resolution PDFs ready to print or turn into hardcover keepsakes for family and friends.
                  </p>
                </div>
              </div>
            </div>

            {/* Benefit 6 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-indigo-100">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">✨</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">
                    Coming Soon: Co-Author Mode
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Imagine your child as a sidekick in their favorite Dog Man or Frozen adventure — reading along as both fan and co-author. StoryMe is building new ways to blend your child into beloved story worlds while keeping the magic personal, safe, and educational.
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
            Creating a StoryMe book is simple, fun, and magical — for both you and your child.
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
                  Upload a photo or describe your child and family members. StoryMe keeps their look consistent across every page and every book.
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
                  StoryMe brings each story to life with beautiful, age-appropriate illustrations that capture your child's world and emotions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg flex items-center gap-2">
                  Read, Print & Treasure <span className="text-xl">📖</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Download your finished storybook as a high-quality PDF — perfect for bedtime reading, printing as a keepsake, or gifting to grandparents.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                5
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg flex items-center gap-2">
                  Share and Grow Together <span className="text-xl">💬</span>
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Share your child's story with family and friends, or with the StoryMe community (coming soon). Tell us how we're doing — your feedback helps us make the experience even more magical for every family.
                </p>
              </div>
            </div>
          </div>
          <p className="text-center text-gray-700 mt-8 text-base sm:text-lg">
            💫 <em>From imagination to a beautifully illustrated storybook — in just minutes.</em>
          </p>
        </div>

        {/* Social Proof / Stats */}
        <div className="mb-12 sm:mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 text-center transform hover:-translate-y-1 transition-all">
              <div className="text-4xl mb-2">🎨</div>
              <div className="text-3xl font-bold text-purple-600 mb-1">AI-Powered</div>
              <div className="text-gray-600">Professional Illustrations</div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6 text-center transform hover:-translate-y-1 transition-all">
              <div className="text-4xl mb-2">⚡</div>
              <div className="text-3xl font-bold text-blue-600 mb-1">5 Minutes</div>
              <div className="text-gray-600">From Story to Book</div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6 text-center transform hover:-translate-y-1 transition-all">
              <div className="text-4xl mb-2">💝</div>
              <div className="text-3xl font-bold text-pink-600 mb-1">Forever</div>
              <div className="text-gray-600">Cherished Keepsakes</div>
            </div>
          </div>
        </div>


        {/* Final CTA */}
        <div className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl shadow-2xl p-8 sm:p-12 text-white">
          <div className="mb-4">
            <span className="text-5xl">✨📖✨</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Every child has a story worth telling — and reading.
          </h2>
          <p className="text-lg sm:text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Let StoryMe help you capture their imagination, nurture their love for reading, and create memories you'll cherish for a lifetime.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            {/* Guest mode - commented out for future use */}
            {/* <Link
              href="/guest"
              className="bg-white text-purple-600 px-8 py-4 rounded-xl hover:bg-gray-50 font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5"
            >
              🚀 Try It Free – No Sign-Up Needed
            </Link> */}
            <Link
              href="/signup"
              className="bg-white text-purple-600 px-8 py-4 rounded-xl hover:bg-gray-50 font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5"
            >
              🎁 Sign up for free 7 days trial
            </Link>
            <Link
              href="/login"
              className="bg-purple-800 text-white px-8 py-4 rounded-xl hover:bg-purple-900 font-bold text-lg shadow-xl hover:shadow-2xl transition-all border-2 border-white/20 transform hover:-translate-y-0.5"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 text-sm">
          <p className="flex items-center justify-center gap-2">
            Made with <span className="text-red-500 animate-pulse">❤️</span> for parents and their little storytellers
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
