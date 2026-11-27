import React, { useState, useEffect } from 'react'

/**
 * Isolated leaf countdown badge so parent pages (Dispatch, CouriersMap)
 * NEVER re-render every second while counting down to the next auto-refresh.
 */
const RefreshCountdown = React.memo(function RefreshCountdown({ nextRefreshAt, enabled = true, language = 'ro' }) {
  const calcLeft = () => {
    if (!nextRefreshAt) return 0
    return Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000))
  }
  const [secondsLeft, setSecondsLeft] = useState(calcLeft)

  useEffect(() => {
    setSecondsLeft(calcLeft())
    if (!enabled || !nextRefreshAt) return
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      setSecondsLeft(calcLeft())
    }, 1000)
    return () => clearInterval(id)
  }, [nextRefreshAt, enabled])

  if (secondsLeft >= 60) {
    return <>{`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}</>
  }
  return <>{`${secondsLeft}${language === 'ru' ? 'с' : 's'}`}</>
})

export default RefreshCountdown
