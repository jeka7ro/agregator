import React from 'react'
import { useLanguage } from '../lib/LanguageContext'

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage()

  const languages = [
    { code: 'ro', label: 'RO' },
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' }
  ]

  return (
    <div
      role="group"
      aria-label="Language"
      className="apple-segmented h-8"
    >
      {languages.map(l => {
        const isActive = language === l.code
        return (
          <button
            key={l.code}
            type="button"
            id={`lang-btn-${l.code}`}
            aria-pressed={isActive}
            onClick={() => setLanguage(l.code)}
            className={`apple-segment !h-[26px] !px-2.5 !text-[11px] ${
              isActive ? 'apple-segment-active' : ''
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
