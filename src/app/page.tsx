import Explorer from '@/components/Explorer'
import { loadDataset } from '@/lib/data'

export default function Page() {
  const {
    rows,
    models,
    oldestCheckedAt,
    verifiedCount,
    upgradesVerifiedCount,
  } = loadDataset()
  return (
    <Explorer
      rows={rows}
      models={models}
      oldestCheckedAt={oldestCheckedAt}
      verifiedCount={verifiedCount}
      upgradesVerifiedCount={upgradesVerifiedCount}
    />
  )
}
