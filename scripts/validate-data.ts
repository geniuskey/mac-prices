import { loadRaw } from '../src/lib/data'
import { buildRows } from '../src/lib/price'

const { chips, models, errors } = loadRaw()

if (errors.length) {
  console.error(`\n데이터 검증 실패 — ${errors.length}건\n`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error('')
  process.exit(1)
}

const asOf = new Date().toISOString().slice(0, 10)
const rows = buildRows(models, chips, asOf)
const unverified = models.filter((m) => !m.verified)

console.log(`\n데이터 검증 통과`)
console.log(`  칩       ${chips.length}종`)
console.log(`  모델     ${models.length}개`)
console.log(`  구성     ${rows.length}개`)
console.log(`  현행     ${models.filter((m) => m.discontinuedAt === null).length}개`)
if (unverified.length) {
  console.log(`\n  대조 필요 (verified: false) — ${unverified.length}개`)
  for (const m of unverified) console.log(`    · ${m.id}`)
}
console.log('')
