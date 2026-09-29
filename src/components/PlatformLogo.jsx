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

  // 2. Wolt (Official brand icon: authentic cyan app icon with white Wolt script)
  if (p === 'wolt') {
    return (
      <img 
        src="/platforms/wolt.png" 
        alt="Wolt" 
        style={{ width: size, height: size }}
        className={`rounded-full shrink-0 object-cover shadow-xs select-none ${className}`}
        title="Wolt"
      />
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

  return (
    <div 
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.55) }}
      className={`inline-flex items-center justify-center rounded-full bg-slate-700 text-slate-200 font-bold leading-none select-none shrink-0 ${className}`}
    >
      {(platform || '?').substring(0, 1).toUpperCase()}
    </div>
  )
}
