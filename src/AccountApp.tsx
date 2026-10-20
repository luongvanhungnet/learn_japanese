import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { activateUserData, deactivateUserData, flushUserData } from './accountData'
import App from './App'

function AccountBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth?.initializing) return <main className="account-loading" role="status">Loading your study account…</main>
  return <div key={auth?.user?.id ?? 'guest'} inert={auth?.loading || undefined}>{children}</div>
}

export function AccountApp() {
  return <AuthProvider
    onAuthenticate={(user, options) => activateUserData(user.id, options)}
    beforeLogout={() => flushUserData()}
    onSignOut={() => deactivateUserData()}
  ><AccountBoundary><App /></AccountBoundary></AuthProvider>
}
