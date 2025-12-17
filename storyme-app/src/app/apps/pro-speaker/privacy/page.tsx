import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - ProSpeaker',
  description: 'Privacy Policy for the ProSpeaker mobile application by KindleWood Studios',
};

export default function ProSpeakerPrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-slate-400 mb-8">Last Updated: December 2024</p>

        <div className="space-y-8 text-slate-300">
          <p>
            KindleWood Studios (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the ProSpeaker mobile application. This Privacy Policy explains how we collect, use, and protect your information.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h2>
            <p className="mb-3">
              <strong className="text-white">Account Information:</strong> When you create an account, we collect your email address and authentication credentials (via Google Sign-In or Apple Sign-In).
            </p>
            <p className="mb-3">
              <strong className="text-white">Voice Recordings:</strong> When you use our speaking practice features, your voice recordings are temporarily processed to provide feedback. Recordings are not permanently stored on our servers.
            </p>
            <p>
              <strong className="text-white">Usage Data:</strong> We collect anonymous usage statistics to improve the app experience.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide and maintain the ProSpeaker service</li>
              <li>To analyze your speech and provide feedback</li>
              <li>To communicate with you about your account</li>
              <li>To improve our services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Data Storage and Security</h2>
            <p>
              We use industry-standard security measures to protect your data. Your account credentials are securely stored using encrypted storage. Voice recordings are processed in real-time and are not permanently retained.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Third-Party Services</h2>
            <p className="mb-3">We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Google Sign-In for authentication</li>
              <li>Apple Sign-In for authentication (iOS)</li>
              <li>Azure Cognitive Services for speech analysis</li>
              <li>OpenAI for AI coaching features</li>
            </ul>
            <p className="mt-3">
              These services have their own privacy policies governing the use of your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Access your personal data</li>
              <li>Delete your account and associated data</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Children&apos;s Privacy</h2>
            <p>
              ProSpeaker is not intended for children under 13. We do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy in the app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at:{' '}
              <a href="mailto:admin@KindleWoodStudio.ai" className="text-blue-400 hover:underline">
                admin@KindleWoodStudio.ai
              </a>
            </p>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-700 text-center text-slate-500">
          <p>&copy; {new Date().getFullYear()} KindleWood Studios. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
