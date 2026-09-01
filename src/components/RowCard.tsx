'use client'

import type { Model, Row } from '@/lib/types'
import { formatKrw, formatKrwShort, formatStorage } from '@/lib/price'
import { FAMILY_LABEL } from '@/lib/schema'
import { Badge } from './ui'
import RowDetail from './RowDetail'

/** 좁은 화면용 카드. 표를 그대로 줄이면 제품명이 세 줄로 접혀 못 읽는다. */
export default function RowCard({
  row,
  model,
  selected,
  onToggleSelect,
  expanded,
  onExpand,
  normalizeOn,
}: {
  row: Row
  model: Model | undefined
  selected: boolean
  onToggleSelect: () => void
  expanded: boolean
  onExpand: () => void
  normalizeOn: boolean
}) {
  const infeasible = row.normalized?.feasible === false

  return (
    <div
      className="border-b"
      style={{
        borderColor: 'var(--border)',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        opacity: infeasible ? 0.6 : 1,
      }}
    >
      <div className="flex items-start gap-2.5 px-3 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`${row.displayName} 비교에 추가`}
          className="mt-0.5 size-4 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-[14px] font-semibold">{row.displayName}</span>
            {row.variantLabel && <Badge>{row.variantLabel}</Badge>}
            {row.upcoming ? (
              <Badge tone="accent">출시 예정</Badge>
            ) : (
              !row.isCurrent && <Badge>단종</Badge>
            )}
          </div>

          <div className="mt-0.5 text-[12px]" style={{ color: 'var(--muted)' }}>
            {FAMILY_LABEL[row.family]} · {row.chip.family} · CPU{' '}
            {row.chip.cpuCores} / GPU {row.chip.gpuCores} · {row.releasedAt.slice(0, 7)}
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="tnum text-[13px] font-medium">
              {row.memoryGb}GB · {formatStorage(row.storageGb)}
            </span>
            {infeasible ? (
              <span className="text-[12px]" style={{ color: 'var(--warn)' }}>
                구성 불가 — {row.normalized!.note}
              </span>
            ) : (
              <span className="tnum ml-auto text-[16px] font-bold">
                {formatKrw(row.priceKrw)}
                {row.priceEstimated && (
                  <span
                    className="ml-1 align-middle text-[10px] font-medium"
                    style={{ color: 'var(--warn)' }}
                  >
                    추정
                  </span>
                )}
              </span>
            )}
          </div>

          {normalizeOn &&
            row.normalized &&
            row.normalized.feasible &&
            row.normalized.upgradeKrw > 0 && (
              <div
                className="tnum mt-0.5 text-right text-[11px]"
                style={{ color: 'var(--muted)' }}
              >
                기본 {formatKrwShort(row.normalized.baseKrw)} + 업그레이드{' '}
                {formatKrwShort(row.normalized.upgradeKrw)}
              </div>
            )}
        </div>

        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-label={`${row.displayName} 상세 ${expanded ? '접기' : '펼치기'}`}
          className="shrink-0 rounded px-1.5 py-1 text-[11px]"
          style={{ color: 'var(--muted)' }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && model && (
        <div style={{ background: 'var(--surface-2)' }}>
          <RowDetail row={row} model={model} />
        </div>
      )}
    </div>
  )
}
