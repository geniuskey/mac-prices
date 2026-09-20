import { z } from 'zod'

export const FAMILIES = [
  'macbook-air',
  'macbook-pro',
  'mac-mini',
  'mac-studio',
  'imac',
  'mac-pro',
] as const
export type Family = (typeof FAMILIES)[number]

export const FAMILY_LABEL: Record<Family, string> = {
  'macbook-air': 'MacBook Air',
  'macbook-pro': 'MacBook Pro',
  'mac-mini': 'Mac mini',
  'mac-studio': 'Mac Studio',
  imac: 'iMac',
  'mac-pro': 'Mac Pro',
}

export const LAPTOP_FAMILIES: Family[] = ['macbook-air', 'macbook-pro']

export const TIERS = ['base', 'pro', 'max', 'ultra'] as const
export type Tier = (typeof TIERS)[number]

export const TIER_LABEL: Record<Tier, string> = {
  base: '기본',
  pro: 'Pro',
  max: 'Max',
  ultra: 'Ultra',
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다')

/** 원 단위 정가. 소수점 없는 양의 정수. */
const krw = z.number().int().positive().max(30_000_000)

export const chipSchema = z.object({
  id: z.string().min(1),
  family: z.string().min(1),
  /** M1 = 1 … M6 = 6 */
  generation: z.number().int().min(1).max(9),
  tier: z.enum(TIERS),
  cpuCores: z.number().int().positive(),
  cpuPerformanceCores: z.number().int().positive().optional(),
  cpuEfficiencyCores: z.number().int().nonnegative().optional(),
  gpuCores: z.number().int().positive(),
  neuralCores: z.number().int().positive().optional(),
  memoryBandwidthGBps: z.number().positive().optional(),
  maxMemoryGb: z.number().int().positive(),
  releasedAt: isoDate,
})
export type Chip = z.infer<typeof chipSchema>

/** 한 시점의 정가. 배열로 쌓아 가격 변동 이력을 표현한다. */
export const priceSnapshotSchema = z.object({
  krw,
  effectiveFrom: isoDate,
  source: z.string().default('apple-kr'),
  note: z.string().optional(),
  /**
   * 이 금액이 확인된 값이 아니라 추정치인가.
   *
   * 2026-06-25 애플이 맥 전 라인 가격을 올렸는데, 보도는 각 제품군의 최저가
   * 구성만 다룬다. 파생 구성까지 같은 인상 폭을 적용해 채우지 않으면 상위
   * 구성이 기본 구성보다 싸 보이는 엉터리 표가 된다. 그렇다고 확인된 값과
   * 섞어버리면 안 되므로 따로 표시한다.
   */
  estimated: z.boolean().optional(),
})
export type PriceSnapshot = z.infer<typeof priceSnapshotSchema>

/** Apple 이 실제로 파는 기본 구성 하나. */
export const configSchema = z.object({
  chipId: z.string().min(1),
  memoryGb: z.number().int().positive(),
  storageGb: z.number().int().positive(),
  isBaseConfig: z.boolean().default(false),
  prices: z.array(priceSnapshotSchema).min(1),
  educationKrw: krw.optional(),
  /** 같은 모델 안에서 구성을 구분하는 꼬리표 (예: "10코어 GPU") */
  variantLabel: z.string().optional(),
})
export type ConfigInput = z.infer<typeof configSchema>

/** BTO 업그레이드 단가. 동일 조건 비교의 근거가 된다. */
export const upgradeSchema = z.object({
  kind: z.enum(['memory', 'storage']),
  fromValue: z.number().int().positive(),
  toValue: z.number().int().positive(),
  krw,
  /** 특정 칩에서만 가능한 업그레이드일 때 지정 */
  chipId: z.string().optional(),
})
export type Upgrade = z.infer<typeof upgradeSchema>

export const portsSchema = z.object({
  thunderbolt: z.number().int().nonnegative().optional(),
  thunderboltVersion: z.number().int().optional(),
  usbA: z.number().int().nonnegative().optional(),
  hdmi: z.number().int().nonnegative().optional(),
  sdCard: z.boolean().optional(),
  ethernet: z.boolean().optional(),
  magsafe: z.boolean().optional(),
  headphone: z.boolean().optional(),
})

export const displaySchema = z.object({
  sizeInch: z.number().positive(),
  resolution: z.string().optional(),
  nits: z.number().int().positive().optional(),
  proMotion: z.boolean().optional(),
  nanoTextureAvailable: z.boolean().optional(),
})

export const modelSchema = z.object({
  id: z.string().min(1),
  family: z.enum(FAMILIES),
  displayName: z.string().min(1),
  releasedAt: isoDate,
  /** null 이면 현행 판매 */
  discontinuedAt: isoDate.nullable().default(null),
  display: displaySchema.nullable().default(null),
  ports: portsSchema.optional(),
  weightKg: z.number().positive().optional(),
  configs: z.array(configSchema).min(1),
  upgrades: z.array(upgradeSchema).default([]),
  sourceUrl: z.string().url().optional(),
  /** 이 파일의 가격을 마지막으로 대조한 날 */
  checkedAt: isoDate,
  /** 기본 구성 정가가 출처와 대조되었는가 */
  verified: z.boolean().default(false),
  /**
   * 무엇과 대조했는가. 'apple-kr' 이 가장 강하고, 언론 보도·유통 시세는
   * 그보다 약하다. 어느 수준의 근거인지 화면에 그대로 드러낸다.
   */
  verifiedSource: z
    .enum(['apple-kr', 'press', 'retail'])
    .optional(),
  /**
   * BTO 업그레이드 단가는 별도로 추적한다. 기본 정가와 달리 보도 자료에
   * 거의 나오지 않고, 2026-06 애플이 메모리 업그레이드 가격을 두 배로
   * 올린 것처럼 따로 움직인다.
   */
  upgradesVerified: z.boolean().default(false),
  /** 가격 구성을 확인한 판매 페이지 */
  priceSourceUrl: z.string().url().optional(),
  notes: z.string().optional(),
})
export type ModelInput = z.infer<typeof modelSchema>

/** 제품 또는 칩 사양에 연결된 외부 벤치마크 참고값. */
export const benchmarkSchema = z
  .object({
    id: z.string().min(1),
    chipId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
    /** 측정 장비의 메모리·저장장치. 점수의 맥락을 보여주는 선택값이다. */
    memoryGb: z.number().int().positive().optional(),
    storageGb: z.number().int().positive().optional(),
    variantLabel: z.string().optional(),
    suite: z.string().min(1),
    version: z.string().min(1).optional(),
    singleCore: z.number().int().positive().optional(),
    multiCore: z.number().int().positive().optional(),
    gpuMetal: z.number().int().positive().optional(),
    /** 벽면에서 측정한 유휴·최대 소비전력(W). 측정 조건은 note에 적는다. */
    powerIdleW: z.number().positive().optional(),
    powerMaxW: z.number().positive().optional(),
    measuredAt: isoDate,
    sourceUrl: z.string().url(),
    device: z.string().min(1),
    note: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.chipId && !value.modelId) {
      ctx.addIssue({
        code: 'custom',
        message: 'chipId 또는 modelId 중 하나는 있어야 합니다',
        path: ['chipId'],
      })
    }
    if (
      value.singleCore === undefined &&
      value.multiCore === undefined &&
      value.gpuMetal === undefined &&
      value.powerIdleW === undefined &&
      value.powerMaxW === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '벤치마크 점수가 하나 이상 있어야 합니다',
        path: ['suite'],
      })
    }
  })
export type Benchmark = z.infer<typeof benchmarkSchema>
