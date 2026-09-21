# 수용 검증 보고서

검증일: 2026-09-22. 로컬 Windows, Node.js 24.13.0, Next.js 16.3.5 기준. Supabase/Vercel 의존성을 제거하고 Windows + SQLite 구조로 전환했다.

## 자동 검증

| 검증 | 결과 | 근거 |
|---|---|---|
| TypeScript strict | PASS | `npm run typecheck` |
| ESLint | PASS | `npm run lint` |
| 단위 테스트 | PASS | Vitest 6파일, 16테스트: SQLite schema/admin/token hash/catalog/취소 경합 포함 |
| SQLite integrity | PASS | 임시 실제 DB에서 `PRAGMA quick_check=ok` |
| 기존 멱등성 | PASS | 같은 요청 100회가 단일 기록, 업무 중복 차단 |
| CMD/PowerShell 구문 | PASS | 전체 `.ps1` parser 오류 없음 |
| 로컬 서버 명령 | PASS | 시작→HTTP/SQLite health→백업→종료 실동작 |
| production build | PASS | Next.js 정적 생성 31/31 및 전체 route 산출 |
| tablet/mobile E2E | PASS | Playwright WebKit 5 pass, 1 의도적 project skip |

## 외부 환경 검증

| 항목 | 상태 | 이유 |
|---|---|---|
| 실제 유니쿨 INSERT + 영수증 | NOT RUN | 학교 SQL Server 접속·승인 없음 |
| 실제 자동 취소 | NOT RUN | DELETE 정책·권한·후속 처리 미검증 |
| Google Sheets 업로드 | NOT RUN | 서비스 계정과 대상 시트 없음 |
| 학교 PC 재부팅 자동 시작 | NOT RUN | 대상 PC 없음 |
| 교내 여러 태블릿 동시 부하 | NOT RUN | 실제 교내망 없음 |

외부 항목을 실행하지 않았다는 사실은 기능 미구현과 구분한다. 코드 경로와 안전 기본값은 구현했지만 학교 자격증명·승인 없이 성공으로 표시하지 않는다.
