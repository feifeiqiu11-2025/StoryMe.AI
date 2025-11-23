'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

// Story cover images - using real community stories
const STORY_COVERS = {
  astronaut: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762485155281.png', // Connor's Taekwondo
  chef: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762997800987.png', // Carter's Soccer
  doctor: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1762998310307.png', // Hospital
  firefighter: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/ce3fd991-04fc-4842-bfe1-6eaeceb9e59f/covers/1763144123894.png', // Firefighters
  artist: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/d7ca9615-06fc-449a-bd45-cb5006971619/covers/1763110054393.png', // Emma's Hawaiian
  pilot: 'https://qxeiajnmprinwydlozlq.supabase.co/storage/v1/object/public/generated-images/98bfdbb1-4098-4098-a433-14adede6122c/covers/1763149800245.png', // Teachers
};

// QR code and image paths (save images to public/images folder)
const QR_APP_STORE = '/images/qr-kindlewood-ios.png';
const QR_STUDIO = '/images/qr-kindlewood-studio.png';
const QR_COMMUNITY = '/images/qr-community.png';
const APP_PREVIEW = '/images/app-store-preview.png';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'feifei_qiu@hotmail.com';

export default function AdminPosterPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'english' | 'chinese'>('english');
  const posterRef = useRef<HTMLDivElement>(null);

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

  const downloadPDF = async () => {
    if (!posterRef.current) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      // Capture using html2canvas
      const canvas = await html2canvas(posterRef.current, {
        scale: 4, // Higher resolution for print clarity
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f3f4f6',
        logging: false,
      });

      // Calculate dimensions for A4
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      // If image is taller than page, scale it down
      if (imgHeight > pageHeight) {
        const scaleFactor = pageHeight / imgHeight;
        const scaledWidth = imgWidth * scaleFactor;
        const xOffset = (imgWidth - scaledWidth) / 2;
        pdf.addImage(imgData, 'PNG', xOffset, 0, scaledWidth, pageHeight);
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      }

      pdf.save(`kindlewood-poster-${activeTab}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
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
    <>

      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Tab Switcher */}
          <div className="flex justify-center mb-6 print:hidden">
          <div className="bg-white rounded-full p-1 ">
            <button
              onClick={() => setActiveTab('english')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                activeTab === 'english'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              English Version
            </button>
            <button
              onClick={() => setActiveTab('chinese')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                activeTab === 'chinese'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              中文版本
            </button>
          </div>
        </div>

        {/* Print/Download Button */}
        <div className="flex justify-center mb-4 print:hidden">
          <button
            onClick={downloadPDF}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full font-medium  hover: transition-all flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save as PDF
          </button>
        </div>

        {/* Poster Content */}
        <div ref={posterRef} id="poster-content">
          {activeTab === 'english' ? <EnglishPoster /> : <ChinesePoster />}
        </div>
      </div>
    </div>
    </>
  );
}

function EnglishPoster() {
  return (
    <div className="relative bg-gradient-to-br from-[#FFF8F0] via-[#F0F4FF] to-[#E8FFF5] rounded-3xl  overflow-hidden max-w-4xl mx-auto" style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
      {/* Decorative elements */}
      <div className="absolute top-6 left-6 text-7xl opacity-40 rotate-12">⭐</div>
      <div className="absolute top-32 right-16 text-4xl opacity-30 -rotate-12">✨</div>
      <div className="absolute bottom-60 left-8 text-5xl opacity-20 rotate-6">🌟</div>
      <div className="absolute top-1/3 right-8 text-3xl opacity-25">📚</div>
      <div className="absolute bottom-32 right-20 text-4xl opacity-20 -rotate-6">🎨</div>

      {/* Main Content */}
      <div className="relative z-10 p-8 md:p-12">
        {/* Hero Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-[#3B5FFF] via-[#8B5CF6] to-[#EC4899] bg-clip-text text-transparent mb-2">
            KindleWood Families
          </h1>
          <p className="text-base text-gray-600 mt-1 italic">
            Where Imagination Grows into Learning — Read, Listen, and Learn Anywhere
          </p>
        </div>

        {/* Kids App Section */}
        <div className="relative mb-8">
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200 transform -rotate-1 hover:rotate-0 transition-transform">
            {/* Highlight banner */}
            <div className="absolute -top-3 left-6 bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md">
              📱 Free Mobile App for Kids
            </div>

            <div className="flex items-start gap-4 mt-2">
              {/* App Store Screenshot */}
              <div className="flex-shrink-0 w-48 h-44 rounded-xl overflow-hidden relative">
                <Image src="/images/app-store-preview.png" alt="KindleWood Kids App" fill className="object-cover object-top" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xl font-bold text-[#1D4ED8]">KindleWood Kids App</h2>
                  <span className="bg-gradient-to-r from-[#059669] to-[#047857] text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                    FREE 6 months
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-2 font-medium">
                  Read and learn in the most fun, interactive way! <span className="text-xs text-purple-600">(Ages 3-12)</span>
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="bg-blue-100 px-2 py-1 rounded-full text-xs font-medium">Cool Jobs</span>
                  <span className="bg-purple-100 px-2 py-1 rounded-full text-xs font-medium">Sports</span>
                  <span className="bg-pink-100 px-2 py-1 rounded-full text-xs font-medium">Adventure</span>
                  <span className="bg-yellow-100 px-2 py-1 rounded-full text-xs font-medium">Chinese Stories 😆</span>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm text-gray-800">
                  <span>🎧 Listen to stories</span>
                  <span>📖 Learn new facts</span>
                  <span>🔤 Tap-to-read words</span>
                  <span>🎯 Set reading goals</span>
                  <span>📊 Track progress</span>
                </div>
              </div>
            </div>

            {/* QR */}
            <div className="absolute -bottom-4 -right-2 bg-white rounded-xl p-2 shadow-lg border border-gray-200 transform rotate-3">
              <div className="w-28 h-28 rounded flex items-center justify-center">
                <Image src="/images/qr-kindlewood-ios.png" alt="App Store QR" width={112} height={112} className="rounded" />
              </div>
              <p className="text-[10px] text-center mt-1 font-medium text-gray-600 leading-tight">Scan to Download<br/>from App Store</p>
            </div>
          </div>
        </div>

        {/* Studio Section - HIGHLIGHTED */}
        <div className="relative ml-4 md:ml-8 mb-8">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-6 shadow-lg border border-purple-200 transform rotate-1 hover:rotate-0 transition-transform">
            {/* Highlight banner */}
            <div className="absolute -top-3 left-6 bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md">
              ✨ Turn Your Child into a Storyteller!
            </div>

            <div className="mt-4">
              <h2 className="text-2xl font-bold text-[#6D28D9] mb-1">🎨 KindleWood Studio</h2>
              <p className="text-gray-700 mb-3 font-medium text-sm">
                Kids don't just read stories — they CREATE their own with imagination, their voice, and endless creativity!
              </p>

              <div className="grid md:grid-cols-2 gap-2 mb-4">
                <div>
                  <p className="font-semibold text-gray-800 text-sm mb-2">You can:</p>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>✏️ Create custom storybooks</p>
                    <p>🤖 Add AI narration</p>
                    <p>🎙️ Record your own voice</p>
                    <p>🔊 Hear your voice tell stories</p>
                    <p>🧡 Build confident storytellers</p>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm mb-2">🎧 Highlights:</p>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>📣 <strong>One-tap publish to Spotify</strong></p>
                    <p className="text-xs text-gray-600 ml-4">Listen in the car, at bedtime ❤️</p>
                    <p>📱 Sync to Kids App</p>
                    <p className="text-xs text-gray-600 ml-4">Tap-to-read · Bilingual</p>
                  </div>
                </div>
              </div>

              <div className="inline-block bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white px-4 py-2 rounded-full text-sm font-bold shadow-md">
                🎁 2 Free Stories per user
              </div>
            </div>

            {/* Founder Story Hook - star shaped background */}
            <div className="absolute bottom-0 right-32 max-w-[180px]">
              <div className="relative">
                {/* Star background - two stars */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[140px] text-yellow-200/70 transform -rotate-12 absolute -left-2">★</span>
                  <span className="text-[100px] text-yellow-200/70 transform rotate-6 absolute right-0 top-2">★</span>
                </div>
                {/* Content */}
                <div className="relative z-10 p-4 text-center">
                  <p className="text-xs text-gray-700 leading-snug">
                    <span className="font-medium">Interested in founder story & vision?</span><br/>
                    <a href="https://www.kindlewoodstudio.ai" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline text-[11px]">https://kindlewoodstudio.ai</a><br/>
                    <a href="https://youtu.be/7ISlDfVdTdk" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline text-[11px]">https://youtu.be/7ISlDfVdTdk</a>
                  </p>
                </div>
              </div>
            </div>

            {/* Studio QR Code */}
            <div className="absolute -bottom-4 -right-2 bg-white rounded-xl p-2 shadow-lg border border-gray-200 transform rotate-3">
              <div className="w-28 h-28 bg-gray-100 rounded flex items-center justify-center">
                <Image src="/images/qr-kindlewood-studio.png" alt="Studio QR" width={112} height={112} className="rounded" />
              </div>
              <p className="text-[10px] text-center mt-1 font-medium text-gray-600 leading-tight">Open Studio to<br/>Create Your Stories</p>
            </div>
          </div>
        </div>

        {/* Community Section */}
        <div className="relative mb-8">
          <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-3xl p-6 shadow-lg border border-green-200 transform -rotate-1 hover:rotate-0 transition-transform">
            {/* Highlight banner */}
            <div className="absolute -top-3 left-6 bg-gradient-to-r from-[#059669] to-[#047857] text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md">
              🌱 501(c)(3) Non-Profit Partner
            </div>

            <div className="mt-4">
              <h2 className="text-2xl font-bold text-[#047857] mb-1">🤝 KindleWood Community</h2>
              <p className="text-gray-700 mb-3 font-medium text-sm">
                Where young creators come together to tell their stories and inspire each other
              </p>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm text-gray-700 mb-3">
                <p>📝 Story creation workshops</p>
                <p>🏆 Monthly Storyteller Challenge</p>
                <p>📚 Make physical books</p>
                <p>🎨 Little Artist Challenge</p>
                <p>🎤 Become confident storytellers</p>
              </div>

              <div className="pt-2 text-sm">
                <p className="text-gray-700 mb-1">📍 Currently available in <span className="font-semibold">Seattle area</span> (in-person workshops)</p>
                <p className="text-gray-600 text-xs">Contact: <span className="text-[#059669] font-medium">Admin@KindleWoodStudio.ai</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Story Cards Section */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-900 mb-3">📚 Popular Stories</p>
            <div className="grid grid-cols-3 gap-2">
              {/* Story Card 1 - Taekwondo */}
              <div className="bg-white rounded-lg overflow-hidden ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.astronaut} alt="Taekwondo" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">Taekwondo</p>
              </div>
              {/* Story Card 2 - Soccer */}
              <div className="bg-white rounded-lg overflow-hidden ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.chef} alt="Soccer" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">Soccer</p>
              </div>
              {/* Story Card 3 - Hospital */}
              <div className="bg-white rounded-lg overflow-hidden ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.doctor} alt="Hospital" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">Hospital</p>
              </div>
              {/* Story Card 4 - Firefighters */}
              <div className="bg-white rounded-lg overflow-hidden ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.firefighter} alt="Firefighters" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">Firefighters</p>
              </div>
              {/* Story Card 5 - Hawaiian */}
              <div className="bg-white rounded-lg overflow-hidden ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.artist} alt="Hawaiian" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">Hawaiian</p>
              </div>
              {/* Story Card 6 - Teachers */}
              <div className="bg-white rounded-lg overflow-hidden ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.pilot} alt="Teachers" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">Teachers</p>
              </div>
            </div>
        </div>

        {/* Pricing footer */}
        <div className="text-center pt-4 border-t border-gray-200/50">
          <p className="text-sm font-semibold text-gray-800 mb-2">🔥 Pricing</p>
          <div className="flex justify-center gap-6 text-xs text-gray-700">
            <div>
              <p className="font-medium">📱 KindleWood Kids App</p>
              <p>Completely free for 6 months</p>
              <p className="text-gray-500">No subscription · No tricks</p>
            </div>
            <div>
              <p className="font-medium">🖥 KindleWood Studio</p>
              <p>2 free stories</p>
              <p className="text-gray-500">Pay-as-you-go after</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChinesePoster() {
  return (
    <div className="relative bg-gradient-to-br from-[#FFF8F0] via-[#F0F4FF] to-[#E8FFF5] rounded-3xl  overflow-hidden max-w-4xl mx-auto" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
      {/* Decorative elements */}
      <div className="absolute top-6 left-6 text-7xl opacity-40 rotate-12">⭐</div>
      <div className="absolute top-32 right-16 text-4xl opacity-30 -rotate-12">✨</div>
      <div className="absolute bottom-60 left-8 text-5xl opacity-20 rotate-6">🌟</div>
      <div className="absolute top-1/3 right-8 text-3xl opacity-25">📚</div>
      <div className="absolute bottom-32 right-20 text-4xl opacity-20 -rotate-6">🎨</div>

      {/* Main Content */}
      <div className="relative z-10 p-8 md:p-12">
        {/* Hero Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-[#3B5FFF] via-[#8B5CF6] to-[#EC4899] bg-clip-text text-transparent mb-2">
            KindleWood Families
          </h1>
          <p className="text-base text-gray-600 mt-1 italic">
            让孩子在想象力和创造力中学习并成长
          </p>
        </div>

        {/* Kids App Section */}
        <div className="relative mb-8">
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-200 transform -rotate-1 hover:rotate-0 transition-transform">
            {/* Highlight banner */}
            <div className="absolute -top-3 left-6 bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md">
              📱 免费儿童手机App
            </div>

            <div className="flex items-start gap-4 mt-2">
              {/* App Store Screenshot */}
              <div className="flex-shrink-0 w-48 h-44 rounded-xl overflow-hidden relative">
                <Image src="/images/app-store-preview.png" alt="KindleWood Kids App" fill className="object-cover object-top" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xl font-bold text-[#1D4ED8]">KindleWood Kids App</h2>
                  <span className="bg-gradient-to-r from-[#059669] to-[#047857] text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                    半年免费
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-2 font-medium">
                  用最有趣、最互动的方式阅读和学习！<span className="text-xs text-purple-600">(3-12岁)</span>
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="bg-blue-100 px-2 py-1 rounded-full text-xs font-medium">Cool Jobs 职业</span>
                  <span className="bg-purple-100 px-2 py-1 rounded-full text-xs font-medium">Sports 体育</span>
                  <span className="bg-pink-100 px-2 py-1 rounded-full text-xs font-medium">Adventure 冒险</span>
                  <span className="bg-yellow-100 px-2 py-1 rounded-full text-xs font-medium">中文故事 😆</span>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm text-gray-800">
                  <span>🎧 听故事</span>
                  <span>📖 学知识</span>
                  <span>🔤 点读学单词</span>
                  <span>🎯 制定阅读目标</span>
                  <span>📊 跟踪阅读进度</span>
                </div>
              </div>
            </div>

            {/* QR */}
            <div className="absolute -bottom-4 -right-2 bg-white rounded-xl p-2 shadow-lg border border-gray-200 transform rotate-3">
              <div className="w-28 h-28 rounded flex items-center justify-center">
                <Image src="/images/qr-kindlewood-ios.png" alt="App Store QR" width={112} height={112} className="rounded" />
              </div>
              <p className="text-[10px] text-center mt-1 font-medium text-gray-600 leading-tight">扫码下载<br/>App Store</p>
            </div>
          </div>
        </div>

        {/* Studio Section - HIGHLIGHTED */}
        <div className="relative ml-4 md:ml-8 mb-8">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-6 shadow-lg border border-purple-200 transform rotate-1 hover:rotate-0 transition-transform">
            {/* Highlight banner */}
            <div className="absolute -top-3 left-6 bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md">
              ✨ 想让孩子成为 Creator 和 Storyteller？
            </div>

            <div className="mt-4">
              <h2 className="text-2xl font-bold text-[#6D28D9] mb-1">🎨 KindleWood Studio</h2>
              <p className="text-gray-700 mb-3 font-medium text-sm">
                孩子不只"读故事" — 还能用想象力、自己的声音，创造属于自己的故事！
              </p>

              <div className="grid md:grid-cols-2 gap-2 mb-4">
                <div>
                  <p className="font-semibold text-gray-800 text-sm mb-2">你可以：</p>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>✏️ 自由创作故事书</p>
                    <p>🤖 用 AI Audio 讲故事</p>
                    <p>🎙️ 录制孩子/父母声音</p>
                    <p>🔊 听自己的声音讲故事</p>
                    <p>🧡 培养自信 Storyteller</p>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm mb-2">🎧 亮点功能：</p>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>📣 <strong>一键发布到 Spotify</strong></p>
                    <p className="text-xs text-gray-600 ml-4">上学路上、车里、睡前随时听 ❤️</p>
                    <p>📱 同步到 Kids App</p>
                    <p className="text-xs text-gray-600 ml-4">点读学词 · 双语阅读</p>
                  </div>
                </div>
              </div>

              <div className="inline-block bg-gradient-to-r from-[#FFCA5F] to-[#F59E0B] text-white px-4 py-2 rounded-full text-sm font-bold ">
                🎁 每人免费创作 2 本故事
              </div>
            </div>

            {/* Founder Story Hook - star shaped background */}
            <div className="absolute bottom-0 right-32 max-w-[180px]">
              <div className="relative">
                {/* Star background - two stars */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[140px] text-yellow-200/70 transform -rotate-12 absolute -left-2">★</span>
                  <span className="text-[100px] text-yellow-200/70 transform rotate-6 absolute right-0 top-2">★</span>
                </div>
                {/* Content */}
                <div className="relative z-10 p-4 text-center">
                  <p className="text-xs text-gray-700 leading-snug">
                    <span className="font-medium">想了解创始人故事和愿景？</span><br/>
                    <a href="https://www.kindlewoodstudio.ai" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline text-[11px]">https://kindlewoodstudio.ai</a><br/>
                    <a href="https://youtu.be/7ISlDfVdTdk" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline text-[11px]">https://youtu.be/7ISlDfVdTdk</a>
                  </p>
                </div>
              </div>
            </div>

            {/* Studio QR Code */}
            <div className="absolute -bottom-4 -right-2 bg-white rounded-xl p-2 shadow-lg border border-gray-200 transform rotate-3">
              <div className="w-28 h-28 bg-gray-100 rounded flex items-center justify-center">
                <Image src="/images/qr-kindlewood-studio.png" alt="Studio QR" width={112} height={112} className="rounded" />
              </div>
              <p className="text-[10px] text-center mt-1 font-medium text-gray-600 leading-tight">打开 Studio<br/>创作你的故事</p>
            </div>
          </div>
        </div>

        {/* Community Section */}
        <div className="relative mb-8">
          <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-3xl p-6 shadow-lg border border-green-200 transform -rotate-1 hover:rotate-0 transition-transform">
            {/* Highlight banner */}
            <div className="absolute -top-3 left-6 bg-gradient-to-r from-[#059669] to-[#047857] text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md">
              🌱 501(c)(3) 非营利合作伙伴
            </div>

            <div className="mt-4 flex items-start gap-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[#047857] mb-1">🤝 KindleWood Community</h2>
                <p className="text-gray-700 mb-3 font-medium text-sm">
                  小小创作者们在这里讲述自己的故事，互相激励和成长
                </p>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm text-gray-700 mb-3">
                  <p>📝 故事创作工作坊</p>
                  <p>🏆 月度故事家挑战赛</p>
                  <p>📚 制作实体书</p>
                  <p>🎨 小小艺术家挑战赛</p>
                  <p>🎤 培养自信故事讲述者</p>
                </div>
              </div>

              {/* WeChat QR */}
              <div className="flex-shrink-0 bg-white rounded-xl p-3 shadow-md border border-gray-200">
                <div className="w-24 h-24 rounded flex items-center justify-center mb-2">
                  <Image src="/images/qr-community.png" alt="WeChat QR" width={96} height={96} className="rounded" />
                </div>
                <p className="text-[10px] text-center font-medium text-gray-600 leading-tight">扫微信二维码<br/>加入社区</p>
                <p className="text-[9px] text-center text-gray-400 mt-1">更多注册方式<br/>即将推出</p>
              </div>
            </div>
          </div>
        </div>

        {/* Story Cards Section */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-900 mb-3">📚 热门故事</p>
            <div className="grid grid-cols-3 gap-2">
              {/* Story Card 1 - Taekwondo */}
              <div className="bg-white rounded-lg overflow-hidden  ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.astronaut} alt="跆拳道" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">跆拳道</p>
              </div>
              {/* Story Card 2 - Soccer */}
              <div className="bg-white rounded-lg overflow-hidden  ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.chef} alt="足球" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">足球</p>
              </div>
              {/* Story Card 3 - Hospital */}
              <div className="bg-white rounded-lg overflow-hidden  ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.doctor} alt="医院" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">医院</p>
              </div>
              {/* Story Card 4 - Firefighters */}
              <div className="bg-white rounded-lg overflow-hidden  ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.firefighter} alt="消防员" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">消防员</p>
              </div>
              {/* Story Card 5 - Hawaiian */}
              <div className="bg-white rounded-lg overflow-hidden  ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.artist} alt="夏威夷" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">夏威夷</p>
              </div>
              {/* Story Card 6 - Teachers */}
              <div className="bg-white rounded-lg overflow-hidden  ">
                <div className="w-full aspect-square relative">
                  <Image src={STORY_COVERS.pilot} alt="老师" fill className="object-cover" />
                </div>
                <p className="text-xs font-medium text-gray-700 truncate text-center py-1">老师</p>
              </div>
            </div>
        </div>

        {/* Pricing footer */}
        <div className="text-center pt-4 border-t border-gray-200/50">
          <p className="text-sm font-semibold text-gray-800 mb-2">🔥 价格说明</p>
          <div className="flex justify-center gap-6 text-xs text-gray-700">
            <div>
              <p className="font-medium">📱 KindleWood Kids App</p>
              <p>半年内完全免费</p>
              <p className="text-gray-500">无订阅 · 无套路</p>
            </div>
            <div>
              <p className="font-medium">🖥 KindleWood Studio</p>
              <p>免费创作 2 本</p>
              <p className="text-gray-500">超出按需付费</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
