import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
  RotateCcw,
  Sun,
  Moon,
  UserCheck
} from 'lucide-react'
import { useAuth, ROLE_META } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import AppLogo from '../components/AppLogo'
import LanguageToggle from '../components/LanguageToggle'
import UserAvatar, { compressAvatarImage } from '../components/UserAvatar'

export default function Login() {
  const {
    user,
    pendingFirstLoginUser,
    setPendingFirstLoginUser,
    login,
    completeFirstLogin,
    requestPasswordReset,
    confirmPasswordReset
  } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { language } = useLanguage()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // Views: 'login' | 'first_login' | 'forgot_request' | 'forgot_confirm'
  const [view, setView] = useState('login')

  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  // First login form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetNewPass, setResetNewPass] = useState('')
  const [resetConfirmPass, setResetConfirmPass] = useState('')
  const [demoCodeHint, setDemoCodeHint] = useState(null)

  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    if (pendingFirstLoginUser) {
      setView('first_login')
      setFirstName(pendingFirstLoginUser.first_name || '')
      setLastName(pendingFirstLoginUser.last_name || '')
      setAvatarUrl(pendingFirstLoginUser.avatar_url || '')
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [pendingFirstLoginUser])

  useEffect(() => {
    if (user && !pendingFirstLoginUser) {
      const firstPage = (user.allowed_pages || [])[0] || 'dashboard'
      navigate(`/${firstPage === 'all' ? 'dashboard' : firstPage}`, { replace: true })
    }
  }, [user, pendingFirstLoginUser, navigate])

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    if (!email.trim() || !password) {
      setFeedback({
        type: 'error',
        text: language === 'ru' ? 'Введите email и пароль.' : 'Introdu adresa de email și parola.'
      })
      return
    }
    setLoading(true)
    try {
      const res = await login(email.trim(), password)
      if (res.mustChangePassword) {
        setView('first_login')
        setFeedback({
          type: 'info',
          text: language === 'ru'
            ? 'Первый вход по приглашению: пожалуйста, установите личный пароль.'
            : 'Prima autentificare din invitație: setează-ți propria parolă personală.'
        })
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleFirstLoginSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    if (!newPassword || newPassword.length < 6) {
      setFeedback({
        type: 'error',
        text: language === 'ru' ? 'Новый пароль должен содержать минимум 6 символов.' : 'Noua parolă trebuie să aibă minim 6 caractere.'
      })
      return
    }
    if (newPassword !== confirmPassword) {
      setFeedback({
        type: 'error',
        text: language === 'ru' ? 'Пароли не совпадают.' : 'Parolele nu coincid.'
      })
      return
    }
    setLoading(true)
    try {
      await completeFirstLogin({
        userId: pendingFirstLoginUser?.id,
        email: pendingFirstLoginUser?.email || email,
        newPassword: newPassword.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarUrl
      })
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotRequest = async (e) => {
    e.preventDefault()
    setFeedback(null)
    setDemoCodeHint(null)
    if (!resetEmail.trim()) {
      setFeedback({
        type: 'error',
        text: language === 'ru' ? 'Введите ваш email.' : 'Introdu adresa ta de email.'
      })
      return
    }
    setLoading(true)
    try {
      const res = await requestPasswordReset(resetEmail.trim())
      setView('forgot_confirm')
      if (res.demoCode) {
        setDemoCodeHint(res.demoCode)
        setResetCode(res.demoCode)
      }
      setFeedback({
        type: 'success',
        text: res.emailSent
          ? (language === 'ru' ? '6-значный код отправлен на ваш email!' : 'Codul de 6 cifre a fost trimis pe email!')
          : (language === 'ru' ? 'Код подтверждения сгенерирован.' : 'Codul de resetare a fost generat.')
      })
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotConfirm = async (e) => {
    e.preventDefault()
    setFeedback(null)
    if (!resetCode.trim()) {
      setFeedback({
        type: 'error',
        text: language === 'ru' ? 'Введите код подтверждения.' : 'Introdu codul de verificare.'
      })
      return
    }
    if (!resetNewPass || resetNewPass.length < 6) {
      setFeedback({
        type: 'error',
        text: language === 'ru' ? 'Пароль должен содержать минимум 6 символов.' : 'Parola nouă trebuie să aibă minim 6 caractere.'
      })
      return
    }
    if (resetNewPass !== resetConfirmPass) {
      setFeedback({
        type: 'error',
        text: language === 'ru' ? 'Пароли не совпадают.' : 'Parolele nu coincid.'
      })
      return
    }
    setLoading(true)
    try {
      await confirmPasswordReset({
        email: resetEmail.trim(),
        code: resetCode.trim(),
        newPassword: resetNewPass.trim()
      })
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressAvatarImage(file)
      setAvatarUrl(compressed)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    }
  }

  const logoVariant = (() => {
    try {
      return localStorage.getItem('app_logo_variant') || 'radar'
    } catch (_) {
      return 'radar'
    }
  })()

  return (
    <div
      className={`relative min-h-screen flex flex-col justify-between p-4 sm:p-6 bg-cover bg-center bg-no-repeat transition-colors ${
        isDark ? 'text-white' : 'text-slate-900'
      }`}
      style={{
        backgroundImage: "url('/login-restaurant-bg.jpg?v=4')"
      }}
    >
      {/* Subtle Ambient Overlay over Restaurant Photo */}
      <div
        className={`absolute inset-0 pointer-events-none transition-colors ${
          isDark
            ? 'bg-slate-950/65'
            : 'bg-slate-950/20'
        }`}
      />

      {/* Top Bar (Language + Theme Toggle) */}
      <div className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-end">
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'border-slate-700/80 bg-slate-900/90 text-amber-300 hover:bg-slate-800'
                : 'border-white/60 bg-white/90 text-slate-700 hover:bg-white shadow-sm'
            }`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* Center Auth Card */}
      <div className="relative z-10 w-full max-w-md mx-auto my-8">
        <div className={`rounded-3xl border shadow-2xl p-6 sm:p-8 backdrop-blur-md transition-colors ${
          isDark
            ? 'bg-slate-900/92 border-slate-800/90'
            : 'bg-white/95 border-white/80'
        }`}>
          {/* VIEW 1: LOGIN */}
          {view === 'login' && (
            <>
              <div className="text-center mb-6">
                <div className="flex justify-center mb-4">
                  <AppLogo
                    variant={logoVariant}
                    size={44}
                    showText={true}
                    isDark={isDark}
                  />
                </div>
                <h1 className="text-xl font-extrabold tracking-tight">
                  {language === 'ru' ? 'Вход в систему' : 'Autentificare în Platformă'}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ru'
                    ? 'Доступ по приглашению администратора'
                    : 'Acces securizat în platforma operațională'}
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    {language === 'ru' ? 'Email адрес' : 'Adresă de Email'}
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nume@companie.ro"
                      className={`w-full h-10 pl-10 pr-4 rounded-2xl border text-xs font-semibold outline-none transition-colors ${
                        isDark
                          ? 'bg-slate-800/90 border-slate-700 text-white focus:border-emerald-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {language === 'ru' ? 'Пароль' : 'Parolă'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email)
                        setFeedback(null)
                        setView('forgot_request')
                      }}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {language === 'ru' ? 'Забыли пароль?' : 'Ai uitat parola?'}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full h-10 pl-10 pr-10 rounded-2xl border text-xs font-semibold outline-none transition-colors ${
                        isDark
                          ? 'bg-slate-800/90 border-slate-700 text-white focus:border-emerald-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {feedback && (
                  <div className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                    feedback.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                  }`}>
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{feedback.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <span>{loading ? (language === 'ru' ? 'Вход...' : 'Se autentifică...') : (language === 'ru' ? 'Войти в платформу' : 'Intră în Platformă')}</span>
                  <ArrowRight size={14} />
                </button>
              </form>
            </>
          )}

          {/* VIEW 2: FIRST LOGIN — MANDATORY PASSWORD CHANGE & AVATAR SETUP */}
          {view === 'first_login' && (
            <>
              <div className="text-center mb-5">
                <div className="flex justify-center mb-3">
                  <UserAvatar
                    user={{
                      ...(pendingFirstLoginUser || {}),
                      first_name: firstName,
                      last_name: lastName,
                      avatar_url: avatarUrl
                    }}
                    size={58}
                    showOnlineDot
                  />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 mb-2">
                  <KeyRound size={11} />
                  <span>{language === 'ru' ? 'Активация приглашения' : 'Activare Cont din Invitație'}</span>
                </span>
                <h2 className="text-lg font-extrabold">
                  {language === 'ru' ? 'Установите ваш личный пароль' : 'Setează-ți Parola Personală'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ru'
                    ? 'При первом входе по приглашению необходимо сменить временный пароль.'
                    : 'La prima logare cu parola primită pe email este obligatorie setarea propriei parole.'}
                </p>
              </div>

              <form onSubmit={handleFirstLoginSubmit} className="space-y-3.5">
                {/* Avatar Upload */}
                <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                }`}>
                  <div className="text-[11px] text-slate-500 dark:text-slate-300 leading-snug">
                    <strong className="block text-slate-800 dark:text-white">
                      {language === 'ru' ? 'Фото профиля (необязательно)' : 'Poză de profil (opțional)'}
                    </strong>
                    {language === 'ru' ? 'Без фото будут показаны ваши инициалы.' : 'Fără poză se vor afișa automat inițialele.'}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Upload size={12} />
                      <span>{language === 'ru' ? 'Фото' : 'Poză'}</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="p-1.5 rounded-full border border-rose-300 text-rose-500 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* First & Last Name */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {language === 'ru' ? 'Имя' : 'Prenume'}
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold outline-none ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {language === 'ru' ? 'Фамилия' : 'Nume'}
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold outline-none ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                {/* New Password & Confirm */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    {language === 'ru' ? 'Новый личный пароль' : 'Parolă Personală Nouă (min. 6 caractere)'}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    {language === 'ru' ? 'Подтвердите новый пароль' : 'Confirmă Parola Nouă'}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>

                {feedback && (
                  <div className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    feedback.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                  }`}>
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{feedback.text}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFirstLoginUser(null)
                      setView('login')
                      setFeedback(null)
                    }}
                    className={`px-4 py-2.5 rounded-full text-xs font-bold border cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'ru' ? 'Назад' : 'Înapoi'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    <span>{loading ? '...' : (language === 'ru' ? 'Сохранить пароль и войти' : 'Salvează Parola & Intră')}</span>
                  </button>
                </div>
              </form>
            </>
          )}

          {/* VIEW 3: FORGOT PASSWORD — STEP 1 (EMAIL) */}
          {view === 'forgot_request' && (
            <>
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                  <RotateCcw size={22} />
                </div>
                <h2 className="text-lg font-extrabold">
                  {language === 'ru' ? 'Восстановление пароля' : 'Resetare Parolă'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ru'
                    ? 'Введите ваш email, чтобы получить 6-значный код сброса пароля.'
                    : 'Introdu adresa ta de email pentru a primi codul de resetare.'}
                </p>
              </div>

              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    {language === 'ru' ? 'Email аккаунта' : 'Adresa de Email a contului'}
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="nume@companie.ro"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-2xl border text-xs font-semibold outline-none ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                </div>

                {feedback && (
                  <div className="px-3.5 py-2.5 rounded-xl border bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{feedback.text}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setView('login')
                      setFeedback(null)
                    }}
                    className={`px-4 py-2.5 rounded-full text-xs font-bold border cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'ru' ? 'Назад' : 'Înapoi la Login'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <span>{loading ? '...' : (language === 'ru' ? 'Отправить код на Email' : 'Trimite Cod pe Email')}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            </>
          )}

          {/* VIEW 4: FORGOT PASSWORD — STEP 2 (CODE + NEW PASSWORD) */}
          {view === 'forgot_confirm' && (
            <>
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                  <KeyRound size={22} />
                </div>
                <h2 className="text-lg font-extrabold">
                  {language === 'ru' ? 'Введите код и новый пароль' : 'Confirmă Codul & Setează Parola'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {resetEmail}
                </p>
              </div>

              <form onSubmit={handleForgotConfirm} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    {language === 'ru' ? '6-значный код из письма' : 'Cod de verificare (6 cifre)'}
                  </label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="123456"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-center tracking-widest font-mono text-sm font-extrabold outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-50 border-slate-200 text-emerald-700'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    {language === 'ru' ? 'Новый пароль' : 'Parolă Nouă (min. 6 caractere)'}
                  </label>
                  <input
                    type="password"
                    value={resetNewPass}
                    onChange={(e) => setResetNewPass(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    {language === 'ru' ? 'Подтвердите новый пароль' : 'Confirmă Parola Nouă'}
                  </label>
                  <input
                    type="password"
                    value={resetConfirmPass}
                    onChange={(e) => setResetConfirmPass(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                {feedback && (
                  <div className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    feedback.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                  }`}>
                    {feedback.type === 'error' ? <AlertCircle size={14} className="shrink-0" /> : <CheckCircle2 size={14} className="shrink-0" />}
                    <span>{feedback.text}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setView('login')
                      setFeedback(null)
                    }}
                    className={`px-4 py-2.5 rounded-full text-xs font-bold border cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'ru' ? 'Отмена' : 'Anulează'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    <span>{loading ? '...' : (language === 'ru' ? 'Сбросить пароль и войти' : 'Resetează Parola & Intră')}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center text-[11px] font-semibold text-white/80 drop-shadow-xs">
        Get App — Central Dispatch
      </div>
    </div>
  )
}

