import { describe, expect, it } from 'vitest'
import { normalizeModel, priceAt } from '../price'
import type { Chip, Model } from '../types'

const chip: Chip = {
  id: 'm4-10c-10g',
  family: 'M4',
  generation: 4,
  tier: 'base',
  cpuCores: 10,
  gpuCores: 10,
  maxMemoryGb: 32,
  releasedAt: '2024-11-08',
}

const model: Model = {
  id: 'mac-mini-m4-2024',
  family: 'mac-mini',
  displayName: 'Mac mini (M4, 2024)',
  releasedAt: '2024-11-08',
  discontinuedAt: null,
  display: null,
  configs: [
    {
      chipId: 'm4-10c-10g',
      memoryGb: 16,
      storageGb: 256,
      isBaseConfig: true,
      prices: [{ krw: 890000, effectiveFrom: '2024-11-08', source: 'apple-kr' }],
    },
    {
      chipId: 'm4-10c-10g',
      memoryGb: 16,
      storageGb: 512,
      isBaseConfig: false,
      prices: [{ krw: 1190000, effectiveFrom: '2024-11-08', source: 'apple-kr' }],
    },
  ],
  upgrades: [
    { kind: 'memory', fromValue: 16, toValue: 24, krw: 300000 },
    { kind: 'storage', fromValue: 256, toValue: 512, krw: 250000 },
    { kind: 'storage', fromValue: 256, toValue: 1024, krw: 550000 },
    { kind: 'storage', fromValue: 512, toValue: 1024, krw: 300000 },
  ],
  checkedAt: '2026-08-29',
  verified: false,
}

describe('priceAt', () => {
  const prices = [
    { krw: 2690000, effectiveFrom: '2024-11-08', source: 'apple-kr' },
    { krw: 3290000, effectiveFrom: '2026-06-25', source: 'apple-kr' },
  ]

  it('인상 전 시점에는 옛 가격을 쓴다', () => {
    expect(priceAt(prices, '2026-01-01').krw).toBe(2690000)
  })

  it('인상일 당일부터 새 가격을 쓴다', () => {
    expect(priceAt(prices, '2026-06-25').krw).toBe(3290000)
  })

  it('첫 스냅샷보다 이른 날짜면 첫 스냅샷으로 떨어진다', () => {
    expect(priceAt(prices, '2020-01-01').krw).toBe(2690000)
  })
})

describe('normalizeModel', () => {
  const asOf = '2026-08-29'

  it('여러 기본 구성 중 목표까지 가장 싼 경로를 고른다', () => {
    // 256GB 에서 1TB: 890,000 + 550,000 = 1,440,000
    // 512GB 에서 1TB: 1,190,000 + 300,000 = 1,490,000  ← 더 비싸다
    const r = normalizeModel(model, chip, { memoryGb: 16, storageGb: 1024 }, asOf)
    expect(r.feasible).toBe(true)
    expect(r.krw).toBe(1440000)
    expect(r.baseKrw).toBe(890000)
  })

  it('기본 구성과 목표가 같으면 업그레이드 비용이 0이다', () => {
    const r = normalizeModel(model, chip, { memoryGb: 16, storageGb: 256 }, asOf)
    expect(r.krw).toBe(890000)
    expect(r.upgradeKrw).toBe(0)
  })

  it('메모리와 저장장치를 함께 올린다', () => {
    const r = normalizeModel(model, chip, { memoryGb: 24, storageGb: 512 }, asOf)
    // 890,000 + 300,000(메모리) + 250,000(저장) = 1,440,000
    expect(r.krw).toBe(1440000)
    expect(r.upgradeKrw).toBe(550000)
  })

  it('칩 메모리 상한을 넘으면 불가능으로 표시한다', () => {
    const r = normalizeModel(model, chip, { memoryGb: 64, storageGb: 512 }, asOf)
    expect(r.feasible).toBe(false)
    expect(r.krw).toBeNull()
    expect(r.note).toContain('32GB')
  })

  it('업그레이드 경로가 없으면 불가능으로 표시한다', () => {
    // 20GB 는 상한 이내지만 업그레이드 항목이 없다
    const r = normalizeModel(model, chip, { memoryGb: 20, storageGb: 256 }, asOf)
    expect(r.feasible).toBe(false)
  })

  it('목표가 기본 구성보다 낮아도 다운그레이드로 계산하지 않는다', () => {
    const r = normalizeModel(model, chip, { memoryGb: 8, storageGb: 256 }, asOf)
    expect(r.feasible).toBe(false)
  })
})
