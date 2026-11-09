import React from 'react'

/**
 * 6 REVOLUTIONARY & HIGHLY REPRESENTATIVE LOGO CONCEPTS
 * FOR MULTI-RESTAURANT AGGREGATOR & LIVE OPERATIONS DISPATCH:
 * 
 * 1. 'kitchen-pin' - Food & Courier Pin (Chef Cloche fused into GPS Pin)
 * 2. 'radar'       - Radar Hub / Live Dispatch Pulse (Scanning & real-time telemetry)
 * 3. 'infinity'    - Aggregator Nexus (Infinite interconnected sales channels)
 * 4. 'speed'       - Hexagon Velocity (High-speed order fulfillment & SLA)
 * 5. 'shield'      - Command Shield M2 (STOP Monitor protection & stability)
 * 6. 'orbit'       - Constellation Hub (52+ restaurants and 15+ cities synced)
 */

export const LOGO_OPTIONS = [
  {
    id: 'radar',
    name: 'Radar Live Dispatch',
    badge: 'Logo Oficial Activ',
    tagline: 'Scanare Live & Puls Rețea',
    description: 'Inspirat din turnurile de control aerian: inele concentrice de detecție cu fascicul rotativ și nod central incandescent ce reflectă comenzile în mișcare.',
    colors: 'from-emerald-600 to-cyan-500'
  },
  {
    id: 'kitchen-pin',
    name: 'Food & Courier Pin',
    badge: 'HoReCa & Food',
    tagline: 'Fuziune Cloche Restaurant + Pin GPS',
    description: 'Cel mai specific pentru industria de food delivery: combină un clopot clasic de bucătărie / cloche cu un pin de localizare pe hartă și unde de livrare rapidă.',
    colors: 'from-emerald-500 to-lime-500'
  },
  {
    id: 'infinity',
    name: 'Aggregator Nexus',
    badge: 'Multi-Canal & Sincronizare',
    tagline: 'Flux Infinit de Comenzi',
    description: 'Simbolul infinitului stilizat isometric: Glovo, Wolt, Bolt, Kiosk și POS converg într-un nod continuu de comenzi fără întreruperi sau blocaje.',
    colors: 'from-emerald-600 to-blue-500'
  },
  {
    id: 'speed',
    name: 'Hexagon Velocity',
    badge: 'Viteză & SLA Timpi',
    tagline: 'Logistică & Respectare SLA',
    description: 'Fagure tehnologic modern traversat de o săgeată supersonic spre viitor, simbolizând livrarea ultrarapidă sub 30 de minute și eficiența maximă.',
    colors: 'from-teal-600 to-emerald-400'
  },
  {
    id: 'shield',
    name: 'Command Shield M2',
    badge: 'Protecție & STOP Monitor',
    tagline: 'Control HQ & Stabilitate Rețea',
    description: 'Scut operațional digital cu monograma stilizată M2 din bare de date KPI și lumină verde de uptime 100%, axat pe siguranță și prevenirea pierderilor.',
    colors: 'from-emerald-800 to-emerald-500'
  },
  {
    id: 'orbit',
    name: 'Orbit Constellation',
    badge: 'Rețea Națională Scalabilă',
    tagline: '52 Locații & 15 Orașe Interconectate',
    description: 'Sferă orbitală cu inele eliptice și sateliți luminoși în jurul nucleului central de date, reprezentând întreaga rețea de restaurante conectate live.',
    colors: 'from-teal-700 to-cyan-400'
  }
]

export function LogoIcon({ variant = 'radar', size = 36, className = '' }) {
  // Option 1: Food + Courier Pin
  if (variant === 'kitchen-pin') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 drop-shadow-sm transition-transform duration-200 hover:scale-105 ${className}`}
      >
        <defs>
          <linearGradient id="kp-grad-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="kp-accent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a7f3d0" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#kp-grad-bg)" />
        
        {/* Subtle top gloss */}
        <path d="M4 16C4 9.37 9.37 4 16 4H32C38.63 4 44 9.37 44 16V22C44 22 34 16 24 16C14 16 4 22 4 22V16Z" fill="white" fillOpacity="0.12" />

        {/* Outer GPS Pin contour with food cloche dome */}
        <path
          d="M24 9C17.37 9 12 14.37 12 21C12 28.5 21.6 37.2 23.2 38.6C23.68 39.02 24.32 39.02 24.8 38.6C26.4 37.2 36 28.5 36 21C36 14.37 30.63 9 24 9Z"
          fill="white"
          fillOpacity="0.2"
        />

        {/* Food Cloche Dome & Handle inside pin */}
        <circle cx="24" cy="15.5" r="2" fill="white" />
        <path
          d="M17 23C17 19.13 20.13 16 24 16C27.87 16 31 19.13 31 23H17Z"
          fill="white"
        />
        <rect x="15" y="24" width="18" height="2.5" rx="1.25" fill="white" />
        
        {/* Dynamic dispatch signal arc */}
        <path
          d="M21 29L24 33L27 29"
          stroke="url(#kp-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="21" r="1.5" fill="#059669" />
      </svg>
    )
  }

  // Option 2: Radar Live Dispatch (Animated Smooth Live Radar)
  if (variant === 'radar') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 drop-shadow-sm transition-transform duration-300 group-hover:scale-105 hover:scale-105 ${className}`}
      >
        <defs>
          <linearGradient id="rd-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="rd-sweep" x1="24" y1="7" x2="38" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.88" />
            <stop offset="55%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
          <style>{`
            @keyframes agRadarSweep {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes agRadarRingReverse {
              0% { transform: rotate(360deg); }
              100% { transform: rotate(0deg); }
            }
            @keyframes agRadarPing {
              0%, 100% { opacity: 0.35; transform: scale(0.85); }
              50% { opacity: 1; transform: scale(1.22); }
            }
            @keyframes agRadarCoreRipple {
              0% { r: 3.5px; opacity: 0.75; }
              100% { r: 15px; opacity: 0; }
            }
            .ag-radar-sweep {
              transform-origin: 24px 24px;
              animation: agRadarSweep 4.2s linear infinite;
            }
            .ag-radar-outer-ring {
              transform-origin: 24px 24px;
              animation: agRadarRingReverse 20s linear infinite;
            }
            .ag-radar-ping-1 {
              transform-origin: 32px 18px;
              animation: agRadarPing 2.8s ease-in-out infinite;
            }
            .ag-radar-ping-2 {
              transform-origin: 16px 29px;
              animation: agRadarPing 2.8s ease-in-out 0.9s infinite;
            }
            .ag-radar-ping-3 {
              transform-origin: 30px 31px;
              animation: agRadarPing 2.8s ease-in-out 1.8s infinite;
            }
            .ag-radar-ripple {
              animation: agRadarCoreRipple 3.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
            }
          `}</style>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#rd-bg)" />

        {/* Concentric radar rings */}
        <circle
          cx="24"
          cy="24"
          r="17"
          stroke="#10b981"
          strokeOpacity="0.3"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          className="ag-radar-outer-ring"
        />
        <circle cx="24" cy="24" r="11" stroke="#10b981" strokeOpacity="0.4" strokeWidth="1.2" />
        <circle cx="24" cy="24" r="5" stroke="#34d399" strokeOpacity="0.6" strokeWidth="1.4" />

        {/* Expanding sonar pulse ripple from center */}
        <circle
          cx="24"
          cy="24"
          r="4"
          stroke="#34d399"
          strokeWidth="1.1"
          fill="none"
          className="ag-radar-ripple"
        />

        {/* Crosshair grid */}
        <line x1="24" y1="6" x2="24" y2="42" stroke="#10b981" strokeOpacity="0.2" strokeWidth="1" />
        <line x1="6" y1="24" x2="42" y2="24" stroke="#10b981" strokeOpacity="0.2" strokeWidth="1" />

        {/* Smooth rotating radar sweep sector + leading laser line */}
        <g className="ag-radar-sweep">
          <path d="M24 24L38.5 13A17 17 0 0 0 24 7Z" fill="url(#rd-sweep)" />
          <line x1="24" y1="24" x2="24" y2="7" stroke="#6ee7b7" strokeOpacity="0.9" strokeWidth="1.3" strokeLinecap="round" />
        </g>

        {/* Glowing animated order pings on radar */}
        <circle cx="32" cy="18" r="2.1" fill="#38bdf8" className="ag-radar-ping-1" />
        <circle cx="16" cy="29" r="1.7" fill="#34d399" className="ag-radar-ping-2" />
        <circle cx="30" cy="31" r="1.9" fill="#fbbf24" className="ag-radar-ping-3" />

        {/* Active pulsing core */}
        <circle cx="24" cy="24" r="3.2" fill="#ffffff" />
        <circle cx="24" cy="24" r="1.6" fill="#10b981" />
      </svg>
    )
  }

  // Option 3: Aggregator Nexus / Infinity Flow
  if (variant === 'infinity') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 drop-shadow-sm transition-transform duration-200 hover:scale-105 ${className}`}
      >
        <defs>
          <linearGradient id="inf-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#065f46" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="inf-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#a7f3d0" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#inf-bg)" />

        {/* Isometric Infinity Loop */}
        <path
          d="M17 18C13.68 18 11 20.68 11 24C11 27.32 13.68 30 17 30C20.5 30 22.5 27 24 24C25.5 21 27.5 18 31 18C34.32 18 37 20.68 37 24C37 27.32 34.32 30 31 30C27.5 30 25.5 27 24 24C22.5 21 20.5 18 17 18Z"
          stroke="url(#inf-stroke)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Connected order nodes at loop ends */}
        <circle cx="17" cy="24" r="2.5" fill="white" />
        <circle cx="31" cy="24" r="2.5" fill="white" />
        <circle cx="24" cy="24" r="2" fill="#38bdf8" />
      </svg>
    )
  }

  // Option 4: Hexagon Velocity
  if (variant === 'speed') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 drop-shadow-sm transition-transform duration-200 hover:scale-105 ${className}`}
      >
        <defs>
          <linearGradient id="spd-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="spd-arrow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#a7f3d0" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#spd-bg)" />

        {/* Hexagon outline */}
        <path
          d="M24 7L38 15V31L24 39L10 31V15L24 7Z"
          stroke="#34d399"
          strokeWidth="1.8"
          strokeOpacity="0.4"
          fill="white"
          fillOpacity="0.08"
        />

        {/* High-speed velocity chevron / supersonic arrow */}
        <path
          d="M17 28L25 24L17 20"
          stroke="white"
          strokeOpacity="0.5"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M23 28L31 24L23 20"
          stroke="url(#spd-arrow)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Glow center */}
        <circle cx="28" cy="24" r="2" fill="#38bdf8" />
      </svg>
    )
  }

  // Option 5: Command Shield M2
  if (variant === 'shield') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 drop-shadow-sm transition-transform duration-200 hover:scale-105 ${className}`}
      >
        <defs>
          <linearGradient id="sh-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#064e3b" />
            <stop offset="100%" stopColor="#022c22" />
          </linearGradient>
          <linearGradient id="sh-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#sh-bg)" />

        {/* Shield Crest Contour */}
        <path
          d="M24 9L36 14V23C36 30.5 30.9 37.3 24 39C17.1 37.3 12 30.5 12 23V14L24 9Z"
          fill="url(#sh-gold)"
          fillOpacity="0.25"
          stroke="#10b981"
          strokeWidth="1.5"
        />

        {/* Monogram M with Central 2 */}
        <path d="M18 29V20L22 24.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M30 29V20L26 24.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Top Uptime Beacon (100% Live) */}
        <circle cx="24" cy="14" r="2.2" fill="#34d399" />
        <circle cx="24" cy="14" r="4" stroke="#34d399" strokeOpacity="0.4" strokeWidth="1" />
      </svg>
    )
  }

  // Option 6: Orbit Constellation Hub
  if (variant === 'orbit') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 drop-shadow-sm transition-transform duration-200 hover:scale-105 ${className}`}
      >
        <defs>
          <linearGradient id="orb-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#115e59" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#orb-bg)" />

        {/* Planetary Orbit Ring 1 (Rotated) */}
        <ellipse cx="24" cy="24" rx="16" ry="6" transform="rotate(-25 24 24)" stroke="#2dd4bf" strokeWidth="1.5" strokeOpacity="0.5" />
        
        {/* Planetary Orbit Ring 2 (Counter Rotated) */}
        <ellipse cx="24" cy="24" rx="16" ry="6" transform="rotate(35 24 24)" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.4" strokeDasharray="3 2" />

        {/* Glowing Central Hub Node */}
        <circle cx="24" cy="24" r="5" fill="#14b8a6" />
        <circle cx="24" cy="24" r="3" fill="#ffffff" />

        {/* Orbiting Satellite Restaurant Nodes */}
        <circle cx="36" cy="18" r="2.2" fill="#34d399" />
        <circle cx="12" cy="29" r="2" fill="#38bdf8" />
        <circle cx="28" cy="33" r="1.8" fill="#a7f3d0" />
      </svg>
    )
  }

  return <LogoIcon variant="radar" size={size} className={className} />
}

export default function AppLogo({ 
  variant = 'radar', 
  size = 42, 
  showText = true, 
  isDark = false,
  onClick = null,
  className = '' 
}) {
  const isLarge = size >= 48
  return (
    <div 
      onClick={onClick}
      className={`group flex items-center ${isLarge ? 'gap-3.5' : 'gap-3'} select-none transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="relative shrink-0">
        <LogoIcon variant={variant} size={size} />
      </div>

      {showText && (
        <div className="min-w-0 text-left flex items-center">
          <h1 className={`${isLarge ? 'text-2xl' : 'text-lg'} font-black tracking-tight leading-none truncate transition-colors duration-200 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            GetApp<span className="text-[#047857] dark:text-[#10b981] font-black">.</span>F<span className="text-[#047857] dark:text-[#10b981] font-black">oo</span>D
          </h1>
        </div>
      )}
    </div>
  )
}
