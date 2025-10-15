'use client';

import { useState } from 'react';

interface StarRatingProps {
  value?: number; // Current rating (1-5)
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showValue?: boolean;
}

export default function StarRating({
  value = 0,
  onChange,
  readonly = false,
  size = 'md',
  label,
  showValue = true,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const stars = [1, 2, 3, 4, 5];
  const displayRating = hoverRating || value;

  const handleClick = (rating: number) => {
    if (!readonly && onChange) {
      onChange(rating);
    }
  };

  const getStarColor = (starIndex: number) => {
    if (displayRating >= starIndex) {
      // Filled star
      if (displayRating >= 4) return 'text-green-500';
      if (displayRating >= 3) return 'text-yellow-500';
      return 'text-orange-500';
    }
    // Empty star
    return 'text-gray-300';
  };

  return (
    <div className="flex items-center gap-2">
      {label && (
        <label className="text-sm font-medium text-gray-700 min-w-[140px]">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        {stars.map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => handleClick(star)}
            onMouseEnter={() => !readonly && setHoverRating(star)}
            onMouseLeave={() => !readonly && setHoverRating(0)}
            className={`
              ${sizeClasses[size]}
              ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
              transition-all duration-150
              ${getStarColor(star)}
            `}
            aria-label={`Rate ${star} stars`}
          >
            {displayRating >= star ? '★' : '☆'}
          </button>
        ))}
        {showValue && value > 0 && (
          <span className="ml-2 text-sm font-semibold text-gray-700">
            {value.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}
