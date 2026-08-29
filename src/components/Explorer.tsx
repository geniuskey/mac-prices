'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Model, Row } from '@/lib/types'
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  filterRows,
  fromQuery,
  sortRows,
  toQuery,
  type FilterState,
  type SortKey,
  type SortState,
} from '@/lib/filters'
import { normalizeRows } from '@/lib/price'
import FilterBar from './FilterBar'
import PriceTable from './PriceTable'
import CompareTray from './CompareTray'
import { FieldLabel, Select, Toggle } from './ui'

const MAX_COMPARE = 4
const NORM_MEMORY = [8, 16, 24, 32, 36, 48, 64, 96, 128]
const NORM_STORAGE = [256, 512, 1024, 2048, 4096]

export default function Explorer({
  rows: allRows,
  models: modelList,
  oldestCheckedAt,
  verifiedCount,
}: {
  rows: Row[]
  models: Model[]
  oldestCheckedAt: string
  verifiedCount: number
}) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [normalize, setNormalize] = useState({
    on: false,
    memoryGb: 16,
    storageGb: 512,
  })
  const [selected, setSelected] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const stickyRef = useRef<HTMLDivElement>(null)

  // 표 헤더도 sticky 라서, 위에 고정된 필터 영역의 실제 높이만큼 내려야 한다.
  // 필터를 펼치거나 창을 줄이면 높이가 바뀌므로 관찰해서 갱신한다.
  useEffect(() => {
    const el = stickyRef.current
    if (!el) return
    const update = () =>
      document.documentElement.style.setProperty(
        '--filter-h',
        `${el.offsetHeight}px`,
      )
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 첫 렌더 뒤 URL 에서 상태를 복원한다. 정적 배포라 서버는 쿼리를 못 본다.
  useEffect(() => {
    const parsed = fromQuery(window.location.search)
    setFilters(parsed.filters)
    setSort(parsed.sort)
    setNormalize(parsed.normalize)
    setSelected(parsed.selected)
    setHydrated(true)
  }, [])

  // 상태가 바뀔 때마다 공유 가능한 링크로 되돌려 쓴다.
  useEffect(() => {
    if (!hydrated) return
    const q = toQuery(filters, sort, normalize, selected)
    const url = q ? `${window.location.pathname}?${q}` : window.location.pathname
    window.history.replaceState(null, '', url)
  }, [hydrated, filters, sort, normalize, selected])

  const models = useMemo(
    () => new Map(modelList.map((m) => [m.id, m])),
    [modelList],
  )

  const asOf = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // 동일 조건 비교가 켜지면 행 자체가 바뀐다 (모델·칩 단위로 합쳐진다).
  const baseRows = useMemo(
    () =>
      normalize.on
        ? normalizeRows(
            allRows,
            modelList,
            { memoryGb: normalize.memoryGb, storageGb: normalize.storageGb },
            asOf,
          )
        : allRows,
    [allRows, modelList, normalize, asOf],
  )

  const visibleRows = useMemo(
    () => sortRows(filterRows(baseRows, filters), sort),
    [baseRows, filters, sort],
  )

  const generations = useMemo(
    () => [...new Set(allRows.map((r) => r.chip.generation))].sort((a, b) => a - b),
    [allRows],
  )
  const sizes = useMemo(
    () =>
      [
        ...new Set(
          allRows
            .filter((r) => r.displaySizeInch !== null)
            .map((r) => Math.floor(r.displaySizeInch!)),
        ),
      ].sort((a, b) => a - b),
    [allRows],
  )

  const selectedRows = useMemo(
    () =>
      selected
        .map((id) => baseRows.find((r) => r.id === id))
        .filter((r): r is Row => r !== undefined),
    [selected, baseRows],
  )

  const onSort = useCallback((key: SortKey) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : // 이름은 오름차순, 나머지 수치는 큰 값부터 보는 게 자연스럽다.
          { key, dir: key === 'name' || key === 'price' ? 'asc' : 'desc' },
    )
  }, [])

  const onToggleSelect = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((v) => v !== id)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, id],
    )
  }, [])

  const unverified = modelList.length - verifiedCount

  return (
    <>
      <header
        className="border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="mx-auto max-w-[1400px] px-3 pt-5 pb-4 sm:px-5">
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[26px]">
            Mac 가격 비교
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>
            M1 이후 Mac {modelList.length}개 모델 · {allRows.length}개 구성의 한국
            정가(VAT 포함)를 한 표에서 비교합니다.
          </p>

          {unverified > 0 && (
            <div
              className="mt-3 rounded-lg border px-3 py-2 text-[12.5px]"
              style={{
                borderColor: 'var(--warn)',
                background: 'var(--warn-soft)',
                color: 'var(--warn)',
              }}
            >
              <strong>가격 대조 진행률 {verifiedCount}/{modelList.length}</strong>
              {' — '}
              아직 {unverified}개 모델의 가격이 apple.com/kr 과 대조되지
              않았습니다. 구매 전 반드시 Apple 스토어에서 실제 가격을 확인하세요.
              (데이터 기준일 {oldestCheckedAt})
            </div>
          )}
        </div>
      </header>

      <div ref={stickyRef} className="sticky top-0 z-30">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        generations={generations}
        sizes={sizes}
        resultCount={visibleRows.length}
        totalCount={baseRows.length}
      />

      {/* 이 사이트의 핵심 기능 — Apple 사이트에서 가장 하기 어려운 비교 */}
      <div
        className="border-b"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-5">
          <Toggle
            active={normalize.on}
            onClick={() => setNormalize((n) => ({ ...n, on: !n.on }))}
          >
            {normalize.on ? '✓ 동일 조건 비교' : '동일 조건 비교'}
          </Toggle>

          {normalize.on ? (
            <>
              <div className="flex items-center gap-1.5">
                <FieldLabel>메모리</FieldLabel>
                <Select
                  ariaLabel="동일 조건 메모리"
                  value={String(normalize.memoryGb)}
                  onChange={(v) =>
                    setNormalize((n) => ({ ...n, memoryGb: Number(v) }))
                  }
                  options={NORM_MEMORY.map((m) => ({
                    value: String(m),
                    label: `${m}GB`,
                  }))}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <FieldLabel>저장장치</FieldLabel>
                <Select
                  ariaLabel="동일 조건 저장장치"
                  value={String(normalize.storageGb)}
                  onChange={(v) =>
                    setNormalize((n) => ({ ...n, storageGb: Number(v) }))
                  }
                  options={NORM_STORAGE.map((s) => ({
                    value: String(s),
                    label: s >= 1024 ? `${s / 1024}TB` : `${s}GB`,
                  }))}
                />
              </div>
              <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
                모든 모델을 같은 사양으로 맞췄을 때의 실제 구매가입니다. 기본
                구성에 BTO 업그레이드 비용을 더해 계산합니다.
              </span>
            </>
          ) : (
            <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
              켜면 모든 모델을 같은 메모리·저장장치로 맞춘 가격으로 다시
              계산합니다. 기본 구성 용량이 제각각이라 정가만으로는 비교가 안 되는
              문제를 없앱니다.
            </span>
          )}
        </div>
      </div>
      </div>

      <main>
        <PriceTable
          rows={visibleRows}
          models={models}
          sort={sort}
          onSort={onSort}
          onSetSort={setSort}
          selected={new Set(selected)}
          onToggleSelect={onToggleSelect}
          expandedId={expandedId}
          onExpand={setExpandedId}
          normalizeOn={normalize.on}
        />

        <div
          className="mx-auto max-w-[1400px] px-3 py-8 text-[12px] sm:px-5"
          style={{ color: 'var(--muted)' }}
        >
          <p>
            가격은 Apple 대한민국 온라인 스토어 정가(VAT 포함) 기준이며 실제
            판매가와 다를 수 있습니다. 교육 할인·통신사 제휴·리셀러 가격은
            포함하지 않습니다.
          </p>
          <p className="mt-1">
            이 사이트는 Apple 과 제휴 관계가 없습니다. Apple, MacBook, Mac mini,
            Mac Studio, iMac, Mac Pro 는 Apple Inc. 의 상표입니다.
          </p>
          {selected.length >= MAX_COMPARE && (
            <p className="mt-1">비교는 최대 {MAX_COMPARE}개까지 가능합니다.</p>
          )}
        </div>
      </main>

      <CompareTray
        rows={selectedRows}
        onRemove={(id) => setSelected((prev) => prev.filter((v) => v !== id))}
        onClear={() => setSelected([])}
      />
    </>
  )
}
