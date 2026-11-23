import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Upload,
  Trash2,
  Save,
  KeyRound,
  ShieldCheck,
  MapPin,
  Store,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import { useAuth, ROLE_META } from '../lib/AuthContext'
import { useLanguage } from '../lib/LanguageContext'
import UserAvatar, { compressAvatarImage } from './UserAvatar'

export default function UserProfileModal({ isOpen, onClose, isDark }) {
  const { user, updateProfile } = useAuth()
  const { language } = useLanguage()
  const tr = (ro, en, ru) => (language === 'ru' ? ru : language === 'en' ? en : ro)
  const fileInputRef = useRef(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    if (user && isOpen) {
      setFirstName(user.first_name || '')
      setLastName(user.last_name || '')
      setPhone(user.phone || '')
      setAvatarUrl(user.avatar_url || '')
      setNewPassword('')
      setConfirmPassword('')
      setFeedback(null)
    }
  }, [user, isOpen])

  if (!isOpen || !user) return null

  const roleMeta = ROLE_META[user.role] || ROLE_META.operational
  const roleLabel = language === 'ru' ? roleMeta.labelRu : language === 'en' ? roleMeta.labelEn : roleMeta.labelRo

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressAvatarImage(file)
      setAvatarUrl(compressed)
      setFeedback(null)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setFeedback(null)

    if (!firstName.trim()) {
      setFeedback({
        type: 'error',
        text: tr('Introdu prenumele.', 'Please enter your first name.', 'Введите имя.')
      })
      return
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setFeedback({
          type: 'error',
          text: tr('Parola trebuie să aibă minim 6 caractere.', 'Password must be at least 6 characters long.', 'Пароль должен содержать минимум 6 символов.')
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
    }

    setSaving(true)
    try {
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        avatar_url: avatarUrl,
        new_password: newPassword ? newPassword.trim() : undefined
      })
      setNewPassword('')
      setConfirmPassword('')
      setFeedback({
        type: 'success',
        text: tr('Profilul a fost actualizat cu succes!', 'Profile updated successfully!', 'Профиль успешно сохранен!')
      })
      setTimeout(() => {
        onClose()
      }, 900)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const previewUser = {
    ...user,
    first_name: firstName,
    last_name: lastName,
    avatar_url: avatarUrl
  }

  const citiesText = (user.allowed_cities || []).includes('all')
    ? tr('Toate orașele', 'All cities', 'Все города')
    : (user.allowed_cities || []).join(', ')

  const brandsText = (user.allowed_brands || []).includes('all')
    ? tr('Toate brandurile', 'All brands', 'Все бренды')
    : (user.allowed_brands || []).join(', ')

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9990] apple-sheet-backdrop flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose?.() }}
      tabIndex={-1}
    >
      <div
        className="apple-sheet w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Liquid Glass Header */}
        <div className="apple-sheet-header px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserAvatar user={previewUser} size={40} showOnlineDot />
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight leading-tight text-slate-900 dark:text-white">
                {tr('Profilul Meu și Securitate', 'My Profile & Security', 'Мой профиль и безопасность')}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[12px] text-slate-500 dark:text-slate-400">{user.email}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleMeta.badgeClass}`}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="apple-sheet-close"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto custom-scrollbar">
          {/* Avatar Photo / Initials Section */}
          <div className="apple-inset-card p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserAvatar user={previewUser} size={50} />
              <div>
                <div className="text-[12.5px] font-semibold text-slate-900 dark:text-white">
                  {tr('Poză de profil', 'Profile photo', 'Фото профиля')}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {tr(
                    'Dacă nu setezi o poză, se afișează inițialele din nume.',
                    'Initials are shown automatically if no photo is set.',
                    'Без фото отображаются инициалы имени.'
                  )}
                </p>
              </div>
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
                className="apple-btn-secondary !h-8 !px-3"
              >
                <Upload size={13} />
                <span>{tr('Încarcă', 'Upload', 'Фото')}</span>
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  title={tr('Șterge poza (folosește inițialele)', 'Remove photo (use initials)', 'Удалить фото (оставить инициалы)')}
                  className="p-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                {tr('Prenume', 'First Name', 'Имя')}
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-xl border text-[13px] font-medium outline-none transition-colors ${
                  isDark
                    ? 'bg-white/[0.06] border-white/12 text-white focus:border-[#10B981]'
                    : 'bg-white border-black/12 text-slate-900 focus:border-[#047857]'
                }`}
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                {tr('Nume de familie', 'Last Name', 'Фамилия')}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-xl border text-[13px] font-medium outline-none transition-colors ${
                  isDark
                    ? 'bg-white/[0.06] border-white/12 text-white focus:border-[#10B981]'
                    : 'bg-white border-black/12 text-slate-900 focus:border-[#047857]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              {tr('Telefon de contact', 'Contact Phone', 'Телефон')}
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+407..."
              className={`w-full px-3.5 py-2 rounded-xl border text-[13px] font-medium tabular-nums outline-none transition-colors ${
                isDark
                  ? 'bg-white/[0.06] border-white/12 text-white focus:border-[#10B981]'
                  : 'bg-white border-black/12 text-slate-900 focus:border-[#047857]'
              }`}
            />
          </div>

          {/* Access Permissions Summary */}
          <div className="apple-inset-card p-3.5 space-y-2 text-[12px]">
            <div className="flex items-center gap-1.5 font-semibold text-[#047857] dark:text-[#10B981]">
              <ShieldCheck size={14} />
              <span>{tr('Permisiuni și perimetru de acces', 'Access permissions & scope', 'Права доступа аккаунта')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                <MapPin size={12} className="text-slate-400 shrink-0" />
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{citiesText}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                <Store size={12} className="text-slate-400 shrink-0" />
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{brandsText}</span>
              </div>
            </div>
          </div>

          {/* Password Change */}
          <div className="apple-inset-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-900 dark:text-white">
                <KeyRound size={13} className="text-[#047857] dark:text-[#10B981]" />
                <span>{tr('Schimbare parolă (opțional)', 'Change password (optional)', 'Изменить пароль (необязательно)')}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] font-medium text-[#047857] dark:text-[#10B981] flex items-center gap-1 cursor-pointer"
              >
                {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showPassword ? tr('Ascunde', 'Hide', 'Скрыть') : tr('Arată', 'Show', 'Показать')}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={tr('Parolă nouă (min. 6 caract.)', 'New password (min. 6 chars)', 'Новый пароль (мин. 6 симв.)')}
                className={`w-full px-3 py-2 rounded-xl border text-[12.5px] font-medium outline-none transition-colors ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/12 text-white focus:border-[#10B981]'
                    : 'bg-white border-black/12 text-slate-900 focus:border-[#047857]'
                }`}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={tr('Confirmă parola nouă', 'Confirm new password', 'Подтвердите новый пароль')}
                className={`w-full px-3 py-2 rounded-xl border text-[12.5px] font-medium outline-none transition-colors ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/12 text-white focus:border-[#10B981]'
                    : 'bg-white border-black/12 text-slate-900 focus:border-[#047857]'
                }`}
              />
            </div>
          </div>

          {feedback && (
            <div className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="apple-btn-secondary !h-9 !px-4"
            >
              {tr('Anulează', 'Cancel', 'Отмена')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="apple-btn-primary !h-9 !px-5 disabled:opacity-50"
            >
              <Save size={13} />
              <span>{saving ? tr('Se salvează...', 'Saving...', 'Сохранение...') : tr('Salvează profilul', 'Save profile', 'Сохранить профиль')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

