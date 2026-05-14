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
      <LandingNav />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12 pb-20">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-3">
            A Letter from the Founder
          </h1>
          <p className="text-sm text-gray-500">By Feifei Qiu</p>
        </div>

        {/* Letter Article */}
        <article className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/80 p-8 sm:p-12 mb-10">
          <div className="space-y-6 text-gray-800 leading-relaxed">
            {/* Opening */}
            <p className="text-lg">
              When I think of my boys, and the neighborhood kids racing off after school — I feel both excitement and a little worry.
            </p>

            <p className="text-lg">
              We&rsquo;re living in a moment where intelligence is no longer enough; AI can write, code, and even &ldquo;think.&rdquo;
            </p>

            <p className="text-lg">
              But one thing it can&rsquo;t do — and what will truly define our children&rsquo;s future — is{' '}
              <strong className="font-semibold text-gray-900">
                creativity, empathy, and the courage to imagine something entirely new
              </strong>
              .
            </p>

            <p className="text-lg">
              The goal for the next generation isn&rsquo;t to compete with machines, but to collaborate with them — to turn technology into a creative amplifier, not a substitute for thinking.
            </p>

            <p className="text-lg font-medium text-gray-900">
              Our children&rsquo;s edge won&rsquo;t be how fast they answer, but the questions they dare to ask.
            </p>

            <p className="text-lg font-medium text-gray-900">
              And that begins with something simple — a spark.
            </p>

            {/* From Spark to Growth */}
            <section className="pt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-5">
                From Spark to Growth
              </h2>

              <div className="space-y-5">
                <p className="text-lg">
                  Every child begins with a{' '}
                  <strong className="font-semibold text-amber-700">spark</strong>{' '}
                  — imagination, creativity, and curiosity.
                </p>

                <p className="text-lg">
                  That spark comes alive through what they create:
                </p>

                <p className="text-lg pl-5 border-l-2 border-amber-300 italic text-gray-700">
                  their stories, their drawings, their books — their voice.
                </p>

                <p className="text-lg">
                  When children become storytellers and share what they&rsquo;ve made, something powerful takes root:
                </p>

                <p className="text-lg pl-5 border-l-2 border-amber-300 italic text-gray-700">
                  they begin to trust their ideas, speak with confidence, and see themselves as creators.
                </p>

                <p className="text-lg">
                  And through that process, they grow into who they are meant to be — confident, empathetic, and resilient individuals.
                </p>

                <p className="text-lg">
                  This truth feels instinctive to every parent and teacher I meet — and the research backs it up.
                </p>
              </div>
            </section>

            {/* The Hard Numbers */}
            <section className="pt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-5">
                The hard numbers behind what feels intuitive
              </h2>

              <ul className="space-y-5 mb-6">
                <li>
                  <p className="font-semibold text-gray-900 mb-1">
                    Creative children grow into more adaptable, confident adults.
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    A 2024 Crayola study found that 92% of kids aged 6–12 believe being creative boosts their confidence.{' '}
                    <a
                      href="https://www.prnewswire.com/news-releases/new-crayola-childrens-study-reveals-a-powerful-link-between-creativity-and-confidence-302326950.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-700 hover:text-amber-800 underline"
                    >
                      PR Newswire
                    </a>
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-gray-900 mb-1">
                    Creativity fuels lifelong success.
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Studies show it predicts higher academic performance, problem-solving ability, and long-term career satisfaction.{' '}
                    <a
                      href="https://www.psychologytoday.com/us/blog/work-your-mind/202111/the-long-lasting-benefits-of-childhood-creativity"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-700 hover:text-amber-800 underline"
                    >
                      Psychology Today
                    </a>
                    ,{' '}
                    <a
                      href="https://www.purdue.edu/uns"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-700 hover:text-amber-800 underline"
                    >
                      Purdue University
                    </a>
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-gray-900 mb-1">
                    Creativity supports mental health and resilience.
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Researchers link creative expression with stronger emotional well-being and stress regulation.{' '}
                    <a
                      href="https://ncch.org.uk/uploads/Creativity-and-Mental-Health-in-Schools-Briefing.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-700 hover:text-amber-800 underline"
                    >
                      National Centre for Creative Health
                    </a>
                    ,{' '}
                    <a
                      href="https://online.maryville.edu"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-700 hover:text-amber-800 underline"
                    >
                      Maryville University
                    </a>
                  </p>
                </li>
              </ul>

              <p className="text-lg">
                So when kids imagine and make, they&rsquo;re not just playing — they&rsquo;re building the human strengths no machine can replicate.
              </p>

              <p className="text-lg font-medium text-gray-900 mt-4">
                And that&rsquo;s where KindleWood comes in: to protect and amplify this spark in an age of limitless information.
              </p>
            </section>

            {/* How KindleWood Nurtures */}
            <section className="pt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-5">
                How KindleWood nurtures that journey
              </h2>

              <p className="text-lg mb-4">
                At KindleWood Studio, we&rsquo;re building an AI-powered ecosystem designed to help children grow not just smarter — but more creative, empathetic, imaginative, and confident.
              </p>

              <p className="text-lg font-medium text-gray-900 mb-8">
                Our approach is simple: kids lead the imagination; AI supports the creation.
              </p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Storytelling as a launchpad
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    Every child has a story to tell. KindleWood transforms their ideas into bilingual, illustrated storybooks — where they are the author, director, and dreamer. This creative act builds voice, confidence, and self-expression.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    AI as a co-creator, not a replacement
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-2">
                    We don&rsquo;t want AI to overshadow children — we want it to empower them. Kids imagine, propose, and revise; AI scaffolds, illustrates, and expands.
                  </p>
                  <p className="text-gray-700 leading-relaxed italic">
                    You are the creator; the tool is the amplifier.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Beyond creativity: building core life skills
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    As children create and share stories, they naturally build skills that matter for life:
                  </p>
                  <ul className="space-y-1.5 text-gray-700 leading-relaxed">
                    <li>— Sharing builds empathy and communication.</li>
                    <li>— Asking &ldquo;why&rdquo; and &ldquo;what if&rdquo; sharpens curiosity and critical thinking.</li>
                    <li>— Experimenting and revising develop resilience and a growth mindset.</li>
                    <li>— Writing across languages opens up global awareness.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Balanced with academic foundations
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    Reading and writing remain essential — not for memorization, but as tools for thinking. Kids don&rsquo;t just learn to consume stories; they learn to create them.
                  </p>
                </div>
              </div>

              <p className="text-lg mt-8 italic text-gray-600">
                And for many parents and educators, this creative cycle mirrors their own journeys.
              </p>
            </section>

            {/* Personal Reflection */}
            <section className="pt-8 mt-4 border-t border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-5">
                A personal reflection
              </h2>

              <p className="text-lg mb-6">
                When I reflect on my own path — from building AI-powered products for enterprise customers, to designing and constructing our family home, to co-creating stories with my kids at bedtime — I&rsquo;ve realized something simple yet profound:
              </p>

              <blockquote className="border-l-4 border-amber-700 pl-6 my-8">
                <p className="text-xl sm:text-2xl font-semibold text-gray-900 italic leading-snug">
                  &ldquo;The tools may evolve, but imagination is timeless.&rdquo;
                </p>
              </blockquote>

              <p className="text-lg mb-4">
                It&rsquo;s what bridges innovation and emotion — how we build not just products or houses, but futures worth living in.
              </p>

              <p className="text-lg">
                KindleWood Studio is my way of passing that belief forward — a space where every child can see themselves as a creator, every parent can nurture imagination, and every story becomes a small act of hope for the future.
              </p>
            </section>

            {/* Signature */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-gray-600 mb-6 italic">With gratitude and imagination,</p>
              <p
                className="text-5xl sm:text-6xl text-gray-900 mb-2"
                style={{ fontFamily: 'var(--font-signature)' }}
              >
                Feifei Qiu
              </p>
              <p className="text-sm text-gray-600 mt-3">Founder &amp; Mom, KindleWood Studio</p>
            </div>
          </div>
        </article>

        {/* CTA */}
        <div className="text-center">
          <p className="text-gray-700 mb-6">
            Want to bring this spark to your child?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="bg-amber-700 hover:bg-amber-800 text-white px-7 py-3 rounded-lg font-semibold transition-colors min-h-[44px] inline-flex items-center justify-center"
            >
              Start Free Trial
            </Link>
            <Link
              href="/products"
              className="bg-white text-gray-700 px-7 py-3 rounded-lg font-semibold transition-colors border border-gray-300 hover:border-gray-400 min-h-[44px] inline-flex items-center justify-center"
            >
              Explore Our Products
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
