import { useEffect, useRef } from 'react'
import { getActiveDataScope, writeStudyValue } from './accountData'
import type { StudyKey } from './accountData'

export function useStudyPersistence(key: StudyKey, value: string | undefined, onError?: () => void): void {
  const initial = useRef({ value, account: getActiveDataScope(), changed: false })
  useEffect(() => {
    if (value === undefined) return
    // Account data was loaded before mounting. Opening a screen must not replace
    // remote values with defaults or transient, normalized state (such as hints).
    if (initial.current.account && !initial.current.changed) {
      if (value === initial.current.value) return
      initial.current.changed = true
    }
    try { writeStudyValue(key, value) } catch { onError?.() }
  }, [key, value, onError])
}
