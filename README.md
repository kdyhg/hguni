# 유니쿨 아침선도

학생회가 교사의 현장 감독 아래 태블릿에서 학생을 검색하고 벌점을 즉시 원본 유니쿨에 전달하는 독립 웹앱입니다. 기존 교사용 웹 서비스와 인증·설정·DB·배포를 공유하지 않습니다.

## 로컬 시험 화면

요구사항: Node.js 22 이상.

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

`.env.local`에서 `APP_ENV=development`, `USE_MOCK_DATA=true`인지 확인합니다. `http://localhost:3000`에서 시험 PIN `246810`을 사용합니다. 교사 시험 계정은 `admin@demo.local` / `hguni-demo`입니다. 시험 화면에는 mock임을 명확히 표시하며 운영에서는 이 조합으로 시작할 수 없습니다.

## 주요 구조

```text
태블릿/교사 브라우저 → Next.js API → 전용 Supabase PostgreSQL
                                      ↑ HTTPS poll/report
                              학교 Windows 중계 → UniCool SQL Server
```

- 학생회: PIN 잠금 해제 → 담당자 등록 → 학생 검색 → 항목 선택 → 큰 부과 버튼
- 교사: 이메일·비밀번호 로그인, 오늘 내역, 취소 승인, 활동·PIN·중계·교사 설정
- 중계: claim/lease/authorize/report/reconcile, SQL Server 원본 쓰기와 `HguniReceipt` 영수증을 같은 트랜잭션으로 커밋
- 안전: 서버 시간, 원본 ID, 중복 unique key, 요청 UUID, scope, payload hash, 최소 권한

## 검증

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install webkit
npm run test:e2e
```

운영 준비는 [배포 안내](docs/deployment.md), [학교 PC 설치](docs/school-pc-setup.md), [운영 안내](docs/operations.md), [수용 보고서](docs/acceptance-report.md)를 순서대로 확인합니다. 실제 학교 DB에서 검증하지 않은 항목은 mock 통과와 구분되어 있습니다.

## 보안 경계

- 실제 SQL 연결 정보는 학교 PC의 `bridge/config/config.local.json`에만 둡니다.
- Supabase secret key, PIN pepper, bridge token은 브라우저에 전달하지 않습니다.
- `REAL_WRITES_ENABLED=true`는 production에서만 허용하고, 중계도 `schemaVerified`와 `realWritesEnabled`를 별도로 확인합니다.
- 자동 취소는 실제 스키마·트리거·권한을 검증해 `cancellationVerified=true`로 켜기 전까지 완료로 표시하지 않습니다.
