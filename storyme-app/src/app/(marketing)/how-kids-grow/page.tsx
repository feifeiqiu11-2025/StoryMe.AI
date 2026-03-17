'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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

interface GrowthArea {
  title: string;
  description: string;
  images: string[];
  imagePosition?: string;
}

const growthAreas: GrowthArea[] = [
  {
    title: 'Read, Write & Speak',
    description:
      'Children build literacy skills through fun, engaging creative projects — from storytelling to designing their own content. They learn to express ideas in words, structure narratives, and develop confident speaking and storytelling skills.',
    images: [
      '/images/how-kids-grow/read-write-1.jpg',
      '/images/how-kids-grow/read-write-2.jpg',
      '/images/how-kids-grow/read-write-3.jpg',
      '/images/how-kids-grow/read-write-4.jpg',
      '/images/how-kids-grow/read-write-5.jpg',
      '/images/how-kids-grow/read-write-6.jpg',
      '/images/how-kids-grow/read-write-7.jpg',
      '/images/how-kids-grow/read-write-8.jpg',
    ],
  },
  {
    title: 'Teamwork & Empathy',
    description:
      'Kids practice expressing ideas, listening to others, and collaborating through shared creation. Working together on stories and projects helps them understand different perspectives and build meaningful connections.',
    images: [
      '/images/how-kids-grow/teamwork-1.jpg',
      '/images/how-kids-grow/teamwork-2.jpg',
      '/images/how-kids-grow/teamwork-3.jpg',
    ],
  },
  {
    title: 'Learn from Failure',
    description:
      'When something doesn\'t work as expected, kids build resilience through iteration — whether tuning a story script and image, refining a 3D model, or debugging code. They discover that mistakes are stepping stones, not setbacks, and learn to embrace imperfect results along the way.',
    images: [
      '/images/how-kids-grow/failure-1.jpg',
      '/images/how-kids-grow/failure-2.jpg',
      '/images/how-kids-grow/failure-3.jpg',
    ],
  },
  {
    title: 'Creative & Critical Thinkers',
    description:
      'Children become critical thinkers and creative problem-solvers who take ownership of their ideas. They gain the confidence to imagine, create, and share with the world.',
    images: [
      '/images/how-kids-grow/creative-1.jpg',
      '/images/how-kids-grow/creative-2.jpg',
    ],
    imagePosition: 'object-contain',
  },
];

function Slideshow({ images, alt, imagePosition = 'object-top' }: { images: string[]; alt: string; imagePosition?: string }) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 shadow-lg">
      {images.map((src, i) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={src}
            alt={`${alt} - photo ${i + 1}`}
            fill
            className={imagePosition === 'object-contain' ? 'object-contain' : `object-cover ${imagePosition}`}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      ))}
      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === current ? 'bg-white' : 'bg-white/50'
            }`}
            aria-label={`Go to photo ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

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
        How Kids{' '}
        <span className="text-amber-700 underline decoration-amber-700 decoration-2 underline-offset-4">
          Grow
        </span>
      </h1>
      <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
        At KindleWood, every story created, every project built, and every workshop attended helps children develop real skills that last a lifetime.
      </p>
    </div>
  );
}

function GrowthAreaSection({ area, index }: { area: GrowthArea; index: number }) {
  const { ref, isVisible } = useScrollAnimation();
  const textLeft = index % 2 === 0;

  return (
    <div
      ref={ref}
      className={`flex flex-col md:flex-row items-start gap-8 md:gap-12 ${
        textLeft ? '' : 'md:flex-row-reverse'
      }`}
    >
      {/* Text */}
      <div
        className={`flex-1 text-center md:text-left transition-all duration-700 delay-100 ${
          isVisible
            ? 'opacity-100 translate-x-0'
            : `opacity-0 ${textLeft ? '-translate-x-10' : 'translate-x-10'}`
        }`}
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          {area.title}
        </h2>
        <p className="text-gray-600 text-xl leading-relaxed">
          {area.description}
        </p>
      </div>

      {/* Slideshow */}
      <div
        className={`flex-1 w-full transition-all duration-700 delay-200 ${
          isVisible
            ? 'opacity-100 translate-x-0'
            : `opacity-0 ${textLeft ? 'translate-x-10' : '-translate-x-10'}`
        }`}
      >
        <Slideshow images={area.images} alt={area.title} imagePosition={area.imagePosition} />
      </div>
    </div>
  );
}

function CtaSection() {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={`text-center py-16 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
        Ready to Inspire Your Child?
      </h2>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/signup"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-base transition-colors"
        >
          Start Creating
        </Link>
        <Link
          href="/workshops"
          className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-lg font-semibold text-base transition-colors"
        >
          Join Workshops
        </Link>
      </div>
    </div>
  );
}

export default function HowKidsGrowPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <HeroSection />

        {/* 4 Growth Areas — alternating layout */}
        <div className="space-y-28">
          {growthAreas.map((area, index) => (
            <GrowthAreaSection key={area.title} area={area} index={index} />
          ))}
        </div>

        {/* CTA */}
        <CtaSection />
      </div>
    </div>
  );
}
