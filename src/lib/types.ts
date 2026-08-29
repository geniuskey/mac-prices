import type {
  Chip,
  Family,
  PriceSnapshot,
  Tier,
  modelSchema,
} from './schema'
import type { z } from 'zod'

export type Model = z.infer<typeof modelSchema>
export type { Chip, Family, PriceSnapshot, Tier }

/** 표의 한 행 = 구매 가능한 구성 하나. */
export interface Row {
  id: string
  modelId: string
  family: Family
  displayName: string
  chip: Chip
  memoryGb: number
  storageGb: number
  isBaseConfig: boolean
  variantLabel?: string
  priceKrw: number
  priceEffectiveFrom: string
  /** 현재 적용 중인 금액이 확인값이 아니라 추정치인가 */
  priceEstimated: boolean
  priceHistory: PriceSnapshot[]
  educationKrw?: number
  releasedAt: string
  discontinuedAt: string | null
  isCurrent: boolean
  displaySizeInch: number | null
  displayResolution?: string
  proMotion?: boolean
  ports?: Model['ports']
  weightKg?: number
  verified: boolean
  verifiedSource?: 'apple-kr' | 'press' | 'retail'
  upgradesVerified: boolean
  /** 아직 출시되지 않은 모델 (발표만 된 상태) */
  upcoming: boolean
  checkedAt: string
  sourceUrl?: string
  /** 동일 조건 비교가 켜졌을 때만 채워진다. */
  normalized?: NormalizeResult
}

export interface NormalizeResult {
  feasible: boolean
  /** 목표 사양까지 맞췄을 때의 총액. feasible 이 false 면 null. */
  krw: number | null
  /** 기준이 된 기본 구성의 가격 */
  baseKrw: number
  /** 기준으로 삼은 기본 구성의 가격이 추정치인가 */
  baseEstimated: boolean
  upgradeKrw: number
  /** 사용자에게 보여줄 사유 (불가능하거나 업그레이드가 필요할 때) */
  note: string
}

export interface Dataset {
  models: Model[]
  chips: Chip[]
  rows: Row[]
  /** 데이터 전체에서 가장 오래된 checkedAt — 사이트 기준일 표시에 쓴다. */
  oldestCheckedAt: string
  verifiedCount: number
  upgradesVerifiedCount: number
}
