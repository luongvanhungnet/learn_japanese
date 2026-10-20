import { useContext, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LanguageContext } from '../translations'
import type { Language } from '../translations'
import { useAuth } from './AuthProvider'
import type { AuthContextValue } from './AuthProvider'
import { authErrorMessage, authMessages } from './messages'
import './auth.css'

export type AuthControlsProps = { language?: Language; syncStatus?: ReactNode }

type AuthMode = 'login' | 'signup'
type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>

function AuthModal({ mode, setMode, onClose, auth, language }: { mode: AuthMode; setMode: (mode: AuthMode) => void; onClose: () => void; auth: AuthContextValue; language: Language }) {
  const messages = authMessages(language)
  const id = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [importGuest, setImportGuest] = useState(true)
  const [errors, setErrors] = useState<FieldErrors>({})
  const backdropRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const initialFieldRef = useRef<HTMLInputElement>(null)
  const signup = mode === 'signup'

  useLayoutEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const siblings = [...document.body.children].filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdropRef.current)
    const previousInert = siblings.map((element) => element.inert)
    siblings.forEach((element) => { element.inert = true })
    document.body.style.overflow = 'hidden'
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) {
        const target = dialogRef.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? dialogRef.current
        target?.focus()
      }
    }
    document.addEventListener('focusin', containFocus)
    return () => {
      document.removeEventListener('focusin', containFocus)
      siblings.forEach((element, index) => { element.inert = previousInert[index] })
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  useLayoutEffect(() => { initialFieldRef.current?.focus() }, [mode])
  useLayoutEffect(() => { if (auth.loading) dialogRef.current?.focus() }, [auth.loading])

  const containKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      if (!auth.loading) onClose()
    }
    if (event.key === 'Tab') {
      const controls = [...dialogRef.current?.querySelectorAll<HTMLElement>('*') ?? []].filter((element) => element.matches('button, input, [href], [tabindex]') && !element.matches(':disabled') && element.tabIndex >= 0)
      const first = controls[0]
      const last = controls.at(-1)
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }
  const changeField = (field: keyof FieldErrors, value: string) => {
    if (field === 'name') setName(value)
    if (field === 'email') setEmail(value)
    if (field === 'password') setPassword(value)
    setErrors((current) => ({ ...current, [field]: undefined }))
    auth.clearError()
  }
  const switchMode = () => {
    setMode(signup ? 'login' : 'signup')
    setPassword('')
    setShowPassword(false)
    setErrors({})
    auth.clearError()
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (auth.loading) return
    const invalid: FieldErrors = {}
    if (signup && (name.trim().length < 2 || name.trim().length > 80)) invalid.name = messages.nameRequired
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) invalid.email = messages.emailInvalid
    if (password.length < 8 || password.length > 128) invalid.password = messages.passwordInvalid
    setErrors(invalid)
    if (Object.keys(invalid).length) return
    try {
      if (signup) await auth.signup(name.trim(), email.trim(), password, { importGuest })
      else await auth.login(email.trim(), password)
      onClose()
    } catch { /* The provider exposes the useful request or hydration error. */ }
  }
  return createPortal(<div ref={backdropRef} className="auth-modal-backdrop" onKeyDownCapture={containKeys} onClick={(event) => { if (event.target === event.currentTarget && !auth.loading) onClose() }}>
    <section ref={dialogRef} className="auth-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-intro`} tabIndex={-1}>
      <button className="auth-close" type="button" aria-label={messages.close} onClick={onClose} disabled={auth.loading}>×</button>
      <span className="auth-eyebrow">MIMIKARA STUDY</span>
      <h2 id={`${id}-title`}>{signup ? messages.signupTitle : messages.loginTitle}</h2>
      <p id={`${id}-intro`} className="auth-intro">{signup ? messages.signupIntro : messages.loginIntro}</p>
      <form onSubmit={submit} noValidate aria-busy={auth.loading}>
        {signup && <div className="auth-field">
          <label htmlFor={`${id}-name`}>{messages.name}</label>
          <input ref={initialFieldRef} id={`${id}-name`} name="name" autoComplete="name" minLength={2} maxLength={80} required value={name} onChange={(event) => changeField('name', event.target.value)} disabled={auth.loading} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${id}-name-error` : undefined} />
          {errors.name && <span className="auth-field-error" id={`${id}-name-error`}>{errors.name}</span>}
        </div>}
        <div className="auth-field">
          <label htmlFor={`${id}-email`}>{messages.email}</label>
          <input ref={signup ? undefined : initialFieldRef} id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required value={email} onChange={(event) => changeField('email', event.target.value)} disabled={auth.loading} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${id}-email-error` : undefined} />
          {errors.email && <span className="auth-field-error" id={`${id}-email-error`}>{errors.email}</span>}
        </div>
        <div className="auth-field">
          <label htmlFor={`${id}-password`}>{messages.password}</label>
          <div className="auth-password-wrap">
            <input id={`${id}-password`} name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required value={password} onChange={(event) => changeField('password', event.target.value)} disabled={auth.loading} aria-invalid={Boolean(errors.password)} aria-describedby={`${id}-password-hint${errors.password ? ` ${id}-password-error` : ''}`} />
            <button className="auth-password-toggle" type="button" aria-label={showPassword ? messages.hidePassword : messages.showPassword} aria-pressed={showPassword} aria-controls={`${id}-password`} disabled={auth.loading} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? messages.hidePassword : messages.showPassword}</button>
          </div>
          <span className="auth-field-hint" id={`${id}-password-hint`}>{messages.passwordHint}</span>
          {errors.password && <span className="auth-field-error" id={`${id}-password-error`}>{errors.password}</span>}
        </div>
        {signup && <label className="auth-copy"><input type="checkbox" checked={importGuest} onChange={(event) => setImportGuest(event.target.checked)} disabled={auth.loading} />{messages.copyGuest}</label>}
        {(Object.values(errors).some(Boolean) || auth.error) && <div className="auth-form-error" role="alert">{auth.error ? authErrorMessage(auth.error, language) : Object.values(errors).filter(Boolean).join(' ')}</div>}
        <button className="auth-submit" type="submit" disabled={auth.loading}>{auth.loading ? signup ? messages.creating : messages.loggingIn : signup ? messages.create : messages.login}</button>
      </form>
      <p className="auth-switch">{signup ? messages.haveAccount : messages.newAccount} <button type="button" onClick={switchMode} disabled={auth.loading}>{signup ? messages.login : messages.signup}</button></p>
      <p className="auth-guest-hint">{messages.guestHint}</p>
    </section>
  </div>, document.body)
}

export function AuthControls({ language: suppliedLanguage, syncStatus }: AuthControlsProps) {
  const auth = useAuth()
  const languageContext = useContext(LanguageContext)
  const language = suppliedLanguage ?? languageContext?.language ?? 'en'
  const messages = authMessages(language)
  const [mode, setMode] = useState<AuthMode | null>(null)
  if (!auth) return null
  return <div className="auth-controls">
    {auth.user ? <>
      {syncStatus}
      <details className="auth-account">
        <summary aria-label={`${messages.account}: ${auth.user.name}`}><span className="auth-avatar" aria-hidden="true">{auth.user.name.slice(0, 1).toUpperCase()}</span><span className="auth-account-name">{auth.user.name}</span><span aria-hidden="true">⌄</span></summary>
        <div className="auth-account-menu"><span className="auth-account-email">{auth.user.email}</span><button type="button" disabled={auth.loading} onClick={() => { void auth.logout().catch(() => {}) }}>{auth.loading ? messages.loggingOut : messages.logout}</button></div>
      </details>
      {auth.error && <span className="auth-controls-error" role="alert">{authErrorMessage(auth.error, language)}</span>}
    </> : <>
      <button className="auth-login" type="button" onClick={() => setMode('login')} disabled={auth.initializing || auth.loading}>{messages.login}</button>
      <button className="auth-signup" type="button" onClick={() => setMode('signup')} disabled={auth.initializing || auth.loading}>{messages.signup}</button>
      {mode && <AuthModal mode={mode} setMode={setMode} onClose={() => setMode(null)} auth={auth} language={language} />}
    </>}
  </div>
}
