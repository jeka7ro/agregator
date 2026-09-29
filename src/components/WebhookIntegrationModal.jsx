import React, { useState, useEffect } from 'react'
import { X, Webhook, Play, RefreshCw, Copy, Check } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'

export default function WebhookIntegrationModal({ isOpen, onClose, onWebhookTriggered }) {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()

  const [statusData, setStatusData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)
  
  // Simulare state
  const [simPlatform, setSimPlatform] = useState('wolt')
  const [simEventType, setSimEventType] = useState('VENUE_OFFLINE_ALERT_TRIGGERED')
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState(null)

  const fetchStatus = () => {
    setLoading(true)
    fetch('http://localhost:3002/api/webhooks/status')
      .then(r => r.json())
      .then(d => {
        if (d.success) setStatusData(d)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isOpen) {
      fetchStatus()
      setSimResult(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleSimulate = async () => {
    setSimulating(true)
    setSimResult(null)
    try {
      const res = await fetch('http://localhost:3002/api/webhooks/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: simPlatform,
          event_type: simEventType,
          status: simPlatform === 'glovo' 
            ? (simEventType === 'CLOSED' ? 'CLOSED' : 'OPEN')
            : (simEventType.includes('OFFLINE') || simEventType === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE')
        })
      })
      const data = await res.json()
      setSimResult(data)
      fetchStatus()
      if (onWebhookTriggered) {
        onWebhookTriggered()
      }
    } catch (err) {
      setSimResult({ success: false, error: err.message })
    } finally {
      setSimulating(false)
    }
  }

  const origin = window.location.origin.replace(':5173', ':3002')
  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-3xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header Modal */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Webhook size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">{t('webhooks.modal_title')}</h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {t('webhooks.ready_badge')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('webhooks.modal_subtitle')}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          
          {/* Carduri URL-uri Endpoint */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('webhooks.endpoints_configured')}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Wolt Endpoint */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    {t('webhooks.wolt_title')}
                  </span>
                  <button
                    onClick={() => handleCopy(`${origin}/api/webhooks/wolt`, 'wolt')}
                    className="p-1 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
                    title="Copy URL"
                  >
                    {copiedKey === 'wolt' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <code className="text-xs font-mono block p-2 rounded bg-black/20 text-slate-300 select-all overflow-x-auto">
                  {`${origin}/api/webhooks/wolt`}
                </code>
                <p className="text-[11px] text-slate-400 mt-2">
                  {t('webhooks.wolt_desc')}
                </p>
              </div>

              {/* Bolt Endpoint */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {t('webhooks.bolt_title')}
                  </span>
                  <button
                    onClick={() => handleCopy(`${origin}/api/webhooks/bolt`, 'bolt')}
                    className="p-1 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
                    title="Copy URL"
                  >
                    {copiedKey === 'bolt' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <code className="text-xs font-mono block p-2 rounded bg-black/20 text-slate-300 select-all overflow-x-auto">
                  {`${origin}/api/webhooks/bolt`}
                </code>
                <p className="text-[11px] text-slate-400 mt-2">
                  {t('webhooks.bolt_desc')}
                </p>
              </div>

              {/* Glovo Endpoint */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    {t('webhooks.glovo_title')}
                  </span>
                  <button
                    onClick={() => handleCopy(`${origin}/api/webhooks/glovo`, 'glovo')}
                    className="p-1 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
                    title="Copy URL"
                  >
                    {copiedKey === 'glovo' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <code className="text-xs font-mono block p-2 rounded bg-black/20 text-slate-300 select-all overflow-x-auto">
                  {`${origin}/api/webhooks/glovo`}
                </code>
                <p className="text-[11px] text-slate-400 mt-2">
                  {t('webhooks.glovo_desc')}
                </p>
              </div>
            </div>
          </div>

          {/* Statistici Mapare Magazine */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {statusData?.mapping?.total_stores || 71}
              </div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">{t('webhooks.stat_locations')}</div>
            </div>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <div className="text-lg font-black text-cyan-600 dark:text-cyan-400">
                {statusData?.mapping?.wolt_mapped_ids || 68}
              </div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">{t('webhooks.stat_wolt_ids')}</div>
            </div>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {statusData?.mapping?.bolt_mapped_ids || 67}
              </div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">{t('webhooks.stat_bolt_ids')}</div>
            </div>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <div className="text-lg font-black text-amber-500 dark:text-amber-400">
                {statusData?.mapping?.glovo_mapped_ids || 55}
              </div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">{t('webhooks.stat_glovo_ids')}</div>
            </div>
          </div>

          {/* Panou Test & Simulare Live */}
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-amber-50/50 border-amber-200/60'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Play size={16} className="text-amber-500" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t('webhooks.sim_title')}
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {t('webhooks.sim_desc')}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={simPlatform}
                onChange={(e) => {
                  const val = e.target.value
                  setSimPlatform(val)
                  if (val === 'wolt') setSimEventType('VENUE_OFFLINE_ALERT_TRIGGERED')
                  else if (val === 'bolt') setSimEventType('INACTIVE')
                  else if (val === 'glovo') setSimEventType('CLOSED')
                }}
                className={`px-3 py-1.5 text-xs rounded-lg border font-semibold ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                <option value="wolt">{t('webhooks.sim_wolt')}</option>
                <option value="bolt">{t('webhooks.sim_bolt')}</option>
                <option value="glovo">{t('webhooks.sim_glovo')}</option>
              </select>

              <select
                value={simEventType}
                onChange={(e) => setSimEventType(e.target.value)}
                className={`px-3 py-1.5 text-xs rounded-lg border font-semibold ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                {simPlatform === 'wolt' ? (
                  <>
                    <option value="VENUE_OFFLINE_ALERT_TRIGGERED">{t('webhooks.sim_wolt_offline')}</option>
                    <option value="VENUE_OFFLINE_ALERT_RECOVERED">{t('webhooks.sim_wolt_recovered')}</option>
                    <option value="REJECTION_ALERT_TRIGGERED">{t('webhooks.sim_wolt_rejection')}</option>
                  </>
                ) : simPlatform === 'bolt' ? (
                  <>
                    <option value="INACTIVE">{t('webhooks.sim_inactive')}</option>
                    <option value="ACTIVE">{t('webhooks.sim_active')}</option>
                  </>
                ) : (
                  <>
                    <option value="CLOSED">{t('webhooks.sim_glovo_closed')}</option>
                    <option value="OPEN">{t('webhooks.sim_glovo_open')}</option>
                  </>
                )}
              </select>

              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {simulating ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                <span>{t('webhooks.sim_btn')}</span>
              </button>
            </div>

            {simResult && (
              <div className="mt-3 p-2.5 rounded-lg bg-black/30 border border-slate-700 text-xs font-mono text-emerald-400">
                {t('webhooks.sim_success')} {JSON.stringify(simResult.result?.action_taken || simResult)}
              </div>
            )}
          </div>

          {/* Audit Log Recent */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('webhooks.recent_title', { count: statusData?.recent_events?.length || 0 })}
              </h4>
              <button 
                onClick={fetchStatus} 
                className="p-1 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                <span>{t('webhooks.refresh')}</span>
              </button>
            </div>

            <div className={`rounded-xl border max-h-48 overflow-y-auto ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              {statusData?.recent_events?.length ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {statusData.recent_events.map((evt) => (
                    <div key={evt.id} className="p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          evt.platform === 'wolt' ? 'bg-cyan-500/20 text-cyan-400' : evt.platform === 'bolt' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {evt.platform}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {evt.event_type}
                        </span>
                        {evt.restaurant_name && (
                          <span className="text-slate-500 dark:text-slate-400">
                            · {evt.restaurant_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{evt.action_taken}</span>
                        <span>·</span>
                        <span>{new Date(evt.timestamp).toLocaleTimeString(localeCode)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  {t('webhooks.no_events')}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            {t('webhooks.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
