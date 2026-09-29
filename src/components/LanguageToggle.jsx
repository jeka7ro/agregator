import React from 'react'
import { useLanguage } from '../lib/LanguageContext'
import { useTheme } from '../lib/ThemeContext'

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage()
  const { isDark } = useTheme()

  const languages = [
    { code: 'ro', label: 'RO' },
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' }
  ]

  return (
    <div className={`h-8 p-0.5 rounded-full border flex items-center shadow-xs transition-colors ${
      isDark ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-50'
    }`}>
      {languages.map(l => {
        const isActive = language === l.code
        return (
          <button
            key={l.code}
            onClick={() => setLanguage(l.code)}
            className={`px-2.5 h-7 rounded-full text-xs font-bold transition-all ${
              isActive
                ? 'bg-emerald-600 text-white shadow-xs'
                : isDark 
                  ? 'text-slate-400 hover:text-white' 
                  : 'text-slate-600 hover:text-slate-900'
            }`}
            title={`Limba: ${l.label}`}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
