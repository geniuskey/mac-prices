import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  filterRows,
  fromQuery,
  sortRows,
  toQuery,
} from '../filters'
import type { Row } from '../types'

function row(over: Partial<Row> & { id: string }): Row {
  return {
    modelId: 'm',
    family: 'macbook-air',
    displayName: 'MacBook Air 13 (M4, 2025)',
    chip: {
      id: 'm4-10c-10g',
      family: 'M4',
      generation: 4,
      tier: 'base',
      cpuCores: 10,
      gpuCores: 10,
      maxMemoryGb: 32,
      releasedAt: '2025-03-12',
    },
    memoryGb: 16,
    storageGb: 256,
    isBaseConfig: true,
    priceKrw: 1590000,
    priceEffectiveFrom: '2025-03-12',
    priceEstimated: false,
    priceHistory: [],
    releasedAt: '2025-03-12',
    discontinuedAt: null,
    isCurrent: true,
    displaySizeInch: 13.6,
    verified: false,
    upgradesVerified: false,
    upcoming: false,
    checkedAt: '2026-08-29',
    ...over,
  }
}

describe('filterRows', () => {
  const rows = [
    row({ id: 'a' }),
    row({
      id: 'b',
      family: 'mac-mini',
      displayName: 'Mac mini (M4, 2024)',
      displaySizeInch: null,
      priceKrw: 890000,
    }),
    row({
      id: 'c',
      displayName: 'MacBook Air 13 (M1, 2020)',
      chip: {
        id: 'm1-8c-7g',
        family: 'M1',
        generation: 1,
        tier: 'base',
        cpuCores: 8,
        gpuCores: 7,
        maxMemoryGb: 16,
        releasedAt: '2020-11-17',
      },
      isCurrent: false,
      discontinuedAt: '2024-03-08',
      priceKrw: 1290000,
    }),
    row({ id: 'd', displayName: 'MacBook Pro 14 (M4, 2024)', family: 'macbook-pro', displaySizeInch: 14.2 }),
  ]

  it('검색어의 모든 토큰이 맞아야 통과한다', () => {
    expect(filterRows(rows, { ...EMPTY_FILTERS, q: 'air m4' }).map((r) => r.id)).toEqual(['a'])
    expect(filterRows(rows, { ...EMPTY_FILTERS, q: 'air mini' })).toHaveLength(0)
  })

  it('화면 크기 필터는 화면 없는 데스크탑을 제외한다', () => {
    const ids = filterRows(rows, { ...EMPTY_FILTERS, sizes: [13, 14] }).map((r) => r.id)
    expect(ids).not.toContain('b')
  })

  it('13.6인치 Air 는 13, 14.2인치 Pro 는 14 로 분류된다', () => {
    // Math.round 를 쓰면 13.6 → 14 가 되어 Air 가 Pro 14 필터에 딸려 나온다.
    expect(filterRows(rows, { ...EMPTY_FILTERS, sizes: [14] }).map((r) => r.id)).toEqual(['d'])
    expect(filterRows(rows, { ...EMPTY_FILTERS, sizes: [13] }).map((r) => r.id).sort()).toEqual(['a', 'c'])
  })

  it('가격 범위와 판매 상태로 거른다', () => {
    expect(filterRows(rows, { ...EMPTY_FILTERS, maxKrw: 1000000 }).map((r) => r.id)).toEqual(['b'])
    expect(filterRows(rows, { ...EMPTY_FILTERS, minKrw: 1500000 }).map((r) => r.id).sort()).toEqual(['a', 'd'])
    expect(filterRows(rows, { ...EMPTY_FILTERS, status: 'discontinued' }).map((r) => r.id)).toEqual(['c'])
  })

  it('메모리·저장장치의 최소·최대 범위를 함께 적용한다', () => {
    const expanded = [...rows, row({ id: 'e', memoryGb: 24, storageGb: 512 })]
    const filtered = filterRows(expanded, {
      ...EMPTY_FILTERS,
      minMemoryGb: 16,
      maxMemoryGb: 16,
      minStorageGb: 256,
      maxStorageGb: 512,
    })
    expect(filtered.map((r) => r.id).sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('sortRows', () => {
  it('구성 불가능한 행은 정렬 방향과 무관하게 뒤로 간다', () => {
    const rows = [
      row({
        id: 'bad',
        priceKrw: 1,
        normalized: { feasible: false, krw: null, baseKrw: 0, baseEstimated: false, upgradeKrw: 0, note: '' },
      }),
      row({ id: 'ok', priceKrw: 999 }),
    ]
    expect(sortRows(rows, { key: 'price', dir: 'asc' }).map((r) => r.id)).toEqual(['ok', 'bad'])
    expect(sortRows(rows, { key: 'price', dir: 'desc' }).map((r) => r.id)).toEqual(['ok', 'bad'])
  })
})

describe('URL 직렬화', () => {
  it('왕복하면 같은 상태가 나온다', () => {
    const filters = {
      ...EMPTY_FILTERS,
      q: 'pro',
      families: ['macbook-pro' as const],
      generations: [3, 4],
      tiers: ['max' as const],
      maxMemoryGb: 64,
      maxStorageGb: 2048,
      maxKrw: 5000000,
      status: 'current' as const,
    }
    const sort = { key: 'gpu' as const, dir: 'desc' as const }
    const normalize = { on: true, memoryGb: 32, storageGb: 1024 }
    const q = toQuery(filters, sort, normalize, ['x', 'y'])
    const back = fromQuery(q)
    expect(back.filters).toEqual(filters)
    expect(back.sort).toEqual(sort)
    expect(back.normalize).toEqual(normalize)
    expect(back.selected).toEqual(['x', 'y'])
  })

  it('기본 상태는 빈 쿼리로 직렬화된다', () => {
    const q = toQuery(EMPTY_FILTERS, DEFAULT_SORT, { on: false, memoryGb: 16, storageGb: 512 }, [])
    expect(q).toBe('')
  })

  it('잘못된 sort 키는 기본값으로 떨어진다', () => {
    expect(fromQuery('sort=nonsense').sort.key).toBe(DEFAULT_SORT.key)
  })

  it('norm 이 없으면 동일 조건 기본값을 그대로 쓴다', () => {
    // Number('') === 0 이고 0 은 유한수라, 순진하게 isFinite 로만 거르면
    // 메모리가 0GB 로 들어간다.
    const n = fromQuery('').normalize
    expect(n).toEqual({ on: false, memoryGb: 16, storageGb: 512 })
  })

  it('망가진 norm 값은 무시하고 기본값으로 떨어진다', () => {
    for (const q of ['norm=', 'norm=16', 'norm=abc-def', 'norm=0-512', 'norm=16-512-1']) {
      const n = fromQuery(q).normalize
      expect(n, q).toEqual({ on: false, memoryGb: 16, storageGb: 512 })
    }
  })

  it('정상 norm 값은 그대로 읽는다', () => {
    expect(fromQuery('norm=32-1024').normalize).toEqual({
      on: true,
      memoryGb: 32,
      storageGb: 1024,
    })
  })
})
