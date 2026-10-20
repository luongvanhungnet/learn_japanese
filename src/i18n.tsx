import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LanguageContext, messagesByLanguage, useLanguage } from './translations'
import type { Language } from './translations'
import { readStudyValue } from './accountData'
import { useStudyPersistence } from './useStudyPersistence'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return readStudyValue('mimikara-language') === 'vi' ? 'vi' : 'en' } catch { return 'en' }
  })
  useStudyPersistence('mimikara-language', language)
  useEffect(() => {
    const messages = messagesByLanguage[language]
    document.documentElement.lang = language
    document.title = messages.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', messages.description)
  }, [language])
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}

export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage()
  return <div className="language-switch" role="group" aria-label={t('language')}>
    <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
    <button type="button" lang="vi" aria-pressed={language === 'vi'} onClick={() => setLanguage('vi')}>Tiếng Việt</button>
  </div>
}
