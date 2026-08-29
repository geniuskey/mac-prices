'use client'

import { Fragment } from 'react'
import type { Model, Row } from '@/lib/types'
import type { SortKey, SortState } from '@/lib/filters'
import { formatKrw, formatKrwShort, formatStorage } from '@/lib/price'
import { FAMILY_LABEL } from '@/lib/schema'
import { Badge, FieldLabel, Select } from './ui'
import RowDetail from './RowDetail'
import RowCard from './RowCard'

const COLUMNS: {
  key: SortKey
  label: string
  align: 'left' | 'right'
  hideBelow?: 'md' | 'lg'
}[] = [
  { key: 'name', label: '제품', align: 'left' },
  { key: 'cpu', label: 'CPU', align: 'right', hideBelow: 'lg' },
  { key: 'gpu', label: 'GPU', align: 'right', hideBelow: 'lg' },
  { key: 'memory', label: '메모리', align: 'right' },
  { key: 'storage', label: '저장', align: 'right' },
  { key: 'released', label: '출시', align: 'right', hideBelow: 'md' },
  { key: 'price', label: '가격', align: 'right' },
]

function hideClass(hide?: 'md' | 'lg') {
  if (hide === 'md') return 'hidden md:table-cell'
  if (hide === 'lg') return 'hidden lg:table-cell'
  return ''
}

export default function PriceTable({
  rows,
  models,
  sort,
  onSort,
  onSetSort,
  selected,
  onToggleSelect,
  expandedId,
  onExpand,
  normalizeOn,
}: {
  rows: Row[]
  models: Map<string, Model>
  sort: SortState
  /** 헤더 클릭 — 같은 키를 다시 누르면 방향이 뒤집힌다 */
  onSort: (key: SortKey) => void
  /** 정렬 상태를 통째로 지정 (모바일 셀렉트) */
  onSetSort: (sort: SortState) => void
  selected: Set<string>
  onToggleSelect: (id: string) => void
  expandedId: string | null
  onExpand: (id: string | null) => void
  normalizeOn: boolean
}) {
  // 가격 막대의 기준. 구성 불가능한 행은 제외해야 막대가 찌그러지지 않는다.
  const maxPrice = Math.max(
    1,
    ...rows.filter((r) => r.normalized?.feasible !== false).map((r) => r.priceKrw),
  )

  if (rows.length === 0) {
    return (
      <div
        className="mx-auto max-w-[1400px] px-5 py-16 text-center text-[14px]"
        style={{ color: 'var(--muted)' }}
      >
        조건에 맞는 구성이 없습니다. 필터를 줄여보세요.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-0 sm:px-5">
      {/* 좁은 화면: 정렬 셀렉트 + 카드 목록 (표 헤더를 누를 자리가 없다) */}
      <div className="sm:hidden">
        <div
          className="flex items-center gap-2 border-b px-3 py-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <FieldLabel>정렬</FieldLabel>
          <Select
            ariaLabel="정렬 기준"
            value={`${sort.key}:${sort.dir}`}
            onChange={(v) => {
              const [key, dir] = v.split(':') as [SortKey, 'asc' | 'desc']
              onSetSort({ key, dir })
            }}
            options={[
              { value: 'price:asc', label: '가격 낮은 순' },
              { value: 'price:desc', label: '가격 높은 순' },
              { value: 'released:desc', label: '최신 출시 순' },
              { value: 'released:asc', label: '오래된 순' },
              { value: 'cpu:desc', label: 'CPU 코어 많은 순' },
              { value: 'gpu:desc', label: 'GPU 코어 많은 순' },
              { value: 'memory:desc', label: '메모리 큰 순' },
              { value: 'storage:desc', label: '저장장치 큰 순' },
              { value: 'name:asc', label: '이름 순' },
            ]}
          />
        </div>
        {rows.map((row) => (
          <RowCard
            key={row.id}
            row={row}
            model={models.get(row.modelId)}
            selected={selected.has(row.id)}
            onToggleSelect={() => onToggleSelect(row.id)}
            expanded={expandedId === row.id}
            onExpand={() => onExpand(expandedId === row.id ? null : row.id)}
            normalizeOn={normalizeOn}
          />
        ))}
      </div>

      <table className="hidden w-full border-collapse text-[13px] sm:table">
        <thead>
          <tr
            className="sticky z-20"
            style={{
              top: 'var(--filter-h, 0px)',
              background: 'var(--surface)',
              boxShadow: 'inset 0 -1px 0 var(--border)',
            }}
          >
            <th className="w-8 px-2 py-2" scope="col">
              <span className="sr-only">비교 선택</span>
            </th>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`px-2 py-2 font-medium ${hideClass(c.hideBelow)} ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                  aria-sort={
                    active
                      ? sort.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className="inline-flex items-center gap-0.5 whitespace-nowrap"
                    style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
                  >
                    {c.label}
                    <span aria-hidden className="text-[10px]">
                      {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </button>
                </th>
              )
            })}
            <th className="w-8 px-2 py-2" scope="col">
              <span className="sr-only">상세</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const infeasible = row.normalized?.feasible === false
            const expanded = expandedId === row.id
            const model = models.get(row.modelId)
            const barPct = infeasible
              ? 0
              : Math.max(2, (row.priceKrw / maxPrice) * 100)

            return (
              <Fragment key={row.id}>
                <tr
                  className="border-t transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    background: expanded
                      ? 'var(--surface-2)'
                      : selected.has(row.id)
                        ? 'var(--accent-soft)'
                        : 'transparent',
                    opacity: infeasible ? 0.55 : 1,
                  }}
                >
                  <td className="px-2 py-2 align-middle">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => onToggleSelect(row.id)}
                      aria-label={`${row.displayName} 비교에 추가`}
                      className="size-4 cursor-pointer align-middle"
                    />
                  </td>

                  <td className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span className="font-medium">{row.displayName}</span>
                      {row.variantLabel && <Badge>{row.variantLabel}</Badge>}
                      {row.upcoming ? (
                        <Badge tone="accent">출시 예정</Badge>
                      ) : (
                        !row.isCurrent && <Badge>단종</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[12px]" style={{ color: 'var(--muted)' }}>
                      {/* 코어 수를 항상 보여야 같은 칩의 GPU 바인닝
                          (예: M4 8코어 GPU vs 10코어 GPU) 이 구분된다 */}
                      {FAMILY_LABEL[row.family]} · {row.chip.family} ·{' '}
                      {row.chip.cpuCores}C / {row.chip.gpuCores}G
                    </div>
                  </td>

                  <td className={`tnum px-2 py-2 text-right ${hideClass('lg')}`}>
                    {row.chip.cpuCores}
                  </td>
                  <td className={`tnum px-2 py-2 text-right ${hideClass('lg')}`}>
                    {row.chip.gpuCores}
                  </td>
                  <td className="tnum px-2 py-2 text-right whitespace-nowrap">
                    {row.memoryGb}GB
                  </td>
                  <td className="tnum px-2 py-2 text-right whitespace-nowrap">
                    {formatStorage(row.storageGb)}
                  </td>
                  <td
                    className={`tnum px-2 py-2 text-right whitespace-nowrap ${hideClass('md')}`}
                    style={{ color: 'var(--muted)' }}
                  >
                    {row.releasedAt.slice(0, 7)}
                  </td>

                  <td className="px-2 py-2 text-right">
                    {infeasible ? (
                      <span className="text-[12px]" style={{ color: 'var(--warn)' }}>
                        구성 불가
                      </span>
                    ) : (
                      <>
                        <div className="tnum font-semibold whitespace-nowrap">
                          {formatKrw(row.priceKrw)}
                        </div>
                        {/* 가격 게이지 — 가격 외 기준으로 정렬했을 때
                            비싼 쪽인지 싼 쪽인지 훑어보게 해준다. 레일을 깔아야
                            밑줄이 아니라 게이지로 읽힌다. */}
                        <div
                          className="ml-auto mt-1.5 h-[4px] w-[92px] overflow-hidden rounded-full"
                          style={{ background: 'var(--border)' }}
                          aria-hidden
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${barPct}%`,
                              background: 'var(--accent)',
                              opacity: 0.65,
                            }}
                          />
                        </div>
                        {normalizeOn && row.normalized && row.normalized.upgradeKrw > 0 && (
                          <div
                            className="tnum mt-0.5 text-[11px] whitespace-nowrap"
                            style={{ color: 'var(--muted)' }}
                          >
                            {formatKrwShort(row.normalized.baseKrw)} + 업그레이드{' '}
                            {formatKrwShort(row.normalized.upgradeKrw)}
                          </div>
                        )}
                      </>
                    )}
                  </td>

                  <td className="px-1 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onExpand(expanded ? null : row.id)}
                      aria-expanded={expanded}
                      aria-label={`${row.displayName} 상세 ${expanded ? '접기' : '펼치기'}`}
                      className="rounded px-1.5 py-1 text-[11px]"
                      style={{ color: 'var(--muted)' }}
                    >
                      {expanded ? '▲' : '▼'}
                    </button>
                  </td>
                </tr>

                {infeasible && row.normalized && (
                  <tr style={{ background: 'transparent' }}>
                    <td />
                    <td
                      colSpan={COLUMNS.length + 1}
                      className="px-2 pb-2 text-[12px]"
                      style={{ color: 'var(--warn)' }}
                    >
                      {row.normalized.note}
                    </td>
                  </tr>
                )}

                {expanded && model && (
                  <tr>
                    <td
                      colSpan={COLUMNS.length + 2}
                      className="border-t p-0"
                      style={{
                        borderColor: 'var(--border)',
                        background: 'var(--surface-2)',
                      }}
                    >
                      <RowDetail row={row} model={model} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
