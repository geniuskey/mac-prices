'use client'

import type { ReactNode } from 'react'

export function Toggle({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className="rounded-full border px-2.5 py-1 text-[13px] leading-5 transition-colors"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'var(--accent-soft)' : 'var(--surface)',
        color: active ? 'var(--accent)' : 'var(--text)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="shrink-0 text-[12px] font-medium"
      style={{ color: 'var(--muted)' }}
    >
      {children}
    </span>
  )
}

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  ariaLabel: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border px-2 py-1 text-[13px]"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'warn' | 'accent'
}) {
  const bg =
    tone === 'warn'
      ? 'var(--warn-soft)'
      : tone === 'accent'
        ? 'var(--accent-soft)'
        : 'var(--surface-2)'
  const fg =
    tone === 'warn'
      ? 'var(--warn)'
      : tone === 'accent'
        ? 'var(--accent)'
        : 'var(--muted)'
  return (
    <span
      className="inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-4"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  )
}

const SOURCE_LABEL: Record<string, string> = {
  'apple-kr': 'Apple KR 대조',
  press: '언론 보도 대조',
  retail: '유통 시세 대조',
}

/** 이 가격이 어느 수준의 근거인지 그대로 드러낸다. */
export function VerifyBadge({
  verified,
  source,
}: {
  verified: boolean
  source?: string
}) {
  if (!verified) return <Badge tone="warn">가격 미대조</Badge>
  // Apple 공식 확인만 안심할 수 있는 수준이다. 2차 출처는 경고색을 유지한다.
  const strong = source === 'apple-kr'
  return (
    <Badge tone={strong ? 'accent' : 'warn'}>
      {SOURCE_LABEL[source ?? ''] ?? '대조됨'}
    </Badge>
  )
}
