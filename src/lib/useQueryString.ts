'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * URL 쿼리스트링을 단일 소스로 쓰기 위한 스토어.
 *
 * 정적 배포라 서버는 쿼리를 볼 수 없다. 그렇다고 effect 안에서 setState 로
 * 복원하면 렌더가 한 번 더 도는 데다 상태가 URL 과 이중화된다. 대신 URL 을
 * 외부 스토어로 취급해 useSyncExternalStore 로 구독한다.
 *
 * replaceState 는 popstate 를 발생시키지 않으므로 직접 알린다.
 */
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('popstate', onChange)
  }
}

function getSnapshot(): string {
  return window.location.search
}

/** 프리렌더 시점에는 쿼리가 없다 — 기본 상태로 그려진 뒤 수화 때 맞춰진다. */
function getServerSnapshot(): string {
  return ''
}

export function useQueryString(): [string, (next: string) => void] {
  const search = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setSearch = useCallback((next: string) => {
    const url = next
      ? `${window.location.pathname}?${next}`
      : window.location.pathname
    window.history.replaceState(null, '', url)
    for (const l of listeners) l()
  }, [])

  return [search, setSearch]
}
