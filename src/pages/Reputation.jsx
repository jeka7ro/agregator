import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  Search,
  Store,
  Loader2,
  X,
  Star,
  Upload,
  Mail,
  Bot,
  Receipt,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ChefHat,
  Bike,
  Clock,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  RotateCw,
  Globe,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useLiveChecks } from '../hooks/useLiveChecks'
import PlatformLogo from '../components/PlatformLogo'
import BrandAvatar, { getBrandInfo, cleanRestaurantName } from '../components/BrandAvatar'
import OrderDetailsModal from '../components/OrderDetailsModal'
import { getProductImage } from '../lib/productImages'
import { getApiUrl } from '../lib/api'

const AUTHORITATIVE_BRANDS = ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']

const UI_TEXT = {
  ro: {
    title: 'Recenzii Clienți & Rating',
    subtitle: 'Inbox centralizat de recenzii clienți (Email, Excel, Glovo Partner, Wolt Merchant) legat automat de bonurile din Dispecerat',
    searchPlaceholder: 'Caută recenzie, bon iiko, restaurant...',
    btnImportExcel: 'Importă Excel / CSV',
    btnEmail: 'Email (jeka7ro@gmail.com)',
    btnPortal: 'Portal B2B (Glovo/Wolt)',
    btnRefresh: 'Reîncarcă recenziile',
    kpiAvgTitle: 'Scor Mediu Platforme',
    kpiAvgSub: 'Sincronizat automat la 11:00, 13:00, 17:00, 18:00, 19:00',
    kpiTotalTitle: 'Total Recenzii Înregistrate',
    kpiTotalLinked: 'legate de bonul iiko',
    kpiPosTitle: 'Sentiment Pozitiv (≥ 8 / ≥ 4⭐)',
    kpiPosCount: 'recenzii pozitive',
    kpiPosSub: 'Analiză automată scor + cuvinte-cheie RO/EN',
    kpiNegTitle: 'Recenzii Negative / Alerte (≤ 5)',
    kpiNegSub1: 'necesită verificare bon & bucătărie',
    kpiNegSub2: 'Atașate automat ca alertă pe comanda din Dispecerat',
    filterAll: 'Toate Recenziile',
    filterNegative: '🚨 Negative / Alerte',
    filterPositive: '👍 Pozitive',
    filterWithComment: '💬 Cu Comentariu Text',
    filterMatched: '🔗 Legate de Bon iiko',
    filterAllPlatforms: 'Toate Platformele',
    autoTranslateLabel: 'Traducere Automată Recenzii',
    showOriginalLabel: 'Arată originalul (RO)',
    translatedBadge: 'Tradus în RO',
    thNr: '#',
    thDateSource: 'Data',
    thLocationPlatform: 'Locație & Client',
    thRatingSentiment: 'Notă',
    thComment: 'Comentariu Client',
    thOrder: 'Comandă / Acțiune',
    sortDateDesc: 'Dată: Cele mai noi ↓',
    sortDateAsc: 'Dată: Cele mai vechi ↑',
    sortRatingDesc: 'Notă: Mare → Mică ↓',
    sortRatingAsc: 'Notă: Mică → Mare ↑',
    sortOrderDesc: 'Valoare Bon ↓',
    rowsLbl: 'Rânduri:',
    allRows: 'Toate',
    totalLbl: 'Total',
    reviewsCountLbl: 'recenzii',
    pageLbl: 'Pagina',
    ofLbl: 'din',
    loadingReviews: 'Se încarcă recenziile și bonurile iiko asociate...',
    emptyReviews: 'Nu există recenzii pentru filtrele selectate. Poți importa un fișier Excel/CSV sau adăuga un email din Glovo/Wolt/Bolt.',
    sourceEmail: '📧 Email (jeka7ro)',
    sourceExcel: '📊 Import Excel',
    sourcePortal: '🤖 Portal B2B',
    sourceWebhook: '⚡ Webhook Live',
    sourceAlert: '📉 Alertă Scădere Rating',
    sourcePublic: '🌐 Evaluare Platformă',
    clientLbl: 'Client:',
    sentimentNeg: 'Negativ 🚨',
    sentimentPos: 'Pozitiv 👍',
    sentimentNeu: 'Neutru',
    noComment: 'Evaluare fără comentariu text',
    receiptBtn: 'Vezi Bonul iiko',
    receiptPrefix: 'Bon',
    cookTimeLbl: 'Gătit:',
    cycleTimeLbl: 'Ciclu:',
    extIdLbl: 'ID extern:',
    noOrderId: 'Fără ID comandă atașat',
    emailModalTitle: 'Conectare Email Recenzii (jeka7ro@gmail.com)',
    emailModalSub: 'Extrage automat Restaurantul, Platforma, Nota, Comentariul și leagă de Comanda iiko',
    emailConnectedBadge: '● Cont Conectat: jeka7ro@gmail.com (Glovo / Wolt / Bolt / Google)',
    copyWebhookBtn: 'Copiază Webhook Mail',
    copiedBtn: 'Copiat!',
    emailModalDesc: 'Poți redirecționa automat emailurile pe /api/webhooks/email-review sau lipi mai jos orice email de recenzie primit pentru asociere instantă cu bonul din iiko:',
    emailSubjectLbl: 'Subiect Email (ex: „New review on Glovo - Smash Me Constanța - Order #118248”)',
    emailSubjectPlaceholder: 'Subiectul emailului primit pe jeka7ro@gmail.com...',
    emailBodyLbl: 'Conținutul / Textul Emailului de Recenzie',
    emailBodyPlaceholder: 'Lipește aici corpul emailului (include ID-ul comenzii dacă apare în mail, nota 1-5⭐ sau 👍/👎 și comentariul clientului)...',
    cancelBtn: 'Anulează',
    extractEmailBtn: 'Extrage Recenzia & Leagă de Bonul iiko',
    scraperModalTitle: 'Scrapere B2B — Glovo Partner & Wolt Merchant',
    scraperModalSub: 'Extragere automată recenzii din contul master jeka7ro@gmail.com',
    scraperGlovoDesc: 'Încarcă sesiunea salvată din glovo-cookies.json pentru bypass 2FA/Cloudflare, accesează portal.glovoapp.com/reviews/, extrage recenziile din DOM și calculează sentimentul.',
    scraperWoltDesc: 'Accesează merchant.wolt.com/app/experience/search cu jeka7ro@gmail.com, așteaptă confirmarea Magic Link pe email (2 minute) și extrage feedback-ul clienților.',
    orImportExcelBtn: 'Sau Importă Raport Excel/CSV',
    startScrapersBtn: 'Pornește Scanarea Portalurilor Acum'
  },
  en: {
    title: 'Customer Reviews & Ratings',
    subtitle: 'Centralized customer review inbox (Email, Excel, Glovo Partner, Wolt Merchant) automatically linked to Dispatch iiko receipts',
    searchPlaceholder: 'Search review, iiko receipt, restaurant...',
    btnImportExcel: 'Import Excel / CSV',
    btnEmail: 'Email (jeka7ro@gmail.com)',
    btnPortal: 'B2B Portal (Glovo/Wolt)',
    btnRefresh: 'Refresh reviews',
    kpiAvgTitle: 'Platform Average Score',
    kpiAvgSub: 'Auto-synced at 11:00, 13:00, 17:00, 18:00, 19:00',
    kpiTotalTitle: 'Total Recorded Reviews',
    kpiTotalLinked: 'linked to iiko receipt',
    kpiPosTitle: 'Positive Sentiment (≥ 8 / ≥ 4⭐)',
    kpiPosCount: 'positive reviews',
    kpiPosSub: 'Automated score + RO/EN keyword analysis',
    kpiNegTitle: 'Negative Reviews / Alerts (≤ 5)',
    kpiNegSub1: 'requires receipt & kitchen check',
    kpiNegSub2: 'Automatically attached as alert on Dispatch order',
    filterAll: 'All Reviews',
    filterNegative: '🚨 Negative / Alerts',
    filterPositive: '👍 Positive',
    filterWithComment: '💬 With Text Comment',
    filterMatched: '🔗 Linked to iiko Receipt',
    filterAllPlatforms: 'All Platforms',
    autoTranslateLabel: 'Auto-Translate Reviews (EN)',
    showOriginalLabel: 'Show original (RO)',
    translatedBadge: 'Translated to EN',
    thNr: '#',
    thDateSource: 'Date',
    thLocationPlatform: 'Location & Client',
    thRatingSentiment: 'Score',
    thComment: 'Customer Comment',
    thOrder: 'Order / Action',
    sortDateDesc: 'Date: Newest ↓',
    sortDateAsc: 'Date: Oldest ↑',
    sortRatingDesc: 'Score: High → Low ↓',
    sortRatingAsc: 'Score: Low → High ↑',
    sortOrderDesc: 'Receipt Total ↓',
    rowsLbl: 'Rows:',
    allRows: 'All',
    totalLbl: 'Total',
    reviewsCountLbl: 'reviews',
    pageLbl: 'Page',
    ofLbl: 'of',
    loadingReviews: 'Loading reviews and linked iiko receipts...',
    emptyReviews: 'No reviews match the selected filters. You can import an Excel/CSV file or parse a review email from Glovo/Wolt/Bolt.',
    sourceEmail: '📧 Email (jeka7ro)',
    sourceExcel: '📊 Excel Import',
    sourcePortal: '🤖 B2B Portal',
    sourceWebhook: '⚡ Live Webhook',
    sourceAlert: '📉 Rating Drop Alert',
    sourcePublic: '🌐 Platform Rating',
    clientLbl: 'Customer:',
    sentimentNeg: 'Negative 🚨',
    sentimentPos: 'Positive 👍',
    sentimentNeu: 'Neutral',
    noComment: 'Rating without text comment',
    receiptBtn: 'View iiko Receipt',
    receiptPrefix: 'Receipt',
    cookTimeLbl: 'Cooked:',
    cycleTimeLbl: 'Cycle:',
    extIdLbl: 'External ID:',
    noOrderId: 'No order ID attached',
    emailModalTitle: 'Review Email Connection (jeka7ro@gmail.com)',
    emailModalSub: 'Automatically extracts Restaurant, Platform, Score, Comment and links to iiko Order',
    emailConnectedBadge: '● Connected Account: jeka7ro@gmail.com (Glovo / Wolt / Bolt / Google)',
    copyWebhookBtn: 'Copy Mail Webhook',
    copiedBtn: 'Copied!',
    emailModalDesc: 'You can auto-forward emails to /api/webhooks/email-review or paste any received review email below for instant linking to the iiko receipt:',
    emailSubjectLbl: 'Email Subject (e.g. "New review on Glovo - Smash Me Constanta - Order #118248")',
    emailSubjectPlaceholder: 'Subject of the email received on jeka7ro@gmail.com...',
    emailBodyLbl: 'Review Email Body / Content',
    emailBodyPlaceholder: 'Paste the email body here (include order ID if present, 1-5⭐ or 👍/👎 score and customer comment)...',
    cancelBtn: 'Cancel',
    extractEmailBtn: 'Extract Review & Link to iiko Receipt',
    scraperModalTitle: 'B2B Scrapers — Glovo Partner & Wolt Merchant',
    scraperModalSub: 'Automated review extraction from master account jeka7ro@gmail.com',
    scraperGlovoDesc: 'Loads saved session from glovo-cookies.json to bypass 2FA/Cloudflare, opens portal.glovoapp.com/reviews/, extracts DOM reviews and computes sentiment.',
    scraperWoltDesc: 'Opens merchant.wolt.com/app/experience/search with jeka7ro@gmail.com, waits for Magic Link confirmation via email (2 minutes) and extracts customer feedback.',
    orImportExcelBtn: 'Or Import Excel/CSV Report',
    startScrapersBtn: 'Start Portal Scan Now'
  },
  ru: {
    title: 'Отзывы клиентов и Рейтинг',
    subtitle: 'Единый центр отзывов клиентов (Email, Excel, Glovo Partner, Wolt Merchant), автоматически связанный с чеками iiko в Диспетчерской',
    searchPlaceholder: 'Поиск отзыва, чека iiko, ресторана...',
    btnImportExcel: 'Импорт Excel / CSV',
    btnEmail: 'Почта (jeka7ro@gmail.com)',
    btnPortal: 'B2B Портал (Glovo/Wolt)',
    btnRefresh: 'Обновить отзывы',
    kpiAvgTitle: 'Средний рейтинг платформ',
    kpiAvgSub: 'Авто-синхронизация в 11:00, 13:00, 17:00, 18:00, 19:00',
    kpiTotalTitle: 'Всего зарегистрировано отзывов',
    kpiTotalLinked: 'связано с чеком iiko',
    kpiPosTitle: 'Позитивные отзывы (≥ 8 / ≥ 4⭐)',
    kpiPosCount: 'позитивных отзывов',
    kpiPosSub: 'Авто-анализ оценки и ключевых слов',
    kpiNegTitle: 'Негативные отзывы / Алерты (≤ 5)',
    kpiNegSub1: 'требует проверки чека и кухни',
    kpiNegSub2: 'Автоматически прикрепляется как алерт к заказу в Диспетчерской',
    filterAll: 'Все отзывы',
    filterNegative: '🚨 Негативные / Алерты',
    filterPositive: '👍 Позитивные',
    filterWithComment: '💬 С текстом отзыва',
    filterMatched: '🔗 Связанные с чеком iiko',
    filterAllPlatforms: 'Все платформы',
    autoTranslateLabel: 'Автоперевод отзывов (RU)',
    showOriginalLabel: 'Показать оригинал (RO)',
    translatedBadge: 'Переведено на RU',
    thNr: '#',
    thDateSource: 'Дата',
    thLocationPlatform: 'Точка и Клиент',
    thRatingSentiment: 'Оценка',
    thComment: 'Комментарий клиента',
    thOrder: 'Заказ / Действие',
    sortDateDesc: 'Дата: Сначала новые ↓',
    sortDateAsc: 'Дата: Сначала старые ↑',
    sortRatingDesc: 'Оценка: По убыванию ↓',
    sortRatingAsc: 'Оценка: По возрастанию ↑',
    sortOrderDesc: 'Сумма чека ↓',
    rowsLbl: 'Строк:',
    allRows: 'Все',
    totalLbl: 'Всего',
    reviewsCountLbl: 'отзывов',
    pageLbl: 'Страница',
    ofLbl: 'из',
    loadingReviews: 'Загрузка отзывов и связанных чеков iiko...',
    emptyReviews: 'Нет отзывов по выбранным фильтрам. Вы можете импортировать файл Excel/CSV или добавить письмо из Glovo/Wolt/Bolt.',
    sourceEmail: '📧 Почта (jeka7ro)',
    sourceExcel: '📊 Импорт Excel',
    sourcePortal: '🤖 B2B Портал',
    sourceWebhook: '⚡ Live Вебхук',
    sourceAlert: '📉 Алерт снижения рейтинга',
    sourcePublic: '🌐 Оценка платформы',
    clientLbl: 'Клиент:',
    sentimentNeg: 'Негативный 🚨',
    sentimentPos: 'Позитивный 👍',
    sentimentNeu: 'Нейтральный',
    noComment: 'Оценка без текстового комментария',
    receiptBtn: 'Открыть чек iiko',
    receiptPrefix: 'Чек',
    cookTimeLbl: 'Кухня:',
    cycleTimeLbl: 'Цикл:',
    extIdLbl: 'Внешний ID:',
    noOrderId: 'Без привязки к ID заказа',
    emailModalTitle: 'Подключение почты отзывов (jeka7ro@gmail.com)',
    emailModalSub: 'Автоматически извлекает Ресторан, Платформу, Оценку, Комментарий и связывает с заказом iiko',
    emailConnectedBadge: '● Подключенный аккаунт: jeka7ro@gmail.com (Glovo / Wolt / Bolt / Google)',
    copyWebhookBtn: 'Скопировать вебхук почты',
    copiedBtn: 'Скопировано!',
    emailModalDesc: 'Вы можете настроить автопересылку писем на /api/webhooks/email-review или вставить текст письма ниже для мгновенной привязки к чеку iiko:',
    emailSubjectLbl: 'Тема письма (напр.: «New review on Glovo - Smash Me Constanta - Order #118248»)',
    emailSubjectPlaceholder: 'Тема письма, полученного на jeka7ro@gmail.com...',
    emailBodyLbl: 'Текст / Содержимое письма с отзывом',
    emailBodyPlaceholder: 'Вставьте сюда текст письма (включая номер заказа, оценку 1-5⭐ или 👍/👎 и комментарий клиента)...',
    cancelBtn: 'Отмена',
    extractEmailBtn: 'Извлечь отзыв и связать с чеком iiko',
    scraperModalTitle: 'B2B Скраперы — Glovo Partner и Wolt Merchant',
    scraperModalSub: 'Автоматическое извлечение отзывов из мастер-аккаунта jeka7ro@gmail.com',
    scraperGlovoDesc: 'Загружает сохраненную сессию из glovo-cookies.json для обхода 2FA/Cloudflare, открывает portal.glovoapp.com/reviews/, извлекает отзывы и определяет тональность.',
    scraperWoltDesc: 'Открывает merchant.wolt.com/app/experience/search с jeka7ro@gmail.com, ожидает подтверждения Magic Link на почте (2 минуты) и загружает отзывы.',
    orImportExcelBtn: 'Или импортировать Excel/CSV отчет',
    startScrapersBtn: 'Запустить сканирование порталов сейчас'
  }
}

export default function Reputation() {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()
  const { restaurants } = useLiveChecks()
  const [searchParams] = useSearchParams()

  const L = UI_TEXT[language] || UI_TEXT.ro

  const [activeBrand, setActiveBrand] = useState(() => searchParams.get('brand') || 'all')
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [reviewFilter, setReviewFilter] = useState('all')
  const [reviewPlatformFilter, setReviewPlatformFilter] = useState(() => searchParams.get('platform') || 'all')

  // Sortare tabel (implicit după dată descrescător = cele mai noi primele) + Paginare & Selector de rânduri
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [rowsPerPage, setRowsPerPage] = useState(15)
  const [page, setPage] = useState(1)

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }))
    setPage(1)
  }

  // Auto-translate review comments into the language selected in the top-right selector (RU / EN / RO)
  const [translateComments, setTranslateComments] = useState(true)
  const [showOriginalMap, setShowOriginalMap] = useState({})
  const [dynamicTranslations, setDynamicTranslations] = useState({})

  const [reviewsData, setReviewsData] = useState({ reviews: [], kpis: null, ratings_by_restaurant: {} })
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null)
  const [toastNotice, setToastNotice] = useState(null)
  const fileInputRef = useRef(null)

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailModalTab, setEmailModalTab] = useState('imap') // 'imap' | 'script' | 'paste'
  const [imapEmail, setImapEmail] = useState('jeka7ro@gmail.com')
  const [imapAppPassword, setImapAppPassword] = useState('')
  const [imapConfigInfo, setImapConfigInfo] = useState(null)
  const [imapSyncing, setImapSyncing] = useState(false)
  const [copiedScript, setCopiedScript] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailParsing, setEmailParsing] = useState(false)
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false)
  const [isScrapingPortals, setIsScrapingPortals] = useState(false)
  const [showScraperInfoModal, setShowScraperInfoModal] = useState(false)

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'

  const showToast = useCallback((type, text) => {
    setToastNotice({ type, text })
    setTimeout(() => setToastNotice(null), 5500)
  }, [])

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true)
    try {
      const res = await fetch(getApiUrl('/api/reviews?limit=300'))
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setReviewsData({
            reviews: data.reviews || [],
            kpis: data.kpis || null,
            ratings_by_restaurant: data.ratings_by_restaurant || {}
          })
        }
      }
    } catch (err) {
      console.error('[Reputation] fetchReviews error:', err)
    } finally {
      setReviewsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReviews()
    fetch(getApiUrl('/api/reviews/email-config'))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.success && d.config) {
          setImapConfigInfo(d.config)
          if (d.config.email) setImapEmail(d.config.email)
        }
      })
      .catch(() => {})
  }, [fetchReviews])

  const handleSyncImap = async (e) => {
    if (e) e.preventDefault()
    setImapSyncing(true)
    try {
      const payload = { email: imapEmail }
      if (imapAppPassword.trim()) payload.appPassword = imapAppPassword.trim()
      const res = await fetch(getApiUrl('/api/reviews/email-sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', `Inbox Gmail verificat (${data.checked || 0} mailuri recente, ${data.imported || 0} recenzii noi importate!)`)
        setImapAppPassword('')
        setShowEmailModal(false)
        fetchReviews()
        const cfgRes = await fetch(getApiUrl('/api/reviews/email-config')).then(r => r.json()).catch(() => null)
        if (cfgRes?.config) setImapConfigInfo(cfgRes.config)
      } else {
        showToast('error', data.error || 'Eroare sincronizare IMAP Gmail')
      }
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setImapSyncing(false)
    }
  }

  // Whenever language is 'ru' or 'en', translate any custom comments that don't yet have a distinct translation
  useEffect(() => {
    if (!translateComments || language === 'ro') return
    const list = reviewsData.reviews || []
    let cancelled = false

    async function translateMissing() {
      for (const rv of list.slice(0, 40)) {
        if (cancelled) break
        if (!rv.comment) continue
        const existing = rv.comment_translations?.[language] || dynamicTranslations[`${rv.id}_${language}`]
        if (existing && existing !== rv.comment) continue

        try {
          const res = await fetch(getApiUrl('/api/reviews/translate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: rv.comment, target_lang: language, review_id: rv.id })
          })
          if (res.ok) {
            const d = await res.json()
            if (d.success && d.translated && !cancelled) {
              setDynamicTranslations(prev => ({ ...prev, [`${rv.id}_${language}`]: d.translated }))
            }
          }
        } catch (_) {}
      }
    }

    translateMissing()
    return () => { cancelled = true }
  }, [language, translateComments, reviewsData.reviews])

  const getDisplayedComment = (rv) => {
    if (!rv.comment) return ''
    if (!translateComments || language === 'ro' || showOriginalMap[rv.id]) {
      return rv.comment
    }
    return (
      dynamicTranslations[`${rv.id}_${language}`] ||
      rv.comment_translations?.[language] ||
      rv.comment
    )
  }

  function deduceBrandName(r) {
    return getBrandInfo(r).name
  }

  const { groupedByBrand, allBrands } = useMemo(() => {
    const grouped = {
      'Roll Master': [],
      'Poki Woki': [],
      'Love Sushi': [],
      'Smash Me': [],
      'Crunch': []
    }
    restaurants.forEach(r => {
      if (!r.is_active) return
      const brand = deduceBrandName(r)
      if (grouped[brand]) grouped[brand].push(r)
      else grouped['Roll Master'].push(r)
    })
    return {
      groupedByBrand: grouped,
      allBrands: ['all', ...AUTHORITATIVE_BRANDS]
    }
  }, [restaurants])

  // MECANISMUL 1: Import Manual din Excel / CSV (handleFileUpload cu XLSX)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      if (!rawRows || rawRows.length === 0) {
        showToast('error', 'Excel/CSV file is empty.')
        return
      }

      const findKey = (obj, candidates) => {
        const keys = Object.keys(obj)
        for (const cand of candidates) {
          const found = keys.find(k => k.toLowerCase().trim().includes(cand))
          if (found) return obj[found]
        }
        return ''
      }

      const parsedReviews = rawRows.map((row) => {
        const rawRating = findKey(row, ['rating', 'score', 'nota', 'notă', 'stars', 'stele', 'evaluare', 'thumbs'])
        let numRating = parseFloat(String(rawRating).replace(',', '.'))
        if (isNaN(numRating)) {
          const strVal = String(rawRating).toLowerCase()
          numRating = (strVal.includes('neg') || strVal.includes('down') || strVal.includes('👎')) ? 2 : 5
        }
        const maxScale = numRating > 5 ? 10 : 5
        const comment = String(findKey(row, ['comment', 'review', 'comentariu', 'feedback', 'text', 'mesaj', 'reason', 'motiv']) || '').trim()
        const orderId = String(findKey(row, ['order_id', 'order id', 'order_code', 'order code', 'comanda', 'comandă', 'bon', 'order number', 'id']) || '').trim()
        const platformRaw = String(findKey(row, ['platform', 'platforma', 'canal', 'source', 'app']) || '').toLowerCase()
        const platform = platformRaw.includes('wolt') ? 'wolt' : platformRaw.includes('bolt') ? 'bolt' : (file.name.toLowerCase().includes('wolt') ? 'wolt' : file.name.toLowerCase().includes('bolt') ? 'bolt' : 'glovo')
        const restName = String(findKey(row, ['restaurant', 'store', 'locatie', 'locație', 'venue', 'branch']) || '').trim()
        const customerName = String(findKey(row, ['customer', 'client', 'author', 'user', 'nume']) || `Client ${platform.toUpperCase()}`).trim()
        const reviewedAt = findKey(row, ['date', 'data', 'created_at', 'reviewed_at', 'time', 'timestamp']) || new Date().toISOString()

        const r10 = maxScale === 10 ? numRating : numRating * 2
        let sentiment = 'neutral'
        if (r10 >= 8) sentiment = 'positive'
        else if (r10 <= 5) sentiment = 'negative'

        return {
          order_id: orderId,
          platform,
          rating: numRating,
          max_scale: maxScale,
          comment,
          sentiment,
          customer_name: customerName,
          restaurant_name: restName,
          reviewed_at: reviewedAt
        }
      })

      const res = await fetch(getApiUrl('/api/reviews/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews: parsedReviews, source: 'excel_import' })
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', `Excel: ${data.added || parsedReviews.length} (${data.matched_orders || 0} iiko)`)
        fetchReviews()
      } else {
        showToast('error', data.error || 'Import error')
      }
    } catch (err) {
      showToast('error', err.message)
    }
  }

  // MECANISMUL 2A: Parsare Email Recenzie (jeka7ro@gmail.com)
  const handleParseEmail = async (e) => {
    e.preventDefault()
    if (!emailSubject.trim() && !emailBody.trim()) return
    setEmailParsing(true)
    try {
      const res = await fetch(getApiUrl('/api/reviews/parse-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailSubject,
          body: emailBody,
          from: 'jeka7ro@gmail.com',
          receivedAt: new Date().toISOString()
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', `Email salvat (${data.matched_orders > 0 ? 'legat de bonul iiko!' : 'OK'})`)
        setEmailSubject('')
        setEmailBody('')
        setShowEmailModal(false)
        fetchReviews()
      } else {
        showToast('error', data.error || 'Error')
      }
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setEmailParsing(false)
    }
  }

  // MECANISMUL 2B: Pornire Scrapere Puppeteer B2B (GlovoPartnerScraper & WoltPartnerScraper)
  const handleTriggerPortalScrapers = async () => {
    setIsScrapingPortals(true)
    try {
      const res = await fetch(getApiUrl('/api/reviews/scrape-portals'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', data.message)
      } else {
        showToast('error', data.error || 'Error')
      }
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setTimeout(() => {
        setIsScrapingPortals(false)
        fetchReviews()
      }, 3000)
    }
  }

  const filteredReviews = useMemo(() => {
    let list = [...(reviewsData.reviews || [])]
    if (activeBrand !== 'all') {
      list = list.filter(rv => {
        if (rv.brand_name && rv.brand_name === activeBrand) return true
        const restObj = restaurants.find(r => r.id === (rv.restaurant_id || rv.location_id)) || { name: rv.restaurant_name }
        return deduceBrandName(restObj) === activeBrand
      })
    }
    if (reviewPlatformFilter !== 'all') {
      list = list.filter(rv => (rv.platform || '').toLowerCase() === reviewPlatformFilter)
    }
    if (reviewFilter === 'negative') {
      list = list.filter(rv => rv.sentiment === 'negative')
    } else if (reviewFilter === 'positive') {
      list = list.filter(rv => rv.sentiment === 'positive')
    } else if (reviewFilter === 'with_comment') {
      list = list.filter(rv => rv.comment && rv.comment.trim().length > 0 && !rv.comment.startsWith('Evaluare publică'))
    } else if (reviewFilter === 'matched') {
      list = list.filter(rv => !!rv.matched_order)
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(rv => {
        const translatedComment = getDisplayedComment(rv).toLowerCase()
        return (
          (rv.restaurant_name && rv.restaurant_name.toLowerCase().includes(s)) ||
          (rv.city && rv.city.toLowerCase().includes(s)) ||
          (rv.comment && rv.comment.toLowerCase().includes(s)) ||
          translatedComment.includes(s) ||
          (rv.customer_name && rv.customer_name.toLowerCase().includes(s)) ||
          (rv.order_id && String(rv.order_id).toLowerCase().includes(s)) ||
          (rv.matched_order?.order_number && String(rv.matched_order.order_number).toLowerCase().includes(s))
        )
      })
    }

    // Sortare după coloana selectată (implicit: 'date' desc)
    const dir = sortConfig.direction === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortConfig.key === 'date') {
        const tA = new Date(a.reviewed_at || 0).getTime()
        const tB = new Date(b.reviewed_at || 0).getTime()
        return (tA - tB) * dir
      }
      if (sortConfig.key === 'location') {
        const locA = `${a.city || ''} ${a.restaurant_name || ''}`.toLowerCase()
        const locB = `${b.city || ''} ${b.restaurant_name || ''}`.toLowerCase()
        return locA.localeCompare(locB) * dir
      }
      if (sortConfig.key === 'rating') {
        const normA = (Number(a.rating) || 0) / ((a.max_rating || a.max_scale) === 10 ? 10 : 5)
        const normB = (Number(b.rating) || 0) / ((b.max_rating || b.max_scale) === 10 ? 10 : 5)
        return (normA - normB) * dir
      }
      if (sortConfig.key === 'order') {
        const amtA = Number(a.matched_order?.total_amount || 0)
        const amtB = Number(b.matched_order?.total_amount || 0)
        return (amtA - amtB) * dir
      }
      return 0
    })

    return list
  }, [reviewsData.reviews, activeBrand, reviewPlatformFilter, reviewFilter, search, restaurants, language, translateComments, dynamicTranslations, showOriginalMap, sortConfig])

  // Reset page when filters or rowsPerPage change
  useEffect(() => {
    setPage(1)
  }, [activeBrand, reviewPlatformFilter, reviewFilter, search, rowsPerPage])

  const total = filteredReviews.length
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * rowsPerPage
  const paginatedReviews = filteredReviews.slice(startIndex, startIndex + rowsPerPage)

  return (
    <div className="flex flex-col w-full space-y-3 pb-6">
      {/* Hidden Excel/CSV Input for Mecanismul 1 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Internal Toast Notification Banner */}
      {toastNotice && (
        <div className={`px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
          toastNotice.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
        }`}>
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            {toastNotice.type === 'error' ? <AlertTriangle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
            <span>{toastNotice.text}</span>
          </div>
          <button onClick={() => setToastNotice(null)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            <X size={14} />
          </button>
        </div>
      )}

      {/* HEADER OPERAȚIONAL (O SINGURĂ LINIE CURATĂ, BUTOANE ICONIȚE) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 shrink-0">
          <Star size={20} className="text-amber-500 fill-amber-400 shrink-0" />
          <span>{L.title}</span>
        </h2>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Căutare */}
          <div className="relative flex-1 sm:w-80 sm:flex-none">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={L.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-10 pr-4 h-10 text-sm rounded-full border outline-none transition-all shadow-xs ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
              }`}
            />
          </div>

          {/* Butoane Iconițe Aliniate Curat pe un Singur Rând */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 1. Email Recenzii (jeka7ro@gmail.com) */}
            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              title={L.btnEmail}
              className={`relative w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                isDark
                  ? 'border-blue-500/40 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400'
                  : 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600'
              }`}
            >
              <Mail size={16} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"></span>
            </button>

            {/* 2. Importă Excel / CSV */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={L.btnImportExcel}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                isDark
                  ? 'border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                  : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
              }`}
            >
              <Upload size={16} />
            </button>

            {/* 3. Scrapere Portal B2B (Glovo/Wolt) */}
            <button
              type="button"
              onClick={() => setShowScraperInfoModal(true)}
              title={L.btnPortal}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                isDark
                  ? 'border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400'
                  : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-600'
              }`}
            >
              <Bot size={16} className={isScrapingPortals ? 'animate-spin' : ''} />
            </button>

            {/* 4. Refresh Recenzii */}
            <button
              type="button"
              onClick={fetchReviews}
              title={L.btnRefresh}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                isDark ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
              }`}
            >
              <RotateCw size={15} className={reviewsLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* TABS BRANDURI */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        {allBrands.map(brand => {
          const isActive = activeBrand === brand
          const count = brand === 'all' ? restaurants.filter(r => r.is_active).length : groupedByBrand[brand]?.length || 0
          return (
            <button
              key={brand}
              onClick={() => setActiveBrand(brand)}
              className={`px-4 h-9 rounded-full text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isDark
                    ? 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {brand !== 'all' ? (
                <BrandAvatar brand={brand} size={18} className="rounded-full shrink-0" />
              ) : (
                <Store size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              )}
              <span>{brand === 'all' ? t('common.all_brands') : brand}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isActive
                  ? 'bg-white/20 text-white'
                  : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 4 CARDURI KPI COMPACTE (O SINGURĂ LINIE PER CARD — NU OCUPĂ ECRANUL) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        <div className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
        }`}>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {L.kpiAvgTitle}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-black text-amber-600 dark:text-amber-400">
              <PlatformLogo platform="glovo" size={12} />
              {reviewsData.kpis?.avg_glovo_rating || reviewsData.kpis?.avg_glovo || 9.8}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs font-black text-sky-600 dark:text-sky-400">
              <PlatformLogo platform="wolt" size={12} />
              {reviewsData.kpis?.avg_wolt_rating || reviewsData.kpis?.avg_wolt || 9.7}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-emerald-600 dark:text-emerald-400">
              <PlatformLogo platform="bolt" size={12} />
              {reviewsData.kpis?.avg_bolt_rating || reviewsData.kpis?.avg_bolt || 4.8}
            </span>
          </div>
        </div>

        <div className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
        }`}>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {L.kpiTotalTitle}
          </span>
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-lg font-black">{reviewsData.kpis?.total_reviews || filteredReviews.length}</span>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              ({reviewsData.kpis?.with_order_count ?? reviewsData.kpis?.matched_orders_count ?? 0} iiko)
            </span>
          </div>
        </div>

        <div className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
        }`}>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {L.kpiPosTitle}
          </span>
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {reviewsData.kpis?.positive_rate ?? reviewsData.kpis?.positive_pct ?? 92}%
            </span>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              ({reviewsData.kpis?.positive_count || 0})
            </span>
          </div>
        </div>

        <div className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
        }`}>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500 truncate">
            {L.kpiNegTitle}
          </span>
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-lg font-black text-rose-600 dark:text-rose-400">
              {reviewsData.kpis?.negative_count || 0}
            </span>
            <ThumbsDown size={13} className="text-rose-500" />
          </div>
        </div>
      </div>

      {/* BARA DE FILTRE PE O SINGURĂ LINIE COMPACTĂ */}
      <div className={`px-3 py-2 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
      }`}>
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'all', label: L.filterAll },
            { id: 'negative', label: L.filterNegative },
            { id: 'positive', label: L.filterPositive },
            { id: 'with_comment', label: L.filterWithComment },
            { id: 'matched', label: L.filterMatched }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReviewFilter(tab.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                reviewFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Selector Sortare Rapidă */}
          <select
            value={`${sortConfig.key}_${sortConfig.direction}`}
            onChange={(e) => {
              const [key, direction] = e.target.value.split('_')
              setSortConfig({ key, direction })
              setPage(1)
            }}
            className={`h-8 px-2.5 rounded-full border text-xs font-bold outline-none cursor-pointer transition-colors ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <option value="date_desc">{L.sortDateDesc}</option>
            <option value="date_asc">{L.sortDateAsc}</option>
            <option value="rating_desc">{L.sortRatingDesc}</option>
            <option value="rating_asc">{L.sortRatingAsc}</option>
            <option value="order_desc">{L.sortOrderDesc}</option>
          </select>

          {/* Buton Iconiță Auto-Traducere */}
          <button
            type="button"
            onClick={() => setTranslateComments(prev => !prev)}
            title={`${L.autoTranslateLabel}: ${translateComments ? 'ON' : 'OFF'}`}
            className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border shrink-0 ${
              translateComments
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : isDark
                  ? 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Globe size={14} />
            {translateComments && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900"></span>
            )}
          </button>

          <div className="flex items-center gap-1">
            {['all', 'glovo', 'wolt', 'bolt', 'google'].map(plat => (
              <button
                key={plat}
                type="button"
                onClick={() => setReviewPlatformFilter(plat)}
                title={plat === 'all' ? L.filterAllPlatforms : plat.toUpperCase()}
                className={`h-8 ${plat === 'all' ? 'px-2.5' : 'w-8 justify-center'} rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 ${
                  reviewPlatformFilter === plat
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white ring-2 ring-emerald-500/30'
                    : isDark
                      ? 'border-slate-800 text-slate-400 hover:bg-slate-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {plat !== 'all' ? <PlatformLogo platform={plat} size={16} /> : <span>{L.filterAllPlatforms}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABEL INBOX RECENZII (100% ÎN FEREASTRĂ, FĂRĂ SCROLL ORIZONTAL) */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="w-full overflow-x-hidden">
          <table className="w-full text-left border-collapse table-auto">
            <thead className={`text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 select-none border-b ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
            }`}>
              <tr>
                <th className="px-2 py-3 w-9 text-center">{L.thNr}</th>
                <th
                  onClick={() => handleSort('date')}
                  className="px-2.5 py-3 w-28 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>{L.thDateSource}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('location')}
                  className="px-2.5 py-3 w-44 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>{L.thLocationPlatform}</span>
                    {sortConfig.key === 'location' && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('rating')}
                  className="px-2 py-3 w-24 text-center cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>{L.thRatingSentiment}</span>
                    {sortConfig.key === 'rating' && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-2.5 py-3">{L.thComment}</th>
                <th
                  onClick={() => handleSort('order')}
                  className="px-2.5 py-3 w-52 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>{L.thOrder}</span>
                    {sortConfig.key === 'order' && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y text-sm ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {reviewsLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <Loader2 className="animate-spin text-emerald-600 mx-auto mb-2" size={28} />
                    <p className="text-xs font-bold text-slate-500">{L.loadingReviews}</p>
                  </td>
                </tr>
              ) : paginatedReviews.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-500">
                    {L.emptyReviews}
                  </td>
                </tr>
              ) : paginatedReviews.map((rv, index) => {
                const isNeg = rv.sentiment === 'negative'
                const isPos = rv.sentiment === 'positive'
                const ord = rv.matched_order
                const displayedComment = getDisplayedComment(rv)
                const isTranslated = translateComments && language !== 'ro' && !showOriginalMap[rv.id] && displayedComment !== rv.comment
                const bName = rv.brand_name || deduceBrandName({ name: rv.restaurant_name }) || 'Roll Master'

                const sourceLabel =
                  rv.source === 'email' ? L.sourceEmail :
                  rv.source === 'excel_import' ? L.sourceExcel :
                  rv.source === 'portal_scraper' ? L.sourcePortal :
                  rv.source === 'webhook' ? L.sourceWebhook :
                  rv.source === 'rating_history_alert' ? L.sourceAlert :
                  L.sourcePublic

                return (
                  <tr
                    key={rv.id}
                    className={`transition-colors ${
                      isNeg
                        ? isDark ? 'bg-rose-950/15 hover:bg-rose-950/25' : 'bg-rose-50/40 hover:bg-rose-50/70'
                        : isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Nr. Crt. */}
                    <td className="px-2 py-3 align-top text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {startIndex + index + 1}
                    </td>

                    <td className="px-2.5 py-3 align-top whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {new Date(rv.reviewed_at).toLocaleDateString(localeCode, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {new Date(rv.reviewed_at).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border truncate max-w-[105px] ${
                        isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`} title={sourceLabel}>
                        {sourceLabel}
                      </span>
                    </td>

                    <td className="px-2.5 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <PlatformLogo platform={rv.platform || 'glovo'} size={18} className="shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[150px]" title={cleanRestaurantName(rv.restaurant_name || 'Locație')}>
                            {cleanRestaurantName(rv.restaurant_name || 'Locație')}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                            {rv.city || 'România'} • <span className="uppercase">{rv.platform}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[150px]">
                            {L.clientLbl} <strong className="text-slate-700 dark:text-slate-300">{rv.customer_name || 'Client'}</strong>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-2 py-3 align-top text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                          isNeg
                            ? 'bg-rose-600 text-white'
                            : isPos
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-500 text-white'
                        }`}>
                          <Star size={11} className="fill-white" />
                          <span>{rv.rating}{(rv.max_rating || rv.max_scale) === 10 ? '/10' : '/5'}</span>
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase tracking-wider ${
                          isNeg ? 'text-rose-600 dark:text-rose-400' : isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {isNeg ? L.sentimentNeg : isPos ? L.sentimentPos : L.sentimentNeu}
                        </span>
                      </div>
                    </td>

                    {/* Comentariu Client (tradus automat în RU/EN după selectorul de limbă) */}
                    <td className="px-2.5 py-3 align-top">
                      {rv.comment ? (
                        <div className="space-y-1">
                          <div className={`px-2.5 py-2 rounded-xl border text-xs leading-snug font-medium ${
                            isNeg
                              ? 'bg-rose-50/70 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800/60 dark:text-rose-200'
                              : isDark
                                ? 'bg-slate-800/60 border-slate-700/80 text-slate-200'
                                : 'bg-slate-50 border-slate-200/80 text-slate-700'
                          }`}>
                            „{displayedComment}”
                          </div>

                          {language !== 'ro' && (
                            <div className="flex items-center justify-between gap-2 px-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                <Globe size={10} />
                                {isTranslated ? L.translatedBadge : 'RO (Original)'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowOriginalMap(prev => ({ ...prev, [rv.id]: !prev[rv.id] }))}
                                className="text-[10px] font-bold underline text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                              >
                                {showOriginalMap[rv.id] ? L.autoTranslateLabel : L.showOriginalLabel}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-400">{L.noComment}</span>
                      )}
                    </td>

                    {/* Legătura cu Comanda din Dispecerat (iiko) sau Butonul Compact Google */}
                    <td className="px-2.5 py-3 align-top">
                      {ord ? (
                        <div className={`p-2 rounded-xl border space-y-1.5 ${
                          isDark ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50/90 border-slate-200/90'
                        }`}>
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-black shrink-0">
                                #{ord.order_number || ord.order_id}
                              </span>
                              <span className="text-[11px] font-extrabold text-slate-900 dark:text-white truncate">
                                {Number(ord.total_amount || 0).toFixed(0)} RON
                              </span>
                            </div>
                            <button
                              type="button"
                              title={L.receiptBtn}
                              onClick={() => setSelectedOrderForModal({
                                ...ord,
                                brand_name: bName,
                                review: {
                                  rating: rv.rating,
                                  max_scale: rv.max_rating || rv.max_scale,
                                  comment: displayedComment,
                                  translations: rv.translations,
                                  sentiment: rv.sentiment,
                                  source: sourceLabel
                                }
                              })}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            >
                              <Receipt size={11} />
                              <span>iiko</span>
                            </button>
                          </div>

                          {ord.items && ord.items.length > 0 && (
                            <div className="space-y-1 pt-0.5">
                              {ord.items.slice(0, 2).map((it, idx) => {
                                const rawName = it.name || it.product_name || 'Produs'
                                const cleanDishName = String(rawName).replace(/^(?:RM|PW|LS|SM|CR|P|G|W|B)[\s_-]+/i, '').trim() || rawName
                                const dishImg = getProductImage(
                                  rawName,
                                  bName,
                                  it.image || it.imageUrl || (Array.isArray(it.imageLinks) ? it.imageLinks[0] : null)
                                )
                                const qty = it.quantity || it.amount || 1
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => setSelectedOrderForModal({
                                      ...ord,
                                      brand_name: bName,
                                      review: {
                                        rating: rv.rating,
                                        max_scale: rv.max_rating || rv.max_scale,
                                        comment: displayedComment,
                                        translations: rv.translations,
                                        sentiment: rv.sentiment,
                                        source: sourceLabel
                                      }
                                    })}
                                    className="flex items-center gap-1.5 p-1 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/70 hover:border-emerald-400/60 transition-colors cursor-pointer"
                                  >
                                    {dishImg && (
                                      <img
                                        src={dishImg}
                                        alt={cleanDishName}
                                        className="w-6 h-6 rounded-md object-cover shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                                        loading="lazy"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                                        <span className="text-emerald-600 dark:text-emerald-400 mr-1">{qty}×</span>
                                        {cleanDishName}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                              {ord.items.length > 2 && (
                                <div className="text-[9px] font-bold text-slate-400 pl-1">
                                  + {ord.items.length - 2} produse...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : rv.platform === 'google' ? (
                        <a
                          href={rv.review_url || 'https://business.google.com/reviews'}
                          target="_blank"
                          rel="noreferrer"
                          title={language === 'ru' ? 'Ответить на отзыв в Google Business' : language === 'en' ? 'Reply to review on Google Business' : 'Răspunde la recenzie în Google Business'}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs shrink-0"
                        >
                          <PlatformLogo platform="google" size={14} className="bg-white rounded-full p-0.5" />
                          <span>{language === 'ru' ? 'Ответить ↗' : language === 'en' ? 'Reply ↗' : 'Răspunde ↗'}</span>
                        </a>
                      ) : (
                        <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <span>{rv.order_id ? `#${rv.order_id}` : '—'}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER PAGINARE & SELECTOR RÂNDURI */}
        <div className={`px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
        }`}>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>{L.rowsLbl}</span>
              <select
                value={rowsPerPage}
                onChange={e => setRowsPerPage(Number(e.target.value))}
                className={`h-8 px-3 rounded-full border text-xs font-bold outline-none cursor-pointer ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={9999}>{L.allRows}</option>
              </select>
            </div>
            <div className={`w-px h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} hidden sm:block`}></div>
            <span>
              {L.totalLbl} <span className="font-bold text-slate-900 dark:text-white">{total}</span> {L.reviewsCountLbl}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>
              {L.pageLbl} <span className="font-bold text-slate-900 dark:text-white">{total === 0 ? 0 : safePage}</span> {L.ofLbl} {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1 || total === 0}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages || total === 0}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Detalii Bon iiko */}
      <OrderDetailsModal
        order={selectedOrderForModal}
        isOpen={!!selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
      />

      {/* MODAL MECANISMUL 2A: CONECTARE EMAIL (jeka7ro@gmail.com) */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl w-full max-w-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[92vh] ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold">{L.emailModalTitle}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{L.emailModalSub}</p>
                </div>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Tabs pentru cele 3 metode de conectare a mailului */}
            <div className={`px-6 pt-3 pb-2 border-b flex flex-wrap gap-1.5 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/70'}`}>
              {[
                { id: 'imap', label: '⚡ 1. Conectare Directă Gmail (IMAP Auto-Sync)' },
                { id: 'script', label: '🤖 2. Google Apps Script (Fără Parolă, 60s)' },
                { id: 'paste', label: '📋 3. Lipește Manual un Email' }
              ].map(tItem => (
                <button
                  key={tItem.id}
                  type="button"
                  onClick={() => setEmailModalTab(tItem.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    emailModalTab === tItem.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : isDark
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tItem.label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {emailModalTab === 'imap' && (
                <form onSubmit={handleSyncImap} className="space-y-4">
                  <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    isDark ? 'bg-slate-800/50 border-slate-700/80 text-slate-300' : 'bg-blue-50/60 border-blue-200/80 text-slate-700'
                  }`}>
                    <div className="font-extrabold text-blue-600 dark:text-blue-400">
                      Cum se activează citirea automată din Gmail (la fiecare 5 minute):
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                      <li>
                        Intră pe contul tău Google la{' '}
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold underline text-blue-600 dark:text-blue-400"
                        >
                          myaccount.google.com/apppasswords
                        </a>{' '}
                        și creează o parolă de aplicație numită <strong>Monitoring</strong>.
                      </li>
                      <li>Copiază codul din 16 litere generat de Google și lipește-l mai jos.</li>
                      <li>Apasă <strong>Salvează & Sincronizează Inboxul Acum</strong> — serverul va citi automat toate recenziile venite pe mail!</li>
                    </ol>
                    {imapConfigInfo?.hasAppPassword && (
                      <div className="pt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ Parolă de aplicație salvată ({imapConfigInfo.maskedPassword})
                        {imapConfigInfo.lastSyncAt && ` • Ultima sincronizare: ${new Date(imapConfigInfo.lastSyncAt).toLocaleTimeString(localeCode)}`}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                        Adresă Gmail Recenzii
                      </label>
                      <input
                        type="email"
                        value={imapEmail}
                        onChange={e => setImapEmail(e.target.value)}
                        placeholder="jeka7ro@gmail.com"
                        className={`w-full px-3.5 h-10 rounded-xl border text-xs font-bold outline-none ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                        Google App Password (16 litere)
                      </label>
                      <input
                        type="password"
                        value={imapAppPassword}
                        onChange={e => setImapAppPassword(e.target.value)}
                        placeholder={imapConfigInfo?.hasAppPassword ? 'Salvată (lasă gol sau introdu una nouă)' : 'xxxx xxxx xxxx xxxx'}
                        className={`w-full px-3.5 h-10 rounded-xl border text-xs font-mono outline-none ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowEmailModal(false)}
                      className={`px-4 h-10 rounded-full text-xs font-bold cursor-pointer ${
                        isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {L.cancelBtn}
                    </button>
                    <button
                      type="submit"
                      disabled={imapSyncing}
                      className="px-5 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {imapSyncing ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                      <span>Salvează & Sincronizează Inboxul Acum</span>
                    </button>
                  </div>
                </form>
              )}

              {emailModalTab === 'script' && (() => {
                const webhookEndpoint = `${window.location.origin.includes('localhost') ? 'http://localhost:3002' : window.location.origin}/api/webhooks/email-review`
                const gasCode = `function forwardReviewsToAggregator() {
  var threads = GmailApp.search('newer_than:2d (glovo OR wolt OR bolt OR review OR recenzie OR feedback)', 0, 20);
  threads.forEach(function(thread) {
    var msg = thread.getMessages().pop();
    if (msg.isStarred()) return;
    UrlFetchApp.fetch('${webhookEndpoint}', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        subject: msg.getSubject(),
        body: msg.getPlainBody(),
        from: msg.getFrom(),
        receivedAt: msg.getDate().toISOString()
      })
    });
    msg.star();
  });
}`
                return (
                  <div className="space-y-3 text-xs">
                    <div className={`p-3.5 rounded-xl border space-y-1.5 ${
                      isDark ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <div className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        Alternativă fără parolă (direct din contul tău Google):
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-[11px]">
                        <li>Deschide <a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline font-bold text-blue-500">script.google.com</a> logat cu <strong>jeka7ro@gmail.com</strong> și apasă <strong>New Project</strong>.</li>
                        <li>Lipește codul de mai jos și setează un Trigger (ceasul din stânga) la fiecare <strong>5 minute</strong>.</li>
                      </ol>
                    </div>
                    <div className="relative">
                      <pre className={`p-3.5 rounded-xl border font-mono text-[11px] overflow-x-auto ${
                        isDark ? 'bg-slate-950 border-slate-800 text-emerald-300' : 'bg-slate-900 border-slate-800 text-emerald-300'
                      }`}>
                        {gasCode}
                      </pre>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(gasCode)
                          setCopiedScript(true)
                          setTimeout(() => setCopiedScript(false), 2000)
                        }}
                        className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedScript ? <Check size={11} /> : <Copy size={11} />}
                        <span>{copiedScript ? 'Copiat!' : 'Copiază Scriptul'}</span>
                      </button>
                    </div>
                  </div>
                )
              })()}

              {emailModalTab === 'paste' && (
                <form onSubmit={handleParseEmail} className="space-y-4">
                  <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    isDark ? 'bg-slate-800/50 border-slate-700/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold uppercase tracking-wider text-[10px] text-emerald-600 dark:text-emerald-400">
                        {L.emailConnectedBadge}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/email-review`)
                          setCopiedWebhookUrl(true)
                          setTimeout(() => setCopiedWebhookUrl(false), 2000)
                        }}
                        className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedWebhookUrl ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                        <span>{copiedWebhookUrl ? L.copiedBtn : L.copyWebhookBtn}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {L.emailModalDesc}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                      {L.emailSubjectLbl}
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      placeholder={L.emailSubjectPlaceholder}
                      className={`w-full px-3.5 h-10 rounded-xl border text-xs font-medium outline-none ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                      {L.emailBodyLbl}
                    </label>
                    <textarea
                      rows={5}
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                      placeholder={L.emailBodyPlaceholder}
                      className={`w-full p-3.5 rounded-xl border text-xs font-medium outline-none ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowEmailModal(false)}
                      className={`px-4 h-10 rounded-full text-xs font-bold cursor-pointer ${
                        isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {L.cancelBtn}
                    </button>
                    <button
                      type="submit"
                      disabled={emailParsing}
                      className="px-5 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {emailParsing ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      <span>{L.extractEmailBtn}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL MECANISMUL 2B: SCRAPERE PUPPETEER PORTALURI B2B */}
      {showScraperInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl w-full max-w-xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold">{L.scraperModalTitle}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{L.scraperModalSub}</p>
                </div>
              </div>
              <button onClick={() => setShowScraperInfoModal(false)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <PlatformLogo platform="glovo" size={15} />
                  <span>1. Glovo Partner (GlovoPartnerScraper)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {L.scraperGlovoDesc}
                </p>
                <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px]">
                  node workers/src/scrapers/glv-init.js
                </div>
              </div>

              <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="font-extrabold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <PlatformLogo platform="wolt" size={15} />
                  <span>2. Wolt Merchant (WoltPartnerScraper)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {L.scraperWoltDesc}
                </p>
                <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px]">
                  node workers/src/scrapers/run-reputation.js
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowScraperInfoModal(false)
                    fileInputRef.current?.click()
                  }}
                  className="px-4 h-10 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload size={14} />
                  <span>{L.orImportExcelBtn}</span>
                </button>

                <button
                  type="button"
                  disabled={isScrapingPortals}
                  onClick={() => {
                    handleTriggerPortalScrapers()
                    setShowScraperInfoModal(false)
                  }}
                  className="px-5 h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isScrapingPortals ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  <span>{L.startScrapersBtn}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
