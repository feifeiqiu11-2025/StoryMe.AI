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
            <h1 className="text-4xl font-bold mb-2 hover:opacity-80 transition-opacity cursor-pointer">
              📚 Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600">Me</span> ✨
            </h1>
          </Link>
          <span className="inline-block text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-full mb-2">BETA</span>
          <p className="text-gray-600">Create personalized children's storybooks</p>
        </div>
        {children}
      </div>
    </div>
  );
}
