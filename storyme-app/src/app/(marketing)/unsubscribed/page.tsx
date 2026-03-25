'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function UnsubscribedContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status') || 'error';

  const statusMap: Record<string, { icon: string; title: string; message: string; note: string }> = {
    success: {
      icon: '\u2705',
      title: "You've Been Unsubscribed",
      message:
        'You will no longer receive marketing emails from KindleWood Studio. Transactional emails (workshop confirmations, account updates) will continue as normal.',
      note: 'Changed your mind? Email us at Admin@KindleWoodStudio.ai to re-subscribe.',
    },
    already: {
      icon: '\u2139\ufe0f',
      title: 'Already Unsubscribed',
      message:
        "You're already unsubscribed from marketing emails. No further action is needed.",
      note: 'If you believe this is an error, contact Admin@KindleWoodStudio.ai.',
    },
    error: {
      icon: '\u26a0\ufe0f',
      title: 'Something Went Wrong',
      message:
        "We couldn't process your unsubscribe request. The link may be invalid or expired.",
      note: 'Please contact Admin@KindleWoodStudio.ai and we\u2019ll remove you manually.',
    },
  };

  const content = statusMap[status] || statusMap.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-xl mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-8">
          <a
            href="https://www.kindlewoodstudio.ai"
            className="inline-block text-2xl font-bold hover:opacity-80 transition-opacity"
          >
            KindleWood Studio
          </a>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-4xl mb-4">{content.icon}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{content.title}</h1>
          <p className="text-gray-600 leading-relaxed mb-6">{content.message}</p>
          <p className="text-sm text-gray-400">{content.note}</p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <a
            href="https://www.kindlewoodstudio.ai"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Back to KindleWood Studio
          </a>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <UnsubscribedContent />
    </Suspense>
  );
}
