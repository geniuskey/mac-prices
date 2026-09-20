import type { Benchmark } from './types'

export interface BenchmarkSummary {
  singleCore?: number
  multiCore?: number
  gpuMetal?: number
  powerIdleW?: number
  powerMaxW?: number
}

/** 여러 측정 제출을 한 행의 짧은 요약으로 합친다. */
export function summarizeBenchmarks(
  benchmarks: Benchmark[] | undefined,
): BenchmarkSummary {
  const summary: BenchmarkSummary = {}
  for (const benchmark of benchmarks ?? []) {
    summary.singleCore ??= benchmark.singleCore
    summary.multiCore ??= benchmark.multiCore
    summary.gpuMetal ??= benchmark.gpuMetal
    summary.powerIdleW ??= benchmark.powerIdleW
    summary.powerMaxW ??= benchmark.powerMaxW
  }
  return summary
}
