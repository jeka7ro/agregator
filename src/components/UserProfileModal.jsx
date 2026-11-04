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
        text: language === 'ru' ? 'Введите имя.' : 'Introdu prenumele.'
      })
      return
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setFeedback({
          type: 'error',
          text: language === 'ru' ? 'Пароль должен содержать минимум 6 символов.' : 'Parola trebuie să aibă minim 6 caractere.'
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
        text: language === 'ru' ? 'Профиль успешно сохранен!' : 'Profilul a fost actualizat cu succes!'
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
    ? (language === 'ru' ? 'Все города' : 'Toate orașele')
    : (user.allowed_cities || []).join(', ')

  const brandsText = (user.allowed_brands || []).includes('all')
    ? (language === 'ru' ? 'Все бренды' : 'Toate brandurile')
    : (user.allowed_brands || []).join(', ')

  return (
    <div
      className="fixed inset-0 z-[9990] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-center gap-3">
            <UserAvatar user={previewUser} size={42} showOnlineDot />
            <div>
              <h3 className="text-base font-extrabold leading-tight">
                {language === 'ru' ? 'Мой профиль и безопасность' : 'Profilul Meu & Securitate'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400 font-medium">{user.email}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleMeta.badgeClass}`}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
              isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto custom-scrollbar">
          {/* Avatar Photo / Initials Section */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
            isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="flex items-center gap-3.5">
              <UserAvatar user={previewUser} size={56} />
              <div>
                <div className="text-xs font-extrabold">
                  {language === 'ru' ? 'Фото профиля (Аватар)' : 'Poză de Profil (Avatar)'}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {language === 'ru'
                    ? 'Если фото не выбрано, автоматически отображаются инициалы имени и фамилии.'
                    : 'Dacă nu setezi o poză, se afișează automat inițialele din Nume și Prenume.'}
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
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Upload size={13} />
                <span>{language === 'ru' ? 'Фото' : 'Încarcă'}</span>
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  title={language === 'ru' ? 'Удалить фото (оставить инициалы)' : 'Șterge poza (folosește inițialele)'}
                  className="p-1.5 rounded-full border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                {language === 'ru' ? 'Имя (Prenume)' : 'Prenume'}
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                {language === 'ru' ? 'Фамилия (Nume)' : 'Nume de familie'}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {language === 'ru' ? 'Телефон' : 'Telefon de contact'}
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+407..."
              className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                  : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
              }`}
            />
          </div>

          {/* Access Permissions Summary */}
          <div className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
            isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/80 border-slate-200/70'
          }`}>
            <div className="flex items-center gap-1.5 font-extrabold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={14} />
              <span>{language === 'ru' ? 'Права доступа аккаунта' : 'Permisiuni & Perimetru de Acces'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                <MapPin size={12} className="text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{citiesText}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                <Store size={12} className="text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{brandsText}</span>
              </div>
            </div>
          </div>

          {/* Password Change */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <KeyRound size={14} className="text-emerald-500" />
                <span>{language === 'ru' ? 'Изменить пароль (необязательно)' : 'Schimbare Parolă (opțional)'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
              >
                {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showPassword ? (language === 'ru' ? 'Скрыть' : 'Ascunde') : (language === 'ru' ? 'Показать' : 'Arată')}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={language === 'ru' ? 'Новый пароль (мин. 6 симв.)' : 'Parolă nouă (min. 6 caract.)'}
                className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
                }`}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={language === 'ru' ? 'Подтвердите новый пароль' : 'Confirmă parola nouă'}
                className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                    : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          {feedback && (
            <div className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
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
              className={`px-4 py-2 rounded-full text-xs font-bold border cursor-pointer ${
                isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {language === 'ru' ? 'Отмена' : 'Anulează'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save size={13} />
              <span>{saving ? (language === 'ru' ? 'Сохранение...' : 'Se salvează...') : (language === 'ru' ? 'Сохранить профиль' : 'Salvează Profilul')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

