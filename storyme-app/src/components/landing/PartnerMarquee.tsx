'use client';

import Link from 'next/link';

interface Partner {
  name: string;
  logo?: string;
  logoClassName?: string;
  href?: string;
  /** For text-based logos (no image) */
  textLogo?: React.ReactNode;
}

const partners: Partner[] = [
  {
    name: 'Avocado Montessori Academy',
    logo: '/images/avocado-logo-cropped.png',
  },
  {
    name: 'Puget Sound Children & Youth Foundation',
    textLogo: (
      <div className="text-center">
        <div
          className="font-bold text-amber-800 text-3xl leading-tight"
          style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
        >
          Puget Sound
        </div>
        <div
          className="text-amber-700 text-lg leading-tight italic"
          style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}
        >
          Children & Youth Foundation
        </div>
      </div>
    ),
  },
  {
    name: 'SteamOji Maker Academy',
    logo: '/images/steamoji-logo.png',
    href: '/workshops#steamoji',
  },
  {
    name: 'Dream Tree Preschool',
    logo: '/images/dreamtree-logo.png',
    logoClassName: 'h-22',
  },
];

function PartnerItem({ partner }: { partner: Partner }) {
  const content = partner.textLogo ? (
    <div className="flex items-center justify-center h-16">{partner.textLogo}</div>
  ) : (
    <img
      src={partner.logo}
      alt={partner.name}
      className={`${partner.logoClassName || 'h-16'} w-auto object-contain`}
    />
  );

  if (partner.href) {
    return (
      <Link
        href={partner.href}
        className="flex items-center justify-center px-10 shrink-0 hover:opacity-80 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-center justify-center px-10 shrink-0">
      {content}
    </div>
  );
}

export default function PartnerMarquee() {
  return (
    <>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="relative overflow-hidden py-4">
        {/* Scrolling track — two copies for seamless loop */}
        <div
          className="flex items-center"
          style={{ animation: 'marquee 30s linear infinite' }}
          onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = 'paused')}
          onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = 'running')}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center shrink-0">
              {partners.map((partner) => (
                <PartnerItem key={`${copy}-${partner.name}`} partner={partner} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
