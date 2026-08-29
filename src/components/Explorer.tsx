'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Model, Row } from '@/lib/types'
import {
  filterRows,
  fromQuery,
  sortRows,
  toQuery,
  type FilterState,
  type SortKey,
  type SortState,
} from '@/lib/filters'
import { useQueryString } from '@/lib/useQueryString'
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
  upgradesVerifiedCount,
}: {
  rows: Row[]
  models: Model[]
  oldestCheckedAt: string
  verifiedCount: number
  upgradesVerifiedCount: number
}) {
  // 필터·정렬·동일조건·선택은 전부 URL 이 원본이다. 별도 state 를 두면
  // 두 벌이 어긋나고, 링크를 붙여넣었을 때 화면과 주소가 따로 논다.
  const [search, setSearch] = useQueryString()
  const { filters, sort, normalize, selected } = useMemo(
    () => fromQuery(search),
    [search],
  )

  const commit = useCallback(
    (next: {
      filters?: FilterState
      sort?: SortState
      normalize?: { on: boolean; memoryGb: number; storageGb: number }
      selected?: string[]
    }) => {
      setSearch(
        toQuery(
          next.filters ?? filters,
          next.sort ?? sort,
          next.normalize ?? normalize,
          next.selected ?? selected,
        ),
      )
    },
    [setSearch, filters, sort, normalize, selected],
  )

  const setFilters = useCallback(
    (f: FilterState) => commit({ filters: f }),
    [commit],
  )
  const setSort = useCallback((s: SortState) => commit({ sort: s }), [commit])

  // 상세 펼침은 링크로 공유할 만한 상태가 아니라 로컬로 둔다.
  const [expandedId, setExpandedId] = useState<string | null>(null)
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

  const onSort = useCallback(
    (key: SortKey) => {
      commit({
        sort:
          sort.key === key
            ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
            : // 이름·가격은 오름차순, 나머지 수치는 큰 값부터가 자연스럽다.
              { key, dir: key === 'name' || key === 'price' ? 'asc' : 'desc' },
      })
    },
    [commit, sort],
  )

  /**
   * 동일 조건 비교를 켜고 끌 때 선택을 옮긴다.
   * 두 모드는 행 id 체계가 다르다 (구성 단위 vs 모델·칩 단위). 그대로 두면
   * 비교함에 담아둔 제품이 토글 한 번에 말없이 사라진다.
   */
  const onToggleNormalize = useCallback(() => {
    const nextNormalize = { ...normalize, on: !normalize.on }
    const keyOf = (r: Row) =>
      `${r.modelId}--${r.chip.id}--${r.variantLabel ?? ''}`

    const keys = selected
      .map((id) => baseRows.find((r) => r.id === id))
      .filter((r): r is Row => r !== undefined)
      .map(keyOf)

    const nextRows = nextNormalize.on
      ? normalizeRows(
          allRows,
          modelList,
          {
            memoryGb: nextNormalize.memoryGb,
            storageGb: nextNormalize.storageGb,
          },
          asOf,
        )
      : allRows

    const nextSelected = keys
      .map((key) => {
        const matches = nextRows.filter((r) => keyOf(r) === key)
        // 구성 단위로 돌아갈 때는 기본 구성을 대표로 삼는다.
        return (matches.find((r) => r.isBaseConfig) ?? matches[0])?.id
      })
      .filter((id): id is string => id !== undefined)

    commit({ normalize: nextNormalize, selected: nextSelected })
  }, [commit, normalize, selected, baseRows, allRows, modelList, asOf])

  const onToggleSelect = useCallback(
    (id: string) => {
      if (selected.includes(id)) {
        commit({ selected: selected.filter((v) => v !== id) })
      } else if (selected.length < MAX_COMPARE) {
        commit({ selected: [...selected, id] })
      }
    },
    [commit, selected],
  )

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

          <div
            className="mt-3 rounded-lg border px-3 py-2 text-[12.5px]"
            style={{
              borderColor: 'var(--warn)',
              background: 'var(--warn-soft)',
              color: 'var(--warn)',
            }}
          >
            <strong>
              기본 정가 대조 {verifiedCount}/{modelList.length}
            </strong>
            {' — '}
            대조된 가격은 언론 보도 기준이며 apple.com/kr 직접 확인은 아닙니다.
            {unverified > 0 && ` 아직 ${unverified}개 모델은 대조 전입니다.`}
            <br />
            <strong>
              BTO 업그레이드 단가 대조 {upgradesVerifiedCount}/{modelList.length}
            </strong>
            {' — '}
            메모리·저장장치 추가 비용은 <b>추정값</b>입니다. 2026년 6월 Apple 이
            메모리 업그레이드 가격을 두 배로 올려 세대마다 크게 다릅니다. 동일
            조건 비교의 업그레이드 금액은 참고용으로만 보세요.
            <br />
            구매 전 반드시 Apple 스토어에서 실제 가격을 확인하세요. (데이터
            기준일 {oldestCheckedAt})
          </div>
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
            onClick={onToggleNormalize}
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
                    commit({ normalize: { ...normalize, memoryGb: Number(v) } })
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
                    commit({ normalize: { ...normalize, storageGb: Number(v) } })
                  }
                  options={NORM_STORAGE.map((s) => ({
                    value: String(s),
                    label: s >= 1024 ? `${s / 1024}TB` : `${s}GB`,
                  }))}
                />
              </div>
              <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
                모든 모델을 같은 사양으로 맞췄을 때의 구매가입니다. 기본 구성에
                BTO 업그레이드 비용을 더해 계산합니다.{' '}
                <b style={{ color: 'var(--warn)' }}>
                  업그레이드 단가는 아직 대조되지 않은 추정값입니다.
                </b>
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
        onRemove={(id) => commit({ selected: selected.filter((v) => v !== id) })}
        onClear={() => commit({ selected: [] })}
      />
    </>
  )
}
