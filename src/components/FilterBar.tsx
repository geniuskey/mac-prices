'use client'

import { useEffect, useRef, useState } from 'react'
import { FAMILIES, FAMILY_LABEL, TIERS, TIER_LABEL } from '@/lib/schema'
import type { Family, Tier } from '@/lib/types'
import { EMPTY_FILTERS, isFiltered, type FilterState } from '@/lib/filters'
import { FieldLabel, RangeSlider, Toggle } from './ui'

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export interface FilterRange {
  min: number
  max: number
  values?: number[]
}

export interface FilterRanges {
  memory: FilterRange
  storage: FilterRange
  price: FilterRange
}

function selectedRange(
  bounds: FilterRange,
  minValue: number | null,
  maxValue: number | null,
) {
  let lower = Math.max(
    bounds.min,
    Math.min(minValue ?? bounds.min, bounds.max),
  )
  let upper = Math.max(
    lower,
    Math.min(maxValue ?? bounds.max, bounds.max),
  )

  if (bounds.values && bounds.values.length > 0) {
    lower = bounds.values.find((value) => value >= lower) ?? bounds.values.at(-1)!
    upper =
      [...bounds.values].reverse().find((value) => value <= upper) ??
      bounds.values[0]
    upper = Math.max(lower, upper)
  }

  return { lower, upper }
}

function sameFilters(a: FilterState, b: FilterState) {
  return (
    a.q === b.q &&
    a.families.join(',') === b.families.join(',') &&
    a.generations.join(',') === b.generations.join(',') &&
    a.tiers.join(',') === b.tiers.join(',') &&
    a.sizes.join(',') === b.sizes.join(',') &&
    a.minMemoryGb === b.minMemoryGb &&
    a.maxMemoryGb === b.maxMemoryGb &&
    a.minStorageGb === b.minStorageGb &&
    a.maxStorageGb === b.maxStorageGb &&
    a.minKrw === b.minKrw &&
    a.maxKrw === b.maxKrw &&
    a.status === b.status
  )
}

export default function FilterBar({
  filters,
  onChange,
  generations,
  sizes,
  resultCount,
  totalCount,
  ranges,
}: {
  filters: FilterState
  onChange: (next: FilterState) => void
  generations: number[]
  sizes: number[]
  resultCount: number
  totalCount: number
  ranges: FilterRanges
}) {
  const [open, setOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState(filters)
  const draftRef = useRef(filters)
  const pendingRef = useRef<FilterState | null>(null)
  const timerRef = useRef<number | null>(null)

  // URL·뒤로가기·초기화처럼 부모에서 들어온 변경은 로컬 초안을 덮어쓴다.
  // 사용자가 방금 조작한 초안은 부모 URL이 따라올 때까지 보존한다.
  useEffect(() => {
    const pending = pendingRef.current
    if (pending && !sameFilters(filters, pending)) {
      pendingRef.current = null
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!pendingRef.current) {
      draftRef.current = filters
      setDraftFilters(filters)
    }
  }, [filters])

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const schedule = (patch: Partial<FilterState>) => {
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    pendingRef.current = next
    setDraftFilters(next)

    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const pending = pendingRef.current
      pendingRef.current = null
      timerRef.current = null
      if (pending) onChange(pending)
    }, 140)
  }

  const reset = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    pendingRef.current = null
    draftRef.current = EMPTY_FILTERS
    setDraftFilters(EMPTY_FILTERS)
    onChange(EMPTY_FILTERS)
  }

  const memory = selectedRange(
    ranges.memory,
    draftFilters.minMemoryGb,
    draftFilters.maxMemoryGb,
  )
  const storage = selectedRange(
    ranges.storage,
    draftFilters.minStorageGb,
    draftFilters.maxStorageGb,
  )
  const price = selectedRange(ranges.price, draftFilters.minKrw, draftFilters.maxKrw)

  const storageLabel = (gb: number) =>
    gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`
  const priceLabel = (krw: number) => `${(krw / 10000).toLocaleString('ko-KR')}만원`

  return (
    <div
      className="border-b lg:rounded-xl lg:border lg:shadow-sm"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mx-auto max-w-[1400px] px-3 py-3 sm:px-5 lg:px-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={draftFilters.q}
            onChange={(e) => schedule({ q: e.target.value })}
            placeholder="모델·칩 검색"
            aria-label="모델 검색"
            className="w-full min-w-0 rounded-md border px-2.5 py-1.5 text-[13px] outline-none sm:flex-1 lg:flex-none"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
          <div className="flex gap-1">
            {(
              [
                ['all', '전체'],
                ['current', '현행'],
                ['discontinued', '단종'],
              ] as const
            ).map(([v, label]) => (
              <Toggle
                key={v}
                active={draftFilters.status === v}
                onClick={() => schedule({ status: v })}
              >
                {label}
              </Toggle>
            ))}
          </div>

          <span className="tnum text-[13px]" style={{ color: 'var(--muted)' }}>
            {resultCount === totalCount
              ? `${totalCount}개 구성`
              : `${resultCount} / ${totalCount}개`}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {isFiltered(draftFilters) && (
              <button
                type="button"
                onClick={reset}
                className="text-[13px] underline underline-offset-2"
                style={{ color: 'var(--muted)' }}
              >
                초기화
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-md border px-2 py-1 text-[13px] sm:hidden"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              aria-expanded={open}
            >
              필터 {open ? '접기' : '펼치기'}
            </button>
          </div>
        </div>

        <div className={`${open ? 'block' : 'hidden'} sm:block`}>
          <div className="mt-4 space-y-3">
            <div>
              <FieldLabel>제품군</FieldLabel>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {FAMILIES.map((f) => (
                  <Toggle
                    key={f}
                    active={draftFilters.families.includes(f)}
                    onClick={() =>
                      schedule({ families: toggleIn(draftFilters.families, f) })
                    }
                  >
                    {FAMILY_LABEL[f as Family]}
                  </Toggle>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>칩</FieldLabel>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {generations.map((g) => (
                  <Toggle
                    key={g}
                    active={draftFilters.generations.includes(g)}
                    onClick={() =>
                      schedule({ generations: toggleIn(draftFilters.generations, g) })
                    }
                  >
                    M{g}
                  </Toggle>
                ))}
                <span
                  className="mx-1 h-4 w-px"
                  style={{ background: 'var(--border)' }}
                />
                {TIERS.map((t) => (
                  <Toggle
                    key={t}
                    active={draftFilters.tiers.includes(t)}
                    onClick={() =>
                      schedule({ tiers: toggleIn(draftFilters.tiers, t as Tier) })
                    }
                  >
                    {TIER_LABEL[t as Tier]}
                  </Toggle>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>화면</FieldLabel>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {sizes.map((s) => (
                  <Toggle
                    key={s}
                    active={draftFilters.sizes.includes(s)}
                    onClick={() =>
                      schedule({ sizes: toggleIn(draftFilters.sizes, s) })
                    }
                  >
                    {s}&quot;
                  </Toggle>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <FieldLabel>메모리</FieldLabel>
                  <span className="tnum text-[11px]" style={{ color: 'var(--muted)' }}>
                    {memory.lower === ranges.memory.min ? '최저' : `${memory.lower}GB`} –{' '}
                    {memory.upper === ranges.memory.max ? '최고' : `${memory.upper}GB`}
                  </span>
                </div>
                <RangeSlider
                  min={ranges.memory.min}
                  max={ranges.memory.max}
                  values={ranges.memory.values}
                  lower={memory.lower}
                  upper={memory.upper}
                  formatValue={(value) => `${value}GB`}
                  ariaLabel="메모리"
                  onChange={(lower, upper) =>
                    schedule({
                      minMemoryGb: lower === ranges.memory.min ? null : lower,
                      maxMemoryGb: upper === ranges.memory.max ? null : upper,
                    })
                  }
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <FieldLabel>저장장치</FieldLabel>
                  <span className="tnum text-[11px]" style={{ color: 'var(--muted)' }}>
                    {storage.lower === ranges.storage.min
                      ? '최저'
                      : storageLabel(storage.lower)}{' '}
                    – {storage.upper === ranges.storage.max
                      ? '최고'
                      : storageLabel(storage.upper)}
                  </span>
                </div>
                <RangeSlider
                  min={ranges.storage.min}
                  max={ranges.storage.max}
                  values={ranges.storage.values}
                  lower={storage.lower}
                  upper={storage.upper}
                  step={256}
                  formatValue={storageLabel}
                  ariaLabel="저장장치"
                  onChange={(lower, upper) =>
                    schedule({
                      minStorageGb: lower === ranges.storage.min ? null : lower,
                      maxStorageGb: upper === ranges.storage.max ? null : upper,
                    })
                  }
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <FieldLabel>가격</FieldLabel>
                  <span className="tnum text-[11px]" style={{ color: 'var(--muted)' }}>
                    {price.lower === ranges.price.min ? '최저' : priceLabel(price.lower)} –{' '}
                    {price.upper === ranges.price.max ? '최고' : priceLabel(price.upper)}
                  </span>
                </div>
                <RangeSlider
                  min={ranges.price.min}
                  max={ranges.price.max}
                  lower={price.lower}
                  upper={price.upper}
                  step={10000}
                  formatValue={priceLabel}
                  ariaLabel="가격"
                  onChange={(lower, upper) =>
                    schedule({
                      minKrw: lower === ranges.price.min ? null : lower,
                      maxKrw: upper === ranges.price.max ? null : upper,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
