'use client'

import { useMemo, useState } from 'react'
import type { Model, Row } from '@/lib/types'
import { formatKrw, formatStorage, normalizeModel } from '@/lib/price'
import { Badge, FieldLabel, Select, VerifyBadge } from './ui'

function Spec({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null
  return (
    <div className="flex justify-between gap-3 py-1">
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="tnum text-right font-medium">{value}</span>
    </div>
  )
}

/**
 * 확장된 행 안의 BTO 계산기.
 * 이 모델의 업그레이드 표만 써서 실제 구성 가능한 조합만 노출한다.
 */
function Calculator({ model, row }: { model: Model; row: Row }) {
  const asOf = new Date().toISOString().slice(0, 10)

  const memoryChoices = useMemo(() => {
    const set = new Set<number>()
    for (const c of model.configs) {
      if (c.chipId !== row.chip.id) continue
      set.add(c.memoryGb)
      for (const u of model.upgrades) {
        if (u.kind !== 'memory') continue
        if (u.chipId && u.chipId !== row.chip.id) continue
        if (u.fromValue === c.memoryGb) set.add(u.toValue)
      }
    }
    return [...set].sort((a, b) => a - b)
  }, [model, row.chip.id])

  const storageChoices = useMemo(() => {
    const set = new Set<number>()
    for (const c of model.configs) {
      if (c.chipId !== row.chip.id) continue
      set.add(c.storageGb)
      for (const u of model.upgrades) {
        if (u.kind !== 'storage') continue
        if (u.chipId && u.chipId !== row.chip.id) continue
        if (u.fromValue === c.storageGb) set.add(u.toValue)
      }
    }
    return [...set].sort((a, b) => a - b)
  }, [model, row.chip.id])

  const [memoryGb, setMemoryGb] = useState(row.memoryGb)
  const [storageGb, setStorageGb] = useState(row.storageGb)

  const result = normalizeModel(
    model,
    row.chip,
    { memoryGb, storageGb },
    asOf,
    row.variantLabel,
  )

  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      <div className="mb-2 text-[13px] font-semibold">구성 계산기</div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1.5">
          <FieldLabel>메모리</FieldLabel>
          <Select
            ariaLabel="메모리 선택"
            value={String(memoryGb)}
            onChange={(v) => setMemoryGb(Number(v))}
            options={memoryChoices.map((m) => ({
              value: String(m),
              label: `${m}GB`,
            }))}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <FieldLabel>저장장치</FieldLabel>
          <Select
            ariaLabel="저장장치 선택"
            value={String(storageGb)}
            onChange={(v) => setStorageGb(Number(v))}
            options={storageChoices.map((s) => ({
              value: String(s),
              label: formatStorage(s),
            }))}
          />
        </div>
      </div>

      <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: 'var(--border)' }}>
        {result.feasible ? (
          <>
            <div className="tnum text-[20px] font-bold">
              {formatKrw(result.krw!)}
            </div>
            <div className="tnum mt-0.5 text-[12px]" style={{ color: 'var(--muted)' }}>
              기본 {formatKrw(result.baseKrw)}
              {result.upgradeKrw > 0 && ` + 업그레이드 ${formatKrw(result.upgradeKrw)}`}
            </div>
            {result.upgradeKrw > 0 && !row.upgradesVerified && (
              <div className="mt-1 text-[11px]" style={{ color: 'var(--warn)' }}>
                업그레이드 단가는 대조되지 않은 추정값입니다
              </div>
            )}
          </>
        ) : (
          <div className="text-[13px]" style={{ color: 'var(--warn)' }}>
            {result.note}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RowDetail({ row, model }: { row: Row; model: Model }) {
  const p = row.ports
  const portText = p
    ? [
        p.thunderbolt
          ? `Thunderbolt ${p.thunderboltVersion ?? ''} ×${p.thunderbolt}`.replace(
              '  ',
              ' ',
            )
          : null,
        p.usbA ? `USB-A ×${p.usbA}` : null,
        p.hdmi ? `HDMI ×${p.hdmi}` : null,
        p.sdCard ? 'SDXC' : null,
        p.ethernet ? '이더넷' : null,
        p.magsafe ? 'MagSafe' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <div className="grid gap-3 p-3 text-[13px] sm:grid-cols-3 sm:p-4">
      <div>
        <div className="mb-1.5 text-[13px] font-semibold">스펙</div>
        <div style={{ borderColor: 'var(--border)' }}>
          <Spec label="칩" value={`${row.chip.family}`} />
          <Spec
            label="CPU"
            value={
              row.chip.cpuPerformanceCores !== undefined
                ? `${row.chip.cpuCores}코어 (성능 ${row.chip.cpuPerformanceCores} + 효율 ${row.chip.cpuEfficiencyCores})`
                : `${row.chip.cpuCores}코어`
            }
          />
          <Spec label="GPU" value={`${row.chip.gpuCores}코어`} />
          <Spec
            label="Neural Engine"
            value={row.chip.neuralCores ? `${row.chip.neuralCores}코어` : null}
          />
          <Spec
            label="메모리 대역폭"
            value={
              row.chip.memoryBandwidthGBps
                ? `${row.chip.memoryBandwidthGBps}GB/s`
                : null
            }
          />
          <Spec label="최대 메모리" value={`${row.chip.maxMemoryGb}GB`} />
          <Spec
            label="디스플레이"
            value={
              row.displaySizeInch
                ? `${row.displaySizeInch}" ${row.displayResolution ?? ''}${row.proMotion ? ' · ProMotion' : ''}`
                : null
            }
          />
          <Spec label="무게" value={row.weightKg ? `${row.weightKg}kg` : null} />
          <Spec label="포트" value={portText} />
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[13px] font-semibold">가격 이력</div>
        {row.priceHistory.length <= 1 ? (
          <p style={{ color: 'var(--muted)' }}>
            출시 이후 정가 변동 기록이 없습니다.
          </p>
        ) : (
          <ul className="space-y-1">
            {row.priceHistory.map((h, i) => {
              const prev = i > 0 ? row.priceHistory[i - 1].krw : null
              const diff = prev === null ? null : h.krw - prev
              return (
                <li key={h.effectiveFrom}>
                  <div className="flex justify-between gap-2">
                    <span style={{ color: 'var(--muted)' }}>{h.effectiveFrom}</span>
                    <span className="tnum">
                      {formatKrw(h.krw)}
                      {h.estimated && (
                        <span className="ml-1 text-[11px]" style={{ color: 'var(--warn)' }}>
                          추정
                        </span>
                      )}
                      {diff !== null && (
                        <span
                          className="ml-1"
                          style={{ color: diff > 0 ? 'var(--danger)' : 'var(--accent)' }}
                        >
                          {diff > 0 ? '▲' : '▼'}
                          {Math.abs(diff / 10000).toLocaleString('ko-KR')}만
                        </span>
                      )}
                    </span>
                  </div>
                  {h.note && (
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                      {h.note}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-3 space-y-1">
          <div className="flex flex-wrap gap-1">
            {row.upcoming ? (
              <Badge tone="accent">출시 예정 {row.releasedAt}</Badge>
            ) : row.isCurrent ? (
              <Badge tone="accent">현행 판매</Badge>
            ) : (
              <Badge>단종 {row.discontinuedAt}</Badge>
            )}
            <VerifyBadge verified={row.verified} source={row.verifiedSource} />
            {row.priceEstimated && <Badge tone="warn">현재가 추정</Badge>}
            {!row.upgradesVerified && <Badge tone="warn">업그레이드가 추정</Badge>}
          </div>
          <div style={{ color: 'var(--muted)' }}>
            출시 {row.releasedAt} · 확인 {row.checkedAt}
          </div>
          {row.sourceUrl && (
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-block underline underline-offset-2"
              style={{ color: 'var(--accent)' }}
            >
              Apple 기술 사양 보기 ↗
            </a>
          )}
          {model.notes && (
            <p className="mt-1" style={{ color: 'var(--muted)' }}>
              {model.notes}
            </p>
          )}
        </div>
      </div>

      <Calculator model={model} row={row} />
    </div>
  )
}
