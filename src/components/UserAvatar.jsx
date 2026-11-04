import React, { useState } from 'react'
import { getUserInitials } from '../lib/AuthContext'

const ROLE_AVATAR_STYLES = {
  admin: 'bg-emerald-600 text-white border-emerald-500/40',
  supervisor: 'bg-blue-600 text-white border-blue-500/40',
  operational: 'bg-amber-600 text-white border-amber-500/40',
  marketing: 'bg-purple-600 text-white border-purple-500/40',
  restaurant_manager: 'bg-cyan-600 text-white border-cyan-500/40'
}

export async function compressAvatarImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Niciun fișier selectat'))
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 180
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        // Center crop square
        const minSide = Math.min(img.width, img.height)
        const sx = (img.width - minSide) / 2
        const sy = (img.height - minSide) / 2
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('Format de imagine invalid'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Eroare la citirea imaginii'))
    reader.readAsDataURL(file)
  })
}

export default function UserAvatar({
  user,
  size = 36,
  className = '',
  showOnlineDot = false
}) {
  const [imgError, setImgError] = useState(false)
  const avatarUrl = user?.avatar_url && !imgError ? user.avatar_url : ''
  const initials = getUserInitials(user)
  const roleKey = user?.role || 'admin'
  const roleStyle = ROLE_AVATAR_STYLES[roleKey] || ROLE_AVATAR_STYLES.admin

  const fontSize = size <= 28 ? 10 : size <= 36 ? 12 : size <= 48 ? 15 : 20

  return (
    <div
      className={`relative rounded-full shrink-0 select-none flex items-center justify-center font-extrabold tracking-tight border shadow-xs ${
        avatarUrl ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : roleStyle
      } ${className}`}
      style={{ width: size, height: size, fontSize }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={user?.full_name || initials}
          onError={() => setImgError(true)}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}

      {showOnlineDot && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
        />
      )}
    </div>
  )
}

