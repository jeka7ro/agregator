import { useState, useEffect } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Download } from 'lucide-react'
import BrandAvatar, { cleanRestaurantName } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import { getApiUrl } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

function StatusBadge({ status, t }) {
  if (status === 'available' || status === 'open' || status === 'online') {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 inline-flex items-center gap-1.5 shadow-2xs">
        <CheckCircle2 size={12} className="shrink-0" /> <span className="whitespace-nowrap">{t('common.online', 'Online')}</span>
      </span>
    )
  }
  return (
    <span className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 inline-flex items-center gap-1.5 shadow-2xs">
      <XCircle size={12} className="shrink-0" /> <span className="whitespace-nowrap">{status === 'error' ? t('common.error', 'Eroare') : t('common.stopped', 'Oprit')}</span>
    </span>
  )
}

export default function Reports() {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()
  
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 25

  const fetchReports = async (p) => {
    setLoading(true)
    try {
      const res = await fetch(getApiUrl(`/api/reports/verifications?page=${p}&limit=${limit}`))
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        setTotal(json.total)
        setTotalPages(json.totalPages)
        setPage(json.page)
      } else {
        throw new Error('API returned success=false')
      }
    } catch (err) {
      console.warn("API reports fetch failed, falling back to Supabase:", err)
      try {
        const offset = (p - 1) * limit
        const { data: dbData, count } = await supabase
          .from('monitoring_checks')
          .select('*, restaurants(name, city)', { count: 'exact' })
          .order('checked_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (dbData && dbData.length > 0) {
          setData(dbData)
          setTotal(count || dbData.length)
          setTotalPages(Math.ceil((count || dbData.length) / limit) || 1)
          setPage(p)
        }
      } catch (dbErr) {
        console.error("Supabase fallback for reports failed:", dbErr)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports(page)
  }, [page])

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'

  const formatDate = (isoString) => {
    const d = new Date(isoString)
    return d.toLocaleString(localeCode, { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  const handleExportCSV = async () => {
    setIsExporting(true)
    try {
      // Fetch a larger batch for export (up to 500 rows)
      let exportRows = data
      try {
        const res = await fetch(getApiUrl(`/api/reports/verifications?page=1&limit=500`))
        const json = await res.json()
        if (json.success && json.data && json.data.length > 0) {
          exportRows = json.data
        }
      } catch {
        // Use loaded data as fallback
      }

      const headers = [
        t('reports.th_nr', 'Nr.'),
        t('reports.th_datetime', 'Data si Ora'),
        t('reports.th_city', 'Oras'),
        t('reports.th_location', 'Restaurant'),
        t('reports.th_platform', 'Platforma'),
        t('reports.th_status', 'Status'),
        t('reports.th_diagnostic', 'Diagnostic')
      ]

      const escapeCSV = (str) => {
        if (!str) return '""'
        const val = String(str).replace(/"/g, '""')
        return `"${val}"`
      }

      const csvLines = [
        headers.map(escapeCSV).join(','),
        ...exportRows.map((row, idx) => {
          const cleanedName = cleanRestaurantName(row.restaurants?.name) || '-'
          const city = row.restaurants?.city || '-'
          const dateStr = formatDate(row.checked_at)
          const statusStr = row.final_status === 'available' || row.final_status === 'open' || row.final_status === 'online' 
            ? t('common.online', 'Online')
            : (row.final_status === 'error' ? t('common.error', 'Eroare') : t('common.stopped', 'Oprit'))
          const diagnostic = row.ui_error_message || '-'

          return [
            idx + 1,
            escapeCSV(dateStr),
            escapeCSV(city),
            escapeCSV(cleanedName),
            escapeCSV(row.platform || '-'),
            escapeCSV(statusStr),
            escapeCSV(diagnostic)
          ].join(',')
        })
      ]

      const csvContent = '\uFEFF' + csvLines.join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `raport_scanari_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export CSV error:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const startIndex = (page - 1) * limit

  return (
    <div className="flex flex-col h-full w-full space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('reports.title')}
        </h2>
        
        <div className="flex items-center gap-2.5">
          <button 
            onClick={handleExportCSV}
            disabled={isExporting || (loading && data.length === 0)}
            className={`px-4 h-9 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 ${
              isDark 
                ? 'bg-emerald-950/30 border-emerald-800/60 hover:bg-emerald-900/50 text-emerald-400' 
                : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700'
            } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Export CSV"
          >
            {isExporting ? (
              <Loader2 size={14} className="animate-spin text-emerald-600" />
            ) : (
              <Download size={14} className="text-emerald-600 dark:text-emerald-400" />
            )}
            {isExporting ? t('reports.exporting') : t('reports.export_csv')}
          </button>

          <button 
            onClick={() => fetchReports(page)}
            disabled={loading}
            className={`px-4 h-9 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 ${
              isDark 
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' 
                : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Loader2 size={14} className={loading ? 'animate-spin text-emerald-600' : 'hidden'} />
            {t('reports.refresh')}
          </button>
        </div>
      </div>

      {/* Tabel */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col flex-1 transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className={`border-b text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <tr>
                <th className="px-6 py-3.5 text-center w-20">{t('reports.th_nr')}</th>
                <th className="px-6 py-3.5">{t('reports.th_datetime')}</th>
                <th className="px-6 py-3.5">{t('reports.th_city')}</th>
                <th className="px-6 py-3.5">{t('reports.th_location')}</th>
                <th className="px-6 py-3.5 text-center w-32">{t('reports.th_platform')}</th>
                <th className="px-6 py-3.5 text-center w-32">{t('reports.th_status')}</th>
                <th className="px-6 py-3.5 text-right">{t('reports.th_diagnostic')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-sm ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {loading && data.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-24 text-center">
                    <div className="flex justify-center"><Loader2 size={32} className="animate-spin text-emerald-600" /></div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-24 text-center text-slate-500 dark:text-slate-400 font-medium">
                    {t('reports.no_records')}
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => {
                  const cleanedName = cleanRestaurantName(row.restaurants?.name)
                  return (
                    <tr 
                      key={row.id} 
                      className={`transition-colors group ${
                        isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Nr. (fara font-mono) */}
                      <td className="px-6 py-3.5 text-center font-semibold text-xs text-slate-400">
                        {startIndex + idx + 1}
                      </td>

                      {/* Data și Ora (fara font-mono) */}
                      <td className="px-6 py-3.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="opacity-40" />
                          {formatDate(row.checked_at)}
                        </div>
                      </td>

                      <td className="px-6 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {row.restaurants?.city || '-'}
                      </td>

                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {row.restaurants && (
                            <BrandAvatar brand={row.restaurants} size={26} className="rounded-full shrink-0 shadow-xs" />
                          )}
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {cleanedName || '-'}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-3.5 text-center">
                        <div className="inline-flex items-center gap-2">
                          <PlatformLogo platform={row.platform} size={16} />
                          <span className="capitalize font-bold text-xs text-slate-700 dark:text-slate-300">{row.platform}</span>
                        </div>
                      </td>

                      <td className="px-6 py-3.5 text-center">
                        <StatusBadge status={row.final_status} t={t} />
                      </td>

                      <td className="px-6 py-3.5 text-xs text-right max-w-[220px] truncate text-slate-500 dark:text-slate-400 font-medium" title={row.ui_error_message || '-'}>
                        {row.ui_error_message || '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer conform regulilor SmartDevize */}
        <div className={`px-6 py-4 flex items-center justify-between border-t transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('reports.total_records', { count: total })}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('common.page')} <span className="font-bold text-slate-900 dark:text-white">{page}</span> {t('common.of')} {totalPages || 1}
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                  page === 1 || loading
                    ? 'opacity-30 cursor-not-allowed text-slate-400'
                    : isDark 
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-300' 
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title={t('common.page')}
              >
                <ChevronLeft size={16} />
              </button>
              
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                  page >= totalPages || loading
                    ? 'opacity-30 cursor-not-allowed text-slate-400'
                    : isDark 
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-300' 
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title={t('common.page')}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
