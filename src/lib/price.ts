import type { Chip, Model, NormalizeResult, PriceSnapshot, Row } from './types'
import { LAPTOP_FAMILIES } from './schema'

/**
 * asOf 시점에 유효한 정가를 고른다.
 * prices 는 effectiveFrom 오름차순이라고 가정한다 (validate 스크립트가 강제).
 * asOf 이전 스냅샷이 하나도 없으면 (미래 출시 모델) 첫 스냅샷을 쓴다.
 */
export function priceAt(
  prices: PriceSnapshot[],
  asOf: string,
): PriceSnapshot {
  let picked = prices[0]
  for (const p of prices) {
    if (p.effectiveFrom <= asOf) picked = p
    else break
  }
  return picked
}

export function buildRows(
  models: Model[],
  chips: Chip[],
  asOf: string,
): Row[] {
  const chipById = new Map(chips.map((c) => [c.id, c]))
  const rows: Row[] = []

  for (const model of models) {
    for (const [i, config] of model.configs.entries()) {
      const chip = chipById.get(config.chipId)
      if (!chip) {
        throw new Error(
          `${model.id}: 알 수 없는 chipId "${config.chipId}"`,
        )
      }
      const price = priceAt(config.prices, asOf)
      rows.push({
        id: `${model.id}--${config.chipId}--${config.memoryGb}-${config.storageGb}-${i}`,
        modelId: model.id,
        family: model.family,
        displayName: model.displayName,
        chip,
        memoryGb: config.memoryGb,
        storageGb: config.storageGb,
        isBaseConfig: config.isBaseConfig,
        variantLabel: config.variantLabel,
        priceKrw: price.krw,
        priceEffectiveFrom: price.effectiveFrom,
        priceHistory: config.prices,
        educationKrw: config.educationKrw,
        releasedAt: model.releasedAt,
        discontinuedAt: model.discontinuedAt,
        isCurrent: model.discontinuedAt === null,
        displaySizeInch: model.display?.sizeInch ?? null,
        displayResolution: model.display?.resolution,
        proMotion: model.display?.proMotion,
        ports: model.ports,
        weightKg: model.weightKg,
        verified: model.verified,
        checkedAt: model.checkedAt,
        sourceUrl: model.sourceUrl,
      })
    }
  }
  return rows
}

/** 한 축(메모리 또는 저장장치)을 from → to 로 올리는 비용. 불가능하면 null. */
function upgradeCost(
  model: Model,
  kind: 'memory' | 'storage',
  chipId: string,
  from: number,
  to: number,
): number | null {
  if (from === to) return 0
  if (to < from) return null // Apple 은 다운그레이드를 팔지 않는다
  const match = model.upgrades.find(
    (u) =>
      u.kind === kind &&
      u.fromValue === from &&
      u.toValue === to &&
      (u.chipId === undefined || u.chipId === chipId),
  )
  return match ? match.krw : null
}

export interface NormalizeTarget {
  memoryGb: number
  storageGb: number
}

/**
 * 모델의 각 구성에서 목표 사양까지 올리는 비용을 계산하고, 가장 싼 경로를 고른다.
 * "모든 Mac 을 16GB/512GB 로 맞추면 각각 얼마인가" 를 답하기 위한 핵심 함수.
 */
export function normalizeModel(
  model: Model,
  chip: Chip,
  target: NormalizeTarget,
  asOf: string,
  variantLabel?: string,
): NormalizeResult {
  if (target.memoryGb > chip.maxMemoryGb) {
    return {
      feasible: false,
      krw: null,
      baseKrw: 0,
      upgradeKrw: 0,
      note: `${chip.family} 는 최대 ${chip.maxMemoryGb}GB 까지만 지원합니다`,
    }
  }

  let best: NormalizeResult | null = null
  let sawConfig = false

  for (const config of model.configs) {
    if (config.chipId !== chip.id) continue
    if (variantLabel !== undefined && config.variantLabel !== variantLabel) continue
    sawConfig = true

    const mem = upgradeCost(
      model,
      'memory',
      chip.id,
      config.memoryGb,
      target.memoryGb,
    )
    const sto = upgradeCost(
      model,
      'storage',
      chip.id,
      config.storageGb,
      target.storageGb,
    )
    if (mem === null || sto === null) continue

    const baseKrw = priceAt(config.prices, asOf).krw
    const upgradeKrw = mem + sto
    const total = baseKrw + upgradeKrw
    if (best === null || total < best.krw!) {
      const parts: string[] = []
      if (mem > 0) parts.push(`메모리 ${config.memoryGb}→${target.memoryGb}GB`)
      if (sto > 0)
        parts.push(`저장장치 ${config.storageGb}→${target.storageGb}GB`)
      best = {
        feasible: true,
        krw: total,
        baseKrw,
        upgradeKrw,
        note: parts.length ? `${parts.join(', ')} 업그레이드 포함` : '기본 구성 그대로',
      }
    }
  }

  if (best) return best
  return {
    feasible: false,
    krw: null,
    baseKrw: 0,
    upgradeKrw: 0,
    note: sawConfig
      ? '해당 사양으로 구성할 수 없습니다 (업그레이드 옵션 없음)'
      : '해당 사양 구성이 없습니다',
  }
}

/**
 * 동일 조건 비교 모드의 행 목록.
 * 같은 모델·같은 칩의 여러 구성은 한 행으로 합쳐진다 — 어느 기본 구성에서
 * 출발하든 목표 사양에 도달한 결과는 하나뿐이기 때문이다.
 */
export function normalizeRows(
  rows: Row[],
  models: Model[],
  target: NormalizeTarget,
  asOf: string,
): Row[] {
  const modelById = new Map(models.map((m) => [m.id, m]))
  const seen = new Map<string, Row>()

  for (const row of rows) {
    // variantLabel 이 다르면 별개 제품이므로 합치지 않는다 (Mac Pro 타워/랙).
    const key = `${row.modelId}--${row.chip.id}--${row.variantLabel ?? ''}`
    if (seen.has(key)) continue
    const model = modelById.get(row.modelId)
    if (!model) continue

    const normalized = normalizeModel(
      model,
      row.chip,
      target,
      asOf,
      row.variantLabel,
    )
    seen.set(key, {
      ...row,
      id: key,
      memoryGb: target.memoryGb,
      storageGb: target.storageGb,
      priceKrw: normalized.krw ?? row.priceKrw,
      normalized,
    })
  }
  return [...seen.values()]
}

export function formatKrw(krw: number): string {
  return `₩${krw.toLocaleString('ko-KR')}`
}

/** 300만원 → "300만", 259만원 → "259만" */
export function formatKrwShort(krw: number): string {
  const man = krw / 10_000
  return Number.isInteger(man) ? `${man.toLocaleString('ko-KR')}만` : `${man.toFixed(1)}만`
}

export function formatStorage(gb: number): string {
  return gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`
}

export function isLaptop(family: Row['family']): boolean {
  return LAPTOP_FAMILIES.includes(family)
}
