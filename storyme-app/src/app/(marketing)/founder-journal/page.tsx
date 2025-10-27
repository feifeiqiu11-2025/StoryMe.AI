/**
 * Founder's Journal
 * Placeholder page for founder's ongoing thoughts and updates
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LandingNav from '@/components/navigation/LandingNav';
import { StoryCard, type StoryCardData } from '@/components/story/StoryCard';

// Featured stories for the October 19th entry
const DRAGON_STORIES = [
  {
    id: '2b8f5dcb-c6c0-418f-8772-a61f69d20613',
    description: "Connor's Dragon Story",
  },
  {
    id: '52c19d59-c305-4a75-a527-cec759359b27',
    description: "Carter's Dragon Story",
  },
];

export default function FounderJournalPage() {
  const router = useRouter();
  const [dragonStories, setDragonStories] = useState<StoryCardData[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);

  useEffect(() => {
    // Fetch the dragon stories
    const fetchDragonStories = async () => {
      try {
        const promises = DRAGON_STORIES.map(async (story) => {
          const response = await fetch(`/api/stories/public/${story.id}`);
          if (response.ok) {
            const data = await response.json();
            return {
              ...data.story,
              description: story.description,
            };
          }
          return null;
        });

        const results = await Promise.all(promises);
        setDragonStories(results.filter((s): s is StoryCardData => s !== null));
      } catch (error) {
        console.error('Error fetching dragon stories:', error);
      } finally {
        setLoadingStories(false);
      }
    };

    fetchDragonStories();
  }, []);

  const handleStoryClick = (storyId: string) => {
    router.push(`/stories/${storyId}?from=journal`);
  };

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

        {/* Journal Index */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg p-6 sm:p-8 border border-indigo-200 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📚</span>
            <span>Journal Entries</span>
          </h2>
          <div className="space-y-3">
            <a
              href="#october-26-2025"
              className="block bg-white rounded-xl p-4 hover:shadow-md transition-all hover:translate-x-1 border border-purple-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                  ✨
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">The Power of a Mom's Voice</h3>
                  <p className="text-sm text-gray-500">October 26th, 2025</p>
                </div>
              </div>
            </a>
            <a
              href="#october-19-2025"
              className="block bg-white rounded-xl p-4 hover:shadow-md transition-all hover:translate-x-1 border border-purple-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                  🌈
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">The Viral Loop of Imagination</h3>
                  <p className="text-sm text-gray-500">October 19th, 2025</p>
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Journal Entry - October 26th, 2025 */}
        <article id="october-26-2025" className="bg-white rounded-2xl shadow-xl p-8 sm:p-12 border border-purple-200 mb-8 scroll-mt-8">
          {/* Entry Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center text-2xl shadow-md border-2 border-purple-200">
                ✨
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  The Power of a Mom's Voice
                </h2>
                <p className="text-sm text-gray-500 mt-1">October 26th, 2025 — by Feifei Qiu, Founder of KindleWood Studio</p>
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

        {/* Journal Entry - October 19th, 2025 */}
        <article id="october-19-2025" className="bg-white rounded-2xl shadow-xl p-8 sm:p-12 border border-purple-200 mb-8 scroll-mt-8">
          {/* Entry Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center text-2xl shadow-md border-2 border-purple-200">
                🌈
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  The Viral Loop of Imagination
                </h2>
                <p className="text-sm text-gray-500 mt-1">October 19th, 2025 — by Feifei Qiu, Founder of KindleWood Studio</p>
              </div>
            </div>
            <div className="h-1 w-full bg-gradient-to-r from-purple-200 to-pink-200 rounded-full"></div>
          </div>

          {/* Entry Content */}
          <div className="space-y-5 text-gray-700 leading-relaxed text-base sm:text-lg">
            <p>
              Every evening, when we open KindleWood Studio to create a new story together, I see something magical happen — a network effect of creativity.
            </p>

            <p>
              It starts with one small idea — sometimes just a silly sentence or a "what if this happens" from my kids — and then it grows.
            </p>

            <p>
              Last night, Connor came up with a wild story:
            </p>

            <blockquote className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 p-6 rounded-lg my-6 italic">
              <p className="text-lg sm:text-xl font-medium text-gray-900">
                "A dragon set fire to the ocean and turned the water purple. No one could live there anymore. So Connor gathered Daddy, Mommy, and his little brother to take the purple water to the Antarctic and refill the ocean with blue water again."
              </p>
            </blockquote>

            <p>
              When we turned his words into vivid illustrations — watching the ocean turn purple, the family marching bravely to save it — his eyes lit up. The moment he saw his story come alive, he immediately said, <strong>"Let's add more! The dragon come back set the fire on sand beach...!"</strong>
            </p>

            <p>
              And then, something even more beautiful happened.
            </p>

            <p>
              My three-year-old, who had been quietly watching, started telling his version:
            </p>

            <blockquote className="bg-gradient-to-r from-pink-50 to-rose-50 border-l-4 border-pink-500 p-6 rounded-lg my-6 italic">
              <p className="text-lg sm:text-xl font-medium text-gray-900">
                "A dragon set fire to the ocean and turned it purple…<span className="text-gray-600">(I thought he gonna simply copy brother's story, but he twisted)</span>... but then the dragon felt sad and turned it back blue again."
              </p>
            </blockquote>

            <p>
              Two brothers. Two versions of the same story.
              <br />
              One about teamwork and courage, the other about empathy and change.
            </p>

            <p>
              Their imaginations, though inspired by the same spark, reflected who they are:
            </p>

            <div className="bg-blue-50 rounded-xl p-6 my-6">
              <p className="mb-2">
                <strong className="text-blue-900">Connor</strong> — thoughtful, caring, the problem solver.
              </p>
              <p>
                <strong className="text-pink-900">Carter</strong> — sweet, wild, and full of surprises. ❤️
              </p>
            </div>

            <p>
              It made me realize: <strong className="text-gray-900">creativity spreads.</strong>
              <br />
              When children see their ideas matter, it fuels a loop — from imagination to creation, from one mind to another.
            </p>

            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border-l-4 border-amber-500 my-8">
              <p className="text-gray-800 leading-relaxed">
                That's the true network effect I want KindleWood Studio to ignite — not through algorithms or growth hacks, but through wonder.
                One child's story inspiring another's.
                One moment of imagination becoming many.
              </p>
            </div>
          </div>

          {/* Featured Stories from the Journal Entry */}
          {!loadingStories && dragonStories.length > 0 && (
            <div className="mt-10 pt-8 border-t-2 border-purple-200">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6 border-l-4 border-blue-400">
                <p className="text-gray-800 text-base sm:text-lg leading-relaxed">
                  Want to see what sparked this moment? Check out these two dragon stories from the boys — each one reflecting their unique imagination and perspective. 🐉✨
                </p>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>🐉</span>
                <span>The Dragon Stories</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {dragonStories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onClick={() => handleStoryClick(story.id)}
                    variant="community"
                    showAuthor={false}
                  />
                ))}
              </div>
            </div>
          )}

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

        {/* Journal Entry - October 26th, 2025 */}
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
                <p className="text-sm text-gray-500 mt-1">October 26th, 2025 — by Feifei Qiu, Founder of KindleWood Studio</p>
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
