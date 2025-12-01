'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'feifei_qiu@hotmail.com';

/**
 * Admin page to generate PDF back cover as HTML
 * Screenshot this page at A5 ratio (420x595) and save as /public/images/pdf-back-cover.png
 */
export default function PdfBackCoverPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();

      if (!supabaseUser) {
        router.push('/login');
        return;
      }

      setUser(supabaseUser);

      if (supabaseUser.email !== ADMIN_EMAIL) {
        router.push('/dashboard');
      }
    };
    loadUser();
  }, [router]);

  const downloadAsImage = async () => {
    if (!contentRef.current) return;

    try {
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#F9FAFB',
        logging: false,
        width: 420,
        height: 595,
      });

      const link = document.createElement('a');
      link.download = 'pdf-back-cover.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Image generation error:', error);
      alert('Failed to generate image. Please try again.');
    }
  };

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Instructions */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">PDF Back Cover Generator</h1>
          <p className="text-gray-600 text-sm mb-4">
            This page generates the back cover for PDF storybooks.
            Download as PNG and replace <code className="bg-gray-100 px-1 rounded">/public/images/pdf-back-cover.png</code>
          </p>
          <div className="flex gap-4">
            <button
              onClick={downloadAsImage}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Download as PNG
            </button>
            <p className="text-sm text-gray-500 self-center">
              Size: 420x595px (A5 ratio)
            </p>
          </div>
        </div>

        {/* Preview with exact A5 dimensions */}
        <div className="flex justify-center">
          <div
            ref={contentRef}
            style={{
              width: '420px',
              height: '595px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
            className="bg-[#F9FAFB] p-5 flex flex-col shadow-xl"
          >
            {/* Header */}
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-2xl">📚</span>
                <h1 className="text-xl font-bold text-gray-800">
                  Kindle<span className="text-orange-500">Wood</span> Families
                </h1>
                <span className="text-2xl">✨</span>
              </div>
              <p className="text-xs text-gray-500 italic">
                Where Imagination Grows into Learning
              </p>
            </div>

            {/* Two Columns */}
            <div className="flex gap-3 flex-1">
              {/* Left Column - Kids App */}
              <div className="flex-1 bg-white rounded-xl p-3 flex flex-col border-t-4 border-blue-500">
                <div className="text-center mb-3 pb-2 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-blue-600 mb-0.5">KindleWood Kids App</h2>
                  <p className="text-[10px] text-gray-500">Free Mobile App for Ages 3-12</p>
                </div>

                {/* QR Code */}
                <div className="flex justify-center mb-3">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-1 bg-white rounded-lg overflow-hidden relative border border-gray-200">
                      <Image
                        src="/images/qr-kindlewood-ios.png"
                        alt="App Store QR"
                        fill
                        className="object-contain p-1"
                      />
                    </div>
                    <p className="text-[8px] text-gray-400">Scan to download</p>
                  </div>
                </div>

                {/* Features */}
                <div className="flex-1 space-y-1.5 text-[9px] text-gray-700">
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">📖</span>
                    <span>Read personalized stories with your child as the hero</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">🎧</span>
                    <span>Listen to stories with AI or family narration</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">🔤</span>
                    <span>Tap-to-hear words for vocabulary learning</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">👶</span>
                    <span>Manage kids profiles for personalized experience</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">🎯</span>
                    <span>Set reading goals and track progress</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">🎮</span>
                    <span>Play learning games and earn badges</span>
                  </div>
                </div>
              </div>

              {/* Right Column - Studio App */}
              <div className="flex-1 bg-white rounded-xl p-3 flex flex-col border-t-4 border-purple-500">
                <div className="text-center mb-3 pb-2 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-purple-600 mb-0.5">KindleWood Studio</h2>
                  <p className="text-[10px] text-gray-500">Create Stories on Any Device</p>
                </div>

                {/* QR Code */}
                <div className="flex justify-center mb-3">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-1 bg-white rounded-lg overflow-hidden relative border border-gray-200">
                      <Image
                        src="/images/qr-kindlewood-studio.png"
                        alt="Studio QR"
                        fill
                        className="object-contain p-1"
                      />
                    </div>
                    <p className="text-[8px] text-gray-400">Scan to open Studio</p>
                  </div>
                </div>

                {/* Features */}
                <div className="flex-1 space-y-1.5 text-[9px] text-gray-700">
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">✏️</span>
                    <span>Create custom storybooks with AI illustrations</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">📷</span>
                    <span>Your child becomes the hero of every story</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">🎙️</span>
                    <span>Record your voice to narrate stories</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">🎧</span>
                    <span>One-tap publish to Spotify podcast</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">📱</span>
                    <span>Sync stories to Kids App instantly</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px]">🌐</span>
                    <span>Bilingual support (English & Chinese)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-3 pt-2 border-t border-gray-200">
              <p className="text-[8px] text-gray-400">© 2025 KindleWood Studio. All rights reserved.</p>
              <p className="text-[10px] text-purple-600 font-medium mt-0.5">Admin@KindleWoodStudio.AI</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
