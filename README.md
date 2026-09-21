# 유니쿨 아침선도

학생회 태블릿과 교사 PC가 교내 네트워크에서 사용하는 독립 로컬 웹앱입니다. Windows 서버 PC에서 Next.js와 SQLite가 실행되고, 같은 PC의 중계가 유니쿨 SQL Server에 최종 벌점을 기록합니다. Supabase와 Vercel은 사용하지 않습니다.

## 가장 쉬운 운영 방법

Node.js 22 이상이 설치된 Windows PC에서 다음 파일을 순서대로 실행합니다.

1. `최초설치.cmd` — 패키지 설치, 프로덕션 빌드, SQLite 생성, 최초 관리자 등록
2. `방화벽허용.cmd` — 관리자 권한으로 교내 개인 네트워크의 TCP 3000 허용
3. `서버시작.cmd` — 웹 서버·유니쿨 중계·선택적 Sheets 동기화 시작
4. `서버상태.cmd` — 프로세스와 SQLite 상태 확인
5. `데이터백업.cmd` — 실행 중에도 일관된 SQLite 백업 생성
6. `서버종료.cmd` — 서버와 보조 프로세스 종료

부팅 때 자동 시작하고 매일 16:30에 백업하려면 관리자 권한으로 `자동시작등록.cmd`를 한 번 실행합니다.
이전 PC에서는 `자동시작해제.cmd`로 작업을 제거할 수 있으며 데이터는 삭제되지 않습니다.

## 구조

```text
학생회 태블릿 / 교사 PC
           │ 교내 LAN
           ▼
Windows 서버 PC
├─ Next.js 웹/API
├─ data/hguni.db (SQLite 운영 DB)
├─ 유니쿨 중계 ──────────────→ UniCool SQL Server
└─ 선택적 동기화 ────────────→ Google Sheets(조회·통계용)
```

Google Sheets는 운영 원본이 아닙니다. 인터넷이나 Sheets API가 일시 중단되어도 부과 요청과 상태는 SQLite에 남고, `google_sync_outbox`가 나중에 다시 전송합니다.

## 개발용 화면

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

`.env.local`에서 `APP_ENV=development`, `USE_MOCK_DATA=true`를 사용합니다. 시험 PIN은 `246810`, 교사 계정은 `admin@demo.local` / `hguni-demo`입니다. 운영에서는 mock 모드가 차단됩니다.

## 검증

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

자세한 내용은 [로컬 설치](docs/deployment.md), [학교 PC 설정](docs/school-pc-setup.md), [PC 이전](docs/pc-migration.md), [운영 안내](docs/operations.md), [수용 보고서](docs/acceptance-report.md)를 확인합니다.

## 보안 경계

- SQL 비밀번호는 `bridge/config/config.local.json`에만 둡니다.
- PIN pepper, 교사 비밀번호 해시, 중계 token hash는 서버에만 저장합니다.
- 서비스 계정 JSON은 `config/`에 두며 Git에 포함되지 않습니다.
- `REAL_WRITES_ENABLED`, `schemaVerified`, 중계의 `realWritesEnabled`가 모두 승인된 경우에만 원본 입력이 가능합니다.
- 현재 기본 설치는 교내 HTTP입니다. 신뢰할 수 있는 분리된 교내망과 Windows `Private` 방화벽 프로필에서만 사용하고, 망 정책상 TLS가 필요하면 내부 인증서·역방향 프록시를 추가한 뒤 `COOKIE_SECURE=true`로 전환합니다.
