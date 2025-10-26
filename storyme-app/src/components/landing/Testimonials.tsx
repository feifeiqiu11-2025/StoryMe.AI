/**
 * Testimonials Component
 * Displays user testimonials on landing page
 * "Voice from Our Little Authors" section
 */

'use client';

import { useState, useEffect } from 'react';

interface Testimonial {
  id: string;
  rating: number;
  feedback_text: string | null;
  display_name: string | null;
  created_at: string;
  is_featured: boolean;
}

export default function Testimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestimonials();
  }, []);

  async function fetchTestimonials() {
    try {
      const response = await fetch('/api/testimonials');
      const data = await response.json();

      if (response.ok) {
        setTestimonials(data.testimonials || []);
      }
    } catch (error) {
      console.error('Error fetching testimonials:', error);
    } finally {
      setLoading(false);
    }
  }

  // Don't render section if no testimonials
  if (!loading && testimonials.length === 0) {
    return null;
  }

  return (
    <section className="py-6 bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-6">
          <div className="inline-block mb-3">
            <div className="flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 px-4 py-2 rounded-full">
              <span className="text-2xl">💬</span>
              <span className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                TESTIMONIALS
              </span>
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Voice from Our Little Authors
          </h2>
          <p className="text-base text-gray-600 max-w-2xl mx-auto">
            See what parents are saying about KindleWood
          </p>
        </div>

        {/* Testimonials Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 mt-4">Loading testimonials...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.id}
                className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-100 hover:shadow-xl transition-shadow relative"
              >
                {/* Featured Badge */}
                {testimonial.is_featured && (
                  <div className="absolute -top-3 -right-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                    ⭐ Featured
                  </div>
                )}

                {/* Star Rating */}
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className="w-6 h-6"
                      fill={star <= testimonial.rating ? '#FCD34D' : '#E5E7EB'}
                      stroke={star <= testimonial.rating ? '#F59E0B' : '#9CA3AF'}
                      strokeWidth="1"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>

                {/* Feedback Text */}
                {testimonial.feedback_text && (
                  <blockquote className="text-gray-700 mb-4 italic leading-relaxed">
                    "{testimonial.feedback_text}"
                  </blockquote>
                )}

                {/* Author */}
                <div className="flex items-center gap-3 mt-auto pt-4 border-t border-gray-100">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {testimonial.display_name || 'Anonymous'}
                    </p>
                    <p className="text-xs text-gray-500">
                      KindleWood Parent
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
