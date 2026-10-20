import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../../shared/contracts'

export type AuthUser = User
export type AuthenticateOptions = { importGuest?: boolean }
export type AuthProviderProps = {
  children: ReactNode
  onAuthenticate?: (user: AuthUser, options?: AuthenticateOptions) => Promise<void> | void
  beforeLogout?: (user: AuthUser) => Promise<void> | void
  onSignOut?: () => Promise<void> | void
}
export type AuthContextValue = {
  user: AuthUser | null
  initializing: boolean
  loading: boolean
  error: AuthError | null
  login: (email: string, password: string) => Promise<AuthUser>
  signup: (name: string, email: string, password: string, options?: AuthenticateOptions) => Promise<AuthUser>
  logout: () => Promise<void>
  clearError: () => void
}

export class AuthError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

export const AuthContext = createContext<AuthContextValue | null>(null)
export const useAuth = () => useContext(AuthContext)
