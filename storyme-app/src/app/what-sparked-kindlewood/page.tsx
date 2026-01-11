/**
 * What Sparked KindleWood Page
 * The origin story with video and founder's narrative
 */

import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';

export const metadata = {
  title: 'What Sparked KindleWood | KindleWood Studio',
  description: 'The story behind KindleWood - how a bedtime story sparked a mission to help kids become confident storytellers.',
};

export default function WhatSparkedKindlewoodPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />

      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        {/* Page Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            What Sparked KindleWood
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Every great idea starts with a spark. Here's ours.
          </p>
        </div>

        {/* Video - Centered and Larger */}
        <div className="mb-12">
          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl max-w-3xl mx-auto">
            <iframe
              src="https://www.youtube.com/embed/7ISlDfVdTdk"
              title="KindleWood Studio Product Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </div>

        {/* Story Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10 border border-yellow-100 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-3xl">💡</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">The Moment That Changed Everything</h2>
          </div>

          <div className="text-gray-700 space-y-5 text-base sm:text-lg leading-relaxed">
            <p>
              One evening, my 4-year-old came running to me with eyes sparkling. He had made up a wild story about his friend getting eaten by a dragon — and how his superhero squad saved the day!
            </p>
            <p>
              I could see the joy in his eyes as he described every twist and turn. But I also knew that if I didn't capture this moment somehow, it would fade away like so many childhood memories do.
            </p>
            <p>
              So I decided to try something different. I took his story and turned it into a real book — complete with pictures where he was the hero.
            </p>
            <p className="font-medium text-gray-800 text-lg">
              When I handed him that book, something magical happened. He couldn't stop reading it — because this time, <em>he</em> was the hero. He showed it to everyone. He read it every night for weeks.
            </p>
            <p>
              That's when I realized: every child has stories inside them waiting to come out. They just need the right tools to bring those stories to life.
            </p>
            <p className="font-semibold text-gray-900 text-lg border-l-4 border-yellow-400 pl-4">
              My dream is to help kids become storytellers who develop confidence, empathy, and resilience — the superpowers AI will never have.
            </p>
          </div>

          {/* Link to Founder's Letter */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link
              href="/founder-letter"
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold transition-colors group"
            >
              Read the Full Founder's Letter
              <span className="transform group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-10">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* Simple Footer */}
      <footer className="border-t border-gray-200 bg-white/50 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} KindleWood Studio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
