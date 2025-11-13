/**
 * A Letter from the Founder
 * Personal message from Feifei about KindleWood's mission and vision
 */

'use client';

import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';

export default function FounderLetterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Navigation */}
      <LandingNav />

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            💌 A Letter from the Founder
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full mx-auto"></div>
        </div>

        {/* Letter Card */}
        <div className="bg-gradient-to-br from-white to-amber-50 rounded-2xl shadow-xl p-6 sm:p-10 border border-amber-200 mb-8">
          {/* Letter Content */}
          <div className="space-y-5 text-gray-700 leading-relaxed">
            {/* Opening */}
            <p className="text-base sm:text-lg">
              When I think of my boys, and the neighborhood kids racing off after school — I feel both excitement and a little worry.
            </p>

            <p className="text-base sm:text-lg">
              We're living in a moment where intelligence is no longer enough; AI can write, code, and even "think."
            </p>

            <p className="text-base sm:text-lg">
              But one thing it can't do — and what will truly define our children's future — is <strong>creativity, empathy, and the courage to imagine something entirely new</strong>.
            </p>

            <p className="text-base sm:text-lg">
              The goal for the next generation isn't to compete with machines, but to collaborate with them — to turn technology into a creative amplifier, not a substitute for thinking.
            </p>

            <p className="text-base sm:text-lg font-medium text-gray-800">
              Our children's edge won't be how fast they answer, but the questions they dare to ask.
            </p>

            <p className="text-base sm:text-lg font-medium text-gray-800">
              And that begins with something simple — a spark.
            </p>

            {/* From Spark to Growth Section */}
            <div className="my-8 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-6 border-l-4 border-yellow-500">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
                <span className="text-2xl">✨</span> From Spark to Growth
              </h3>

              <div className="space-y-4">
                <p className="text-base sm:text-lg">
                  Every child begins with a <strong className="text-yellow-700">spark</strong> — imagination, creativity, and curiosity.
                </p>

                <p className="text-base sm:text-lg">
                  That spark comes alive through what they create:
                </p>

                <p className="text-base sm:text-lg pl-4 border-l-2 border-yellow-400 italic">
                  their stories, their drawings, their books — their voice.
                </p>

                <p className="text-base sm:text-lg">
                  When children become storytellers and share what they've made, something powerful takes root:
                </p>

                <p className="text-base sm:text-lg pl-4 border-l-2 border-yellow-400 italic">
                  they begin to trust their ideas, speak with confidence, and see themselves as creators.
                </p>

                <p className="text-base sm:text-lg">
                  And through that process, they grow into who they are meant to be —
                </p>

                <p className="text-base sm:text-lg font-bold text-gray-900 bg-white/60 p-4 rounded-lg">
                  🌱 confident, empathetic, and resilient individuals.
                </p>

                <p className="text-base sm:text-lg pt-2">
                  This truth feels instinctive to every parent and teacher I meet — and the research backs it up.
                </p>
              </div>
            </div>

            {/* Research Section */}
            <div className="my-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
                The Hard Numbers Behind What Feels Intuitive
              </h3>

              <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500 mb-6">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold flex-shrink-0 mt-1">•</span>
                    <div>
                      <strong className="text-gray-900">Creative children grow into more adaptable, confident adults.</strong><br />
                      <span className="text-sm text-gray-600">
                        A 2024 Crayola study found that 92% of kids aged 6–12 believe being creative boosts their confidence.
                        {' '}(<a href="https://www.prnewswire.com/news-releases/new-crayola-childrens-study-reveals-a-powerful-link-between-creativity-and-confidence-302326950.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">PR Newswire</a>)
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold flex-shrink-0 mt-1">•</span>
                    <div>
                      <strong className="text-gray-900">Creativity fuels lifelong success.</strong><br />
                      <span className="text-sm text-gray-600">
                        Studies show it predicts higher academic performance, problem-solving ability, and long-term career satisfaction.
                        {' '}(<a href="https://www.psychologytoday.com/us/blog/work-your-mind/202111/the-long-lasting-benefits-of-childhood-creativity" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Psychology Today</a>,{' '}
                        <a href="https://www.purdue.edu/uns" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Purdue University</a>)
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold flex-shrink-0 mt-1">•</span>
                    <div>
                      <strong className="text-gray-900">Creativity supports mental health and resilience.</strong><br />
                      <span className="text-sm text-gray-600">
                        Researchers link creative expression with stronger emotional well-being and stress regulation.
                        {' '}(<a href="https://ncch.org.uk/uploads/Creativity-and-Mental-Health-in-Schools-Briefing.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">National Centre for Creative Health</a>,{' '}
                        <a href="https://online.maryville.edu" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Maryville University</a>)
                      </span>
                    </div>
                  </li>
                </ul>
              </div>

              <p className="text-base sm:text-lg mb-4">
                So when kids imagine and make, they're not just playing —<br />
                they're building the human strengths no machine can replicate.
              </p>

              <p className="text-base sm:text-lg font-medium text-gray-800">
                And that's where KindleWood comes in: to protect and amplify this spark in an age of limitless information.
              </p>
            </div>

            {/* How KindleWood Nurtures */}
            <div className="my-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>🌈</span> How KindleWood Nurtures That Journey
              </h3>

              <p className="text-base sm:text-lg mb-4">
                At <strong className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">KindleWood Studio</strong>, we're building an AI-powered ecosystem designed to help children grow not just smarter — but more creative, empathetic, imaginative, and confident.
              </p>

              <p className="text-base sm:text-lg font-medium text-gray-800 mb-6">
                Our approach is simple:<br />
                kids lead the imagination; AI supports the creation.
              </p>

              <div className="space-y-4">
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-5 border-l-4 border-pink-500">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    📖 Storytelling as a Launchpad
                  </h4>
                  <p className="text-sm sm:text-base text-gray-700">
                    Every child has a story to tell.<br />
                    KindleWood transforms their ideas into bilingual, illustrated storybooks — where they are the author, director, and dreamer.<br />
                    This creative act builds voice, confidence, and self-expression.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-5 border-l-4 border-purple-500">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    🤖 AI as a Co-Creator, Not a Replacement
                  </h4>
                  <p className="text-sm sm:text-base text-gray-700 mb-3">
                    We don't want AI to overshadow children — we want it to empower them.
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 mb-3">
                    Kids imagine, propose, and revise; AI scaffolds, illustrates, and expands.
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 font-medium">
                    The message is always:<br />
                    <em className="text-purple-700">You are the creator; the tool is the amplifier.</em>
                  </p>
                </div>

                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-5 border-l-4 border-teal-500">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    🌟 Beyond Creativity: Building Core Life Skills
                  </h4>
                  <p className="text-sm sm:text-base text-gray-700 mb-3">
                    As children create and share stories, they naturally build skills that matter for life:
                  </p>
                  <ul className="space-y-2 text-sm sm:text-base text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 font-bold mt-1">→</span>
                      Sharing → empathy & communication
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 font-bold mt-1">→</span>
                      Asking "why" and "what if" → curiosity & critical thinking
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 font-bold mt-1">→</span>
                      Experimenting & revising → resilience & growth mindset
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-600 font-bold mt-1">→</span>
                      Writing across languages → global awareness
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border-l-4 border-orange-500">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    📚 Balanced with Academic Foundations
                  </h4>
                  <p className="text-sm sm:text-base text-gray-700">
                    Reading and writing remain essential — not for memorization, but as <em className="font-medium text-orange-700">tools for thinking</em>.<br />
                    Kids don't just learn to consume stories; they learn to create them.
                  </p>
                </div>
              </div>

              <p className="text-base sm:text-lg mt-6 italic text-gray-600">
                And for many parents and educators, this creative cycle mirrors their own journeys.
              </p>
            </div>

            {/* Personal Reflection */}
            <div className="my-6 pt-6 border-t border-amber-300">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
                A Personal Reflection
              </h3>

              <p className="text-base sm:text-lg mb-6">
                When I reflect on my own path — from building AI-powered products for enterprise customers, to designing and constructing our family home, to co-creating stories with my kids at bedtime — I've realized something simple yet profound:
              </p>

              <blockquote className="bg-gradient-to-r from-amber-100 to-yellow-100 border-l-4 border-amber-500 p-6 rounded-lg my-6">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 italic">
                  "The tools may evolve, but imagination is timeless."
                </p>
              </blockquote>

              <p className="text-base sm:text-lg mb-4">
                It's what bridges innovation and emotion —<br />
                how we build not just products or houses, but futures worth living in.
              </p>

              <p className="text-base sm:text-lg mb-4">
                KindleWood Studio is my way of passing that belief forward —<br />
                a space where every child can see themselves as a creator,<br />
                every parent can nurture imagination,<br />
                and every story becomes a small act of hope for the future.
              </p>
            </div>

            {/* Signature */}
            <div className="mt-10 pt-6 border-t-2 border-amber-300">
              <p className="text-gray-600 mb-6 italic text-base">With gratitude and imagination,</p>
              <p
                className="text-5xl sm:text-6xl text-blue-900 mb-2"
                style={{ fontFamily: "var(--font-signature)" }}
              >
                Feifei Qiu
              </p>
              <p className="text-sm text-gray-600 mt-3">Founder & Mom, KindleWood Studio</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-xl p-8 text-center border border-indigo-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to Nurture Your Child's Creativity?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              🎁 Start Free Trial
            </Link>
            <Link
              href="/products"
              className="bg-white text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-50 font-semibold shadow-lg hover:shadow-xl transition-all border-2 border-gray-300 transform hover:-translate-y-1"
            >
              Explore Our Products
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
