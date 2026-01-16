'use client';

import { useEffect, useRef, useState } from 'react';

export default function WhyCreativitySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only animate once
        }
      },
      { threshold: 0.2 } // Trigger when 20% visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="mb-12 sm:mb-16">
      {/* Title */}
      <div
        className={`text-center mb-6 sm:mb-8 transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Why <span className="text-amber-700">Creativity</span> Matters More in the AI Era
        </h2>
      </div>

      {/* Inspirational Message - 3 Lines */}
      <div
        className={`text-center mb-10 sm:mb-12 max-w-3xl mx-auto transition-all duration-500 delay-100 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-2">
          <strong className="text-gray-900">Curiosity</strong> is the source of discovering problems.
        </p>
        <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-2">
          <strong className="text-gray-900">Creativity</strong> is the power to solve them.
        </p>
        <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
          And <strong className="text-gray-900">resilience</strong>, <strong className="text-gray-900">teamwork</strong>, and{' '}
          <strong className="text-gray-900">empathy</strong> are what carry you through the journey.
        </p>
      </div>

      {/* 3 Stats - Clean, no boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        {/* Stat 1: #1 Future Skill */}
        <div
          className={`text-center transition-all duration-500 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-5xl sm:text-6xl font-bold text-gray-900 mb-2">
            #1
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Future Skill</h3>
          <p className="text-gray-600 leading-relaxed">
            Creativity is the most needed skill for 2025 and beyond
          </p>
        </div>

        {/* Stat 2: 92% Confidence Boost */}
        <div
          className={`text-center transition-all duration-500 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-5xl sm:text-6xl font-bold text-gray-900 mb-2">
            92%
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Confidence Boost</h3>
          <p className="text-gray-600 leading-relaxed">
            Children with creativity show dramatically improved self-confidence
          </p>
        </div>

        {/* Stat 3: 90% Brain Development */}
        <div
          className={`text-center transition-all duration-500 delay-[400ms] ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-5xl sm:text-6xl font-bold text-gray-900 mb-2">
            90%
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Brain Development</h3>
          <p className="text-gray-600 leading-relaxed">
            Creative activities build neural pathways during critical early years
          </p>
        </div>
      </div>
    </div>
  );
}
