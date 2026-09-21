# 로컬 Windows 배포 안내

## 사전 조건

- Windows 10/11 또는 Windows Server
- Node.js 22 이상과 npm
- 고정 IP 또는 DHCP 예약을 받은 교내 PC
- 태블릿과 서버가 서로 접근 가능한 신뢰된 교내망
- 유니쿨 SQL Server 접근 권한

## 최초 설치

1. 승인된 Git commit의 전체 폴더를 서버 PC에 복사한다.
2. `최초설치.cmd`를 실행하고 최초 관리자 이메일과 8자 이상 비밀번호를 입력한다.
3. 스크립트가 `.env.local`, `data/hguni.db`, 프로덕션 빌드를 준비한다.
4. `방화벽허용.cmd`를 관리자 권한으로 실행한다. 이 규칙은 Private 프로필의 TCP 3000만 허용한다.
5. `서버시작.cmd`를 실행한다.
6. `서버상태.cmd`가 보여 주는 `http://교내IP:3000/teacher/login`에 접속한다.
7. 교사 설정에서 PIN을 만들고, 중계 token을 발급하고, 담당교사·활동시간·허용항목을 설정한다.

## `.env.local` 핵심값

```dotenv
APP_ENV=production
APP_BASE_URL=http://교내고정IP:3000
COOKIE_SECURE=false
USE_MOCK_DATA=false
LOCAL_DATABASE_PATH=./data/hguni.db
PIN_PEPPER=최소32자_무작위값
SOURCE_SCOPE=학교별고유범위
REAL_WRITES_ENABLED=false
GOOGLE_SHEETS_ENABLED=false
```

실제 입력 승인이 끝나기 전에는 `REAL_WRITES_ENABLED=false`를 유지한다. HTTPS 역방향 프록시를 설치한 경우에만 URL을 HTTPS로 바꾸고 `COOKIE_SECURE=true`로 설정한다.

## 자동 시작

관리자 권한으로 `자동시작등록.cmd`를 실행하면 `HguniMorningServer`가 부팅 시 웹 서버·중계·선택적 Sheets worker를 시작하고, `HguniMorningBackup`이 매일 16:30 SQLite 백업을 만든다. 등록 후 반드시 재부팅하여 `서버상태.cmd`와 실제 태블릿 접속을 확인한다.

## Google Sheets 선택 연동

1. Google Cloud 프로젝트에서 Sheets API를 활성화한다.
2. 서비스 계정을 만들고 JSON 키를 발급한다.
3. 빈 스프레드시트를 만들고 서비스 계정 이메일에 편집 권한으로 공유한다.
4. 키를 `config/google-service-account.json`에 저장한다.
5. `.env.local`에서 `GOOGLE_SHEETS_ENABLED=true`, `GOOGLE_SHEETS_SPREADSHEET_ID=...`를 설정한다.
6. 서버를 재시작한다. `아침선도 기록` 시트와 머리글은 worker가 자동 생성한다.

서비스 계정 생성과 키 보관은 [Google 공식 서버 간 인증 안내](https://developers.google.com/identity/protocols/oauth2/service-account)를 따른다. 표준 Sheets API에는 분당 할당량이 있으므로 운영 DB로 사용하지 않고 일괄 동기화만 한다. [Sheets API 사용 제한](https://developers.google.com/workspace/sheets/api/limits)
