import React, { useState } from 'react'
import { LOGO_OPTIONS, LogoIcon } from '../components/AppLogo'
import { Check, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function LogoShowcase() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem('app_logo_variant') || 'radar'
    } catch (_) {
      return 'radar'
    }
  })

  const handleSelect = (id) => {
    setSelected(id)
    try {
      localStorage.setItem('app_logo_variant', id)
    } catch (_) {}
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-500/20">
              Galeria de Concepte Vizuale
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Alege Logo-ul pentru MONITORING 2.0
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              6 identități vizuale vectoriale create pentru operațiuni de agregare restaurante, bucătării și livrări.
            </p>
          </div>

          <button
            onClick={() => navigate('/dispatch' + (window.location.search || ''))}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all w-fit cursor-pointer"
          >
            <span>Mergi la Dispecerat</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* 6 Large Showcase Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {LOGO_OPTIONS.map((opt, idx) => {
            const isSelected = selected === opt.id
            return (
              <div
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`group relative rounded-3xl p-6 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-500 bg-slate-900/90 shadow-2xl shadow-emerald-500/20 ring-2 ring-emerald-500/20'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                {/* Top Badge & Number */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="text-xs font-black px-3 py-1 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700">
                    OPȚIUNEA #{idx + 1}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {opt.badge}
                  </span>
                </div>

                {/* Big Visual Logo Preview (Light & Dark combined) */}
                <div className="my-3 p-6 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 flex items-center justify-center gap-6">
                  {/* Large Icon Preview */}
                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/60 shadow-inner">
                    <LogoIcon variant={opt.id} size={84} />
                  </div>
                  
                  {/* Sidebar Simulation */}
                  <div className="border-l border-slate-800 pl-4 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      În Sidebar:
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <LogoIcon variant={opt.id} size={28} />
                      <div className="leading-tight">
                        <div className="text-xs font-black text-white uppercase">MONITORING <span className="text-emerald-500">2.0</span></div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase">OPERATIONS SUITE</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Name & Tagline */}
                <div className="mt-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {opt.name}
                  </h3>
                  <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                    {opt.tagline}
                  </p>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {opt.description}
                  </p>
                </div>

                {/* Bottom Select Action */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white'}`}>
                    {isSelected ? '✓ Logo Activ în Aplicație' : 'Apasă pentru a alege'}
                  </span>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    isSelected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'
                  }`}>
                    <Check size={16} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
