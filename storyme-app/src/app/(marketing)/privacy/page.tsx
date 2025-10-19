/**
 * Privacy Policy Page
 * Details about data collection, storage, and usage
 */

import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <Link href="/" className="inline-block text-3xl font-bold mb-4 hover:opacity-80 transition-opacity">
            📚 Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Me</span> ✨
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mt-4">Privacy Policy</h1>
          <p className="text-gray-600 mt-2">Last updated: October 2024</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
            <p className="text-gray-700 leading-relaxed">
              At StoryMe, we take your privacy seriously. This policy explains how we collect, use,
              protect, and share your personal information when you use our personalized children's
              storybook generation service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Account Information</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>Email address</li>
                  <li>Name (for personalization)</li>
                  <li>Authentication credentials (securely hashed)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Photos & Content</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>Character photos you upload for story personalization</li>
                  <li>Story content (titles, descriptions, generated scenes)</li>
                  <li>Generated images from AI processing</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Usage Data</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>Stories created and generation counts</li>
                  <li>Feature usage and preferences</li>
                  <li>Technical data (browser type, IP address, device info)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">How We Use Your Information</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>To generate personalized storybooks with your characters</li>
              <li>To maintain and improve our service</li>
              <li>To communicate with you about your account</li>
              <li>To enforce our terms and prevent abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Photo Storage & AI Processing</h2>
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <h3 className="font-bold text-gray-900 mb-2">Secure Storage</h3>
              <p className="text-gray-700 mb-4">
                Your uploaded photos are securely stored in Supabase (a secure cloud database).
                We use industry-standard encryption and access controls.
              </p>
              <h3 className="font-bold text-gray-900 mb-2">AI Image Generation</h3>
              <p className="text-gray-700">
                When you create a story, your photos are temporarily sent to fal.ai (our AI image
                generation partner) to create illustrations. fal.ai processes your photos in real-time
                and does not permanently store them after generation. Generated images are saved
                securely to your StoryMe account.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Sharing</h2>
            <p className="text-gray-700 mb-4">
              We do <strong>NOT</strong> sell your personal data. We only share data with:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>fal.ai:</strong> For AI image generation (photos sent temporarily, not stored)</li>
              <li><strong>Supabase:</strong> Our secure database and authentication provider</li>
              <li><strong>Legal authorities:</strong> If required by law or to protect rights and safety</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Rights</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Access:</strong> View all data we have about you</li>
              <li><strong>Delete:</strong> Delete your account and all associated data at any time</li>
              <li><strong>Control:</strong> Manage story visibility (public/private)</li>
              <li><strong>Export:</strong> Download your data in a portable format (coming soon)</li>
              <li><strong>Withdraw Consent:</strong> Opt out of data processing by deleting your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Children's Privacy</h2>
            <p className="text-gray-700">
              StoryMe is designed for parents and guardians to create stories featuring children.
              We do not knowingly collect personal information directly from children under 13.
              All accounts must be created and managed by adults.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Security</h2>
            <p className="text-gray-700">
              We implement industry-standard security measures including encryption, secure
              authentication, and row-level security policies. However, no system is 100% secure,
              and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Changes to This Policy</h2>
            <p className="text-gray-700">
              We may update this policy periodically. We will notify you of significant changes
              via email or a notice on our website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-700">
              If you have questions about this Privacy Policy or your data:
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mt-4">
              <p className="text-gray-700">
                <strong>Email:</strong> privacy@storyme.app (placeholder)
              </p>
            </div>
          </section>
        </div>

        {/* Back Button */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-md"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
