import type { SearchEntry } from './vocabularySearch'
import type { ReactNode } from 'react'
import { FocusHeader } from './FocusHeader'
import { LanguageSwitch } from './i18n'
import { AccountMenu } from './AccountMenu'
import { VocabularySearch } from './VocabularySearch'
import { useLanguage } from './translations'

export function SharedHeader({ onBack, children, onSearchSelect }: { onBack?: () => void; children?: ReactNode; onSearchSelect?: (entry: SearchEntry) => void }) {
  const { language, t } = useLanguage()
  const navigate = (route: string) => window.dispatchEvent(new CustomEvent('study-navigate', { detail: route }))
  return <FocusHeader>
    <nav aria-label={language === 'vi' ? 'Điều hướng chính' : 'Main navigation'} className="shared-navigation">
      <button onClick={() => navigate('speed-exam')}>Ôn thi thần tốc</button>
      <button onClick={() => onBack ? onBack() : navigate('study')}>← {language === 'vi' ? 'Về học tập' : 'Back to study'}</button>
      <button onClick={() => navigate('word-flashcard')}>{t('wordFlashcard')}</button>
      <button onClick={() => navigate('flashcard')}>{t('flashcard')}</button>
      <button onClick={() => navigate('game')}>{language === 'vi' ? 'Chơi & học' : 'Play & learn'}</button>
      <button onClick={() => navigate('exam')}>{t('exam')}</button>
      <button onClick={() => navigate('novel')}>{language === 'vi' ? 'Đọc tiểu thuyết N3' : 'Read N3 novel'}</button>
    </nav>
    {children}
    <VocabularySearch onSelect={onSearchSelect} /><LanguageSwitch /><AccountMenu />
  </FocusHeader>
}
