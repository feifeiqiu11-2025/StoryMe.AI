/**
 * Usage Limit Badge Component
 * Displays current image generation limits in a user-friendly way
 */

'use client';

import { useEffect, useState } from 'react';

interface UsageLimits {
  daily: { used: number; limit: number; remaining: number };
  hourly: { used: number; limit: number; remaining: number };
  total?: { used: number; limit: number; remaining: number };
}

export function UsageLimitBadge() {
  const [limits, setLimits] = useState<UsageLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLimits();
  }, []);

  const fetchLimits = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/usage/limits');
      const data = await response.json();

      if (response.ok && data.usage) {
        setLimits(data.usage);
      } else {
        setError(data.error || 'Failed to load usage data');
      }
    } catch (err) {
      console.error('Error fetching usage limits:', err);
      setError('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-2 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  if (error || !limits) {
    return null; // Silently fail - don't show errors for non-critical feature
  }

  const dailyPercent = Math.min(100, (limits.daily.used / limits.daily.limit) * 100);
  const hourlyPercent = Math.min(100, (limits.hourly.used / limits.hourly.limit) * 100);
  const totalPercent = limits.total
    ? Math.min(100, (limits.total.used / limits.total.limit) * 100)
    : null;

  // Determine warning level
  const getWarningLevel = (percent: number) => {
    if (percent >= 90) return 'critical';
    if (percent >= 75) return 'warning';
    return 'normal';
  };

  const dailyWarning = getWarningLevel(dailyPercent);
  const totalWarning = totalPercent !== null ? getWarningLevel(totalPercent) : 'normal';

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-200">
      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
        <span className="text-lg">📊</span>
        <span>Image Generation Limits</span>
      </h3>

      {/* Trial Limit (if applicable) */}
      {limits.total && (
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="font-semibold text-gray-700">🎁 Trial Limit</span>
            <span className={`font-bold ${
              totalWarning === 'critical' ? 'text-red-600' :
              totalWarning === 'warning' ? 'text-orange-600' :
              'text-blue-600'
            }`}>
              {limits.total.remaining} / {limits.total.limit} remaining
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                totalWarning === 'critical' ? 'bg-red-500' :
                totalWarning === 'warning' ? 'bg-orange-500' :
                'bg-gradient-to-r from-blue-500 to-purple-500'
              }`}
              style={{ width: `${totalPercent}%` }}
            />
          </div>
          {totalWarning === 'critical' && (
            <p className="text-xs text-red-600 mt-2 font-medium">
              ⚠️ Trial almost complete! Upgrade to continue creating unlimited stories.
            </p>
          )}
          {totalWarning === 'warning' && (
            <p className="text-xs text-orange-600 mt-2 font-medium">
              💡 Running low on trial images. Consider upgrading soon!
            </p>
          )}
        </div>
      )}

      {/* Daily Limit */}
      <div className="mb-3">
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="text-gray-600 font-medium">📅 Today</span>
          <span className={`font-semibold ${
            dailyWarning === 'critical' ? 'text-red-600' :
            dailyWarning === 'warning' ? 'text-orange-600' :
            'text-gray-700'
          }`}>
            {limits.daily.used} / {limits.daily.limit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              dailyWarning === 'critical' ? 'bg-red-500' :
              dailyWarning === 'warning' ? 'bg-orange-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${dailyPercent}%` }}
          />
        </div>
      </div>

      {/* Hourly Limit */}
      <div>
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="text-gray-600 font-medium">⏱️ This Hour</span>
          <span className="text-gray-700 font-semibold">
            {limits.hourly.used} / {limits.hourly.limit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${hourlyPercent}%` }}
          />
        </div>
      </div>

      {/* Daily limit warning */}
      {dailyWarning === 'critical' && !limits.total && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700 font-medium">
            ⚠️ You've reached your daily limit. Try again tomorrow or upgrade for more images!
          </p>
        </div>
      )}
      {dailyWarning === 'warning' && !limits.total && (
        <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-xs text-orange-700 font-medium">
            💡 Approaching daily limit ({limits.daily.remaining} images left today)
          </p>
        </div>
      )}

      {/* Refresh button */}
      <button
        onClick={fetchLimits}
        className="mt-3 w-full text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        🔄 Refresh limits
      </button>
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function UsageLimitBadgeCompact() {
  const [limits, setLimits] = useState<UsageLimits | null>(null);

  useEffect(() => {
    fetch('/api/usage/limits')
      .then(res => res.json())
      .then(data => {
        if (data.usage) setLimits(data.usage);
      })
      .catch(console.error);
  }, []);

  if (!limits) return null;

  const remaining = limits.total?.remaining ?? limits.daily.remaining;
  const limit = limits.total?.limit ?? limits.daily.limit;
  const percent = (1 - remaining / limit) * 100;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-gray-200">
      <span className="text-xs font-medium text-gray-600">
        {remaining} / {limit} images
      </span>
      <div className="w-16 bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${
            percent >= 90 ? 'bg-red-500' :
            percent >= 75 ? 'bg-orange-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}
