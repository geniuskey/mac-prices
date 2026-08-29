# mac-prices 구현 계획

Apple Silicon(M1 이후) Mac 제품의 **한국 공식 가격**을 한 자리에서 비교하는 정적 웹사이트.

- **데이터**: 수동 큐레이션 JSON (Apple KR 공식가 기준)
- **스택**: Next.js(App Router) + TypeScript + Tailwind CSS, SSG
- **범위**: 노트북 + 데스크탑 전 라인업, M1 이후 전 세대 (단종 모델 포함)

---

## 1. 목표

1. M1 이후 모든 Mac 모델의 한국 정가를 **하나의 표에서 필터·정렬·비교**할 수 있다.
2. "16GB / 512GB로 맞추면 얼마인가" 같은 **동일 조건 비교**가 가능하다. (Apple 사이트에서 가장 하기 어려운 일)
3. 단종 모델까지 포함해 **중고·리퍼 구매 시 기준가**를 확인할 수 있다.
4. 새 모델이 나왔을 때 **JSON 파일 몇 개만 추가하면** 사이트에 반영된다.

### 비목표 (v1)

- 실시간 크롤링 / 자동 가격 갱신
- 쿠팡·네이버 등 리셀러 시세
- 해외 가격 비교, 다국어

---

## 2. 대상 제품 범위

M1(2020-11) 이후 출시된 전 제품군. 2026년 8월 기준 M1~M6까지 **6개 칩 세대**가 존재하며, 라인업이 빠르게 늘어나므로 데이터 확장성이 설계의 최우선 제약이다.

| 제품군 | 커버 세대 | 비고 |
|---|---|---|
| MacBook Air 13" / 15" | M1 → M5 | 15"는 M2(2023)부터 |
| MacBook Pro 13" / 14" / 16" | M1 → M5 Pro/Max | 13"는 M2에서 단종 |
| Mac mini | M1 → M6 / M5 Pro | |
| Mac Studio | M1 Max/Ultra → M5 Max/Ultra | |
| iMac 24" | M1, M3, M4 (→ M6 예상) | |
| Mac Pro | M2 Ultra | 랙 모델 포함 |

> **작업 시 확인 필요**: 2025~2026년 모델(M5 계열, M6 Mac mini, M5 Max/Ultra Mac Studio)은 데이터 입력 단계에서 apple.com/kr 에서 정확한 SKU와 가격을 대조할 것. 이 계획서의 세대 목록은 개요이며 정오표가 아니다.

### 가격 기준

- **Apple KR 온라인 스토어 정가**(VAT 포함, 원화)를 단일 기준으로 삼는다.
- 교육 할인가는 있으면 함께 기록(선택 필드).
- 단종 모델은 **단종 직전 마지막 정가**를 기록하고 `discontinued` 로 표시한다.
- 2026-06-25 MacBook Pro 가격 인상처럼 **정가는 바뀐다**. 따라서 가격은 단일 값이 아니라 `effectiveFrom` 을 가진 스냅샷 배열로 저장한다. (§4.3)

---

## 3. 아키텍처

```
data/*.json  ──[build]──►  Zod 검증 + 파생 계산  ──►  Next.js SSG  ──►  정적 HTML/JS
                                                          │
                                                    클라이언트 필터/정렬
                                                    (전체 데이터 인라인, ~100KB 이하)
```

- 서버·DB 없음. 전체 데이터셋이 수백 SKU 규모라 **빌드 타임에 통째로 번들**해도 충분하다.
- 필터·정렬·비교는 전부 클라이언트 상태. URL 쿼리스트링에 동기화해 공유 가능한 링크를 만든다.
- 배포는 GitHub Pages (`output: 'export'`) 또는 Vercel. **Pages를 기본으로 가정**한다.

---

## 4. 데이터 모델

설계 핵심: **칩 / 모델 / 구성(SKU) / 업그레이드 옵션 / 가격 이력**을 분리한다. 칩 스펙과 BTO 단가는 여러 모델이 공유하므로 정규화하지 않으면 중복 입력 오류가 반드시 발생한다.

### 4.1 Chip — 칩 스펙

```ts
{
  id: "m4-pro-14c-20g",
  family: "M4 Pro",          // 표시명
  generation: 4,             // 1..6 — 세대 필터용
  tier: "base" | "pro" | "max" | "ultra",
  cpu: { total: 14, performance: 10, efficiency: 4 },
  gpuCores: 20,
  neuralCores: 16,
  memoryBandwidthGBps: 273,
  maxMemoryGb: 64,
  releasedAt: "2024-10-30"
}
```

동일 칩의 코어 수 바인닝(예: M4 Pro 12코어 / 14코어)은 **별도 Chip 레코드**로 둔다. 그래야 SKU가 칩 하나를 정확히 가리킨다.

### 4.2 Model — 제품 세대

```ts
{
  id: "macbook-pro-14-m4-2024",
  family: "macbook-pro",     // macbook-air|macbook-pro|mac-mini|mac-studio|imac|mac-pro
  formFactor: "laptop" | "desktop",
  displayName: "MacBook Pro 14인치 (M4, 2024)",
  screenSizeInch: 14 | null,
  releasedAt: "2024-11-08",
  discontinuedAt: null,      // null = 현행 판매
  ports: { thunderbolt: 3, tbVersion: 4, hdmi: 1, sdCard: true, magsafe: true },
  display: { resolution: "3024x1964", nits: 1000, proMotion: true } | null,
  weightKg: 1.55 | null,
  appleUrl: "https://www.apple.com/kr/..."   // 출처 링크
}
```

### 4.3 Config — 구매 가능한 기본 구성(SKU)과 가격

```ts
{
  id: "macbook-pro-14-m4-2024--16-512",
  modelId: "macbook-pro-14-m4-2024",
  chipId: "m4-10c-10g",
  memoryGb: 16,
  storageGb: 512,
  isBaseConfig: true,        // 해당 모델의 최저가 구성인가
  prices: [                  // 최신순이 아니라 effectiveFrom 오름차순
    { krw: 2390000, effectiveFrom: "2024-11-08", source: "apple-kr" },
    { krw: 2690000, effectiveFrom: "2026-06-25", source: "apple-kr", note: "환율 인상" }
  ],
  educationKrw: 2190000 | null
}
```

**현재가** = `prices` 중 `effectiveFrom <= today` 인 마지막 항목. 단종 모델은 마지막 항목이 그대로 "단종 시점가"가 된다. 이 구조 덕분에 나중에 가격 추이 차트를 데이터 변경 없이 붙일 수 있다.

### 4.4 UpgradeOption — BTO 업그레이드 단가

```ts
{
  modelId: "macbook-pro-14-m4-2024",
  kind: "memory" | "storage" | "chip",
  fromValue: 16, toValue: 24,     // GB, 또는 chipId
  krw: 300000
}
```

이게 있어야 §6-3의 **"동일 조건 비교"**(모든 모델을 16GB/512GB로 맞춰 가격 산출)가 가능하다. 이 사이트의 핵심 기능이므로 v1 필수.

### 4.5 Benchmark — 가성비 계산용 (선택, M5 단계)

```ts
{ chipId: "m4-pro-14c-20g", source: "geekbench6", singleCore: 3900, multiCore: 22500, gpuMetal: 110000, measuredAt: "2025-01-10" }
```

원/멀티코어점수 지표를 만들어 "가성비" 뷰를 제공한다. 출처와 측정일을 반드시 남기고, 사이트에 **3rd-party 참고치임을 명시**한다.

### 4.6 검증

`zod` 스키마로 빌드 타임 검증 + `pnpm validate` 스크립트. 최소한 다음을 강제한다:

- 모든 `modelId` / `chipId` 참조가 실제로 존재
- 모델당 `isBaseConfig: true` 가 정확히 하나
- `prices` 가 비어있지 않고 `effectiveFrom` 이 오름차순, 중복 없음
- `memoryGb <= chip.maxMemoryGb`
- 가격이 양의 정수 (원 단위, 소수점 없음)

CI에서 이 스크립트가 실패하면 머지 불가.

---

## 5. 데이터 입력 워크플로

수동 큐레이션의 유일한 리스크는 **오타와 누락**이다. 이를 프로세스로 막는다.

1. `data/models/<family>/<model-id>.json` 파일 하나가 한 모델 세대를 담는다 (모델 + 구성 + 업그레이드 옵션을 한 파일에). 리뷰 시 diff가 읽힌다.
2. 모든 파일에 `sourceUrl` 과 `checkedAt` 필수 → 어느 페이지를 언제 보고 넣었는지 추적.
3. `pnpm validate` 통과 필수.
4. `docs/DATA-ENTRY.md` 에 신규 모델 추가 절차를 체크리스트로 문서화 (M1 단계 산출물).

> 참고: 현재 개발 환경은 apple.com 아웃바운드가 차단되어 있어 자동 대조가 불가하다. 가격은 사람이 브라우저에서 확인해 입력하는 것을 전제로 한다.

---

## 6. 화면 설계

### 6-1. 홈 `/`
제품군별 카드 6개. 각 카드에 현행 모델의 최저가 / 최고가 범위, 대표 이미지(또는 아이콘), 최신 칩 배지.

### 6-2. 전체 비교표 `/mac` — **핵심 화면**
M1 이후 전 SKU를 한 테이블에. 
- 필터: 제품군 / 칩 세대 / 티어(base·Pro·Max·Ultra) / 화면 크기 / 메모리 / 저장용량 / 가격대 / 현행·단종
- 정렬: 가격, 출시일, CPU 코어, GPU 코어, 메모리
- 필터 상태를 URL 쿼리에 반영 (공유 가능)
- 모바일에서는 테이블 → 카드 리스트로 전환

### 6-3. 동일 조건 비교 `/mac?normalize=16-512`
비교표 위의 토글. 켜면 모든 행의 가격이 "기본 구성가 + 필요한 업그레이드 비용"으로 재계산된다. 해당 조건이 불가능한 모델(예: 8GB 상한)은 흐리게 처리하고 사유를 표시.

### 6-4. 모델 상세 `/mac/[modelId]`
스펙 전문, 구성별 가격표, **BTO 구성 계산기**(칩/메모리/저장 선택 → 실시간 합계), 가격 변동 이력, 같은 가격대 대안 모델 추천.

### 6-5. 나란히 비교 `/compare?ids=a,b,c`
최대 4개 SKU를 열로 놓고 스펙·가격 비교. 차이나는 행만 보기 토글.

### 6-6. 가성비 `/value` (M5)
원 / Geekbench 멀티코어 산점도. 제품군별 색상 구분.

---

## 7. 디렉터리 구조

```
mac-prices/
├─ data/
│  ├─ chips.json
│  ├─ benchmarks.json
│  └─ models/
│     ├─ macbook-air/*.json
│     ├─ macbook-pro/*.json
│     ├─ mac-mini/*.json
│     ├─ mac-studio/*.json
│     ├─ imac/*.json
│     └─ mac-pro/*.json
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                 # 홈
│  │  ├─ mac/page.tsx             # 비교표
│  │  ├─ mac/[modelId]/page.tsx   # 상세
│  │  ├─ compare/page.tsx
│  │  └─ value/page.tsx
│  ├─ components/                 # FilterPanel, PriceTable, ConfigCalculator, ...
│  ├─ lib/
│  │  ├─ schema.ts                # Zod 스키마 = 타입의 단일 출처
│  │  ├─ load.ts                  # JSON 로드 + 검증 + 조인
│  │  ├─ price.ts                 # 현재가 계산, 정규화 비교, BTO 합산
│  │  └─ format.ts                # ₩ 포맷, 날짜
│  └─ types.ts                    # z.infer 재수출
├─ scripts/validate-data.ts
├─ docs/{PLAN.md, DATA-ENTRY.md}
└─ .github/workflows/{ci.yml, deploy.yml}
```

`lib/price.ts` 는 순수 함수만 담고 단위 테스트를 붙인다. 가격 계산 버그가 이 사이트의 유일한 치명적 버그다.

---

## 8. 마일스톤

| # | 내용 | 완료 기준 |
|---|---|---|
| **M0** | 프로젝트 셋업 | Next.js + TS + Tailwind + ESLint/Prettier + Vitest. `pnpm build` 성공, 빈 홈 배포 확인 |
| **M1** | 데이터 스키마 & 시드 | Zod 스키마 + `validate` 스크립트 + **MacBook Pro 전 세대** 데이터 입력 완료. `DATA-ENTRY.md` 작성 |
| **M2** | 비교표 | `/mac` 필터·정렬·URL 동기화 동작. 모바일 카드 뷰 |
| **M3** | 나머지 5개 제품군 데이터 | M1 이후 전 SKU 입력, validate 통과 |
| **M4** | 상세 + BTO 계산기 + 동일 조건 비교 | `/mac/[id]` 렌더, 계산기 합계가 Apple 견적과 일치(수기 검증 5건), `normalize` 토글 동작 |
| **M5** | 나란히 비교 + 가성비 | `/compare`, `/value` |
| **M6** | 마감 | Lighthouse 90+, OG 이미지, sitemap, 가격 기준일 명시, README 갱신 |

M0→M2까지가 최소 사용 가능 버전(MVP). M3에서 데이터가 채워지면 실사용 가치가 생긴다.

---

## 9. 배포 & CI

- **ci.yml** (PR): typecheck → lint → `validate-data` → vitest → build
- **deploy.yml** (main push): build → GitHub Pages 배포
- 데이터 변경 PR도 동일 CI를 타므로, 잘못된 가격 형식·깨진 참조는 머지 전에 걸린다.

---

## 10. 리스크

| 리스크 | 대응 |
|---|---|
| **가격 정보가 낡음** — 정가 인상/모델 교체가 잦다 | 모든 페이지에 "기준일" 표기 + 파일별 `checkedAt`. 분기 1회 전수 점검을 이슈로 예약 |
| **잘못된 가격 입력** | CI 검증 + 리뷰 시 `sourceUrl` 대조 필수 |
| 단종 모델 정보 소실 | 단종 시점가를 삭제하지 않고 `discontinuedAt` 으로만 표시 |
| 상표·이미지 | Apple 제품 이미지 미사용(직접 그린 아이콘/실루엣). 푸터에 비제휴 고지 |
| 데이터 입력 노동량 | ~60개 모델 × 평균 3구성. M1에서 한 제품군을 먼저 끝내 실제 소요를 측정한 뒤 M3 일정 확정 |

---

## 11. v2 이후 확장

- 가격 추이 차트 (`prices` 배열이 이미 이력을 담고 있음)
- Apple 리퍼 스토어 가격
- 쿠팡/네이버 최저가 (별도 소스로 분리, 공식가와 구분 표기)
- 용도별 추천 ("영상 편집 300만원 이하")
- 가격 인하 알림
