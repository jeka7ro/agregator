import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations } from './translations'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('app-language')
    if (saved && (saved === 'ro' || saved === 'en' || saved === 'ru')) return saved
    return 'ro'
  })

  useEffect(() => {
    localStorage.setItem('app-language', language)
    document.documentElement.lang = language
  }, [language])

  const t = (path, params = {}) => {
    let fallbackText = null
    let interpolationParams = {}
    if (typeof params === 'string') {
      fallbackText = params
    } else if (params && typeof params === 'object') {
      interpolationParams = params
    }

    const keys = path.split('.')
    let current = translations[language] || translations.ro

    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key]
      } else {
        // Fallback to RO
        let fallback = translations.ro
        for (const fbKey of keys) {
          if (fallback && fallback[fbKey] !== undefined) {
            fallback = fallback[fbKey]
          } else {
            fallback = null
            break
          }
        }
        current = fallback || fallbackText || path
        break
      }
    }

    if (typeof current !== 'string') return fallbackText || path

    // Variable interpolation {count}, {platform}, etc.
    let result = current
    for (const [pKey, pVal] of Object.entries(interpolationParams)) {
      result = result.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal))
    }
    return result
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
