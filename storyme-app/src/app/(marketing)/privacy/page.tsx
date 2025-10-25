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
            📚 Kindle<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Wood</span> Studio ✨
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mt-4">Privacy Policy</h1>
          <p className="text-gray-600 mt-2">Last updated: October 25, 2025</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
            <p className="text-gray-700 leading-relaxed">
              At KindleWood Studio, we take your privacy seriously. This policy explains how we collect, use,
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
                securely to your KindleWood Studio account.
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
              <li><strong>Stripe:</strong> Our payment processor for subscription billing (they handle all payment card data - we never see or store your card information)</li>
              <li><strong>Legal authorities:</strong> If required by law or to protect rights and safety</li>
            </ul>
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200 mt-4">
              <h3 className="font-bold text-gray-900 mb-2">Payment Information</h3>
              <p className="text-gray-700">
                All payment card information is processed directly by Stripe, a PCI-DSS compliant payment
                processor. We never see, handle, or store your credit card details. We only receive
                confirmation of successful or failed payments and subscription status updates from Stripe.
              </p>
            </div>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Children's Privacy (COPPA Compliance)</h2>
            <div className="space-y-4">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 mb-2">Our Commitment to Children's Privacy</h3>
                <p className="text-gray-700">
                  KindleWood complies with the Children's Online Privacy Protection Act (COPPA). We take the privacy of children under 13 very seriously.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Parent-Controlled Platform</h3>
                <p className="text-gray-700 mb-2">
                  KindleWood Studio is designed for parents and guardians to create and manage content for their children:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>All accounts must be created and managed by adults (18+)</li>
                  <li>Parents control all child profiles, photos, and data</li>
                  <li>We do not knowingly collect information directly from children under 13</li>
                  <li>Children can only access content through the KindleWood Kids app with parental setup</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Information About Children We Collect (With Parental Consent)</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li><strong>Child's name and age:</strong> Provided by parent for profile creation</li>
                  <li><strong>Photos:</strong> Uploaded by parent for story personalization</li>
                  <li><strong>Reading progress:</strong> Stories read, quiz performance, time spent</li>
                  <li><strong>Preferences:</strong> Favorite stories, reading goals set by parents</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  All of this information is collected through the parent account and controlled by the parent.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">How We Use Children's Information</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>To personalize stories with the child's name and likeness</li>
                  <li>To track reading progress and educational achievements</li>
                  <li>To provide age-appropriate content recommendations</li>
                  <li>To enable parents to monitor their child's learning journey</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Parental Rights Under COPPA</h3>
                <p className="text-gray-700 mb-2">
                  As a parent or guardian, you have the right to:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li><strong>Review:</strong> View all data we have about your child</li>
                  <li><strong>Delete:</strong> Delete your child's profile and all associated data at any time</li>
                  <li><strong>Refuse:</strong> Refuse further collection of your child's information (by deleting their profile)</li>
                  <li><strong>Control:</strong> Manage what data is collected and how it's used</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  To exercise these rights, sign in to your account and manage child profiles in Settings, or contact us at kindlewood@gmail.com.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Data Sharing for Children</h3>
                <p className="text-gray-700">
                  We do NOT sell or share children's personal information with third parties for marketing purposes.
                  Children's photos are only shared with our AI service provider (fal.ai) for the sole purpose of
                  generating personalized story illustrations, and are not stored by the service provider.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">KindleWood Kids App</h3>
                <p className="text-gray-700">
                  The KindleWood Kids mobile app is designed for children to consume content created by their parents.
                  The app does not collect any additional information beyond reading progress and quiz answers, which
                  are visible to parents in their account dashboard.
                </p>
              </div>
            </div>
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
              <p className="text-gray-700 mb-2">
                <strong>Email:</strong> <a href="mailto:kindlewood@gmail.com" className="text-blue-600 hover:text-blue-700 underline">kindlewood@gmail.com</a>
              </p>
              <p className="text-gray-700 text-sm">
                We will respond to your privacy inquiries within 30 days.
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
