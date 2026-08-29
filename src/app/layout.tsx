import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mac 가격 비교 — M1 이후 전 모델',
  description:
    'MacBook Air·Pro, Mac mini, Mac Studio, iMac, Mac Pro 의 한국 정가를 한 표에서 비교합니다. 메모리·저장장치를 같은 조건으로 맞춰 실질 가격을 계산합니다.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
