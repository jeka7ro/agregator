import React, { useState } from 'react'

import pokiWokiLogo from '../assets/brands/poki-woki.png'
import rollMasterLogo from '../assets/brands/roll-master.png'
import loveSushiLogo from '../assets/brands/love-sushi.png'
import smashMeLogo from '../assets/brands/smash-me.png'
import crunchLogo from '../assets/brands/crunch.webp'

export function cleanRestaurantName(name) {
  if (!name) return ''
  return name
    .replace(/ikura\s*sushi/gi, 'Poki Woki')
    .replace(/ikura/gi, 'Poki Woki')
    .replace(/sushi\s*master/gi, 'Roll Master')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getBrandInfo(restaurantOrName) {
  const name = typeof restaurantOrName === 'string'
    ? restaurantOrName
    : (restaurantOrName?.brands?.name || restaurantOrName?.name || '')

  const lower = (name || '').toLowerCase()

  // 1. Poki Woki (replaces Ikura)
  if (lower.includes('poki') || lower.includes('woki') || lower.includes('ikura')) {
    return {
      name: 'Poki Woki',
      logo: pokiWokiLogo,
      short: 'PW',
      bgClass: 'bg-emerald-950/60 border-emerald-800/50 text-emerald-400'
    }
  }

  // 2. Love Sushi
  if (lower.includes('love sushi') || (lower.includes('love') && lower.includes('sushi'))) {
    return {
      name: 'Love Sushi',
      logo: loveSushiLogo,
      short: 'LS',
      bgClass: 'bg-pink-950/60 border-pink-800/50 text-pink-400'
    }
  }

  // 3. Smash Me
  if (lower.includes('smash')) {
    return {
      name: 'Smash Me',
      logo: smashMeLogo,
      short: 'SM',
      bgClass: 'bg-amber-950/60 border-amber-800/50 text-amber-400'
    }
  }

  // 4. Crunch
  if (lower.includes('crunch')) {
    return {
      name: 'Crunch',
      logo: crunchLogo,
      short: 'CR',
      bgClass: 'bg-purple-950/60 border-purple-800/50 text-purple-400'
    }
  }

  // 5. Roll Master (replaces Sushi Master, RM)
  if (lower.includes('roll') || lower.includes('master') || lower.includes('rm ') || lower.startsWith('rm') || lower.includes('sushi master')) {
    return {
      name: 'Roll Master',
      logo: rollMasterLogo,
      short: 'RM',
      bgClass: 'bg-zinc-900 border-zinc-700/60 text-zinc-200'
    }
  }

  // Default fallback to Love Sushi if sushi keyword, or Roll Master
  if (lower.includes('sushi')) {
    return {
      name: 'Love Sushi',
      logo: loveSushiLogo,
      short: 'LS',
      bgClass: 'bg-pink-950/60 border-pink-800/50 text-pink-400'
    }
  }

  return {
    name: 'Roll Master',
    logo: rollMasterLogo,
    short: 'RM',
    bgClass: 'bg-zinc-900 border-zinc-700/60 text-zinc-200'
  }
}

export default function BrandAvatar({ brand, size = 32, className = '' }) {
  const info = getBrandInfo(brand)
  const [imgFailed, setImgFailed] = useState(false)

  if (info.logo && !imgFailed) {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`relative shrink-0 rounded-full overflow-hidden bg-white/95 border border-slate-200 dark:border-slate-700 p-0.5 flex items-center justify-center shadow-xs ${className}`}
        title={info.name}
      >
        <img
          src={info.logo}
          alt={info.name}
          className="w-full h-full object-contain rounded-full"
          onError={() => setImgFailed(true)}
        />
      </div>
    )
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.35)) }}
      className={`shrink-0 rounded-full font-bold flex items-center justify-center border shadow-xs select-none ${info.bgClass} ${className}`}
      title={info.name}
    >
      {info.short}
    </div>
  )
}
