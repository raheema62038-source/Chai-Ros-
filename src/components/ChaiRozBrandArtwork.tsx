import React from 'react';

/**
 * Renders the Chai Roj / Admin-configured brand logo, cursive title with leaf,
 * and tagline. Supports custom uploaded logo image and dynamic brand text/colors.
 */
export const ChaiRozHeaderLogo: React.FC<{
  compact?: boolean;
  lang?: 'hi' | 'en';
  appName?: string;
  companyName?: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
}> = ({
  compact = false,
  lang = 'hi',
  appName,
  companyName,
  tagline,
  logoUrl,
  primaryColor = '#064E1E',
}) => {
  const resolvedAppName = (appName || 'CHAI ROS').trim() || 'CHAI ROS';
  const resolvedCompany = (companyName || 'CHAI ROS').trim() || 'CHAI ROS';
  const taglineText =
    tagline !== undefined
      ? tagline
      : lang === 'en'
      ? 'Your Tea, Delivered to Your Doorstep'
      : 'आपकी चाय, आपके घर तक';

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2.5 select-none">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={resolvedAppName}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full object-cover border-2 border-[#7ED348] shadow-xs shrink-0 bg-white"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full border-2 border-[#7ED348] flex items-center justify-center shadow-xs shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <span className="text-[11px] font-bold italic text-[#F8F6E8] tracking-tight">
              {resolvedAppName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div className="leading-none">
          <span
            className="font-display text-lg font-extrabold italic tracking-tight"
            style={{ color: primaryColor }}
          >
            {resolvedAppName}
          </span>
          {taglineText && (
            <span className="block text-[10px] font-semibold text-[#0E6B2B] mt-0.5">
              {taglineText}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center select-none pt-1">
      {/* Custom Uploaded Logo OR Brand Oval Emblem */}
      {logoUrl ? (
        <div className="relative w-32 sm:w-36 h-32 sm:h-36 rounded-3xl overflow-hidden border-4 border-white shadow-lg bg-white flex items-center justify-center mb-2">
          <img
            src={logoUrl}
            alt={resolvedAppName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="relative w-56 sm:w-64 h-36 sm:h-40 flex items-center justify-center">
          <svg
            viewBox="0 0 320 205"
            className="w-full h-full drop-shadow-md"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label={`${resolvedCompany} ${resolvedAppName} Logo`}
          >
            <text
              x="275"
              y="38"
              fill="#0A3A18"
              fontSize="12"
              fontWeight="700"
              fontFamily="sans-serif"
            >
              TM
            </text>

            {/* Outer Dark Forest Green Oval */}
            <ellipse cx="160" cy="105" rx="142" ry="88" fill={primaryColor || '#054418'} />
            {/* Bright Lime-Green Inner Ring */}
            <ellipse
              cx="160"
              cy="105"
              rx="132"
              ry="79"
              fill={primaryColor || '#095821'}
              stroke="#80D440"
              strokeWidth="3.5"
            />
            {/* Subtle Inner Rim */}
            <ellipse
              cx="160"
              cy="105"
              rx="124"
              ry="72"
              fill="#074B1B"
              stroke="#4CA82B"
              strokeWidth="1.2"
            />

            {/* Top 3 Tea Leaves Crown */}
            <g transform="translate(160, 23)">
              <path
                d="M0 -12 C9 -4, 9 8, 0 15 C-9 8, -9 -4, 0 -12Z"
                fill="#C7E879"
              />
              <path
                d="M-6 2 C-18 -6, -28 0, -24 10 C-16 12, -10 8, -6 2Z"
                fill="#99DB4E"
              />
              <path
                d="M6 2 C18 -6, 28 0, 24 10 C16 12, 10 8, 6 2Z"
                fill="#99DB4E"
              />
              <path d="M-36 10 C-46 6, -54 12, -48 18 C-42 19, -38 15, -36 10Z" fill="#7AC737" />
              <path d="M36 10 C46 6, 54 12, 48 18 C42 19, 38 15, 36 10Z" fill="#7AC737" />
            </g>

            {/* Company Name Letters */}
            <text
              x="160"
              y="59"
              textAnchor="middle"
              fill="#F4F7E6"
              fontSize="18"
              fontWeight="800"
              letterSpacing="4"
              fontFamily="sans-serif"
            >
              {resolvedCompany.slice(0, 18)}
            </text>

            {/* Script App Name inside oval */}
            <text
              x="160"
              y="112"
              textAnchor="middle"
              fill="#F7F9EB"
              fontSize={resolvedAppName.length > 10 ? '36' : '50'}
              fontWeight="700"
              fontStyle="italic"
              fontFamily="Fraunces, Georgia, serif"
            >
              {resolvedAppName.slice(0, 18)}
            </text>

            {/* Swooshing Cream & Lime Ribbon Underline */}
            <path
              d="M62 124 C115 132, 195 104, 262 120 C215 116, 125 140, 62 124Z"
              fill="#DCEFA2"
            />

            {/* Steaming Cup at bottom of oval */}
            <g transform="translate(160, 152)">
              <path
                d="M-3 -14 C-7 -21, 3 -25, -1 -32"
                stroke="#F4F7E6"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M4 -12 C8 -18, 0 -22, 4 -28"
                stroke="#C7E879"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M-18 -8 H18 L14 8 C12 14, -12 14, -14 8 L-18 -8Z"
                fill="#F4F7E6"
              />
              <ellipse
                cx="0"
                cy="-8"
                rx="18"
                ry="4.5"
                fill="#99DB4E"
                stroke="#F4F7E6"
                strokeWidth="1.5"
              />
              <path
                d="M17 -5 C24 -5, 24 6, 15 6"
                stroke="#F4F7E6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <ellipse cx="0" cy="14" rx="22" ry="3" fill="#C7E879" />
            </g>

            {/* Left & Right Laurel Leaf Wreath along bottom arc */}
            <g fill="#8AD642">
              <ellipse cx="95" cy="152" rx="11" ry="5" transform="rotate(22 95 152)" />
              <ellipse cx="115" cy="162" rx="11" ry="5" transform="rotate(14 115 162)" />
              <ellipse cx="76" cy="138" rx="10" ry="4.5" transform="rotate(32 76 138)" />
              <ellipse cx="225" cy="152" rx="11" ry="5" transform="rotate(-22 225 152)" />
              <ellipse cx="205" cy="162" rx="11" ry="5" transform="rotate(-14 205 162)" />
              <ellipse cx="244" cy="138" rx="10" ry="4.5" transform="rotate(-32 244 138)" />
            </g>
          </svg>
        </div>
      )}

      {/* Large Cursive Display Title with Tea Leaf */}
      <div className="relative inline-flex items-center justify-center -mt-2">
        <span
          className="font-display text-4xl sm:text-5xl font-black italic tracking-tight drop-shadow-xs"
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            color: primaryColor || '#06471B',
          }}
        >
          {resolvedAppName}
        </span>
        <svg
          viewBox="0 0 64 42"
          className="w-11 sm:w-13 h-8 -ml-3 -mt-7"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M8 32 C16 10, 40 4, 60 6 C48 24, 30 34, 8 32Z"
            fill="#1D8A34"
          />
          <path
            d="M8 32 C24 22, 42 14, 58 7"
            stroke="#8EE04A"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 24 C4 14, 12 10, 18 18 C12 24, 6 26, 4 24Z"
            fill="#56B938"
          />
        </svg>
      </div>

      {/* Tagline with Horizontal Flanking Lines & Steaming Cup */}
      {taglineText && (
        <div className="w-full max-w-md flex items-center justify-center gap-3 mt-1 px-4">
          <span className="h-[2px] flex-1 bg-[#146B2E] rounded-full opacity-75" />
          <span className="inline-flex items-center gap-1.5 text-base sm:text-lg font-bold text-[#0A5C24] whitespace-nowrap">
            <span>{taglineText}</span>
            <svg
              viewBox="0 0 28 26"
              className="w-6 h-6 inline-block shrink-0 -mt-1"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M11 6 C10 3, 13 2, 12 0 M15 6 C14 3, 17 2, 16 0"
                stroke="#2C3E33"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M5 9 H20 L18.5 18 C18 21, 6.5 21, 6 18 L5 9Z"
                fill="#2B3530"
              />
              <path
                d="M20 11 H22.5 C24 11, 24 16, 22 16 H19"
                stroke="#2B3530"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <ellipse cx="12.5" cy="22" rx="10" ry="2" fill="#2B3530" />
            </svg>
          </span>
          <span className="h-[2px] flex-1 bg-[#146B2E] rounded-full opacity-75" />
        </div>
      )}
    </div>
  );
};

/**
 * Decorative Tea Garden Background with Top/Bottom Tea Leaves,
 * Wooden Ledge, Steaming White Chai Cup (Bottom-Left), and Wooden Bowl of CTC Tea (Bottom-Right).
 */
export const TeaGardenBackdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden flex flex-col justify-between bg-gradient-to-b from-[#F9F8EC] via-[#E4F2D5] to-[#74B743]">
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full object-cover"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FBF9EE" />
              <stop offset="42%" stopColor="#EFF5DF" />
              <stop offset="100%" stopColor="#BEE09B" />
            </linearGradient>
            <linearGradient id="hillBack" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#AED48E" />
              <stop offset="100%" stopColor="#6BA84F" />
            </linearGradient>
            <linearGradient id="hillMid" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7CC248" />
              <stop offset="100%" stopColor="#3B8724" />
            </linearGradient>
            <linearGradient id="hillFront" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#58A82B" />
              <stop offset="100%" stopColor="#236312" />
            </linearGradient>
          </defs>

          <rect width="1440" height="900" fill="url(#skyGrad)" />

          <path
            d="M0 420 Q240 310 520 390 T1080 350 T1440 400 V900 H0 Z"
            fill="#D4E8C6"
            opacity="0.7"
          />

          <path
            d="M0 500 Q320 380 720 480 T1440 430 V900 H0 Z"
            fill="url(#hillBack)"
            opacity="0.85"
          />
          <path
            d="M0 590 Q400 470 860 580 T1440 510 V900 H0 Z"
            fill="url(#hillMid)"
          />
          <path
            d="M0 690 Q360 610 760 680 T1440 640 V900 H0 Z"
            fill="url(#hillFront)"
          />
        </svg>

        <svg
          viewBox="0 0 220 220"
          className="absolute top-0 left-0 w-36 sm:w-48 h-36 sm:h-48 drop-shadow-sm"
          fill="none"
        >
          <path d="M-10 140 Q45 75 110 15" stroke="#3D7A1E" strokeWidth="3.5" />
          <path
            d="M45 65 C65 20, 115 5, 138 12 C118 52, 82 72, 45 65Z"
            fill="#56B024"
          />
          <path d="M45 65 Q90 38 132 14" stroke="#A6E85B" strokeWidth="2" />
          <path
            d="M25 102 C68 82, 122 92, 150 115 C105 135, 58 128, 25 102Z"
            fill="#3E9419"
          />
          <path d="M25 102 Q88 106 142 114" stroke="#8CD946" strokeWidth="2" />
          <path
            d="M0 142 C32 135, 72 152, 88 178 C52 188, 18 172, 0 142Z"
            fill="#66BE2E"
          />
        </svg>

        <svg
          viewBox="0 0 220 220"
          className="absolute top-0 right-0 w-36 sm:w-48 h-36 sm:h-48 drop-shadow-sm scale-x-[-1]"
          fill="none"
        >
          <path d="M-10 140 Q45 75 110 15" stroke="#3D7A1E" strokeWidth="3.5" />
          <path
            d="M45 65 C65 20, 115 5, 138 12 C118 52, 82 72, 45 65Z"
            fill="#56B024"
          />
          <path d="M45 65 Q90 38 132 14" stroke="#A6E85B" strokeWidth="2" />
          <path
            d="M25 102 C68 82, 122 92, 150 115 C105 135, 58 128, 25 102Z"
            fill="#3E9419"
          />
          <path d="M25 102 Q88 106 142 114" stroke="#8CD946" strokeWidth="2" />
        </svg>
      </div>

      <div className="relative z-10 flex-1 flex flex-col">{children}</div>

      <div className="relative z-10 w-full mt-6 pointer-events-none select-none" aria-hidden="true">
        <div className="max-w-3xl mx-auto relative h-20 sm:h-24">
          <svg
            viewBox="0 0 220 160"
            className="absolute -bottom-3 -left-2 sm:left-2 w-36 sm:w-44 h-28 sm:h-32 drop-shadow-lg"
            fill="none"
          >
            <path d="M135 125 C165 110, 195 118, 210 135 C180 145, 150 140, 135 125Z" fill="#3B8C1A" />
            <ellipse cx="95" cy="134" rx="76" ry="20" fill="#E5E7EB" />
            <ellipse cx="95" cy="131" rx="72" ry="17" fill="#FFFFFF" />
            <path
              d="M36 62 H152 L140 120 C134 138, 54 138, 48 120 L36 62Z"
              fill="#F9FAFB"
            />
            <path
              d="M148 74 C172 74, 172 112, 142 112"
              stroke="#F3F4F6"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <ellipse cx="94" cy="62" rx="58" ry="15" fill="#FFFFFF" />
            <ellipse cx="94" cy="63" rx="52" ry="12" fill="#D98B48" />
            <ellipse cx="88" cy="61" rx="34" ry="6" fill="#EBB075" opacity="0.5" />
          </svg>

          <svg
            viewBox="0 0 220 160"
            className="absolute -bottom-3 -right-2 sm:right-2 w-36 sm:w-44 h-28 sm:h-32 drop-shadow-lg"
            fill="none"
          >
            <path d="M10 135 C30 112, 65 112, 85 128 C58 142, 28 142, 10 135Z" fill="#469E20" />
            <path d="M35 148 C55 132, 82 135, 98 148 C72 156, 48 156, 35 148Z" fill="#63BD35" />
            <path
              d="M72 74 H204 L192 128 C184 148, 92 148, 84 128 L72 74Z"
              fill="#8B4C20"
            />
            <ellipse cx="138" cy="74" rx="66" ry="18" fill="#A6602E" />
            <ellipse cx="138" cy="73" rx="58" ry="14" fill="#2A1E18" />
            <circle cx="122" cy="71" r="3" fill="#47342A" />
            <circle cx="145" cy="75" r="2.5" fill="#17100D" />
            <circle cx="158" cy="70" r="3" fill="#3D2C23" />
            <circle cx="115" cy="75" r="2.5" fill="#3D2C23" />
          </svg>
        </div>

        <div
          className="h-7 sm:h-9 w-full border-t-2 border-[#B67E46]"
          style={{
            background:
              'linear-gradient(180deg, #C88D55 0%, #A96E38 50%, #8C5627 100%)',
          }}
        />
      </div>
    </div>
  );
};
