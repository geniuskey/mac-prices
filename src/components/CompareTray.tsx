'use client'

import { useState } from 'react'
import type { Row } from '@/lib/types'
import { summarizeBenchmarks } from '@/lib/benchmarks'
import { formatKrw, formatStorage } from '@/lib/price'
import { FAMILY_LABEL } from '@/lib/schema'
import { Toggle } from './ui'

interface Attr {
  label: string
  value: (r: Row) => string
  /** 낮을수록/높을수록 좋은 축이면 최저·최고를 강조한다 */
  highlight?: 'min' | 'max'
  numeric?: (r: Row) => number | null
}

const summaryOf = (row: Row) => summarizeBenchmarks(row.benchmarks)
const score = (row: Row, key: 'singleCore' | 'multiCore' | 'gpuMetal') =>
  summaryOf(row)[key] ?? null
const power = (row: Row, key: 'powerIdleW' | 'powerMaxW') =>
  summaryOf(row)[key] ?? null
const scoreText = (value: number | null) => value?.toLocaleString('ko-KR') ?? '—'
const powerText = (value: number | null) => (value === null ? '—' : `${value}W`)

const ATTRS: Attr[] = [
  {
    label: '가격',
    value: (r) => formatKrw(r.priceKrw),
    highlight: 'min',
    numeric: (r) => r.priceKrw,
  },
  { label: '제품군', value: (r) => FAMILY_LABEL[r.family] },
  { label: '칩', value: (r) => r.chip.family },
  {
    label: 'CPU 코어',
    value: (r) => `${r.chip.cpuCores}`,
    highlight: 'max',
    numeric: (r) => r.chip.cpuCores,
  },
  {
    label: 'GPU 코어',
    value: (r) => `${r.chip.gpuCores}`,
    highlight: 'max',
    numeric: (r) => r.chip.gpuCores,
  },
  {
    label: '메모리',
    value: (r) => `${r.memoryGb}GB`,
    highlight: 'max',
    numeric: (r) => r.memoryGb,
  },
  {
    label: '저장장치',
    value: (r) => formatStorage(r.storageGb),
    highlight: 'max',
    numeric: (r) => r.storageGb,
  },
  {
    label: '메모리 대역폭',
    value: (r) =>
      r.chip.memoryBandwidthGBps ? `${r.chip.memoryBandwidthGBps}GB/s` : '—',
    highlight: 'max',
    numeric: (r) => r.chip.memoryBandwidthGBps ?? null,
  },
  { label: '최대 메모리', value: (r) => `${r.chip.maxMemoryGb}GB` },
  {
    label: 'Geekbench 6 싱글',
    value: (r) => scoreText(score(r, 'singleCore')),
    highlight: 'max',
    numeric: (r) => score(r, 'singleCore'),
  },
  {
    label: 'Geekbench 6 멀티',
    value: (r) => scoreText(score(r, 'multiCore')),
    highlight: 'max',
    numeric: (r) => score(r, 'multiCore'),
  },
  {
    label: 'Geekbench Metal',
    value: (r) => scoreText(score(r, 'gpuMetal')),
    highlight: 'max',
    numeric: (r) => score(r, 'gpuMetal'),
  },
  {
    label: '전력 소비 (유휴)',
    value: (r) => powerText(power(r, 'powerIdleW')),
    highlight: 'min',
    numeric: (r) => power(r, 'powerIdleW'),
  },
  {
    label: '전력 소비 (최대)',
    value: (r) => powerText(power(r, 'powerMaxW')),
    highlight: 'min',
    numeric: (r) => power(r, 'powerMaxW'),
  },
  {
    label: '화면',
    value: (r) =>
      r.displaySizeInch ? `${r.displaySizeInch}"${r.proMotion ? ' ProMotion' : ''}` : '없음',
  },
  {
    label: '무게',
    value: (r) => (r.weightKg ? `${r.weightKg}kg` : '—'),
    highlight: 'min',
    numeric: (r) => r.weightKg ?? null,
  },
  {
    label: 'Thunderbolt',
    value: (r) =>
      r.ports?.thunderbolt
        ? `${r.ports.thunderbolt}개 (v${r.ports.thunderboltVersion ?? '?'})`
        : '—',
  },
  { label: '출시', value: (r) => r.releasedAt },
  { label: '상태', value: (r) => (r.isCurrent ? '현행 판매' : `단종 ${r.discontinuedAt}`) },
]

export default function CompareTray({
  rows,
  onRemove,
  onClear,
}: {
  rows: Row[]
  onRemove: (id: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [diffOnly, setDiffOnly] = useState(false)

  if (rows.length === 0) return null

  const visible = diffOnly
    ? ATTRS.filter((a) => new Set(rows.map(a.value)).size > 1)
    : ATTRS

  const numericRange = (attr: Attr): { min: number; max: number } | null => {
    if (!attr.highlight || !attr.numeric || rows.length < 2) return null
    const vals = rows
      .map(attr.numeric)
      .filter((value): value is number => value !== null)
    if (vals.length < 2 || new Set(vals).size === 1) return null
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }

  const numericStyle = (
    attr: Attr,
    row: Row,
    range: { min: number; max: number } | null,
  ) => {
    const value = attr.numeric?.(row) ?? null
    if (value === null || range === null || !attr.highlight) {
      return { color: 'var(--text)', fontWeight: 400 }
    }

    const isBest = value === (attr.highlight === 'min' ? range.min : range.max)
    const isWorst = value === (attr.highlight === 'min' ? range.max : range.min)
    return {
      color: isBest
        ? 'var(--accent)'
        : isWorst
          ? 'var(--danger)'
          : 'var(--warn)',
      fontWeight: isBest ? 700 : 500,
    }
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-strong)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
      }}
    >
      {open && (
        <div
          className="max-h-[70vh] overflow-auto border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="mx-auto max-w-[1400px] px-3 py-3 sm:px-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Toggle active={diffOnly} onClick={() => setDiffOnly((v) => !v)}>
                차이나는 항목만
              </Toggle>
              <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
                {rows.length < 2
                  ? '2개 이상 선택하면 항목별 우열이 강조됩니다'
                  : <>
                      숫자형 항목:{' '}
                      <b style={{ color: 'var(--accent)' }}>최고</b> ·{' '}
                      <b style={{ color: 'var(--warn)' }}>중간</b> ·{' '}
                      <b style={{ color: 'var(--danger)' }}>최하</b>
                    </>}
              </span>
            </div>

            <h3 className="mb-2 text-[13px] font-semibold">사양 비교</h3>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <table className="min-w-[720px] w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th
                      className="sticky left-0 z-10 px-2 py-2 text-left font-medium"
                      style={{ background: 'var(--surface)', color: 'var(--muted)' }}
                    >
                      항목
                    </th>
                    {rows.map((r) => (
                      <th key={r.id} className="min-w-[150px] px-2 py-2 text-left">
                        <div className="font-semibold">{r.displayName}</div>
                        <div className="text-[12px] font-normal" style={{ color: 'var(--muted)' }}>
                          {r.chip.family} · {r.memoryGb}GB / {formatStorage(r.storageGb)}
                          {r.variantLabel ? ` · ${r.variantLabel}` : ''}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((attr) => {
                    const range = numericRange(attr)
                    return (
                      <tr
                        key={attr.label}
                        className="border-t"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td
                          className="sticky left-0 z-10 whitespace-nowrap px-2 py-1.5"
                          style={{ background: 'var(--surface)', color: 'var(--muted)' }}
                        >
                          {attr.label}
                        </td>
                        {rows.map((r) => {
                          return (
                            <td
                              key={r.id}
                              className="tnum px-2 py-1.5"
                              style={numericStyle(attr, r, range)}
                            >
                              {attr.value(r)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {visible.length === 0 && (
                    <tr>
                      <td
                        colSpan={rows.length + 1}
                        className="px-2 py-4 text-center"
                        style={{ color: 'var(--muted)' }}
                      >
                        선택한 구성의 스펙이 모두 같습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-2 sm:px-5">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {rows.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <span className="max-w-[190px] truncate">
                {r.displayName} · {r.memoryGb}GB/{formatStorage(r.storageGb)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                aria-label={`${r.displayName} 비교에서 빼기`}
                style={{ color: 'var(--muted)' }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-[13px] underline underline-offset-2"
          style={{ color: 'var(--muted)' }}
        >
          비우기
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-md px-3 py-1.5 text-[13px] font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          {open ? '닫기' : `비교 (${rows.length})`}
        </button>
      </div>
    </div>
  )
}
