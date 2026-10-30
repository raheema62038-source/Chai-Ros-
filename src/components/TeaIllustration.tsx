import React from 'react';
import { TeaProductItem } from '../data/teaCatalog';

interface TeaIllustrationProps {
  variant: TeaProductItem['illustrationVariant'] | 'hero_kulhad';
  className?: string;
}

export const TeaIllustration: React.FC<TeaIllustrationProps> = ({
  variant,
  className = 'w-full h-full',
}) => {
  if (variant === 'hero_kulhad') {
    return (
      <div
        className={`relative overflow-hidden bg-[#231915] flex items-center justify-center ${className}`}
        role="img"
        aria-label="भाप उठती हुई पारंपरिक कुल्हड़ मसाला चाय और भारतीय मसाले"
      >
        <svg
          viewBox="0 0 800 500"
          className="w-full h-full object-cover"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="warmGlow" cx="50%" cy="55%" r="60%">
              <stop offset="0%" stopColor="#8C371B" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#3B2318" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#1B1310" stopOpacity="1" />
            </radialGradient>
            <linearGradient id="kulhadClay" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C85D37" />
              <stop offset="60%" stopColor="#9E3B1B" />
              <stop offset="100%" stopColor="#6D250E" />
            </linearGradient>
            <linearGradient id="chaiLiquid" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D98A4E" />
              <stop offset="50%" stopColor="#E6A165" />
              <stop offset="100%" stopColor="#B86B35" />
            </linearGradient>
            <linearGradient id="brassTray" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A67C37" />
              <stop offset="50%" stopColor="#E2B86B" />
              <stop offset="100%" stopColor="#8A6224" />
            </linearGradient>
          </defs>

          {/* Ambient warm studio backdrop */}
          <rect width="800" height="500" fill="url(#warmGlow)" />

          {/* Architectural arch silhouette in background */}
          <path
            d="M210 500V210C210 105 590 105 590 210V500H210Z"
            fill="#2A1D17"
            stroke="#4B3429"
            strokeWidth="1.5"
          />

          {/* Brass Parat / Tray base */}
          <ellipse cx="400" cy="405" rx="220" ry="34" fill="#17100D" opacity="0.65" />
          <ellipse
            cx="400"
            cy="396"
            rx="200"
            ry="28"
            fill="url(#brassTray)"
            stroke="#F4D390"
            strokeWidth="1.5"
          />
          <ellipse cx="400" cy="393" rx="175" ry="20" fill="#593B1D" opacity="0.65" />

          {/* Cinnamon sticks (दालचीनी) on left */}
          <g transform="translate(230, 378) rotate(-14)">
            <rect x="0" y="0" width="76" height="12" rx="6" fill="#7D3518" stroke="#A8512D" />
            <rect x="10" y="8" width="72" height="11" rx="5.5" fill="#63270F" stroke="#8F3F1E" />
          </g>

          {/* Green Elaichi pods (हरी इलायची) on right */}
          <g transform="translate(505, 382)">
            <ellipse cx="0" cy="0" rx="14" ry="8" transform="rotate(-20)" fill="#6C8C47" stroke="#95B56E" />
            <ellipse cx="22" cy="6" rx="13" ry="7.5" transform="rotate(15)" fill="#597737" stroke="#86A85E" />
            <ellipse cx="-14" cy="10" rx="12" ry="7" transform="rotate(8)" fill="#789951" stroke="#A3C47A" />
          </g>

          {/* Secondary smaller Kulhad on left-back */}
          <g transform="translate(275, 250) scale(0.78)">
            <path
              d="M20 30L38 155C40 168 65 176 95 176C125 176 150 168 152 155L170 30H20Z"
              fill="url(#kulhadClay)"
            />
            <ellipse cx="95" cy="30" rx="75" ry="18" fill="#823015" stroke="#DF7B52" strokeWidth="2" />
            <ellipse cx="95" cy="32" rx="67" ry="13" fill="url(#chaiLiquid)" />
          </g>

          {/* Primary Foreground Terracotta Kulhad */}
          <g transform="translate(310, 210)">
            {/* Terracotta body */}
            <path
              d="M20 35L42 172C45 186 74 196 110 196C146 196 175 186 178 172L200 35H20Z"
              fill="url(#kulhadClay)"
              stroke="#E07A52"
              strokeWidth="1.5"
            />
            {/* Hand-thrown clay wheel ridges */}
            <path
              d="M28 72C65 82 155 82 192 72"
              stroke="#7A280E"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.65"
            />
            <path
              d="M34 115C70 125 150 125 186 115"
              stroke="#E58B65"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.45"
            />
            <path
              d="M39 148C75 156 145 156 181 148"
              stroke="#7A280E"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.55"
            />
            {/* Kulhad rim */}
            <ellipse cx="110" cy="35" rx="92" ry="22" fill="#8C3316" stroke="#EB8E68" strokeWidth="2.5" />
            {/* Hot Masala Chai surface */}
            <ellipse cx="110" cy="37" rx="82" ry="17" fill="url(#chaiLiquid)" />
            {/* Frothy crema & crushed spice flecks */}
            <ellipse cx="98" cy="35" rx="45" ry="7" fill="#F3C392" opacity="0.45" />
            <circle cx="128" cy="37" r="2.5" fill="#4E6B2C" />
            <circle cx="92" cy="39" r="2" fill="#7D240D" />
            <path d="M105 33C112 31 118 35 123 33" stroke="#C92A1D" strokeWidth="1.8" strokeLinecap="round" />
          </g>

          {/* Rising aromatic steam wisps */}
          <path
            d="M402 215C388 180 426 150 406 110C392 82 418 58 412 35"
            stroke="#F7E4D0"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.45"
          />
          <path
            d="M438 222C454 188 420 156 442 120C456 96 438 70 446 48"
            stroke="#F7E4D0"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.3"
          />
          <path
            d="M342 235C330 205 358 180 344 148"
            stroke="#F7E4D0"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.28"
          />
        </svg>
      </div>
    );
  }

  // Product card 4:3 illustrations with distinct botanical & ceramic palette
  const paletteMap: Record<
    NonNullable<TeaProductItem['illustrationVariant']>,
    {
      bg: string;
      vessel: string;
      rim: string;
      teaTone: string;
      accent1: string;
      accent2: string;
      badgeTextHi: string;
    }
  > = {
    assam_kadak: {
      bg: '#F3ECE1',
      vessel: '#8E3216',
      rim: '#C95B38',
      teaTone: '#A83E17',
      accent1: '#3E251B',
      accent2: '#D4894A',
      badgeTextHi: 'सीटीसी दानेदार पत्ती',
    },
    elaichi: {
      bg: '#EEF2E8',
      vessel: '#3E5B31',
      rim: '#6A8E58',
      teaTone: '#C87A3B',
      accent1: '#7A9E57',
      accent2: '#D8E4C7',
      badgeTextHi: 'इडुक्की हरी इलायची',
    },
    adrak_tulsi: {
      bg: '#F2EDE4',
      vessel: '#6E4726',
      rim: '#A6754B',
      teaTone: '#BD692E',
      accent1: '#4D6B3C',
      accent2: '#D9A76A',
      badgeTextHi: 'सोंठ व श्यामा तुलसी',
    },
    kesar_badam: {
      bg: '#F6EFE2',
      vessel: '#7A2419',
      rim: '#C88D32',
      teaTone: '#DA8F39',
      accent1: '#C92C1D',
      accent2: '#EED39B',
      badgeTextHi: 'कश्मीरी केसर व बादाम',
    },
    masala_cutting: {
      bg: '#F3EAE0',
      vessel: '#752E17',
      rim: '#B85435',
      teaTone: '#AF471D',
      accent1: '#592312',
      accent2: '#D47B45',
      badgeTextHi: '6 खड़े भारतीय मसाले',
    },
    darjeeling_gold: {
      bg: '#F5F0E4',
      vessel: '#2D3A2E',
      rim: '#8C734B',
      teaTone: '#D99B38',
      accent1: '#475E48',
      accent2: '#E5C578',
      badgeTextHi: 'हिमालयी साबुत पत्ती',
    },
  };

  const theme = paletteMap[variant || 'assam_kadak'];

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{ backgroundColor: theme.bg }}
      role="img"
      aria-label={theme.badgeTextHi}
    >
      <svg
        viewBox="0 0 400 300"
        className="w-full h-full object-cover"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle stone pedestal shadow */}
        <ellipse cx="200" cy="246" rx="128" ry="18" fill="#1C1613" opacity="0.08" />
        <ellipse cx="200" cy="240" rx="112" ry="13" fill="#FFFFFF" opacity="0.65" />

        {/* Artisanal Tea Caddy / Jar on Left */}
        <g transform="translate(88, 86)">
          <rect
            x="0"
            y="18"
            width="92"
            height="128"
            rx="14"
            fill={theme.vessel}
          />
          {/* Brass lid */}
          <rect
            x="12"
            y="4"
            width="68"
            height="18"
            rx="5"
            fill="#C59341"
            stroke="#E5BA6B"
            strokeWidth="1"
          />
          {/* Minimalist label on jar */}
          <rect
            x="14"
            y="44"
            width="64"
            height="68"
            rx="4"
            fill="#FAF7F2"
          />
          <rect x="24" y="56" width="44" height="3" rx="1.5" fill={theme.vessel} opacity="0.85" />
          <rect x="30" y="65" width="32" height="2" rx="1" fill="#786B63" />
          <circle cx="46" cy="86" r="10" fill={theme.accent1} opacity="0.2" />
          <circle cx="46" cy="86" r="5" fill={theme.teaTone} />
        </g>

        {/* Steaming Kulhad Cup on Right */}
        <g transform="translate(198, 134)">
          <path
            d="M10 20L24 94C26 102 44 108 66 108C88 108 106 102 108 94L122 20H10Z"
            fill={theme.rim}
          />
          <path
            d="M16 46C42 52 90 52 116 46"
            stroke={theme.vessel}
            strokeWidth="2"
            opacity="0.5"
          />
          <ellipse cx="66" cy="20" rx="56" ry="13" fill={theme.vessel} />
          <ellipse cx="66" cy="21" rx="50" ry="10" fill={theme.teaTone} />
          <ellipse cx="58" cy="20" rx="26" ry="4" fill="#FFF3E0" opacity="0.4" />
        </g>

        {/* Botanical garnish details in foreground */}
        <g transform="translate(166, 232)">
          <ellipse cx="0" cy="0" rx="12" ry="6" transform="rotate(-18)" fill={theme.accent1} />
          <ellipse cx="18" cy="5" rx="10" ry="5" transform="rotate(14)" fill={theme.accent2} />
          <circle cx="34" cy="2" r="4" fill={theme.vessel} />
        </g>

        {/* Gentle steam lines */}
        <path
          d="M254 122C246 102 268 88 258 68"
          stroke={theme.vessel}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.28"
        />
        <path
          d="M276 126C284 108 268 94 278 76"
          stroke={theme.vessel}
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.2"
        />
      </svg>
    </div>
  );
};
