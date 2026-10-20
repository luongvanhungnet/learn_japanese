// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { AuthControls } from './AuthControls'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const user = { id: 'user-1', email: 'learner@example.com', name: 'Learner' }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
async function renderGuest() {
  const fetch = vi.fn().mockResolvedValueOnce(response({ user: null }))
  vi.stubGlobal('fetch', fetch)
  render(<AuthProvider><AuthControls /></AuthProvider>)
  await waitFor(() => expect((screen.getByRole('button', { name: 'Sign up' }) as HTMLButtonElement).disabled).toBe(false))
  return fetch
}

test('sign-up validates password length and sends the name and visible guest-copy choice', async () => {
  const fetch = await renderGuest()
  fetch.mockResolvedValueOnce(response({ user }))
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
  const dialog = screen.getByRole('dialog', { name: 'Create your account' })
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Learner' } })
  fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'learner@example.com' } })
  fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'short' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }))
  expect(within(dialog).getByRole('alert').textContent).toContain('8–128 characters')
  expect(fetch).toHaveBeenCalledTimes(1)
  const copy = within(dialog).getByRole('checkbox', { name: 'Copy my guest study progress on this device' }) as HTMLInputElement
  expect(copy.checked).toBe(true)
  fireEvent.click(copy)
  fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'strongpassword' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(fetch).toHaveBeenLastCalledWith('/api/auth/signup', expect.objectContaining({ body: JSON.stringify({ name: 'Learner', email: 'learner@example.com', password: 'strongpassword' }) }))
  expect(screen.getByText('Learner')).toBeTruthy()
})

test('contains keyboard focus, stops study shortcuts, and returns focus after Escape', async () => {
  await renderGuest()
  const trigger = screen.getByRole('button', { name: 'Log in' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Welcome back' })
  const email = within(dialog).getByLabelText('Email')
  expect(document.activeElement).toBe(email)
  const close = within(dialog).getByRole('button', { name: 'Close account dialog' })
  const switchForm = within(dialog).getByRole('button', { name: 'Sign up' })
  switchForm.focus()
  fireEvent.keyDown(switchForm, { key: 'Tab' })
  expect(document.activeElement).toBe(close)
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(switchForm)
  const shortcut = vi.fn()
  document.addEventListener('keydown', shortcut)
  try {
    fireEvent.keyDown(email, { key: 'Enter' })
    expect(shortcut).not.toHaveBeenCalled()
    fireEvent.keyDown(email, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  } finally { document.removeEventListener('keydown', shortcut) }
})

test('shows password state accessibly and resets it when switching between login and sign-up', async () => {
  await renderGuest()
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  const dialog = screen.getByRole('dialog')
  const password = within(dialog).getByLabelText('Password') as HTMLInputElement
  expect(password.autocomplete).toBe('current-password')
  fireEvent.change(password, { target: { value: 'privatepassword' } })
  const toggle = within(dialog).getByRole('button', { name: 'Show password' })
  expect(toggle.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(toggle)
  expect(password.type).toBe('text')
  expect(within(dialog).getByRole('button', { name: 'Hide password' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Sign up' }))
  const newPassword = within(dialog).getByLabelText('Password') as HTMLInputElement
  expect(newPassword.autocomplete).toBe('new-password')
  expect(newPassword.type).toBe('password')
  expect(newPassword.value).toBe('')
  expect(document.activeElement).toBe(within(dialog).getByLabelText('Name'))
})

test('keeps the dialog and focus active while login is pending and submits once', async () => {
  const fetch = await renderGuest()
  let finishLogin!: (value: Response) => void
  fetch.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishLogin = resolve }))
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'learner@example.com' } })
  fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'strongpassword' } })
  const form = dialog.querySelector('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(fetch).toHaveBeenCalledTimes(2)
  expect((within(dialog).getByRole('button', { name: 'Logging in…' }) as HTMLButtonElement).disabled).toBe(true)
  expect((within(dialog).getByRole('button', { name: 'Close account dialog' }) as HTMLButtonElement).disabled).toBe(true)
  expect(document.activeElement).toBe(dialog)
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.getByRole('dialog')).toBe(dialog)
  finishLogin(response({ user }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('validates the sign-up name before requesting an account', async () => {
  const fetch = await renderGuest()
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'A' } })
  fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'learner@example.com' } })
  fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'strongpassword' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }))
  expect(within(dialog).getByRole('alert').textContent).toContain('2–80 characters')
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('localizes uppercase credential errors in Vietnamese and allows a corrected retry', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ user: null }))
    .mockResolvedValueOnce(response({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } }, 401))
    .mockResolvedValueOnce(response({ user }))
  vi.stubGlobal('fetch', fetch)
  render(<AuthProvider><AuthControls language="vi" /></AuthProvider>)
  await waitFor(() => expect((screen.getByRole('button', { name: 'Đăng nhập' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  const dialog = screen.getByRole('dialog', { name: 'Chào mừng trở lại' })
  fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'learner@example.com' } })
  fireEvent.change(within(dialog).getByLabelText('Mật khẩu'), { target: { value: 'wrongpassword' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Đăng nhập' }))
  expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.')
  fireEvent.change(within(dialog).getByLabelText('Mật khẩu'), { target: { value: 'strongpassword' } })
  expect(within(dialog).queryByRole('alert')).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Đăng nhập' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText('Learner')).toBeTruthy()
})
