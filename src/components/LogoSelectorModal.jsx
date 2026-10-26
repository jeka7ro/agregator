import React from 'react'
import { X, Check, Sparkles } from 'lucide-react'
import { LOGO_OPTIONS, LogoIcon } from './AppLogo'

export default function LogoSelectorModal({
  isOpen,
  onClose,
  selectedLogo,
  onSelectLogo,
  isDark = false
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-4xl max-h-[90vh] rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`p-6 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-850' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                Alege Logo-ul Reprezentativ pentru MONITORING 2.0
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                6 concepte vectoriale distincte create special pentru agregare restaurante & live dispatch.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* 6 Logo Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar">
          {LOGO_OPTIONS.map((opt, index) => {
            const isSelected = selectedLogo === opt.id
            return (
              <div
                key={opt.id}
                onClick={() => onSelectLogo(opt.id)}
                className={`group relative p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/5 shadow-md shadow-emerald-500/10'
                    : isDark
                      ? 'border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/80'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-100/80'
                }`}
              >
                {/* Top Badge & Number */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    Opțiunea #{index + 1}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {opt.badge}
                  </span>
                </div>

                {/* Logo Icon Visual & Title */}
                <div className="flex items-center gap-3.5 my-2">
                  <div className="p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm shrink-0">
                    <LogoIcon variant={opt.id} size={44} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate group-hover:text-emerald-500 transition-colors">
                      {opt.name}
                    </h3>
                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                      {opt.tagline}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {opt.description}
                </p>

                {/* Selection Footer Button */}
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {isSelected ? 'Logo Activ' : 'Click pentru a alege'}
                  </span>
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-transparent group-hover:text-slate-400'
                  }`}>
                    <Check size={14} className={isSelected ? 'text-white' : ''} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-850' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="text-xs text-slate-400">
            Logo-ul selectat se aplică automat în sidebar și pe toate paginile suitei.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Confirmă Selecția
          </button>
        </div>
      </div>
    </div>
  )
}
