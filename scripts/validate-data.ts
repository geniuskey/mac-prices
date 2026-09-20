import { loadRaw } from '../src/lib/data'
import { buildRows } from '../src/lib/price'

const { chips, models, benchmarks, errors } = loadRaw()

if (errors.length) {
  console.error(`\n데이터 검증 실패 — ${errors.length}건\n`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error('')
  process.exit(1)
}

const asOf = new Date().toISOString().slice(0, 10)
const rows = buildRows(models, chips, asOf)
const unverified = models.filter((m) => !m.verified)
const noUpgrades = models.filter((m) => !m.upgradesVerified)
const bySource = new Map<string, number>()
for (const m of models) {
  if (!m.verified) continue
  const k = m.verifiedSource ?? '(출처 미기재)'
  bySource.set(k, (bySource.get(k) ?? 0) + 1)
}

console.log(`\n데이터 검증 통과`)
console.log(`  칩       ${chips.length}종`)
console.log(`  모델     ${models.length}개`)
console.log(`  벤치마크 ${benchmarks.length}개`)
console.log(`  구성 row ${rows.length}개`)
console.log(`  현행     ${models.filter((m) => m.discontinuedAt === null).length}개`)

console.log(`\n기본 정가 대조 ${models.length - unverified.length}/${models.length}`)
for (const [src, n] of [...bySource].sort()) console.log(`    ${src}: ${n}개`)
if (unverified.length) {
  console.log(`  미대조 — ${unverified.length}개`)
  for (const m of unverified) console.log(`    · ${m.id}`)
}

const estimated = rows.filter((r) => r.priceEstimated)
if (estimated.length) {
  console.log(`\n현재가가 추정치인 구성 ${estimated.length}/${rows.length}`)
  console.log(`  2026-06-25 전 라인 인상 때 최저가 구성만 보도되어,`)
  console.log(`  파생 구성은 같은 인상 폭을 적용한 추정치다.`)
}

console.log(`\nBTO 업그레이드 단가 대조 ${models.length - noUpgrades.length}/${models.length}`)
if (noUpgrades.length) {
  console.log(
    `  업그레이드 단가는 추정값이다. 2026-06 애플이 메모리 업그레이드`,
  )
  console.log(`  가격을 두 배로 올려 세대별로 크게 다르므로 개별 확인이 필요하다.`)
}
console.log('')
