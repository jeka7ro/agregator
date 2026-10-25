import React, { useState, useEffect } from 'react'

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
  // If object has brands.logo_url or direct logo_url from Supabase database, prioritize it!
  const dbLogo = typeof restaurantOrName === 'object'
    ? (restaurantOrName?.brands?.logo_url || restaurantOrName?.logo_url || null)
    : null

  const name = typeof restaurantOrName === 'string'
    ? restaurantOrName
    : (restaurantOrName?.brands?.name || restaurantOrName?.name || '')

  const lower = (name || '').toLowerCase()

  // 1. Poki Woki (replaces Ikura)
  if (lower.includes('poki') || lower.includes('woki') || lower.includes('ikura')) {
    return {
      name: 'Poki Woki',
      logo: dbLogo || pokiWokiLogo,
      fallbackLogo: pokiWokiLogo,
      short: 'PW',
      bgClass: 'bg-emerald-950/60 border-emerald-800/50 text-emerald-400'
    }
  }

  // 2. Roll Master (replaces Sushi Master, RM) - MUST BE CHECKED BEFORE GENERIC SUSHI / LOVE
  if (lower.includes('roll master') || lower.includes('sushi master') || lower.includes('roll') || lower.includes('master') || lower.includes('rm ') || lower.startsWith('rm')) {
    return {
      name: 'Roll Master',
      logo: dbLogo || rollMasterLogo,
      fallbackLogo: rollMasterLogo,
      short: 'RM',
      bgClass: 'bg-zinc-900 border-zinc-700/60 text-zinc-200'
    }
  }

  // 3. Love Sushi (only if explicitly Love Sushi, WLS, or love without roll/master)
  if (lower.includes('love sushi') || lower.includes('wls') || (lower.includes('love') && !lower.includes('roll') && !lower.includes('master'))) {
    return {
      name: 'Love Sushi',
      logo: dbLogo || loveSushiLogo,
      fallbackLogo: loveSushiLogo,
      short: 'LS',
      bgClass: 'bg-pink-950/60 border-pink-800/50 text-pink-400'
    }
  }

  // 4. Smash Me
  if (lower.includes('smash')) {
    return {
      name: 'Smash Me',
      logo: dbLogo || smashMeLogo,
      fallbackLogo: smashMeLogo,
      short: 'SM',
      bgClass: 'bg-amber-950/60 border-amber-800/50 text-amber-400'
    }
  }

  // 5. Crunch
  if (lower.includes('crunch')) {
    return {
      name: 'Crunch',
      logo: dbLogo || crunchLogo,
      fallbackLogo: crunchLogo,
      short: 'CR',
      bgClass: 'bg-purple-950/60 border-purple-800/50 text-purple-400'
    }
  }

  // Default fallback for any remaining sushi keyword -> Roll Master!
  if (lower.includes('sushi')) {
    return {
      name: 'Roll Master',
      logo: dbLogo || rollMasterLogo,
      fallbackLogo: rollMasterLogo,
      short: 'RM',
      bgClass: 'bg-zinc-900 border-zinc-700/60 text-zinc-200'
    }
  }

  return {
    name: name || 'Roll Master',
    logo: dbLogo || rollMasterLogo,
    fallbackLogo: rollMasterLogo,
    short: (name || 'RM').substring(0, 2).toUpperCase(),
    bgClass: 'bg-zinc-900 border-zinc-700/60 text-zinc-200'
  }
}

export default function BrandAvatar({ brand, name, size = 32, className = '' }) {
  const brandVal = brand || name
  let pixelSize = 32
  if (typeof size === 'number') pixelSize = size
  else if (size === 'xs') pixelSize = 20
  else if (size === 'sm') pixelSize = 26
  else if (size === 'md') pixelSize = 32
  else if (size === 'lg') pixelSize = 44
  else if (parseInt(size)) pixelSize = parseInt(size)

  const info = getBrandInfo(brandVal)
  const [currentSrc, setCurrentSrc] = useState(info.logo)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setCurrentSrc(info.logo)
    setHasError(false)
  }, [brandVal, info.logo])

  const handleError = () => {
    if (currentSrc !== info.fallbackLogo && info.fallbackLogo) {
      setCurrentSrc(info.fallbackLogo)
    } else {
      setHasError(true)
    }
  }

  if (currentSrc && !hasError) {
    return (
      <div 
        style={{ width: pixelSize, height: pixelSize }}
        className={`relative shrink-0 rounded-full overflow-hidden bg-white border border-slate-200 dark:border-slate-700 p-0.5 flex items-center justify-center shadow-xs select-none ${className}`}
        title={info.name}
      >
        <img
          src={currentSrc}
          alt={info.name}
          className="w-full h-full object-contain rounded-full"
          onError={handleError}
        />
      </div>
    )
  }

  return (
    <div
      style={{ width: pixelSize, height: pixelSize, fontSize: Math.max(9, Math.floor(pixelSize * 0.38)) }}
      className={`shrink-0 rounded-full font-bold flex items-center justify-center border shadow-xs select-none ${info.bgClass} ${className}`}
      title={info.name}
    >
      {info.short}
    </div>
  )
}
