/**
 * Community Stories Page (Dashboard)
 * Body lives in the shared <CommunityStoriesView /> so this stays in sync with /stories.
 */

'use client';

import { Suspense } from 'react';
import CommunityStoriesView from '@/components/story/CommunityStoriesView';

export default function CommunityStoriesPage() {
  return (
    <Suspense>
      <CommunityStoriesView />
    </Suspense>
  );
}
