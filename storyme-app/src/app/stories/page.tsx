/**
 * Public Stories Gallery Page
 * Browse all public stories from the community.
 * Body lives in the shared <CommunityStoriesView /> so /stories and /community-stories stay in sync.
 */

'use client';

import { Suspense } from 'react';
import LandingNav from '@/components/navigation/LandingNav';
import CommunityStoriesView from '@/components/story/CommunityStoriesView';

export default function PublicStoriesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />
      <Suspense>
        <CommunityStoriesView />
      </Suspense>
    </div>
  );
}
