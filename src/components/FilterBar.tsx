'use client'

import { useState } from 'react'
import { FAMILIES, FAMILY_LABEL, TIERS, TIER_LABEL } from '@/lib/schema'
import type { Family, Tier } from '@/lib/types'
import type { FilterState } from '@/lib/filters'
import { isFiltered } from '@/lib/filters'
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
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })

  const memory = selectedRange(
    ranges.memory,
    filters.minMemoryGb,
    filters.maxMemoryGb,
  )
  const storage = selectedRange(
    ranges.storage,
    filters.minStorageGb,
    filters.maxStorageGb,
  )
  const price = selectedRange(ranges.price, filters.minKrw, filters.maxKrw)

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
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
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
                active={filters.status === v}
                onClick={() => set({ status: v })}
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
            {isFiltered(filters) && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    q: '',
                    families: [],
                    generations: [],
                    tiers: [],
                    sizes: [],
                    minMemoryGb: null,
                    maxMemoryGb: null,
                    minStorageGb: null,
                    maxStorageGb: null,
                    minKrw: null,
                    maxKrw: null,
                    status: 'all',
                  })
                }
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
                    active={filters.families.includes(f)}
                    onClick={() => set({ families: toggleIn(filters.families, f) })}
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
                    active={filters.generations.includes(g)}
                    onClick={() =>
                      set({ generations: toggleIn(filters.generations, g) })
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
                    active={filters.tiers.includes(t)}
                    onClick={() => set({ tiers: toggleIn(filters.tiers, t as Tier) })}
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
                    active={filters.sizes.includes(s)}
                    onClick={() => set({ sizes: toggleIn(filters.sizes, s) })}
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
                    set({
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
                    – {storage.upper === ranges.storage.max ? '최고' : storageLabel(storage.upper)}
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
                    set({
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
                    set({
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
