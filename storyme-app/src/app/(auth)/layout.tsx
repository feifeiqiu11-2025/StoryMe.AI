/**
 * Layout for authentication pages
 * Provides a centered card layout for login/signup
 */

import { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold mb-2 hover:opacity-80 transition-opacity cursor-pointer text-gray-900">
              📚 Kindle<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600">Wood</span> Studio ✨
            </h1>
          </Link>
          <p className="text-gray-600">Create personalized children's storybooks</p>
        </div>
        {children}
      </div>
    </div>
  );
}
