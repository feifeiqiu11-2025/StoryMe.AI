/**
 * Christmas Promo Poster Page
 * /admin/poster/xmas
 *
 * Festive promotional poster for KindleWood Christmas campaign
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import html2canvas from 'html2canvas';

// Story ID for Christmas story
const XMAS_STORY_ID = 'e0c9c4ab-3357-4f83-b32f-cc48df3bc5af';

interface Scene {
  id: string;
  sceneNumber: number;
  caption: string;
  imageUrl: string | null;
}

interface Story {
  id: string;
  title: string;
  coverImageUrl: string | null;
  scenes: Scene[];
}

export default function XmasPosterPage() {
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStory();
  }, []);

  const fetchStory = async () => {
    try {
      const response = await fetch(`/api/stories/public/${XMAS_STORY_ID}`);
      if (response.ok) {
        const data = await response.json();
        setStory(data.story);
      }
    } catch (error) {
      console.error('Error fetching story:', error);
    } finally {
      setLoading(false);
    }
  };

  const [downloading, setDownloading] = useState(false);

  const downloadAsPNG = async () => {
    if (!posterRef.current) return;

    setDownloading(true);
    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 4, // Higher resolution for print clarity
        useCORS: true,
        allowTaint: false, // Must be false for toDataURL to work with CORS
        backgroundColor: '#ffffff',
        logging: true, // Enable logging for debugging
        proxy: undefined, // No proxy needed if CORS headers are set
      });

      const link = document.createElement('a');
      link.download = `kindlewood-xmas-poster-${language}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating PNG:', error);
      alert('Failed to generate PNG. Check browser console for details.');
    } finally {
      setDownloading(false);
    }
  };

  // Get scenes 12, 13, and 15
  const scene12 = story?.scenes?.find(s => s.sceneNumber === 12);
  const scene13 = story?.scenes?.find(s => s.sceneNumber === 13);
  const scene15 = story?.scenes?.find(s => s.sceneNumber === 15);
  const coverImageUrl = story?.coverImageUrl; // Use actual cover image from DB

  // Chinese translations for captions (translate on the fly)
  const getChineseCaption = (sceneNumber: number, englishCaption: string) => {
    // Pre-translated captions for scenes 12, 13 and 15
    const translations: Record<number, string> = {
      12: '他们走进一个闪闪发光的冰洞穴，冰柱像钻石一样闪耀着。北极星的光芒照亮了前方的道路。',
      13: '最后，他们到达了圣诞老人的工作坊。里面充满了玩具、精灵，还有一棵巨大的、闪闪发光的圣诞树。',
      15: '"圣诞快乐！"圣诞老人说道，挥着手。莱恩和麦克斯在北极星的带领下飞回了家，永远不会忘记这次神奇的旅程。',
    };
    return translations[sceneNumber] || englishCaption;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading Christmas story...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Christmas Promo Poster</h1>
          <div className="flex gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
            <button
              onClick={downloadAsPNG}
              disabled={downloading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {downloading ? 'Generating...' : 'Download PNG'}
            </button>
          </div>
        </div>

        {/* Poster Content */}
        <div ref={posterRef}>
          {language === 'en' ? (
            <EnglishPoster
              story={story}
              scene12={scene12}
              scene13={scene13}
              scene15={scene15}
              coverImageUrl={coverImageUrl}
              getChineseCaption={getChineseCaption}
            />
          ) : (
            <ChinesePoster
              story={story}
              scene12={scene12}
              scene13={scene13}
              scene15={scene15}
              coverImageUrl={coverImageUrl}
              getChineseCaption={getChineseCaption}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface PosterProps {
  story: Story | null;
  scene12: Scene | undefined;
  scene13: Scene | undefined;
  scene15: Scene | undefined;
  coverImageUrl: string | null | undefined;
  getChineseCaption: (sceneNumber: number, caption: string) => string;
}

function EnglishPoster({ story, scene12, scene13, scene15, coverImageUrl, getChineseCaption }: PosterProps) {
  return (
    <div
      className="relative bg-gradient-to-b from-[#f0f9ff] via-[#ffffff] to-[#fef2f2] rounded-3xl overflow-hidden max-w-4xl mx-auto"
      style={{
        minHeight: '1056px', // Letter size height at 96dpi
      }}
    >
      {/* Snowy/Christmas decorative elements - repositioned to avoid overlap */}
      <div className="absolute top-6 left-32 text-4xl -rotate-6">🎄</div>
      <div className="absolute top-6 right-32 text-3xl rotate-12">❄️</div>
      <div className="absolute top-40 left-1/4 text-2xl opacity-30">❄️</div>
      <div className="absolute top-1/4 right-12 text-3xl opacity-50">🎁</div>
      <div className="absolute bottom-1/3 left-6 text-4xl opacity-40 rotate-6">⛄</div>
      <div className="absolute bottom-20 right-8 text-4xl opacity-50 -rotate-12">🎄</div>
      <div className="absolute top-1/2 right-4 text-2xl opacity-30">❄️</div>
      <div className="absolute bottom-40 left-1/3 text-xl opacity-25">✨</div>

      {/* Main Content */}
      <div className="relative z-10 p-6">
        {/* Hero Header - title and emoji on same line */}
        <div className="text-center mb-4">
          <h1 className="text-2xl md:text-3xl font-black mb-2">
            <span className="bg-gradient-to-r from-[#DC2626] via-[#B91C1C] to-[#15803D] bg-clip-text text-transparent">Present from KindleWood Santa</span> <span role="img" aria-label="Santa">🧑‍🎄</span>
          </h1>
          <p className="text-base text-gray-700 italic max-w-xl mx-auto leading-relaxed">
            Thinking about Christmas gifts? Bring your child into a magical Xmas world and create their favorite book together — <span className="text-red-600 font-bold">FOR FREE!</span>
          </p>
        </div>

        {/* Sample Xmas Book Showcase */}
        <div className="relative mb-4">
          <div className="text-center mb-2">
            <span className="inline-block bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-1.5 rounded-full text-sm font-bold transform -rotate-1">
              📚 Sample Xmas Story
            </span>
          </div>

          <h2 className="text-base font-bold text-green-700 mb-2 text-center">{story?.title || 'Christmas Adventure'}</h2>

          {/* Story cards - horizontal carousel style */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {/* Cover Card - single image, no text */}
            {coverImageUrl && (
              <div className="flex-shrink-0 bg-white rounded-lg p-1.5 border border-gray-200">
                <div className="w-32 h-40 relative rounded overflow-hidden">
                  <Image src={coverImageUrl} alt="Cover" fill className="object-cover" />
                </div>
              </div>
            )}

            {/* Scene 12 Card - booklet style */}
            {scene12?.imageUrl && (
              <div className="flex-shrink-0 bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                  <div className="w-36 h-44 relative flex-shrink-0 rounded overflow-hidden">
                    <Image src={scene12.imageUrl} alt="Scene 12" fill className="object-cover" />
                  </div>
                  <div className="w-20 py-1">
                    <p className="text-[11px] text-gray-900 leading-snug mb-1.5 font-medium">{scene12.caption}</p>
                    <p className="text-[10px] text-gray-700 leading-snug">{getChineseCaption(12, scene12.caption)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Scene 13 Card - booklet style */}
            {scene13?.imageUrl && (
              <div className="flex-shrink-0 bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                  <div className="w-36 h-44 relative flex-shrink-0 rounded overflow-hidden">
                    <Image src={scene13.imageUrl} alt="Scene 13" fill className="object-cover" />
                  </div>
                  <div className="w-20 py-1">
                    <p className="text-[11px] text-gray-900 leading-snug mb-1.5 font-medium">{scene13.caption}</p>
                    <p className="text-[10px] text-gray-700 leading-snug">{getChineseCaption(13, scene13.caption)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Scene 15 Card - booklet style */}
            {scene15?.imageUrl && (
              <div className="flex-shrink-0 bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                  <div className="w-36 h-44 relative flex-shrink-0 rounded overflow-hidden">
                    <Image src={scene15.imageUrl} alt="Scene 15" fill className="object-cover" />
                  </div>
                  <div className="w-20 py-1">
                    <p className="text-[11px] text-gray-900 leading-snug mb-1.5 font-medium">{scene15.caption}</p>
                    <p className="text-[10px] text-gray-700 leading-snug">{getChineseCaption(15, scene15.caption)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Share with Community */}
        <div className="relative mb-4 mx-2">
          <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl p-2.5 border-2 border-green-300">
            <p className="text-green-700 text-sm text-center">
              💝 <strong>Share your Xmas story</strong> with friends & family by making it public as a community story!
            </p>
          </div>
        </div>

        {/* FREE Physical Books */}
        <div className="relative mb-4">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-3 border-2 border-red-200">
            <div className="absolute -top-2.5 left-6 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-3 py-0.5 rounded-full text-xs font-bold">
              🎁 FREE Physical Books - First 10 Families!
            </div>

            <p className="text-gray-700 text-sm mb-2 mt-1">
              Create your own Xmas story with <strong className="text-red-600">your child as the character</strong> and get it printed for FREE!
            </p>

            {/* Step Flow */}
            <div className="flex items-start justify-between px-1">
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center text-gray-900 font-bold text-sm mb-1">1</div>
                <p className="text-[11px] text-gray-900 font-semibold leading-tight">Create<br/>Story</p>
              </div>
              <div className="text-red-400 text-base mt-3 font-bold">→</div>
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm mb-1">2</div>
                <p className="text-[11px] text-gray-900 font-semibold leading-tight">Export PDF<br/>(Legal Size)</p>
              </div>
              <div className="text-red-400 text-base mt-3 font-bold">→</div>
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm mb-1">3</div>
                <p className="text-[11px] text-gray-900 font-semibold leading-tight">Email PDF to<br/>Admin@KindleWoodStudio.ai</p>
              </div>
              <div className="text-red-400 text-base mt-3 font-bold">→</div>
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm mb-1">4</div>
                <p className="text-[11px] text-gray-900 font-semibold leading-tight">Pick Up<br/>Dec 6, 2025<br/>12-2pm<br/>Bellevue Square</p>
              </div>
            </div>
          </div>
        </div>

        {/* EXTRA 10 Books from Santa */}
        <div className="relative mb-4">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border-2 border-purple-200">
            <div className="absolute -top-2.5 right-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-0.5 rounded-full text-xs font-bold">
              🧑‍🎄 10 Extra Gifts from Santa & KindleWood Brothers!
            </div>

            <div className="mt-1">
              <p className="text-gray-700 text-sm mb-2">
                These are <strong className="text-purple-600">pre-made Xmas books</strong> — no need to create or contact us!
              </p>
              <div className="bg-white/60 rounded-lg p-2 text-sm text-gray-600">
                <p>📍 Just show up: <strong>Bellevue Square Mall</strong> - next to Happy Lemon Bubble Tea</p>
                <p>📅 <strong>Dec 6, 2025 • 12-2pm</strong></p>
                <p>👦👦 KindleWood Brothers will be there!</p>
                <p>⏰ First come, first serve!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2">
          <p className="text-gray-600 text-sm">
            Questions? Contact: <span className="text-red-600 font-semibold">Admin@KindleWoodStudio.ai</span>
          </p>
          <p className="text-gray-500 text-xs mt-1">
            🎄 Happy Holidays from KindleWood Studio! 🎄
          </p>
        </div>
      </div>
    </div>
  );
}

function ChinesePoster({ story, scene12, scene13, scene15, coverImageUrl, getChineseCaption }: PosterProps) {
  return (
    <div
      className="relative bg-gradient-to-b from-[#f0f9ff] via-[#ffffff] to-[#fef2f2] rounded-3xl overflow-hidden max-w-4xl mx-auto"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        minHeight: '1056px',
      }}
    >
      {/* Snowy/Christmas decorative elements */}
      <div className="absolute top-6 left-32 text-4xl -rotate-6">🎄</div>
      <div className="absolute top-6 right-32 text-3xl rotate-12">❄️</div>
      <div className="absolute top-40 left-1/4 text-2xl opacity-30">❄️</div>
      <div className="absolute top-1/4 right-12 text-3xl opacity-50">🎁</div>
      <div className="absolute bottom-1/3 left-6 text-4xl opacity-40 rotate-6">⛄</div>
      <div className="absolute bottom-20 right-8 text-4xl opacity-50 -rotate-12">🎄</div>
      <div className="absolute top-1/2 right-4 text-2xl opacity-30">❄️</div>
      <div className="absolute bottom-40 left-1/3 text-xl opacity-25">✨</div>

      {/* Main Content */}
      <div className="relative z-10 p-6">
        {/* Hero Header - title and emoji on same line */}
        <div className="text-center mb-4">
          <h1 className="text-2xl md:text-3xl font-black mb-2">
            <span className="bg-gradient-to-r from-[#DC2626] via-[#B91C1C] to-[#15803D] bg-clip-text text-transparent">KindleWood 圣诞老人的礼物</span> <span role="img" aria-label="Santa">🧑‍🎄</span>
          </h1>
          <p className="text-base text-gray-700 italic max-w-xl mx-auto leading-relaxed">
            还在想圣诞礼物送什么？带孩子进入神奇的圣诞世界，一起创作属于他们的故事书——<span className="text-red-600 font-bold">完全免费！</span>
          </p>
        </div>

        {/* Sample Xmas Book Showcase */}
        <div className="relative mb-4">
          <div className="text-center mb-2">
            <span className="inline-block bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-1.5 rounded-full text-sm font-bold transform -rotate-1">
              📚 圣诞故事示例
            </span>
          </div>

          <h2 className="text-base font-bold text-green-700 mb-2 text-center">{story?.title || '圣诞大冒险'}</h2>

          {/* Story cards - horizontal carousel style */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {/* Cover Card - single image, no text */}
            {coverImageUrl && (
              <div className="flex-shrink-0 bg-white rounded-lg p-1.5 border border-gray-200">
                <div className="w-32 h-40 relative rounded overflow-hidden">
                  <Image src={coverImageUrl} alt="封面" fill className="object-cover" />
                </div>
              </div>
            )}

            {/* Scene 12 Card - booklet style */}
            {scene12?.imageUrl && (
              <div className="flex-shrink-0 bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                  <div className="w-36 h-44 relative flex-shrink-0 rounded overflow-hidden">
                    <Image src={scene12.imageUrl} alt="第12页" fill className="object-cover" />
                  </div>
                  <div className="w-20 py-1">
                    <p className="text-[10px] text-gray-700 leading-snug mb-1.5">{scene12.caption}</p>
                    <p className="text-[11px] text-gray-900 leading-snug font-medium">{getChineseCaption(12, scene12.caption)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Scene 13 Card - booklet style */}
            {scene13?.imageUrl && (
              <div className="flex-shrink-0 bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                  <div className="w-36 h-44 relative flex-shrink-0 rounded overflow-hidden">
                    <Image src={scene13.imageUrl} alt="第13页" fill className="object-cover" />
                  </div>
                  <div className="w-20 py-1">
                    <p className="text-[10px] text-gray-700 leading-snug mb-1.5">{scene13.caption}</p>
                    <p className="text-[11px] text-gray-900 leading-snug font-medium">{getChineseCaption(13, scene13.caption)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Scene 15 Card - booklet style */}
            {scene15?.imageUrl && (
              <div className="flex-shrink-0 bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                  <div className="w-36 h-44 relative flex-shrink-0 rounded overflow-hidden">
                    <Image src={scene15.imageUrl} alt="第15页" fill className="object-cover" />
                  </div>
                  <div className="w-20 py-1">
                    <p className="text-[10px] text-gray-700 leading-snug mb-1.5">{scene15.caption}</p>
                    <p className="text-[11px] text-gray-900 leading-snug font-medium">{getChineseCaption(15, scene15.caption)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Share with Community */}
        <div className="relative mb-4 mx-2">
          <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl p-2.5 border-2 border-green-300">
            <p className="text-green-700 text-sm text-center">
              💝 <strong>分享你的圣诞故事</strong>给朋友和家人——设为公开，成为社区故事！
            </p>
          </div>
        </div>

        {/* FREE Physical Books */}
        <div className="relative mb-4">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-3 border-2 border-red-200">
            <div className="absolute -top-2.5 left-6 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-3 py-0.5 rounded-full text-xs font-bold">
              🎁 免费实体书——前10个家庭！
            </div>

            <p className="text-gray-700 text-sm mb-2 mt-1">
              创作你自己的圣诞故事，让<strong className="text-red-600">孩子成为故事主角</strong>，免费打印成实体书！
            </p>

            {/* Step Flow */}
            <div className="flex items-start justify-between px-1">
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center text-gray-900 font-bold text-sm mb-1">1</div>
                <p className="text-[11px] text-gray-900 font-semibold leading-tight">创作<br/>故事</p>
              </div>
              <div className="text-red-400 text-base mt-3 font-bold">→</div>
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm mb-1">2</div>
                <p className="text-[11px] text-gray-900 font-semibold leading-tight">导出PDF<br/>(Legal尺寸)</p>
              </div>
              <div className="text-red-400 text-base mt-3 font-bold">→</div>
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm mb-1">3</div>
                <p className="text-[11px] text-gray-900 font-semibold leading-tight">发送PDF至<br/>Admin@KindleWoodStudio.ai</p>
              </div>
              <div className="text-red-400 text-base mt-3 font-bold">→</div>
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm mb-1">4</div>
                <p className="text-[11px] text-gray-900 font-semibold leading-tight">2025/12/6<br/>12-2pm<br/>Bellevue Square<br/>领取</p>
              </div>
            </div>
          </div>
        </div>

        {/* EXTRA 10 Books from Santa */}
        <div className="relative mb-4">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border-2 border-purple-200">
            <div className="absolute -top-2.5 right-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-0.5 rounded-full text-xs font-bold">
              🧑‍🎄 圣诞老人和KindleWood兄弟额外赠送10本！
            </div>

            <div className="mt-1">
              <p className="text-gray-700 text-sm mb-2">
                这是<strong className="text-purple-600">预制的圣诞故事书</strong>——无需创作，无需联系我们！
              </p>
              <div className="bg-white/60 rounded-lg p-2 text-sm text-gray-600">
                <p>📍 直接来: <strong>Bellevue Square Mall</strong> - Happy Lemon奶茶店旁边</p>
                <p>📅 <strong>2025年12月6日 • 中午12-2点</strong></p>
                <p>👦👦 KindleWood兄弟会在现场！</p>
                <p>⏰ 先到先得！</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2">
          <p className="text-gray-600 text-sm">
            有问题? 联系: <span className="text-red-600 font-semibold">Admin@KindleWoodStudio.ai</span>
          </p>
          <p className="text-gray-500 text-xs mt-1">
            🎄 KindleWood Studio 祝您节日快乐! 🎄
          </p>
        </div>
      </div>
    </div>
  );
}
