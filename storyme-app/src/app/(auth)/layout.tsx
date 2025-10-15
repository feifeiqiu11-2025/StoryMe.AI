/**
 * Layout for authentication pages
 * Provides a centered card layout for login/signup
 */

import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">StoryMe</h1>
          <p className="text-gray-600">Create personalized children's storybooks</p>
        </div>
        {children}
      </div>
    </div>
  );
}
