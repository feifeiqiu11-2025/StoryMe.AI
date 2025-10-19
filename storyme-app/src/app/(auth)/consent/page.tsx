/**
 * Privacy Consent Page
 * Shown to new OAuth users after authentication but before account completion
 * Users must accept privacy policy before their account is fully activated
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PrivacyConsentModal from '@/components/auth/PrivacyConsentModal';

function ConsentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [checkingConsent, setCheckingConsent] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const next = searchParams.get('next') || '/dashboard';

  useEffect(() => {
    checkConsentStatus();
  }, []);

  async function checkConsentStatus() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not authenticated, redirect to login
        router.replace('/login');
        return;
      }

      // Check if user has already given consent
      const { data: userData } = await supabase
        .from('users')
        .select('privacy_consent_given')
        .eq('id', user.id)
        .single();

      if (userData?.privacy_consent_given) {
        // Already consented, redirect to destination
        router.replace(next);
      } else {
        // Need consent, show modal
        setModalOpen(true);
      }
    } catch (error) {
      console.error('Error checking consent status:', error);
      // Show modal on error (better safe than sorry)
      setModalOpen(true);
    } finally {
      setCheckingConsent(false);
    }
  }

  async function handleConsent() {
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Update user record with consent
      const { error } = await supabase
        .from('users')
        .update({
          privacy_consent_given: true,
          privacy_consent_date: new Date().toISOString(),
          privacy_consent_version: '1.0',
          terms_accepted: true,
          terms_accepted_date: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Redirect to destination
      router.replace(next);
    } catch (error) {
      console.error('Error recording consent:', error);
      alert('Failed to record consent. Please try again.');
      setLoading(false);
    }
  }

  async function handleDecline() {
    try {
      const supabase = createClient();

      // User declined consent - sign them out and redirect to login
      await supabase.auth.signOut();
      router.replace('/login?message=consent_required');
    } catch (error) {
      console.error('Error signing out:', error);
      router.replace('/login');
    }
  }

  if (checkingConsent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <PrivacyConsentModal
        isOpen={modalOpen}
        onConsent={handleConsent}
        onDecline={handleDecline}
        loading={loading}
      />
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <ConsentPageContent />
    </Suspense>
  );
}
