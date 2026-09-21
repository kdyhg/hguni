# 로컬 운영 구조 결정

2026-09-22 사용자 결정으로 기존 클라우드 Supabase/Vercel 설계를 폐기하고 단일 교내 Windows 서버 구조로 전환했다. 초기 구현 계획의 화면·업무·안전 요구사항은 유지하되, 해당 계획에서 Supabase·Vercel을 지시하는 부분은 이 문서가 대체한다.

## 책임 분리

| 구성요소 | 책임 |
|---|---|
| Next.js | 태블릿/교사 화면, 역할 검사, 입력 검증 |
| SQLite | 계정·세션·설정·카탈로그·멱등 요청·작업 큐·감사·Sheets outbox |
| Windows 중계 | SQLite 작업을 API로 claim하고 유니쿨 SQL Server에 반영 |
| `HguniReceipt` | 원본 SQL 트랜잭션의 멱등 영수증 |
| Google Sheets | 완료 내역의 선택적 조회·통계 복제본 |

SQLite는 WAL, 외래키, busy timeout과 트랜잭션을 사용한다. 학생/항목 전체 카탈로그는 최근 활성본과 직전 2개를 보관하고, 벌점 이력은 학생·항목 snapshot을 저장하므로 오래된 카탈로그를 삭제해도 이력이 유지된다.

Google Sheets 장애는 운영 요청의 성공 여부에 영향을 주지 않는다. 동기화 대상은 `google_sync_outbox`에 먼저 커밋되며 별도 worker가 최대 100건씩 append하고 성공한 행만 `synced`로 변경한다.
