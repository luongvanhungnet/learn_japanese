import type { Language } from '../translations'
import type { AuthError } from './AuthProvider'

const en = {
  login: 'Log in', signup: 'Sign up', logout: 'Log out', loggingOut: 'Logging out…',
  signupTitle: 'Create your account', loginTitle: 'Welcome back',
  signupIntro: 'Save your study progress and continue on another device.',
  loginIntro: 'Pick up where you left off with your saved study progress.',
  name: 'Name', email: 'Email', password: 'Password', passwordHint: 'Use 8–128 characters.',
  copyGuest: 'Copy my guest study progress on this device',
  create: 'Create account', creating: 'Creating account…', loggingIn: 'Logging in…',
  close: 'Close account dialog', haveAccount: 'Already have an account?', newAccount: 'New to Mimikara?',
  nameRequired: 'Use 2–80 characters for your name.', emailInvalid: 'Enter a valid email address.',
  passwordInvalid: 'Your password must contain 8–128 characters.',
  showPassword: 'Show password', hidePassword: 'Hide password',
  guestHint: 'You can keep studying as a guest. Your guest progress stays on this device.',
  checking: 'Checking account…', account: 'Your account',
  serverUnavailable: 'The account service is unavailable. You can keep studying as a guest and try again later.',
  invalidCredentials: 'Email or password is incorrect. Please try again.',
  emailTaken: 'An account with this email already exists. Try logging in.',
  tooManyRequests: 'Too many attempts. Please wait a little before trying again.',
}
const vi: typeof en = {
  login: 'Đăng nhập', signup: 'Đăng ký', logout: 'Đăng xuất', loggingOut: 'Đang đăng xuất…',
  signupTitle: 'Tạo tài khoản', loginTitle: 'Chào mừng trở lại',
  signupIntro: 'Lưu tiến độ học và tiếp tục trên thiết bị khác.',
  loginIntro: 'Tiếp tục học từ tiến độ đã lưu trong tài khoản.',
  name: 'Tên', email: 'Email', password: 'Mật khẩu', passwordHint: 'Dùng 8–128 ký tự.',
  copyGuest: 'Sao chép tiến độ học của khách trên thiết bị này',
  create: 'Tạo tài khoản', creating: 'Đang tạo tài khoản…', loggingIn: 'Đang đăng nhập…',
  close: 'Đóng hộp thoại tài khoản', haveAccount: 'Bạn đã có tài khoản?', newAccount: 'Bạn mới dùng Mimikara?',
  nameRequired: 'Tên phải có từ 2 đến 80 ký tự.', emailInvalid: 'Nhập địa chỉ email hợp lệ.',
  passwordInvalid: 'Mật khẩu phải có từ 8 đến 128 ký tự.',
  showPassword: 'Hiện mật khẩu', hidePassword: 'Ẩn mật khẩu',
  guestHint: 'Bạn có thể tiếp tục học với tư cách khách. Tiến độ của khách được lưu trên thiết bị này.',
  checking: 'Đang kiểm tra tài khoản…', account: 'Tài khoản của bạn',
  serverUnavailable: 'Dịch vụ tài khoản chưa khả dụng. Bạn có thể tiếp tục học với tư cách khách và thử lại sau.',
  invalidCredentials: 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
  emailTaken: 'Email này đã có tài khoản. Hãy thử đăng nhập.',
  tooManyRequests: 'Bạn đã thử quá nhiều lần. Vui lòng đợi một chút rồi thử lại.',
}
export const authMessages = (language: Language) => language === 'vi' ? vi : en

export function authErrorMessage(error: AuthError, language: Language): string {
  const messages = authMessages(language)
  const code = error.code.toLowerCase()
  if (['server_unavailable', 'database_unavailable', 'internal_error'].includes(code)) return messages.serverUnavailable
  if (code === 'invalid_credentials') return messages.invalidCredentials
  if (['email_taken', 'email_exists', 'email_in_use'].includes(code)) return messages.emailTaken
  if (['rate_limited', 'too_many_requests'].includes(code)) return messages.tooManyRequests
  return error.message
}
