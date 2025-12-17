import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - ProSpeaker',
  description: 'Terms of Service for the ProSpeaker mobile application by KindleWood Studios',
};

export default function ProSpeakerTermsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-slate-400 mb-8">Last Updated: December 2024</p>

        <div className="space-y-8 text-slate-300">
          <p>
            Welcome to ProSpeaker. By using our app, you agree to these Terms of Service. Please read them carefully.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using ProSpeaker, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use the app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
            <p className="mb-3">ProSpeaker is a language learning and speaking practice application that provides:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>AI-powered speech analysis and feedback</li>
              <li>Speaking practice exercises</li>
              <li>Interview preparation coaching</li>
              <li>Daily conversation prompts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. User Accounts</h2>
            <p>
              To use ProSpeaker, you must create an account using Google Sign-In, Apple Sign-In, or email registration. You are responsible for maintaining the security of your account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Subscription and Payments</h2>
            <p className="mb-3">
              ProSpeaker offers a free trial period. After the trial, continued access requires a purchase. All purchases are processed through the Apple App Store or Google Play Store and are subject to their respective terms.
            </p>
            <p>
              <strong className="text-white">Refunds:</strong> Refund requests must be made through the respective app store according to their refund policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Use the service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Transmit harmful or malicious content</li>
              <li>Reverse engineer or attempt to extract source code</li>
              <li>Use the service to harass or harm others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Intellectual Property</h2>
            <p>
              ProSpeaker and its content, features, and functionality are owned by KindleWood Studios and are protected by copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. AI-Generated Content</h2>
            <p>
              Our AI coaching features generate content based on your inputs. While we strive for accuracy, AI-generated feedback should be used as guidance only and may not always be perfect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Limitation of Liability</h2>
            <p>
              ProSpeaker is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account if you violate these Terms. You may also delete your account at any time through the app settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">10. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. Continued use of the app after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">11. Contact Information</h2>
            <p>
              For questions about these Terms, please contact us at:{' '}
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
