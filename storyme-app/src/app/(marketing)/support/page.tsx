/**
 * Support Page
 * Public page with FAQs and support ticket submission form
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: 'How do KindleWood Studio and the Kids App work together?',
    answer: 'KindleWood Studio is the web platform where you create personalized storybooks using AI. Once you create stories on the web, you need to manually publish them to make them available in the Kids App. After publishing, the stories can be accessed through our companion Kids App on iOS and Android, which provides a kid-friendly reading experience with audio narration and interactive elements. Note: Offline reading is not yet supported in the Kids App.',
  },
  {
    question: 'Do I need to pay for the Kids App separately?',
    answer: 'No! The Kids App is completely free to download. Your KindleWood Studio subscription (Free 7-day trial, Basic, Premium, or Team) works across both the web platform and the mobile app. The features you have access to depend on your subscription tier.',
  },
  {
    question: 'What subscription tiers are available?',
    answer: 'We offer four tiers: Free (7-day trial for new users), Basic, Premium, and Team. Each tier has different features and story limits. After your 7-day free trial ends, you\'ll need to choose a paid plan to continue using KindleWood Studio. Visit our Pricing page for detailed feature comparisons.',
  },
  {
    question: 'What is the Little Artists feature?',
    answer: 'Little Artists is a Premium feature that allows you to showcase your child\'s artwork in our community gallery. You can upload your child\'s sketches, transform them into story characters using AI, and share them with our community. Other users can use these characters in their stories, helping young artists see their creativity come to life in new ways.',
  },
  {
    question: 'How do I create my first story?',
    answer: 'After signing up, click "Create Story" from your dashboard. You can choose a theme and add characters (including uploading photos for personalization). When creating your story, you can either keep the original script or let our AI be creative to generate a unique story for you. The AI can create engaging, personalized narratives based on your preferences.',
  },
  {
    question: 'Can I use my own photos in stories?',
    answer: 'Yes! All users can create character profiles and upload photos to personalize story characters. Our AI transforms the photos into illustrated characters that appear throughout your stories, making each tale uniquely special for your child.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) through Stripe, our secure payment processor. You can manage your subscription and payment methods from your Account Settings page.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes! You can cancel your subscription at any time from your Account Settings. You\'ll continue to have access to the features of your current plan until the end of your billing period. After cancellation, your subscription will end and you won\'t be charged again. Note: The Free plan is a 7-day trial only available to new users.',
  },
  {
    question: 'Is my child\'s data safe and private?',
    answer: 'Absolutely. We take privacy very seriously, especially for children\'s content. Photos and stories are private by default and only visible to your account. We never share personal information with third parties, and all data is encrypted and stored securely. See our Privacy Policy for full details.',
  },
];

export default function SupportPage() {
  const [user, setUser] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      setUser(supabaseUser);
    };
    loadUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setSubmitError('Please fill in all required fields');
      return;
    }

    if (!user && !email.trim()) {
      setSubmitError('Please provide your email address');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/support/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          email: user ? undefined : email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit support request');
      }

      setSubmitSuccess(true);
      setTitle('');
      setDescription('');
      setEmail('');

      // Reset success message after 5 seconds
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (error) {
      console.error('Error submitting support request:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <Link href="/" className="inline-block text-3xl font-bold mb-4 hover:opacity-80 transition-opacity">
            📚 Kindle<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Wood</span> Studio ✨
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mt-4">Support Center</h1>
          <p className="text-gray-600 mt-2">Find answers and get help</p>
        </div>

        {/* FAQs Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      expandedFAQ === index ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedFAQ === index && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Support Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900">Report an Issue or Share Feedback</h2>
          </div>

          <p className="text-gray-600 mb-6">
            Can't find what you're looking for? Let us know how we can help or share your thoughts about KindleWood Studio.
          </p>

          {submitSuccess && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <h3 className="font-semibold text-green-900">Thank you for your submission!</h3>
                  <p className="text-green-700 text-sm mt-1">
                    We've received your message and will get back to you as soon as possible.
                  </p>
                </div>
              </div>
            </div>
          )}

          {submitError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-900">Error</h3>
                  <p className="text-red-700 text-sm mt-1">{submitError}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!user && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-blue-900">Login Required</h3>
                    <p className="text-blue-700 text-sm mt-1">
                      Please <a href="/login?redirect=/support" className="underline font-semibold">log in</a> to submit a support request. This helps us respond to you directly.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Brief description of your issue or feedback"
                maxLength={200}
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Please provide as much detail as possible about your issue or feedback..."
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                {description.length} characters
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="text-red-500">*</span> Required fields
              </p>
              <button
                type="submit"
                disabled={isSubmitting || !user}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>

        {/* Additional Help */}
        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Need immediate assistance? Email us at{' '}
            <a href="mailto:Admin@KindleWoodStudio.ai" className="text-purple-600 hover:text-purple-700 font-semibold">
              Admin@KindleWoodStudio.ai
            </a>
          </p>
          <div className="mt-4 flex items-center justify-center gap-6 text-sm">
            <Link href="/privacy" className="text-gray-600 hover:text-purple-600 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-gray-400">•</span>
            <Link href="/terms" className="text-gray-600 hover:text-purple-600 transition-colors">
              Terms of Service
            </Link>
            <span className="text-gray-400">•</span>
            <Link href="/" className="text-gray-600 hover:text-purple-600 transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
