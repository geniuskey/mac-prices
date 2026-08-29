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
  /** 이 파일의 가격을 마지막으로 사람이 대조한 날 */
  checkedAt: isoDate,
  /** apple.com/kr 과 대조를 마쳤는가 */
  verified: z.boolean().default(false),
  notes: z.string().optional(),
})
export type ModelInput = z.infer<typeof modelSchema>
