import type { Family, Row, Tier } from './types'

export interface FilterState {
  q: string
  families: Family[]
  generations: number[]
  tiers: Tier[]
  sizes: number[]
  minMemoryGb: number | null
  minStorageGb: number | null
  minKrw: number | null
  maxKrw: number | null
  status: 'all' | 'current' | 'discontinued'
}

export const EMPTY_FILTERS: FilterState = {
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
}

export type SortKey =
  | 'price'
  | 'released'
  | 'cpu'
  | 'gpu'
  | 'memory'
  | 'storage'
  | 'name'

export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

export const DEFAULT_SORT: SortState = { key: 'price', dir: 'asc' }

function matchesQuery(row: Row, q: string): boolean {
  if (!q) return true
  const haystack = [
    row.displayName,
    row.chip.family,
    row.variantLabel ?? '',
    `${row.memoryGb}GB`,
    row.storageGb >= 1024 ? `${row.storageGb / 1024}TB` : `${row.storageGb}GB`,
  ]
    .join(' ')
    .toLowerCase()
  // 공백으로 나눈 토큰이 전부 들어있어야 한다 ("air m4" → 두 토큰 모두 매치)
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => haystack.includes(t))
}

export function filterRows(rows: Row[], f: FilterState): Row[] {
  return rows.filter((row) => {
    if (!matchesQuery(row, f.q)) return false
    if (f.families.length && !f.families.includes(row.family)) return false
    if (f.generations.length && !f.generations.includes(row.chip.generation))
      return false
    if (f.tiers.length && !f.tiers.includes(row.chip.tier)) return false
    if (f.sizes.length) {
      // 화면 없는 데스크탑은 크기 필터가 걸리면 제외된다.
      if (row.displaySizeInch === null) return false
      // floor 로 잘라야 Apple 마케팅 명칭과 맞는다: 13.6"→13, 14.2"→14,
      // 15.3"→15, 16.2"→16. round 를 쓰면 Air 13 이 Pro 14 와 겹친다.
      if (!f.sizes.includes(Math.floor(row.displaySizeInch))) return false
    }
    if (f.minMemoryGb !== null && row.memoryGb < f.minMemoryGb) return false
    if (f.minStorageGb !== null && row.storageGb < f.minStorageGb) return false
    if (f.minKrw !== null && row.priceKrw < f.minKrw) return false
    if (f.maxKrw !== null && row.priceKrw > f.maxKrw) return false
    if (f.status === 'current' && !row.isCurrent) return false
    if (f.status === 'discontinued' && row.isCurrent) return false
    // 동일 조건 비교에서 구성이 불가능한 행은 남기되 맨 뒤로 보낸다 (sortRows).
    return true
  })
}

function sortValue(row: Row, key: SortKey): number | string {
  switch (key) {
    case 'price':
      return row.priceKrw
    case 'released':
      return row.releasedAt
    case 'cpu':
      return row.chip.cpuCores
    case 'gpu':
      return row.chip.gpuCores
    case 'memory':
      return row.memoryGb
    case 'storage':
      return row.storageGb
    case 'name':
      return row.displayName
  }
}

export function sortRows(rows: Row[], sort: SortState): Row[] {
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    // 구성 불가능한 행은 정렬 기준과 무관하게 항상 뒤로.
    const aBad = a.normalized?.feasible === false
    const bBad = b.normalized?.feasible === false
    if (aBad !== bBad) return aBad ? 1 : -1

    const av = sortValue(a, sort.key)
    const bv = sortValue(b, sort.key)
    if (av === bv) return a.displayName.localeCompare(b.displayName, 'ko')
    return (av > bv ? 1 : -1) * sign
  })
}

/** 필터가 하나라도 걸려 있는가 — "초기화" 버튼 노출 판단용. */
export function isFiltered(f: FilterState): boolean {
  return (
    f.q !== '' ||
    f.families.length > 0 ||
    f.generations.length > 0 ||
    f.tiers.length > 0 ||
    f.sizes.length > 0 ||
    f.minMemoryGb !== null ||
    f.minStorageGb !== null ||
    f.minKrw !== null ||
    f.maxKrw !== null ||
    f.status !== 'all'
  )
}

/** 필터 상태를 URL 쿼리로 직렬화한다. 기본값은 생략해 링크를 짧게 유지. */
export function toQuery(
  f: FilterState,
  sort: SortState,
  normalize: { on: boolean; memoryGb: number; storageGb: number },
  selected: string[],
): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.families.length) p.set('family', f.families.join(','))
  if (f.generations.length) p.set('gen', f.generations.join(','))
  if (f.tiers.length) p.set('tier', f.tiers.join(','))
  if (f.sizes.length) p.set('size', f.sizes.join(','))
  if (f.minMemoryGb !== null) p.set('mem', String(f.minMemoryGb))
  if (f.minStorageGb !== null) p.set('sto', String(f.minStorageGb))
  if (f.minKrw !== null) p.set('min', String(f.minKrw))
  if (f.maxKrw !== null) p.set('max', String(f.maxKrw))
  if (f.status !== 'all') p.set('status', f.status)
  if (sort.key !== DEFAULT_SORT.key) p.set('sort', sort.key)
  if (sort.dir !== DEFAULT_SORT.dir) p.set('dir', sort.dir)
  if (normalize.on) p.set('norm', `${normalize.memoryGb}-${normalize.storageGb}`)
  if (selected.length) p.set('pick', selected.join(','))
  return p.toString()
}

export interface ParsedQuery {
  filters: FilterState
  sort: SortState
  normalize: { on: boolean; memoryGb: number; storageGb: number }
  selected: string[]
}

const SORT_KEYS: SortKey[] = [
  'price',
  'released',
  'cpu',
  'gpu',
  'memory',
  'storage',
  'name',
]

export function fromQuery(
  search: string,
  fallbackNormalize = { memoryGb: 16, storageGb: 512 },
): ParsedQuery {
  const p = new URLSearchParams(search)
  const nums = (k: string) =>
    (p.get(k) ?? '')
      .split(',')
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
  const strs = (k: string) =>
    (p.get(k) ?? '').split(',').filter(Boolean)
  const num = (k: string) => {
    const v = Number(p.get(k))
    return p.has(k) && Number.isFinite(v) ? v : null
  }

  const sortKey = p.get('sort') as SortKey | null
  const status = p.get('status')
  const norm = p.get('norm')
  const [nm, ns] = (norm ?? '').split('-').map(Number)

  return {
    filters: {
      q: p.get('q') ?? '',
      families: strs('family') as Family[],
      generations: nums('gen'),
      tiers: strs('tier') as Tier[],
      sizes: nums('size'),
      minMemoryGb: num('mem'),
      minStorageGb: num('sto'),
      minKrw: num('min'),
      maxKrw: num('max'),
      status:
        status === 'current' || status === 'discontinued' ? status : 'all',
    },
    sort: {
      key: sortKey && SORT_KEYS.includes(sortKey) ? sortKey : DEFAULT_SORT.key,
      dir: p.get('dir') === 'desc' ? 'desc' : 'asc',
    },
    normalize: {
      on: Boolean(norm) && Number.isFinite(nm) && Number.isFinite(ns),
      memoryGb: Number.isFinite(nm) ? nm : fallbackNormalize.memoryGb,
      storageGb: Number.isFinite(ns) ? ns : fallbackNormalize.storageGb,
    },
    selected: strs('pick'),
  }
}
