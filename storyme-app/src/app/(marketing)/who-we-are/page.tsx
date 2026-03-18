'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';

function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

interface Founder {
  name: string;
  role: string;
  photo: string;
  bio: string;
  focus: string;
  quote: string;
}

const founders: Founder[] = [
  {
    name: 'Feifei Qiu',
    role: 'Founder & CEO',
    photo: '/images/team/feifei-qiu.webp',
    bio: 'Graduated with a Bachelor\u2019s in Computer Science and a Master\u2019s in Machine Learning, with 10+ years at Microsoft and tech companies as Engineering Manager and AI Product Manager. After years building cloud and AI products at scale, she turned to something she\u2019s truly passionate about \u2014 the intersection of AI, education, and kids \u2014 helping children learn through creativity.',
    focus: 'At KindleWood, Feifei shapes the product vision \u2014 how AI and creativity come together to help kids learn. She also builds partnerships with schools and educators to bring KindleWood to more children.',
    quote: 'I build bridges between imagination, learning, and technology.',
  },
  {
    name: 'Lu Pang',
    role: 'Co-Founder',
    photo: '/images/team/lu-pang.webp',
    bio: 'A data analytics expert with over 10 years of experience in data modeling in Healthcare, and co-founder of Seattle Little Rangers, a nonprofit dedicated to youth enrichment and nature-based learning. Lu brings a rare blend of analytical rigor and hands-on community building to everything she does.',
    focus: 'At KindleWood, Lu designs and leads in-person workshops, bringing creative learning beyond the screen and into real-world classroom experiences. She also drives growth by building authentic connections with families and communities.',
    quote: 'I bring imagination into practice\u2014where kids and communities come together.',
  },
];

function HeroSection() {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={`text-center mb-16 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
        Meet Our{' '}
        <span className="text-amber-700 underline decoration-amber-700 decoration-2 underline-offset-4">
          Visionary Team
        </span>
      </h1>
    </div>
  );
}

function FounderSection({ founder, index }: { founder: Founder; index: number }) {
  const { ref, isVisible } = useScrollAnimation();
  const photoLeft = index % 2 === 0;

  return (
    <div
      ref={ref}
      className={`flex flex-col md:flex-row items-start gap-10 md:gap-14 ${
        photoLeft ? '' : 'md:flex-row-reverse'
      }`}
    >
      {/* Photo */}
      <div
        className={`flex-shrink-0 transition-all duration-700 delay-100 ${
          isVisible
            ? 'opacity-100 translate-x-0'
            : `opacity-0 ${photoLeft ? '-translate-x-10' : 'translate-x-10'}`
        }`}
      >
        <div className="w-60 h-60 sm:w-72 sm:h-72 rounded-2xl overflow-hidden shadow-xl relative">
          <Image
            src={founder.photo}
            alt={founder.name}
            fill
            className="object-cover"
            sizes="288px"
          />
        </div>
      </div>

      {/* Text */}
      <div
        className={`flex-1 ${photoLeft ? 'md:text-left' : 'md:text-right'} text-center transition-all duration-700 delay-200 ${
          isVisible
            ? 'opacity-100 translate-x-0'
            : `opacity-0 ${photoLeft ? 'translate-x-10' : '-translate-x-10'}`
        }`}
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
          {founder.name}
        </h2>
        <p className="text-amber-700 font-semibold text-lg mb-4">{founder.role}</p>
        <p className="text-gray-600 text-lg leading-relaxed mb-4">
          {founder.bio}
        </p>
        <p className="text-gray-600 leading-relaxed mb-5">
          {founder.focus}
        </p>
        <p className="text-gray-800 italic text-lg font-medium">
          &ldquo;{founder.quote}&rdquo;
        </p>
      </div>
    </div>
  );
}

function CtaSection() {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={`text-center py-8 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
        Join Us on This Journey
      </h2>
      <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto">
        We&rsquo;re building something special for families and educators.
        <br />
        Interested in joining our team? Reach out to us.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="mailto:Admin@KindleWoodStudio.ai"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-base transition-colors"
        >
          Get in Touch
        </a>
        <Link
          href="/what-sparked-kindlewood"
          className="bg-white text-gray-700 px-8 py-3 rounded-lg font-semibold text-base transition-colors border-2 border-gray-300 hover:border-gray-400"
        >
          Our Origin Story
        </Link>
      </div>
    </div>
  );
}

export default function WhoWeArePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />

      <div className="max-w-5xl mx-auto px-4 py-12">
        <HeroSection />

        {/* Founders */}
        <div className="space-y-20 mb-16">
          {founders.map((founder, index) => (
            <FounderSection key={founder.name} founder={founder} index={index} />
          ))}
        </div>

        <CtaSection />
      </div>
    </div>
  );
}
