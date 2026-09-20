import { describe, expect, it } from 'vitest'
import { loadDataset, loadRaw } from '../data'
import { buildRows, normalizeModel, priceAt } from '../price'
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
  upgradesVerified: false,
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

describe('옵션별 row 확장', () => {
  it('메모리·저장장치 옵션의 모든 조합을 row로 펼친다', () => {
    const rows = buildRows([model], [chip], '2026-08-29')

    // 16/24GB × 256/512/1024GB. 명시된 16/512 구성은 그 가격을 보존한다.
    expect(rows).toHaveLength(6)
    expect(rows.map((r) => `${r.memoryGb}/${r.storageGb}`).sort()).toEqual([
      '16/1024',
      '16/256',
      '16/512',
      '24/1024',
      '24/256',
      '24/512',
    ])
    expect(
      rows.find((r) => r.memoryGb === 16 && r.storageGb === 512)?.priceKrw,
    ).toBe(1190000)
    expect(
      rows.find((r) => r.memoryGb === 24 && r.storageGb === 1024)?.priceKrw,
    ).toBe(1740000)
  })

  it('2025년 Mac Studio는 Max와 Ultra를 합쳐 28개 옵션 row를 만든다', () => {
    const { chips, models, errors } = loadRaw()
    expect(errors).toEqual([])
    const rows = buildRows(models, chips, '2026-09-20').filter(
      (row) =>
        row.modelId === 'mac-studio-m4-max-2025' ||
        row.modelId === 'mac-studio-m3-ultra-2025',
    )

    expect(rows).toHaveLength(28)
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)
  })

  it('Mac Studio M5 Max는 GPU 바인딩과 모든 메모리·저장 조합을 row로 만든다', () => {
    const dataset = loadDataset('2026-09-20')
    const rows = dataset.rows.filter((row) => row.modelId === 'mac-studio-m5-max-2026')

    expect(rows).toHaveLength(20)
    expect(rows.filter((row) => row.chip.id === 'm5-max-18c-32g')).toHaveLength(5)
    expect(rows.filter((row) => row.chip.id === 'm5-max-18c-40g')).toHaveLength(15)
    expect(
      rows.find(
        (row) =>
          row.chip.id === 'm5-max-18c-40g' &&
          row.memoryGb === 128 &&
          row.storageGb === 8192,
      )?.priceKrw,
    ).toBe(15170000)

    const baseBenchmark = rows.find((row) => row.chip.id === 'm5-max-18c-32g')?.benchmarks
    expect(baseBenchmark?.some((benchmark) => benchmark.gpuMetal === 189086)).toBe(true)
    expect(
      rows
        .find((row) => row.chip.id === 'm5-max-18c-40g')
        ?.benchmarks?.some((benchmark) => benchmark.multiCore === 30105),
    ).toBe(true)
  })
})

describe('추정 가격 전파', () => {
  const raised: Model = {
    ...model,
    configs: [
      {
        ...model.configs[0],
        prices: [
          { krw: 890000, effectiveFrom: '2024-11-08', source: 'apple-kr' },
          {
            krw: 1349000,
            effectiveFrom: '2026-06-25',
            source: 'apple-kr',
            estimated: true,
          },
        ],
      },
    ],
  }

  it('인상 전 시점에는 확인된 값이 쓰이고 추정 표시가 붙지 않는다', () => {
    const p = priceAt(raised.configs[0].prices, '2026-01-01')
    expect(p.krw).toBe(890000)
    expect(p.estimated).toBeUndefined()
  })

  it('인상 후에는 추정 표시가 남는다', () => {
    const p = priceAt(raised.configs[0].prices, '2026-08-29')
    expect(p.krw).toBe(1349000)
    expect(p.estimated).toBe(true)
  })

  it('동일 조건 비교 결과가 기준 구성의 추정 여부를 물려받는다', () => {
    const r = normalizeModel(
      raised,
      chip,
      { memoryGb: 16, storageGb: 256 },
      '2026-08-29',
    )
    expect(r.krw).toBe(1349000)
    expect(r.baseEstimated).toBe(true)
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
