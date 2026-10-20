import { useSyncExternalStore } from 'react'
import { AuthControls } from './auth/AuthControls'
import { useAuth } from './auth/AuthProvider'
import { flushUserData, getSyncStatus, subscribeSyncStatus } from './accountData'
import { useLanguage } from './translations'

export function AccountMenu() {
  const auth = useAuth()
  const { t, language } = useLanguage()
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, () => 'guest')
  if (!auth) return null
  const syncStatus = auth.user && <span className={`account-sync account-sync-${status}`} role="status">
    {t(status === 'saving' ? 'accountSaving' : status === 'error' ? 'accountSaveError' : 'accountSaved')}
    {status === 'error' && <button type="button" onClick={() => { void flushUserData().catch(() => {}) }}>{t('accountRetry')}</button>}
  </span>
  return <AuthControls language={language} syncStatus={syncStatus} />
}
