# 수용 검증 보고서

검증일: 2026-09-22. 로컬 Windows, Node.js 24.13.0, Next.js 16.3.5, Playwright WebKit 26.6. 실제 학교 SQL Server·Supabase·Vercel은 연결하지 않았다.

## 실행 결과

| 검증 | 결과 | 근거 |
|---|---|---|
| TypeScript strict | PASS | `npm run typecheck` |
| ESLint | PASS | `npm run lint` |
| 단위 테스트 | PASS | Vitest 5파일, 12테스트(동일 요청 100회 재전송 포함) |
| production build | PASS | Next.js 정적 페이지 생성 단계 31/31, 앱 라우트 목록 정상 산출 |
| 학생회 tablet/mobile 흐름 | PASS | Playwright WebKit 5 pass, 1 의도적 project skip: PIN→명단→검색→선택→접수 |
| 교사 로그인 흐름 | PASS | mock 이메일·비밀번호 로그인 후 오늘 내역 |
| 시각 점검 | PASS | `docs/screenshots/` 3장, touch target/단일 주 동작/광학 fallback 확인 |
| 실제 Supabase migration | NOT RUN | 프로젝트 자격증명 없음 |
| 실제 SQL INSERT+영수증 | NOT RUN | 학교 DB 접속·승인 없음 |
| 실제 자동 취소 | NOT RUN | DELETE 정책·권한·후속 처리 미검증 |
| Vercel production | NOT RUN | 서비스 프로젝트·환경변수 없음 |
| Windows 재부팅 자동 시작 | NOT RUN | 대상 학교 PC 없음 |

## 계획 수용 항목 요약

- A01/A29: 서버 시간 경계 단위 테스트, reduced motion/transparency/fallback 구현. 실제 서버 시간 통합은 미실행.
- A04/A09/A10/A11/A12/A13: PIN version·append-only roster·동명이인·strict payload·request/business unique를 코드와 migration에 구현. A12/A13의 실제 PostgreSQL 동시성 부하는 미실행.
- A14/A15/A17/A20/A23/A25/A33: SQL 영수증, SERIALIZABLE, lease generation, report/reconcile, 성공 상태 보호를 구현. 실제 SQL Server 장애 주입은 미실행.
- A18/A19/A26/A27/A31/A32: readiness, 원본 재검증, scope, token, catalog 원자 활성화, 일정 잠금 trigger 구현. 실제 클라우드 통합은 미실행.
- A35–A39: 공개 signup 미사용, 초대·수락·복구·마지막 admin trigger 구현. 실제 Supabase 메일 만료/재사용 시험은 미실행.

## 스크린샷

- `council-locked-768x1024.png`
- `council-search-768x1024.png`
- `council-search-390x844.png`

개발 표시의 Next.js 검은 원형 배지는 production 빌드에는 나타나지 않는다. mock 배너와 시험 PIN도 운영 모드에는 표시되지 않는다.
