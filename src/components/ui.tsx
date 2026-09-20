'use client'

import type { DragEventHandler, ReactNode } from 'react'

export function Toggle({
  active,
  onClick,
  children,
  title,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  ariaLabel,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  title?: string
  draggable?: boolean
  onDragStart?: DragEventHandler<HTMLButtonElement>
  onDragOver?: DragEventHandler<HTMLButtonElement>
  onDrop?: DragEventHandler<HTMLButtonElement>
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-label={ariaLabel}
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

export function RangeSlider({
  min,
  max,
  values,
  lower,
  upper,
  step = 1,
  formatValue,
  ariaLabel,
  onChange,
}: {
  min: number
  max: number
  values?: number[]
  lower: number
  upper: number
  step?: number
  formatValue: (value: number) => string
  ariaLabel: string
  onChange: (lower: number, upper: number) => void
}) {
  const discreteValues = values && values.length > 1 ? values : null
  const discrete = discreteValues !== null
  const sliderMin = discrete ? 0 : min
  const sliderMax = discrete ? discreteValues.length - 1 : max
  const lowerPosition = discrete ? discreteValues.indexOf(lower) : lower
  const upperPosition = discrete ? discreteValues.indexOf(upper) : upper
  const span = sliderMax - sliderMin || 1
  const lowerPercent = ((lowerPosition - sliderMin) / span) * 100
  const upperPercent = ((upperPosition - sliderMin) / span) * 100

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="tnum font-medium">{formatValue(lower)}</span>
        <span style={{ color: 'var(--muted)' }}>–</span>
        <span className="tnum text-right font-medium">{formatValue(upper)}</span>
      </div>
      <div className="relative mt-1 h-5">
        <div
          className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full"
          style={{ background: 'var(--border)' }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{
            left: `${lowerPercent}%`,
            right: `${100 - upperPercent}%`,
            background: 'var(--accent)',
          }}
          aria-hidden
        />
        <input
          className="range-slider-input z-20"
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={discrete ? 1 : step}
          value={lowerPosition}
          onChange={(event) =>
            onChange(
              discrete
                ? discreteValues[Number(event.target.value)]
                : Math.min(Number(event.target.value), upper),
              upper,
            )
          }
          aria-label={`${ariaLabel} 최소`}
          aria-valuetext={formatValue(lower)}
        />
        <input
          className="range-slider-input z-30"
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={discrete ? 1 : step}
          value={upperPosition}
          onChange={(event) =>
            onChange(
              lower,
              discrete
                ? discreteValues[Number(event.target.value)]
                : Math.max(Number(event.target.value), lower),
            )
          }
          aria-label={`${ariaLabel} 최대`}
          aria-valuetext={formatValue(upper)}
        />
      </div>
    </div>
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
