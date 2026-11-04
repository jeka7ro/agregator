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
  const tr = (ro, en, ru) => (language === 'ru' ? ru : language === 'en' ? en : ro)
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // Views: 'login' | 'first_login' | 'forgot_request' | 'forgot_confirm'
  const [view, setView] = useState('login')

  // Login form state (initialized from remembered credentials if saved)
  const savedCreds = (() => {
    try {
      const raw = localStorage.getItem('monitoring_remember_creds')
      return raw ? JSON.parse(raw) : null
    } catch (_) {
      return null
    }
  })()

  const [email, setEmail] = useState(savedCreds?.email || '')
  const [password, setPassword] = useState(savedCreds?.password || '')
  const [rememberMe, setRememberMe] = useState(savedCreds ? Boolean(savedCreds.rememberMe) : true)
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

  const persistRememberedCredentials = (targetEmail, targetPassword, shouldRemember = rememberMe) => {
    try {
      if (shouldRemember && targetEmail && targetPassword) {
        localStorage.setItem(
          'monitoring_remember_creds',
          JSON.stringify({
            email: targetEmail.trim(),
            password: targetPassword,
            rememberMe: true
          })
        )
      } else {
        localStorage.removeItem('monitoring_remember_creds')
      }
    } catch (_) {}
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    if (!email.trim() || !password) {
      setFeedback({
        type: 'error',
        text: tr('Introdu adresa de email și parola.', 'Please enter your email address and password.', 'Введите email и пароль.')
      })
      return
    }
    setLoading(true)
    try {
      const res = await login(email.trim(), password)
      persistRememberedCredentials(email.trim(), password, rememberMe)
      if (res.mustChangePassword) {
        setView('first_login')
        setFeedback({
          type: 'info',
          text: tr(
            'Prima autentificare din invitație: setează-ți propria parolă personală.',
            'First sign-in from invitation: please set your personal password.',
            'Первый вход по приглашению: пожалуйста, установите личный пароль.'
          )
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
        text: tr(
          'Noua parolă trebuie să aibă minim 6 caractere.',
          'New password must be at least 6 characters long.',
          'Новый пароль должен содержать минимум 6 символов.'
        )
      })
      return
    }
    if (newPassword !== confirmPassword) {
      setFeedback({
        type: 'error',
        text: tr('Parolele nu coincid.', 'Passwords do not match.', 'Пароли не совпадают.')
      })
      return
    }
    setLoading(true)
    try {
      const targetEmail = pendingFirstLoginUser?.email || email
      await completeFirstLogin({
        userId: pendingFirstLoginUser?.id,
        email: targetEmail,
        newPassword: newPassword.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarUrl
      })
      persistRememberedCredentials(targetEmail, newPassword.trim(), rememberMe)
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
        text: tr('Introdu adresa ta de email.', 'Please enter your email address.', 'Введите ваш email.')
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
          ? tr('Codul de 6 cifre a fost trimis pe email!', 'The 6-digit verification code has been sent to your email!', '6-значный код отправлен на ваш email!')
          : tr('Codul de resetare a fost generat.', 'Verification code has been generated.', 'Код подтверждения сгенерирован.')
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
        text: tr('Introdu codul de verificare.', 'Please enter the verification code.', 'Введите код подтверждения.')
      })
      return
    }
    if (!resetNewPass || resetNewPass.length < 6) {
      setFeedback({
        type: 'error',
        text: tr('Parola nouă trebuie să aibă minim 6 caractere.', 'New password must be at least 6 characters long.', 'Пароль должен содержать минимум 6 символов.')
      })
      return
    }
    if (resetNewPass !== resetConfirmPass) {
      setFeedback({
        type: 'error',
        text: tr('Parolele nu coincid.', 'Passwords do not match.', 'Пароли не совпадают.')
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
      persistRememberedCredentials(resetEmail.trim(), resetNewPass.trim(), rememberMe)
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
                  {tr('Autentificare în Platformă', 'Sign in to Platform', 'Вход в систему')}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {tr(
                    'Acces securizat în platforma operațională',
                    'Secure access to the operations suite',
                    'Доступ по приглашению администратора'
                  )}
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} autoComplete="on" className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    {tr('Adresă de Email', 'Email Address', 'Email адрес')}
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="username email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={tr('nume@companie.ro', 'name@company.com', 'name@company.com')}
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
                    <label htmlFor="login-password" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {tr('Parolă', 'Password', 'Пароль')}
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
                      {tr('Ai uitat parola?', 'Forgot password?', 'Забыли пароль?')}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-password"
                      name="password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="current-password"
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

                {/* Remember Password Checkbox */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setRememberMe(checked)
                        if (!checked) {
                          try {
                            localStorage.removeItem('monitoring_remember_creds')
                          } catch (_) {}
                        }
                      }}
                      className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                    />
                    <span>
                      {tr('Memorează parola', 'Remember password', 'Запомнить пароль')}
                    </span>
                  </label>
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
                  <span>
                    {loading
                      ? tr('Se autentifică...', 'Signing in...', 'Вход...')
                      : tr('Intră în Platformă', 'Sign in to Platform', 'Войти в платформу')}
                  </span>
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
                  <span>{tr('Activare Cont din Invitație', 'Account Activation from Invite', 'Активация приглашения')}</span>
                </span>
                <h2 className="text-lg font-extrabold">
                  {tr('Setează-ți Parola Personală', 'Set Your Personal Password', 'Установите ваш личный пароль')}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {tr(
                    'La prima logare cu parola primită pe email este obligatorie setarea propriei parole.',
                    'On your first sign-in with a temporary password, setting your personal password is required.',
                    'При первом входе по приглашению необходимо сменить временный пароль.'
                  )}
                </p>
              </div>

              <form onSubmit={handleFirstLoginSubmit} className="space-y-3.5">
                {/* Avatar Upload */}
                <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                }`}>
                  <div className="text-[11px] text-slate-500 dark:text-slate-300 leading-snug">
                    <strong className="block text-slate-800 dark:text-white">
                      {tr('Poză de profil (opțional)', 'Profile photo (optional)', 'Фото профиля (необязательно)')}
                    </strong>
                    {tr('Fără poză se vor afișa automat inițialele.', 'Without a photo, your initials will be displayed.', 'Без фото будут показаны ваши инициалы.')}
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
                      <span>{tr('Poză', 'Photo', 'Фото')}</span>
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
                      {tr('Prenume', 'First Name', 'Имя')}
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
                      {tr('Nume', 'Last Name', 'Фамилия')}
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
                    {tr('Parolă Personală Nouă (min. 6 caractere)', 'New Personal Password (min. 6 chars)', 'Новый личный пароль')}
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
                    {tr('Confirmă Parola Nouă', 'Confirm New Password', 'Подтвердите новый пароль')}
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
                    {tr('Înapoi', 'Back', 'Назад')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    <span>{loading ? '...' : tr('Salvează Parola & Intră', 'Save Password & Sign In', 'Сохранить пароль и войти')}</span>
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
                  {tr('Resetare Parolă', 'Password Reset', 'Восстановление пароля')}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {tr(
                    'Introdu adresa ta de email pentru a primi codul de resetare.',
                    'Enter your email address to receive a 6-digit password reset code.',
                    'Введите ваш email, чтобы получить 6-значный код сброса пароля.'
                  )}
                </p>
              </div>

              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    {tr('Adresa de Email a contului', 'Account Email Address', 'Email аккаунта')}
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder={tr('nume@companie.ro', 'name@company.com', 'name@company.com')}
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
                    {tr('Înapoi la Login', 'Back to Sign In', 'Назад')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <span>{loading ? '...' : tr('Trimite Cod pe Email', 'Send Code via Email', 'Отправить код на Email')}</span>
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
                  {tr('Confirmă Codul & Setează Parola', 'Verify Code & Set Password', 'Введите код и новый пароль')}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {resetEmail}
                </p>
              </div>

              <form onSubmit={handleForgotConfirm} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    {tr('Cod de verificare (6 cifre)', 'Verification code (6 digits)', '6-значный код из письма')}
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
                    {tr('Parolă Nouă (min. 6 caractere)', 'New Password (min. 6 chars)', 'Новый пароль')}
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
                    {tr('Confirmă Parola Nouă', 'Confirm New Password', 'Подтвердите новый пароль')}
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
                    {tr('Anulează', 'Cancel', 'Отмена')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    <span>{loading ? '...' : tr('Resetează Parola & Intră', 'Reset Password & Sign In', 'Сбросить пароль и войти')}</span>
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

