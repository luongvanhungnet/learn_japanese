// @vitest-environment jsdom
import { StrictMode } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { getActiveDataScope, writeStudyValue } from './accountData'
import { useStudyPersistence } from './useStudyPersistence'

vi.mock('./accountData', () => ({ getActiveDataScope: vi.fn(), writeStudyValue: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
function Preference({ value }: { value: string }) {
  useStudyPersistence('mimikara-language', value)
  return null
}

test('mounting an account never uploads fallback defaults, but changing and reverting a preference saves both', () => {
  vi.mocked(getActiveDataScope).mockReturnValue('account-a')
  const view = render(<StrictMode><Preference value="en" /></StrictMode>)
  expect(writeStudyValue).not.toHaveBeenCalled()
  view.rerender(<StrictMode><Preference value="vi" /></StrictMode>)
  expect(writeStudyValue).toHaveBeenLastCalledWith('mimikara-language', 'vi')
  view.rerender(<StrictMode><Preference value="en" /></StrictMode>)
  expect(writeStudyValue).toHaveBeenLastCalledWith('mimikara-language', 'en')
})
