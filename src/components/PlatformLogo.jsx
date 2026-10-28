import React from 'react'

export default function PlatformLogo({ platform, size = 20, className = '' }) {
  const p = (platform || '').toLowerCase().replace('_food', '')

  // 1. Glovo (Official brand icon: #FFC244 yellow with #00A082 green official pin)
  if (p === 'glovo') {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`inline-flex items-center justify-center rounded-full bg-[#FFC244] shrink-0 overflow-hidden shadow-xs select-none ${className}`}
        title="Glovo"
      >
        <svg viewBox="0 0 24 24" className="w-[66%] h-[66%]" fill="#00A082">
          <path d="M12.012 0C7.847 0 4.459 3.388 4.459 7.553c0 1.576.494 3.106 1.412 4.4l.211.281 3.93 5.555s.47.775 1.529.775h.941c1.036 0 1.53-.775 1.53-.775l3.93-5.555.187-.28a7.43 7.43 0 0 0 1.412-4.401C19.564 3.388 16.176 0 12.011 0Zm0 3.693a3.837 3.837 0 0 1 3.836 3.836c0 .824-.26 1.578-.73 2.237l-.212.28-2.894 4.095-2.895-4.07-.21-.305a3.848 3.848 0 0 1-.731-2.237 3.837 3.837 0 0 1 3.836-3.836zm-2.117 18.26c0 1.106.893 2.023 2.07 2.047 1.223 0 2.117-.917 2.117-2.059 0-1.14-.894-2.058-2.094-2.058-1.2 0-2.093.917-2.093 2.07z"/>
        </svg>
      </div>
    )
  }

  // 2. Wolt (Official brand icon: authentic cyan #00C2E8 circle with crisp white Wolt vector)
  if (p === 'wolt') {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`inline-flex items-center justify-center rounded-full bg-[#00C2E8] text-white shrink-0 overflow-hidden shadow-xs select-none ${className}`}
        title="Wolt"
      >
        <span style={{ fontSize: Math.max(7, size * 0.46), letterSpacing: '-0.4px' }} className="font-black italic lowercase tracking-tight leading-none -translate-y-[0.5px]">
          wolt
        </span>
      </div>
    )
  }

  // 3. Bolt Food (Official brand icon: #34D186 Bolt green with official dark lightning 'b')
  if (p === 'bolt') {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`inline-flex items-center justify-center rounded-full bg-[#34D186] shrink-0 overflow-hidden shadow-xs select-none ${className}`}
        title="Bolt Food"
      >
        <svg viewBox="0 0 256 326" className="w-[62%] h-[62%] translate-x-[1px]" fill="#22262A">
          <path d="M146.913164,0 L125.011288,98.780726 C142.70058,79.4448787 159.127663,72.299019 180.186309,72.299019 C225.675379,72.299019 256,102.143383 256,156.78784 C256,213.113341 221.042391,285.412745 148.597627,285.412745 C125.432404,285.412745 102.688439,277.006103 89.6315659,258.931608 L85.0262251,280.248197 L0,325.328264 L9.17897315,280.248197 L71.0994728,0 L146.913164,0 Z M143.96464,139.133749 C132.171399,139.133749 122.062907,144.177164 113.218048,153.005635 L101.424807,204.706699 C109.427434,213.533745 121.641791,218.578585 135.11978,218.578585 C159.127663,218.578585 177.659614,198.822477 177.659614,172.761743 C177.659614,152.585232 162.076187,139.133749 143.96464,139.133749 Z"/>
        </svg>
      </div>
    )
  }

  // 4. iiko / Syrve (Official brand icon: #E30613 red with crisp lowercase white 'iiko')
  if (p === 'iiko') {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`inline-flex items-center justify-center rounded-full bg-[#E30613] text-white font-black shrink-0 overflow-hidden shadow-xs select-none ${className}`}
        title="iiko"
      >
        <span style={{ fontSize: Math.max(8, size * 0.42), letterSpacing: '-0.4px' }} className="font-black leading-none lowercase tracking-tighter">
          iiko
        </span>
      </div>
    )
  }

  // 5. Smart Kiosk
  if (p === 'kiosk' || p === 'smart_kiosk' || p === 'kitchen') {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`inline-flex items-center justify-center rounded-full bg-purple-600 text-white shrink-0 overflow-hidden shadow-xs select-none ${className}`}
        title="Smart Kiosk"
      >
        <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      </div>
    )
  }

  // 6. Casierie / POS (Casa de marcat)
  if (p === 'casierie' || p === 'pos' || p === 'in-store' || p === 'restaurant') {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`inline-flex items-center justify-center rounded-full bg-blue-600 text-white shrink-0 overflow-hidden shadow-xs select-none ${className}`}
        title="Casierie (POS)"
      >
        <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M14 8H8" />
          <path d="M16 12H8" />
          <path d="M13 16H8" />
        </svg>
      </div>
    )
  }

  // 7. Own Delivery / Site Propriu
  if (p === 'own' || p === 'own_delivery' || p === 'site' || p === 'propriu') {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`inline-flex items-center justify-center rounded-full bg-indigo-600 text-white shrink-0 overflow-hidden shadow-xs select-none ${className}`}
        title="Livrare Proprie"
      >
        <svg viewBox="0 0 24 24" className="w-[60%] h-[60%]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      </div>
    )
  }

  // 8. Google Business Profile (Official 4-color Google 'G')
  if (p === 'google' || p === 'google_business') {
    return (
      <div
        style={{ width: size, height: size }}
        className={`inline-flex items-center justify-center rounded-full bg-white border border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden shadow-xs select-none ${className}`}
        title="Google Business Profile"
      >
        <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"/>
        </svg>
      </div>
    )
  }

  return (
    <div 
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.55) }}
      className={`inline-flex items-center justify-center rounded-full bg-slate-700 text-slate-200 font-bold leading-none select-none shrink-0 ${className}`}
    >
      {(platform || '?').substring(0, 1).toUpperCase()}
    </div>
  )
}
