/**
 * Legacy Story Route - Redirects to /stories/[id]
 * This route is deprecated - use /stories/[id] instead
 */

import { redirect } from 'next/navigation';

export default function LegacyStoryPage({ params }: { params: { id: string } }) {
  redirect(`/stories/${params.id}`);
}
