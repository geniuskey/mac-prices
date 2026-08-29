'use client'

import { useState } from 'react'
import { FAMILIES, FAMILY_LABEL, TIERS, TIER_LABEL } from '@/lib/schema'
import type { Family, Tier } from '@/lib/types'
import type { FilterState } from '@/lib/filters'
import { isFiltered } from '@/lib/filters'
import { FieldLabel, Select, Toggle } from './ui'

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

const MEMORY_OPTIONS = [8, 16, 18, 24, 32, 36, 48, 64, 96, 128]
const STORAGE_OPTIONS = [256, 512, 1024, 2048, 4096, 8192]
const PRICE_CAPS = [1000000, 2000000, 3000000, 4000000, 6000000]

export default function FilterBar({
  filters,
  onChange,
  generations,
  sizes,
  resultCount,
  totalCount,
}: {
  filters: FilterState
  onChange: (next: FilterState) => void
  generations: number[]
  sizes: number[]
  resultCount: number
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })

  const storageLabel = (gb: number) =>
    gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`

  return (
    <div
      className="border-b"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mx-auto max-w-[1400px] px-3 py-2.5 sm:px-5">
        {/* 1행: 검색 + 판매 상태 + 결과 수 */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="모델·칩 검색 (예: air m4, studio ultra)"
            aria-label="모델 검색"
            /* 모바일에서는 한 줄을 통째로 쓴다. flex-1 만으로는 옆의 상태
               토글에 밀려 입력창이 몇 글자 폭으로 찌그러진다. */
            className="w-full min-w-0 rounded-md border px-2.5 py-1.5 text-[13px] outline-none sm:w-auto sm:flex-1 sm:max-w-xs"
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
                    minStorageGb: null,
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
          {/* 2행: 제품군 */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <FieldLabel>제품군</FieldLabel>
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

          {/* 3행: 칩 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <FieldLabel>칩</FieldLabel>
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

          {/* 4행: 화면 + 최소 사양 + 가격 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <FieldLabel>화면</FieldLabel>
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

            <div className="flex items-center gap-1.5">
              <FieldLabel>최소 메모리</FieldLabel>
              <Select
                ariaLabel="최소 메모리"
                value={String(filters.minMemoryGb ?? '')}
                onChange={(v) => set({ minMemoryGb: v ? Number(v) : null })}
                options={[
                  { value: '', label: '제한 없음' },
                  ...MEMORY_OPTIONS.map((m) => ({
                    value: String(m),
                    label: `${m}GB+`,
                  })),
                ]}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <FieldLabel>최소 저장</FieldLabel>
              <Select
                ariaLabel="최소 저장장치"
                value={String(filters.minStorageGb ?? '')}
                onChange={(v) => set({ minStorageGb: v ? Number(v) : null })}
                options={[
                  { value: '', label: '제한 없음' },
                  ...STORAGE_OPTIONS.map((s) => ({
                    value: String(s),
                    label: `${storageLabel(s)}+`,
                  })),
                ]}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <FieldLabel>가격 상한</FieldLabel>
              <Select
                ariaLabel="가격 상한"
                value={String(filters.maxKrw ?? '')}
                onChange={(v) => set({ maxKrw: v ? Number(v) : null })}
                options={[
                  { value: '', label: '제한 없음' },
                  ...PRICE_CAPS.map((c) => ({
                    value: String(c),
                    label: `${c / 10000}만원 이하`,
                  })),
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
