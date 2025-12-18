import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support - ProSpeaker',
  description: 'Help and Support for the ProSpeaker mobile application by KindleWood Studios',
};

export default function ProSpeakerSupportPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Help & Support</h1>
        <p className="text-slate-400 mb-8">ProSpeaker by KindleWood Studios</p>

        <div className="space-y-8 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Frequently Asked Questions</h2>

            <div className="space-y-6">
              <div className="bg-slate-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-white mb-2">How does the 1-Minute Workout work?</h3>
                <p>
                  Each day, you&apos;ll receive a new speaking prompt. Tap the microphone button, speak your response, and receive instant AI-powered feedback on your pronunciation, pace, and communication style.
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-white mb-2">Who is Emma, the AI Coach?</h3>
                <p>
                  Emma is your personal AI speaking coach. You can have natural voice conversations with Emma to practice English speaking in a supportive, judgment-free environment. Emma provides real-time feedback and encouragement.
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-white mb-2">What is Listen & Read?</h3>
                <p>
                  Listen & Read delivers daily curated news articles that you can read along with AI narration. This helps improve your listening comprehension and pronunciation by exposing you to natural English speech patterns.
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-white mb-2">How does Interview Prep work?</h3>
                <p>
                  Practice answering common behavioral interview questions. You&apos;ll receive prompts like &ldquo;Tell me about a time when...&rdquo; and get feedback on your responses to help you prepare for job interviews.
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-white mb-2">How is my pronunciation score calculated?</h3>
                <p>
                  Your pronunciation score is powered by Azure Cognitive Services speech assessment technology. It analyzes your speech for accuracy, fluency, and completeness compared to native speakers.
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-white mb-2">Is my voice data stored?</h3>
                <p>
                  Your voice recordings are processed in real-time to provide feedback and are not permanently stored on our servers. We take your privacy seriously. See our{' '}
                  <a href="/apps/pro-speaker/privacy" className="text-blue-400 hover:underline">
                    Privacy Policy
                  </a>{' '}
                  for more details.
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-white mb-2">How do I cancel my subscription?</h3>
                <p>
                  ProSpeaker offers a one-time lifetime purchase. If you need to request a refund, please contact Apple Support through the App Store, or reach out to us directly.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Contact Us</h2>
            <div className="bg-slate-800 rounded-lg p-6">
              <p className="mb-4">
                Can&apos;t find the answer you&apos;re looking for? We&apos;re here to help!
              </p>
              <p className="mb-4">
                Send us an email at:{' '}
                <a href="mailto:admin@KindleWoodStudio.ai" className="text-blue-400 hover:underline font-medium">
                  admin@KindleWoodStudio.ai
                </a>
              </p>
              <p className="text-slate-400 text-sm">
                We typically respond within 24-48 hours.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Troubleshooting</h2>
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-white mb-2">Microphone not working?</h3>
                <p>
                  Make sure you&apos;ve granted ProSpeaker permission to access your microphone. Go to Settings &gt; ProSpeaker &gt; Microphone and ensure it&apos;s enabled.
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-white mb-2">App running slowly?</h3>
                <p>
                  Try closing and reopening the app. If the issue persists, ensure you have a stable internet connection as our AI features require connectivity.
                </p>
              </div>

              <div className="bg-slate-800 rounded-lg p-5">
                <h3 className="text-lg font-medium text-white mb-2">Sign-in issues?</h3>
                <p>
                  If you&apos;re having trouble signing in with Google or Apple, try signing out of the respective account on your device and signing back in. If issues persist, contact us.
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-700 text-center text-slate-500">
          <p className="mb-2">
            <a href="/apps/pro-speaker/privacy" className="hover:text-slate-300 mr-4">Privacy Policy</a>
            <a href="/apps/pro-speaker/terms" className="hover:text-slate-300">Terms of Service</a>
          </p>
          <p>&copy; {new Date().getFullYear()} KindleWood Studios. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
