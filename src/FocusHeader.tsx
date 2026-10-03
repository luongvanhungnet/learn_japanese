import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLanguage } from './translations'

export function FocusHeader({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)
  const { t } = useLanguage()
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))
  const [fullscreenError, setFullscreenError] = useState(false)

  useEffect(() => {
    const change = () => { setFullscreen(Boolean(document.fullscreenElement)); setFullscreenError(false) }
    document.addEventListener('fullscreenchange', change)
    return () => document.removeEventListener('fullscreenchange', change)
  }, [])

  const toggleFullscreen = async () => {
    setFullscreenError(false)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      setFullscreenError(true)
    }
  }

  useEffect(() => {
    const move = (event: MouseEvent) => {
      const bottom = visible ? headerRef.current?.getBoundingClientRect().bottom ?? 0 : 0
      setVisible(event.clientY >= 0 && event.clientY <= Math.max(64, bottom))
    }
    const leave = (event: MouseEvent) => { if (!event.relatedTarget) setVisible(false) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseout', leave)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseout', leave)
    }
  }, [visible])

  return <div ref={headerRef} className={`focus-controls${visible ? ' is-visible' : ''}`}>
    {children}
    <button type="button" className="fullscreen-toggle" aria-pressed={fullscreen} onClick={toggleFullscreen}>
      <span aria-hidden="true">{fullscreen ? '⤡' : '⛶'}</span> {t(fullscreen ? 'exitFullscreen' : 'fullscreen')}
    </button>
    {fullscreenError && <p className="fullscreen-error" role="alert">{t('fullscreenError')}</p>}
  </div>
}
