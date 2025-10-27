/**
 * Founder's Journal
 * Placeholder page for founder's ongoing thoughts and updates
 */

'use client';

import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';

export default function FounderJournalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Navigation */}
      <LandingNav />

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            📝 Founder's Journal
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Welcome to my Founder's Journal — a space where I share stories, reflections, and little moments that inspire the journey behind KindleWood Studio.
            Every feature we build starts from something real — a bedtime story, a child's question, or a laugh shared around the table. These notes are my way of keeping those sparks alive.
          </p>
        </div>

        {/* Journal Entry */}
        <article className="bg-white rounded-2xl shadow-xl p-8 sm:p-12 border border-purple-200 mb-8">
          {/* Entry Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-2xl shadow-lg">
                ✨
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  The Power of a Mom's Voice
                </h2>
                <p className="text-sm text-gray-500 mt-1">October 2025 — by Feifei Qiu, Founder of KindleWood Studio</p>
              </div>
            </div>
            <div className="h-1 w-full bg-gradient-to-r from-purple-200 to-pink-200 rounded-full"></div>
          </div>

          {/* Entry Content */}
          <div className="space-y-5 text-gray-700 leading-relaxed text-base sm:text-lg">
            <p>
              Today, while working on Chinese storybooks creation flow, I wanted the narration to sound truly authentic. I started by trying OpenAI's TTS voice — it was fluent, but something felt off. The tone, rhythm — it didn't sound right.
            </p>

            <p>
              I looked into other options, like Azure's Chinese TTS, which can sound smoother. But before testing more AI models, I thought — <em className="font-medium">why not just record it myself?</em>
            </p>

            <p>
              So I did. Recorded myself for the story my kids and I created together.
            </p>

            <p>
              Later, when I played the story back, my boys listened carefully and said:
            </p>

            <blockquote className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 p-6 rounded-lg my-6 italic">
              <p className="text-lg sm:text-xl font-medium text-gray-900">
                "Mama, I like your voice better than the other one (AI voice over)."
              </p>
            </blockquote>

            <p>
              That one sentence made my day. It reminded me that while AI can do incredible things — generate stories, draw beautiful pictures, translate languages — there are some parts of storytelling that only a human heart can give.
            </p>

            <p className="font-medium text-gray-900">
              Because no AI voice can replace the comfort of a parent's "once upon a time."
            </p>

            <p>
              I was thinking to train AI to clone human voices, but now this made me pause and wonder: <strong>Do we need a AI cloned human voice at all?</strong>
            </p>

            <p>
              Maybe the slight imperfections, the uneven breaths, the laughter tucked into a word — those are what make a story <strong>ALIVE</strong>.
            </p>

            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border-l-4 border-amber-500 my-8">
              <p className="text-gray-800 leading-relaxed">
                At KindleWood Studio, we're building tools to help parents and teachers create stories effortlessly. But what I never want to lose is the human connection — the sound of <em className="font-medium">you</em> telling your child's story.
              </p>
            </div>

            <div className="text-center my-8 space-y-2">
              <p className="text-lg font-semibold text-gray-900">
                AI can help us craft the story.
              </p>
              <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                But it's our voices that make it unforgettable.
              </p>
            </div>
          </div>

          {/* Author Signature */}
          <div className="mt-10 pt-6 border-t-2 border-purple-200">
            <p
              className="text-4xl sm:text-5xl text-blue-900"
              style={{ fontFamily: "var(--font-signature)" }}
            >
              Feifei Qiu
            </p>
            <p className="text-sm text-gray-600 mt-2">Founder & Mom, KindleWood Studio</p>
          </div>
        </article>

        {/* More Entries Coming Soon Notice */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg p-6 border border-indigo-200 mb-8 text-center">
          <p className="text-gray-700 font-medium">
            More journal entries coming soon. Follow our journey as we build KindleWood together.
          </p>
        </div>

        {/* Newsletter Signup (Placeholder) */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-xl p-8 border border-indigo-200 mb-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Get Notified When We Publish
            </h3>
            <p className="text-gray-600 mb-6">
              Want to be the first to read new journal entries? We'll let you know when new content is available.
            </p>
            <div className="max-w-md mx-auto">
              <p className="text-sm text-gray-500 italic">
                Newsletter signup coming soon. In the meantime, follow our journey by signing up for KindleWood Studio!
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-xl p-8 text-center border border-purple-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Join Us on This Journey
          </h2>
          <p className="text-gray-700 mb-6 max-w-xl mx-auto">
            While the journal is being prepared, start creating stories with your family today!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              🎁 Start Free Trial
            </Link>
            <Link
              href="/founder-letter"
              className="bg-white text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-50 font-semibold shadow-lg hover:shadow-xl transition-all border-2 border-gray-300 transform hover:-translate-y-1"
            >
              Read the Founder's Letter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
