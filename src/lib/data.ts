import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { benchmarkSchema, chipSchema, modelSchema } from './schema'
import type { Benchmark, Chip, Dataset, Model } from './types'
import { buildRows } from './price'

const DATA_DIR = path.join(process.cwd(), 'data')

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function listModelFiles(): string[] {
  const root = path.join(DATA_DIR, 'models')
  if (!fs.existsSync(root)) return []
  const out: string[] = []
  for (const family of fs.readdirSync(root)) {
    const dir = path.join(root, family)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json')) out.push(path.join(dir, f))
    }
  }
  return out.sort()
}

export interface LoadResult {
  chips: Chip[]
  models: Model[]
  benchmarks: Benchmark[]
  errors: string[]
}

/** 파싱 + 스키마 검증 + 참조 무결성 검사. 오류는 모아서 반환한다. */
export function loadRaw(): LoadResult {
  const errors: string[] = []

  let chips: Chip[] = []
  let benchmarks: Benchmark[] = []
  const chipFile = path.join(DATA_DIR, 'chips.json')
  if (!fs.existsSync(chipFile)) {
    errors.push('data/chips.json 이 없습니다')
  } else {
    const parsed = z.array(chipSchema).safeParse(readJson(chipFile))
    if (!parsed.success) {
      errors.push(`chips.json: ${z.prettifyError(parsed.error)}`)
    } else {
      chips = parsed.data
    }
  }

  const benchmarkFile = path.join(DATA_DIR, 'benchmarks.json')
  if (fs.existsSync(benchmarkFile)) {
    const parsed = z.array(benchmarkSchema).safeParse(readJson(benchmarkFile))
    if (!parsed.success) {
      errors.push(`benchmarks.json: ${z.prettifyError(parsed.error)}`)
    } else {
      benchmarks = parsed.data
    }
  }

  const chipIds = new Set(chips.map((c) => c.id))
  const dupChips = chips
    .map((c) => c.id)
    .filter((id, i, a) => a.indexOf(id) !== i)
  for (const id of new Set(dupChips)) errors.push(`chips.json: 중복 id "${id}"`)

  const models: Model[] = []
  const modelIds = new Set<string>()

  for (const file of listModelFiles()) {
    const rel = path.relative(process.cwd(), file)
    const parsed = modelSchema.safeParse(readJson(file))
    if (!parsed.success) {
      errors.push(`${rel}: ${z.prettifyError(parsed.error)}`)
      continue
    }
    const model = parsed.data

    // 파일 경로의 제품군과 데이터의 family 가 어긋나면 조용히 잘못 분류된다.
    const dirFamily = path.basename(path.dirname(file))
    if (dirFamily !== model.family) {
      errors.push(
        `${rel}: family "${model.family}" 인데 ${dirFamily}/ 아래에 있습니다`,
      )
    }
    if (modelIds.has(model.id)) errors.push(`${rel}: 중복 모델 id "${model.id}"`)
    modelIds.add(model.id)

    const baseCount = model.configs.filter((c) => c.isBaseConfig).length
    if (baseCount !== 1) {
      errors.push(
        `${rel}: isBaseConfig 가 정확히 하나여야 합니다 (현재 ${baseCount}개)`,
      )
    }

    const chipById = new Map(chips.map((c) => [c.id, c]))
    const modelTiers = new Set<string>()
    for (const [i, config] of model.configs.entries()) {
      const where = `${rel} configs[${i}]`
      if (!chipIds.has(config.chipId)) {
        errors.push(`${where}: 알 수 없는 chipId "${config.chipId}"`)
      } else {
        const chip = chipById.get(config.chipId)!
        modelTiers.add(chip.tier)
        if (config.memoryGb > chip.maxMemoryGb) {
          errors.push(
            `${where}: ${config.memoryGb}GB 는 ${chip.family} 상한(${chip.maxMemoryGb}GB) 초과`,
          )
        }
      }
      for (let j = 1; j < config.prices.length; j++) {
        if (config.prices[j].effectiveFrom <= config.prices[j - 1].effectiveFrom) {
          errors.push(
            `${where}: prices 가 effectiveFrom 오름차순이 아닙니다`,
          )
          break
        }
      }
    }

    // Mac Studio 는 Max와 Ultra의 기본 가격대와 메모리 구성이 크게 달라서
    // 한 모델 파일에 섞으면 동일 조건 비교의 기준 구성이 한쪽에 종속된다.
    if (model.family === 'mac-studio' && modelTiers.size > 1) {
      errors.push(
        `${rel}: Mac Studio 모델은 CPU 등급별로 분리해야 합니다 (현재 ${[
          ...modelTiers,
        ].join(', ')})`,
      )
    }

    // variantLabel 까지 넣어야 Mac Pro 타워/랙처럼 구성이 같고 가격만 다른
    // 제품이 중복으로 잡히지 않는다.
    const configKeys = model.configs.map(
      (c) => `${c.chipId}/${c.memoryGb}/${c.storageGb}/${c.variantLabel ?? ''}`,
    )
    for (const key of new Set(
      configKeys.filter((k, i, a) => a.indexOf(k) !== i),
    )) {
      errors.push(`${rel}: 중복 구성 "${key}"`)
    }

    for (const [i, up] of model.upgrades.entries()) {
      if (up.toValue <= up.fromValue) {
        errors.push(
          `${rel} upgrades[${i}]: toValue(${up.toValue}) 가 fromValue(${up.fromValue}) 이하입니다`,
        )
      }
      if (up.chipId && !chipIds.has(up.chipId)) {
        errors.push(`${rel} upgrades[${i}]: 알 수 없는 chipId "${up.chipId}"`)
      }
    }

    models.push(model)
  }

  const modelIdSet = new Set(models.map((model) => model.id))
  const benchmarkIds = new Set<string>()
  for (const [i, benchmark] of benchmarks.entries()) {
    const where = `benchmarks.json[${i}]`
    if (benchmarkIds.has(benchmark.id)) {
      errors.push(`${where}: 중복 id "${benchmark.id}"`)
    }
    benchmarkIds.add(benchmark.id)
    if (benchmark.chipId && !chipIds.has(benchmark.chipId)) {
      errors.push(`${where}: 알 수 없는 chipId "${benchmark.chipId}"`)
    }
    if (benchmark.modelId && !modelIdSet.has(benchmark.modelId)) {
      errors.push(`${where}: 알 수 없는 modelId "${benchmark.modelId}"`)
    }
  }

  if (models.length === 0 && errors.length === 0) {
    errors.push('data/models/ 아래에 모델 파일이 없습니다')
  }

  return { chips, models, benchmarks, errors }
}

/** 빌드 타임에 페이지가 쓰는 진입점. 데이터가 깨졌으면 빌드를 실패시킨다. */
export function loadDataset(asOf = new Date().toISOString().slice(0, 10)): Dataset {
  const { chips, models, benchmarks, errors } = loadRaw()
  if (errors.length) {
    throw new Error(
      `데이터 검증 실패 (${errors.length}건):\n` +
        errors.map((e) => `  - ${e}`).join('\n'),
    )
  }

  const rows = buildRows(models, chips, asOf)
  for (const row of rows) {
    row.benchmarks = benchmarks.filter(
      (benchmark) =>
        (!benchmark.chipId || benchmark.chipId === row.chip.id) &&
        (!benchmark.modelId || benchmark.modelId === row.modelId) &&
        (!benchmark.variantLabel || benchmark.variantLabel === row.variantLabel),
    )
  }
  const checkedDates = models.map((m) => m.checkedAt).sort()

  return {
    models,
    chips,
    benchmarks,
    rows,
    oldestCheckedAt: checkedDates[0] ?? asOf,
    verifiedCount: models.filter((m) => m.verified).length,
    upgradesVerifiedCount: models.filter((m) => m.upgradesVerified).length,
  }
}
