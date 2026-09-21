# 유니쿨 아침선도 독립 사이트 — 상세 구현 계획

작성일: 2026-09-22 · 대상 저장소: https://github.com/kdyhg/hguni.git

추가 합의 반영: 교사는 이메일·비밀번호 기반의 새 사이트 별도 계정으로 로그인하고, 최초 관리자를 지정한 다음 다른 교사는 초대로 등록한다. 이메일·비밀번호 및 초대 방식은 과거 대화에서 이미 확정된 사항이 아니라 이 계획 작성 중 사용자가 추가로 확정한 사항이다.

이 문서는 「상벌점 태블릿 모드 구현」 대화의 최종 결정을 새 프로젝트에서 구현하기 위한 작업 명세다. 구현 담당 AI는 이 문서 전체와 별도로 첨부되는 `liquid_optical_glass_design_system_improved.md` 전체를 먼저 읽고, 아래 순서대로 코드·검증·운영 문서·Git 커밋 및 푸시까지 수행한다. 이 문서 작성 시점에는 앱을 구현하거나 배포하지 않았다.

## 1. 목표와 범위

아침 등교지도 또는 점심 선도활동 중, 교사가 감독하는 학생회가 태블릿에서 학생을 찾고 벌점 항목을 선택해 실제 유니쿨에 즉시 반영한다. 종이에 기록한 뒤 교사가 다시 입력하는 작업을 없앤다. 학생회 화면은 처음 보는 사람도 설명 없이 사용할 만큼 단순해야 한다.

기존 교사용 사이트와 로그인·DB·설정·API·배포를 공유하지 않는 독립 제품이다. 유니쿨 원본 DB는 같은 학교 시스템이므로 최종 기록 대상은 동일하지만, 기존 교사용 웹 서비스에 의존하지 않는다. 기존 소스는 원본 연동 규칙을 파악하기 위한 읽기 전용 참고자료이며 기존 프로젝트 파일·원격 저장소·운영 설정을 변경하지 않는다.

### 1.1 확정 요구사항

| ID | 요구사항 | 완료 기준 |
|---|---|---|
| R01 | 별도 사이트 | 기존 서비스가 중지되어도 새 사이트 자체 인증·설정·중계가 동작 |
| R02 | 간단한 학생회 화면 | 학생 검색 → 항목 선택 → 부과, 핵심 화면에 큰 주 동작 1개 |
| R03 | 교사 PIN | 교사가 6자리 숫자 PIN을 입력해 해당 브라우저의 현재 활동만 해제 |
| R04 | 활동시간 | 이름·요일·시작/종료시간을 가진 여러 활동 설정, 서버 기준 제한 |
| R05 | 담당자 명단 | 학생회 개인 계정 없이 여러 이름 입력, 명단 변경 이력 보존 |
| R06 | 즉시 처리 | 일괄 승인 없이 접수 직후 중계가 처리, 성공 확인 후에만 반영 완료 |
| R07 | 취소 | 학생회 요청 → 교사 승인 → 원본 취소 확인, 감사 이력 유지 |
| R08 | 중복 방지 | 연속 탭·응답 유실·다중 PC·다중 태블릿에도 중복 기록 방지 |
| R09 | 교사 관리 | 이메일·비밀번호 별도 로그인, 최초 관리자 지정 후 교사 초대, 실시간 내역·설정·취소 관리 |
| R10 | 담당교사 연결 | 환경설정에서 실제 부과 교사 식별값을 검증해 연결 |
| R11 | 배포 | private GitHub 저장소 hguni와 Vercel, 별도 클라우드 DB |
| R12 | 학교 PC 중계 | 외부 HTTPS로 작업을 가져오고 학교 내부 유니쿨 DB에 기록 |
| R13 | PC 이전 | 새 PC로 중계 이동 후에도 Vercel 주소·설정·이력 유지 |
| R14 | 디자인 | 첨부 Liquid / Optical Glass 문서 적용, 가독성·터치 우선 |

### 1.2 최종 결정으로 정리한 이전 제안

- 태블릿 사전 등록·연결번호 페어링은 구현하지 않는다. 최종 선택은 교사가 현장에서 입력하는 6자리 PIN이다.
- 교사 휴대폰의 별도 활동 시작 승인 버튼은 필수가 아니다. PIN 입력이 활동 시작 승인 역할을 한다.
- 초기 대화의 ‘승인 끄기’ 옵션은 PIN 도입 후 접근 방식이 미정이다. 1차 버전은 PIN 필수로 고정한다. 인증을 완전히 없애는 체크박스를 만들지 않는다.
- 30초 취소 인증번호는 초기 대안이었다. 1차 버전은 교사 관리자 화면의 취소 승인으로 구현한다.
- 사이트 자체를 학교 PC에서 호스팅하지 않는다. 태블릿 접속 주소는 Vercel 주소다.
- 인터넷이 끊긴 학생회 입력을 브라우저에 쌓아 나중에 자동 제출하는 기능은 제외한다.
- 상점·교정점수·전체 누적점수 조회·문자발송·대량 일괄 부과·과거 날짜 부과는 학생회 기능에 넣지 않는다.

### 1.3 이 계획에서 선택한 구현 기본값

다음은 사용자가 숫자까지 지정한 사항이 아니라 구현 혼선을 줄이기 위한 기본값이다. 운영 전 설정값으로 조정할 수 있게 한다.

- 시간대: Asia/Seoul, 저장 timestamp는 UTC, 활동 날짜는 한국 날짜.
- 활동은 당일 시작/종료만 지원하고 자정을 넘는 일정은 거부한다.
- 일정이 겹치면 저장 단계에서 거부한다. 한 시점에 하나의 활동만 활성화한다.
- 같은 활동 회차에서 같은 학생·항목은 한 번만 부과한다. 취소 후 재부과도 학생회에서는 막고 교사가 별도 정정 절차를 사용한다.
- 담당자 이름 1~10명, 이름당 trim 후 1~30자. 이를 실명 인증으로 표현하지 않는다.
- 검색은 2자 이상, 최대 20개 결과. 학년·반 필터는 필요한 때 접어 펼친다.
- 중계 heartbeat 10초, 온라인 판정 30초 이내, 작업 poll 활동 중 2초/비활동 중 15초, 실패 시 지수 backoff와 jitter.
- 학생회 상태 조회 5초, 처리 중인 요청 결과 조회 2초. 관리자 내역 조회 5초. 탭 비활성 시 polling 축소.
- PIN: 세션/클라이언트와 신뢰 가능한 IP 기준 5회 실패 시 5분 제한을 기본으로 하고, 학교 전체 공유 IP를 장시간 차단하는 정책은 피한다. 사이트 전체 공격은 별도의 단기 속도 제한과 관리자 알림으로 대응한다.
- 입력 대기 유효기간: 접수 후 30초와 활동 종료시각 중 빠른 시각. 그 뒤 새 원본 쓰기는 하지 않는다.
- 카탈로그 신선도: 기본 24시간. 연결 교사·학생·항목은 실제 쓰기 직전에 원본에서도 검증한다.

## 2. 확인된 기존 연동 근거와 반드시 남겨둘 불확실성

계획 작성 시 읽은 로컬 자료:

- `C:/Users/user/Documents/ChatGPT/유니쿨/README.md`
- `C:/Users/user/Documents/ChatGPT/유니쿨/docs/integration.md`
- `C:/Users/user/Documents/ChatGPT/유니쿨/bridge/adapter.ts`
- `C:/Users/user/Documents/ChatGPT/유니쿨/bridge/sqlserver.ts`의 관련 검색 결과
- `C:/Users/user/Documents/ChatGPT/유니쿨/bridge/receipt.sql`
- `C:/Users/user/Documents/ChatGPT/유니쿨/bridge/writer-permissions.ts`의 권한 정의

실제 학교 DB에 접속하거나 변경한 것은 아니다. 아래는 기존 소스·문서 근거이며 새 환경의 실제 스키마와 권한을 검증해야 한다.

| 항목 | 근거 및 구현 지침 |
|---|---|
| 실제 연결 | 학교 PC에서 SQL Server에 연결하는 방식. Vercel이 내부 SQL Server에 직접 접속하지 않음 |
| 부과 교사 | `merit.t_id = teacher.key_num`. 교사 이름·이메일·teacher.t_id로 대체하지 않음 |
| 학생 키 | `merit.st_id = student.st_id`. 이름·학년반번호를 영구 키로 사용하지 않음 |
| 벌점 항목 | `merit_sel = D`, 항목 구분과 코드를 함께 식별 |
| 배점 | 원본 부호를 보존. UI에 ‘벌점 2점’으로 보여도 DB 저장 부호를 임의 변경하지 않음 |
| 학적 범위 | `class` 의미를 학년 또는 학년도라고 추정하지 않음 |
| 원본 저장 | 날짜·시간·학생·교사·코드·배점·class 등 실제 열/형식 검증 필요 |
| 삭제 | 코드에는 DELETE 경로가 있으나 현재 운영 전용 계정은 입력 전용이며 삭제 권한 없음 |
| 재시도 | 원본 쓰기와 SQL Server 영수증 저장이 같은 트랜잭션이어야 함 |

**‘유니쿨 담당교사 계정 연결’은 DB 접속 계정 입력과 다르다.** 관리자 설정에서는 동기화된 교사 목록에서 담당교사를 선택하고, 연결 결과를 표시한다. 유니쿨 교사 비밀번호 검증 방법이 확인되지 않았는데 가짜 로그인 폼을 만들지 않는다. DB 접속 자격증명은 학교 PC의 로컬 설정에서 관리한다. 실제 비밀번호 기반 교사 인증이 필요한지는 기존 프로그램의 검증 가능한 경로를 조사한 뒤 확장한다. 새 사이트 관리자가 누구를 부과 교사로 지정했는지 감사 로그를 남긴다.

기존 `.env*`, 실행파일, 분석 덤프, 실제 학생 데이터, 비밀 연결 문자열을 새 저장소에 복사하지 않는다. 연동에 필요한 코드만 의존성을 확인해 선별적으로 포팅한다.

## 3. 시스템 구조와 기술 선택

```text
학생회 태블릿 / 교사 휴대폰
          │ HTTPS
          ▼
Vercel: Next.js UI + 짧은 API 요청
          │
          ▼
새 Supabase 프로젝트: Auth + PostgreSQL
  활동·세션·최소 카탈로그·요청·결과·감사
          ▲
          │ 학교 PC가 외부 HTTPS로 poll / heartbeat / report
학교 Windows PC: hguni 전용 중계 프로그램
          │ 내부망 SQL 연결
          ▼
UniCool SQL Server: 원본 벌점 + hguni 전용 영수증
```

### 3.1 구현 스택 기본안

- TypeScript strict, Next.js App Router, React, CSS modules 또는 단일 토큰 기반 CSS.
- Supabase Auth: 확정된 이메일·비밀번호 및 초대 방식의 구현 수단으로 선택한다. 공개 회원가입은 끈다. 기존 사이트 계정을 재사용하지 않는다.
- Supabase PostgreSQL: 영구 큐와 앱 데이터. 테이블과 RPC를 SQL migration으로 관리한다.
- Node.js TypeScript 중계 + SQL Server 드라이버. 기존의 검증된 mssql 연동 패턴을 참고한다.
- Vitest: 정책·상태 전이. PostgreSQL 통합 테스트: 원자성·권한. Playwright: 실제 화면 흐름.
- GitHub Actions: 의존성 설치, 타입 검사, lint, 테스트, 빌드. 실제 학교 DB 없는 CI를 기본으로 한다.

버전은 구현 시 공식 문서와 런타임 지원을 확인하고 안정 버전으로 고정한 lockfile을 커밋한다. 설치한 Next.js 패키지에 로컬 가이드가 있으면 먼저 확인한다. 과거 버전의 cookies/headers/route params API를 그대로 가정하지 않는다.

Vercel 함수에는 영구 polling loop·로컬 SQLite 대기열·파일 기반 세션을 두지 않는다. 각 API는 DB에 영구 상태를 저장하고 짧게 반환한다. 학교 PC만 지속 실행한다. 이 구분은 [Vercel Functions](https://vercel.com/docs/functions)의 요청 기반 실행 모델을 따른 설계다.

앱 데이터는 브라우저가 직접 조회하지 않고 Next.js API에서 역할 검증 후 읽는다. Supabase privileged key는 서버 전용이다. RLS를 활성화하고 anon/authenticated의 앱 테이블 직접 접근을 차단하며, RPC 실행 권한도 명시적으로 제한한다. 서버 key는 RLS를 우회하므로 모든 API에 별도 권한 검사가 필요하다. [Supabase RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security), [API 보안 문서](https://supabase.com/docs/guides/api/securing-your-api)를 구현 시 다시 확인한다.

## 4. 학생회 화면 — 버튼 수와 단계까지 고정

### 4.1 라우트와 화면 구성

| URL | 화면 | 기본 노출 |
|---|---|---|
| `/` | 학생회 활동 화면 | 잠금/담당자/입력 상태에 따라 같은 화면 전환 |
| `/teacher/login` | 교사 로그인 | 이메일·비밀번호·로그인, 비밀번호 재설정 링크 |
| `/teacher` | 오늘 내역 | 활동 상태, 최근 입력, 취소 요청 필터 |
| `/teacher/settings` | 설정 | 활동시간·항목·PIN·담당교사·중계·교사관리 접이식 섹션 |

학생회 기본 화면에 사이드바·대시보드 차트·큰 관리자 메뉴·통계 카드·설정 버튼 모음을 두지 않는다. 교사 로그인은 잠금 화면 하단의 작은 텍스트 링크 하나로 제공한다. 교사 화면 내 상위 탐색은 ‘오늘 내역 / 설정’ 두 개다.

### 4.2 잠금 화면

```text
아침 선도
아침 등교지도 · 07:40–08:30

교사가 활동을 열어 주세요
[ ● ● ● ● ● ● ]
[ 활동 열기 ]

교사 로그인
```

- 허용시간 밖에는 PIN 입력과 활동 열기를 비활성화하고 다음 활동 이름/시간 표시.
- 중계 미연결, 교사 미설정, 카탈로그 미준비 시 구체적 안내와 잠금 유지.
- PIN 입력은 password + inputMode=numeric, 자동완성 제한. 화면에 PIN 유지 금지.
- 6자리가 되었다고 자동 제출하지 않는다. 교사가 ‘활동 열기’를 누른다.
- 실패 메시지는 PIN 정답 여부 외의 내부 정보를 과도하게 노출하지 않는다.

### 4.3 담당자 등록

```text
오늘 활동하는 학생회 이름
[ 이름 입력                 ] [추가]
김민수 ×   이지은 ×
[ 시작하기 ]
```

Enter로도 추가. 최소 1명 있어야 시작. 같은 trim 결과는 중복 금지. 이름은 해당 세션의 담당자 명단이며 개별 클릭자의 인증된 신원은 아니다. 새로고침 후 서버 세션을 복원한다.

### 4.4 주 입력 화면

```text
아침 등교지도 · 08:30 종료                  활동 종료
담당 김민수, 이지은

[ 이름 또는 학번 검색                          ]

2학년 3반 12번  김학생

[ 복장불량 ] [ 대리출석 ]

[ 복장불량 · 벌점 2점 부과 ]

최근 입력  김학생 · 복장불량 · 반영 완료
                                       내역 보기
```

- 큰 주 버튼은 1개. 예시 항목 2개는 실데이터가 아니라 레이아웃 예시다.
- 활동 설정에서 허용 항목을 2~4개 권장. 4개 초과이면 검색 가능한 단일 선택 목록으로 전환해 버튼 벽을 만들지 않는다.
- 결과 목록에는 학년·반·번호·이름을 모두 표시. 한 명 검색되어도 자동 부과 금지.
- 선택된 학생은 크게, 변경은 학생 영역을 누르는 식으로 일관되게 제공.
- 학생/항목이 모두 유효할 때만 부과 활성화. UI뿐 아니라 서버 검증 필수.
- 부과 직후 버튼을 잠그고 같은 요청 ID의 결과를 추적. 전송 중 새 요청 ID 생성 금지.
- 접수 성공 시 선택을 초기화하고 검색창으로 복귀, 최근 입력에서 처리 상태 유지. 응답 자체가 유실되면 기존 요청 ID로 상태 확인 후 초기화한다.
- 학생마다 다시 확인 모달을 띄우지 않는다. 학생·항목을 크게 보여주는 마지막 버튼이 확인 역할을 한다.
- 취소는 ‘내역 보기’의 행 상세 안에 ‘취소 요청’으로 제공. 모든 행에 큰 삭제 버튼 금지.
- 담당자 변경은 담당자 표시를 눌러 시트를 열고 명단 버전을 추가. 기존 기록은 이전 명단 유지.
- 종료 시각 도달/서버 세션 폐기/교사 긴급 중지 시 학생 정보·검색 결과를 비우고 잠금 화면으로 복귀.
- 마지막 작업이 진행 중이면 ‘활동은 종료되었으며 처리 결과를 확인 중입니다’로 알리고, 완료 내역은 교사 화면에서 확인 가능하게 한다.

### 4.5 UI 상태 문구

| 내부 상태 | 표시 | 사용자 동작 |
|---|---|---|
| queued / executing | 전송 중 | 같은 건 다시 누르지 않음 |
| succeeded | 반영 완료 | 다음 학생 검색 |
| failed_safe | 반영되지 않음 | 안전한 재처리 여부는 교사에게 안내 |
| uncertain | 확인 필요 | 자동 새 부과 금지 |
| expired_unsent | 시간이 지나 전송되지 않음 | 교사 확인 |
| cancel_requested / cancel_approved | 취소 확인 중 | 원본은 아직 남아 있을 수 있음 |
| cancel_succeeded | 취소 완료 | 원본 취소 증거가 있을 때만 표시 |
| cancel_manual_required | 교사 직접 처리 필요 | 관리자 유니쿨 처리 및 확인 |

## 5. 첨부 디자인 문서 적용 지침

반드시 별도로 첨부되는 `liquid_optical_glass_design_system_improved.md`를 전체 읽고 참고한다. 최초 원본 위치는 `C:/Users/user/Downloads/liquid_optical_glass_design_system_improved.md`이다. 구현 시 파일이 제공되어 있으면 내용을 바꾸지 않고 `docs/design/liquid_optical_glass_design_system_improved.md`에 보관해 전달 가능한 기준으로 만든다. 파일을 찾을 수 없으면 실제 첨부를 요청하며, 읽었다고 주장하지 않는다.

디자인 문서는 재질·조형·접근성 기준이다. 그 안의 선택적 bento/pricing/hero 예제를 이 업무 화면에 끼워 넣지 않는다. 사용자의 ‘매우 단순한 화면’이 레이아웃의 최우선 기준이다.

1. 환경: 부드러운 크림·세이지 계열의 잔잔한 배경, 의미 없는 움직이는 구체 금지.
2. 깊이: 페이지 배경 → 큰 광학 유리 영역 1개 → 내용. 무거운 blur를 중첩하지 않는다.
3. 재질: 환경색이 비치고 방향성 하이라이트·얇은 가장자리·부드러운 그림자·미세 굴절 또는 그에 준하는 시각적 모사가 있어야 한다.
4. 텍스트를 굴절시키지 않는다. 모든 텍스트는 재질 효과 위에 안정적으로 표시.
5. clear/balanced/dense 토큰을 구현하되 모든 곳에 동일 opacity를 적용하지 않는다.
6. 중요한 학생 정보는 진한 근흑색, 한국어 시스템 폰트와 충분한 행간. 학생 이름 24~32px, 본문 16~18px를 시작점으로 삼는다.
7. 주 강조색 1개. 오류/성공은 의미 있는 상태색과 텍스트를 함께 사용한다.
8. 주 부과 버튼 높이 56px 이상, 다른 터치 영역 최소 44px. 아이콘만으로 기능 설명 금지.
9. 둥근 모서리는 부모/자식 관계에 맞춰 14/22/30px 정도에서 시작.
10. motion은 입력 속도를 방해하지 않는 150~220ms 상태 전환 위주. 상시 부유/반짝임/큰 scale 금지.
11. reduced-motion, reduced-transparency, blur 미지원 fallback 구현. 투명도 줄이기 옵션은 교사 설정의 접근성 섹션 또는 장치 로컬 접근성 설정에 둔다.
12. iPad Safari·Android Chrome에서 가상 키보드, 768×1024/1024×768, 교사 모바일 390×844, 좁은 360px 폭을 확인한다.
13. 대비·포커스·키보드 이동·스크린리더 label·aria-live 상태 안내를 확인한다.
14. 터치 장치에서 hover 효과가 필수 정보를 숨기지 않도록 한다. 카드별 WebGL 효과는 넣지 않는다.

구현 AI에게 전달할 디자인 문구:

> 첨부한 liquid_optical_glass_design_system_improved.md 전체를 디자인 기준으로 참고하세요. iOS에서 영감을 받은 Liquid / Optical Glass 재질을 사용하되, 이 제품은 학생회가 등교 중 빠르게 쓰는 업무 도구입니다. 학생 검색, 항목 선택, 큰 부과 버튼 하나가 중심인 단순한 화면을 유지하세요. 환경색, 절제된 굴절, 방향성 하이라이트, 연속적인 곡률을 구현하고 텍스트 가독성과 터치 정확성을 우선하세요. 유백색 카드의 반복, 과한 blur, 장식용 대시보드, 많은 버튼과 중첩 카드로 구성하지 마세요.

## 6. 인증·권한·활동 정책

### 6.1 교사 인증

- 새 Supabase Auth 프로젝트의 초대 계정만 사용. 최초 방문자를 관리자로 승격하지 않는다.
- 초기 관리자는 서버 운영 설정으로 지정한 이메일을 검증한 계정에 한해 bootstrap 명령으로 등록한다. 실행 결과만 로그로 남기고 초기 암호를 문서에 쓰지 않는다.
- 역할 `admin`은 시간/PIN/교사 연결/교사 초대 설정 가능. `teacher`는 오늘 내역·취소 승인·활동 긴급 중지 가능.
- 마지막 활성 admin의 비활성화/강등을 막는다.
- teacher 탈퇴·정지 시 다음 API부터 차단. 브라우저가 보내는 role/teacher ID를 신뢰하지 않는다.
- PIN으로 교사 화면에 진입할 수 없다.

#### 교사 초대·계정 복구 세부 절차

1. 최초 관리자 이메일은 배포자가 명시적으로 지정한다. bootstrap은 지정 이메일에 대한 초대 또는 검증된 기존 Auth 계정 연결만 수행하며, 외부인이 호출하는 공개 bootstrap API를 만들지 않는다.
2. admin이 설정의 ‘교사 관리’에서 이메일을 입력하고 초대한다. 일반 teacher와 학생회는 초대할 수 없다.
3. 서버는 이메일을 정규화하고 기존 계정/대기 초대를 확인한다. `teacher_invitations`에 이메일, 역할, 초대한 관리자, 상태, 만료시각을 기록하며 provider의 원문 토큰은 저장하지 않는다.
4. Supabase의 검증된 초대 흐름으로 메일을 발송한다. 실서비스 메일 발송 설정과 redirect allowlist를 배포 안내에 포함한다.
5. 교사는 `/teacher/accept-invite`에서 검증된 초대 세션으로 비밀번호를 설정한다. 서버가 이메일·초대 상태·만료·계정 ID를 대조한 후 teacher_profiles를 활성화한다. 이메일 문자열만 일치한다고 admin으로 만들지 않는다.
6. 만료·철회된 초대는 수락 불가. 재초대와 철회를 지원하며 이전 초대 세션이 있더라도 현재 초대 상태를 서버에서 확인한다. 초대 재발급 시각 이전에 만들어진 인증 컨텍스트를 새 초대 수락으로 인정하지 않도록 provider의 토큰 검증 방식에 맞춰 구현한다.
7. 이미 활성화된 교사를 다시 초대해 계정이나 역할이 중복 생성되지 않도록 unique 제약과 원자 처리를 사용한다.
8. `/teacher/forgot-password` → provider 재설정 메일 → `/teacher/reset-password`로 복구한다. 화면에는 이메일 존재 여부를 드러내지 않는 동일한 안내를 표시한다.
9. 비밀번호 정책과 토큰 만료는 구현 시 provider 공식 규칙을 확인하고 설정한다. 비밀번호를 앱 DB·로그·감사 이벤트에 저장하지 않는다.
10. 수락·철회·정지·역할 변경·복구 요청은 비밀값을 제외한 감사 이벤트로 남긴다. 관리자 화면에서 교사의 비밀번호를 조회할 수 없게 한다.

교사 로그인은 실제 부과 대상인 유니쿨 담당교사 연결과 별개다. 새 사이트 teacher 계정이 생성됐다고 원본 teacher key를 이름으로 자동 연결하지 않는다.

### 6.2 학생회 세션

- PIN은 salt를 사용하는 검증된 비밀번호 해시와 서버 pepper로 저장. 평문·가역암호 저장·로그 금지.
- PIN 검증 성공 후 256bit 이상 무작위 세션 토큰 발급. DB에는 토큰 해시만 저장.
- Secure, HttpOnly, SameSite 쿠키 사용. localStorage에 인증 토큰을 넣지 않는다.
- 세션은 activity occurrence, pin_version, expires_at, roster version에 연결한다.
- 유효기간은 현재 활동 종료시각까지. 아침 세션으로 점심 입력 불가.
- PIN 변경은 pin_version 증가 및 기존 세션 폐기. 새 PIN은 화면 재조회로 읽을 수 없고 교체만 가능.
- 활동 종료·중지·일정 변경 시 해당 회차를 폐쇄하고 열린 세션 폐기. 이미 시작된 회차의 시간을 조용히 늘리지 않는다.
- 검색·부과·취소 요청·내역 조회 모든 API에 세션 검사. 로그인 UI만 숨기는 방식 금지.
- 모든 상태 변경 요청에 Origin/CSRF 검증, content-type 및 body 크기 제한 적용.
- PIN 실패 rate limit은 공유 DB의 원자적 카운터로 구현. Vercel 프로세스 메모리에만 두지 않는다.

### 6.3 활동 회차

- schedule은 반복 규칙, occurrence는 한국 날짜에 발생한 특정 활동이다.
- `(schedule_id, local_date)` unique로 서버에서 회차를 원자 생성한다.
- 시간 구간은 `[start, end)`이다. 종료시각 정각에는 잠금 해제/새 접수 불가.
- occurrence 생성 때 이름·시간·허용항목·담당교사 설정 버전을 고정한다.
- 담당교사/항목/배점이 운영 중 바뀌면 해당 활동을 일시 중지하고 재검증한다. 기존 접수의 교사 키를 새 설정값으로 바꿔 전송하지 않는다.
- 긴급 중지는 모든 세션과 아직 실행 승인되지 않은 대기를 차단한다. 이미 SQL 트랜잭션에 진입한 작업은 완료될 수 있으며 결과를 보존한다.
- 활동 종료 직전 시작된 트랜잭션이 종료 후 커밋될 수 있다. ‘종료 전 실행 승인된 작업의 완료’로 기록하고 신규 접수와 구분한다.

## 7. DB 모델과 마이그레이션

모든 UUID는 서버 생성 또는 검증된 request UUID를 사용한다. 원본 ID는 숫자로 강제 변환하지 않고 문자열로 보존한다. 아래 필드는 최소 명세이며 외래키·인덱스·CHECK·updated_at을 구현하면서 명시한다.

| 테이블 | 주요 필드 | 제약/역할 |
|---|---|---|
| teacher_profiles | auth_user_id, email, role, enabled | auth_user_id unique, 역할 CHECK |
| teacher_invitations | id, normalized_email, role, invited_by, provider_user_id, status, issued_at, expires_at, accepted_at | 이메일별 유효 대기 초대 1개, 원문 초대 토큰 저장 금지 |
| app_settings | id=1, timezone, pin_hash, pin_version, settings_version, teacher_source_id, paused | singleton; 비밀 필드 API 응답 제외 |
| activity_schedules | id, name, weekdays, start_local, end_local, enabled, version | start<end, 요일 0~6, 중복 시간 저장 함수에서 잠금 검증 |
| schedule_items | schedule_id, source_kind, source_code | composite PK, D만 허용 |
| activity_occurrences | id, schedule_id, local_date, starts_at, ends_at, status, config_snapshot | schedule/date unique |
| council_sessions | id, token_hash, occurrence_id, pin_version, expires_at, revoked_at | token_hash unique |
| session_rosters | id, session_id, version, names_json, created_at | session/version unique; append-only |
| catalog_versions | id, source_scope, synced_at, status, counts, checksum | 완전 업로드 후 활성 버전 전환 |
| students | catalog_version, source_id, name, grade, class_label, number, source_class, active | version/source_id unique |
| penalty_items | catalog_version, kind, code, label, signed_points, enabled | version/kind/code unique, D |
| source_teachers | catalog_version, source_id, name, active | 비밀번호/주민번호 수집 금지 |
| penalty_requests | id, session_id, roster_id, occurrence_id, student_id, item_key, snapshot_json, payload_hash, state, execute_before, source_record_id | 요청 identity와 기록 snapshot 불변 |
| cancellation_requests | id, penalty_request_id, reason, requested_by, approved_by, state, result_json | 원본 입력 연결, 활성 취소 1개 |
| bridge_jobs | id, operation, request_id, state, lease_owner, lease_generation, lease_until, attempt_count, execute_before | request/operation unique |
| bridge_instances | id, token_hash, enabled, last_seen_at, sql_checked_at, capabilities, version, scope | bridge 인증과 상태 |
| audit_events | id, actor_type, actor_id, action, target_id, redacted_detail, created_at | 일반 API 수정/삭제 금지 |
| pin_attempt_buckets | bucket_hash, window_start, fail_count, blocked_until | raw IP 장기 저장 대신 keyed hash |

### 7.1 인덱스와 원자성

- penalty_requests의 `(occurrence_id, student_id, item_key)` unique로 업무 중복을 막는다. 안전하게 실패한 건을 교사가 재처리해도 동일 요청을 사용한다.
- 취소 완료 후에도 기존 업무 중복 키를 해제하지 않는다. 재부과 예외 기능은 1차 범위 밖이다.
- 큐 검색용 `(state, execute_before, created_at)`, 내역용 `(occurrence_id, created_at desc)` 인덱스.
- 접수 RPC 한 트랜잭션에서 세션·회차·설정·중계 readiness 검증 → 중복 조회 → 요청 + job + 감사 생성.
- 이미 존재하는 request_id는 payload_hash가 같고 접근 권한이 맞으면 기존 결과 반환. 다르면 409.
- activity_schedules 수정은 singleton 설정 행을 잠가 서로 겹치는 동시 저장도 차단.
- DB now()를 시간 권위로 사용. 브라우저 시간으로 허용 여부를 판정하지 않는다.
- RLS 및 GRANT/REVOKE를 migration 안에 포함. SECURITY DEFINER RPC가 필요하면 고정 search_path와 제한된 실행 권한을 설정한다.

### 7.2 migration 파일 순서

1. `001_core.sql`: 교사·설정·활동·세션·명단.
2. `002_catalog.sql`: 카탈로그 버전 및 학생/항목/교사 최소 목록.
3. `003_requests_jobs.sql`: 요청·취소·큐·중계·감사·인덱스.
4. `004_atomic_functions.sql`: 접수/claim/실행승인/report/취소승인/중지 원자 함수.
5. `005_access_control.sql`: RLS·RPC 권한·rate limit 권한.

적용 전 빈 개발 DB부터 전체 migration을 검증하고, 운영 migration은 적용 버전과 롤백/복구 방안을 문서로 남긴다. destructive down migration 대신 보존 가능한 forward fix를 우선한다.

## 8. API 계약

일관된 응답: 성공 `{ data, serverTime }`, 실패 `{ error: { code, message, requestId? }, serverTime }`. 학생회 응답에는 SQL·교사 이메일·DB 주소·비밀값을 포함하지 않는다. 개인정보 응답은 `Cache-Control: no-store`.

| 메서드/경로 | 권한 | 입력/출력 핵심 |
|---|---|---|
| GET `/api/council/status` | 미인증도 최소 응답 | 활동 이름/시간, 잠금 이유만. 카탈로그 제외 |
| POST `/api/council/unlock` | PIN + 시간 + rate limit | `{pin}` → 보안 쿠키 발급 |
| PUT `/api/council/roster` | 학생회 세션 | `{names}` → 새 roster version |
| GET `/api/council/students?q=` | 활성 세션+명단 | 최소 학생 검색, pagination 제한 |
| GET `/api/council/items` | 활성 세션 | 현재 활동의 허용 벌점만 |
| POST `/api/council/penalties` | 활성 세션+명단 | `{requestId,studentId,itemKey,catalogVersion}` |
| GET `/api/council/penalties/:id` | 해당 세션 소유 | 상태, 최소 대상 정보 |
| GET `/api/council/history` | 해당 세션 | 현재 세션 내역, 제한된 페이지 |
| POST `/api/council/penalties/:id/cancel` | 해당 세션 소유 | `{reason}` → 취소 요청 |
| POST `/api/council/end` | 해당 세션 | 세션 폐기, 쿠키 삭제 |
| GET `/api/teacher/history` | teacher/admin | 날짜/활동/상태 필터, 커서 pagination |
| POST `/api/teacher/cancellations/:id/approve` | teacher/admin | `{reason}` 및 승인 감사 |
| POST `/api/teacher/cancellations/:id/reject` | teacher/admin | 거절 사유 |
| POST `/api/teacher/occurrences/:id/stop` | teacher/admin | 회차 중지·대기 차단·세션 폐기 |
| GET/PATCH `/api/teacher/settings` | admin | 비밀 필드 제외 DTO, version 충돌 409 |
| POST `/api/teacher/settings/pin` | admin | 새 PIN 저장·기존 세션 폐기 |
| GET/POST/PATCH `/api/teacher/schedules[/:id]` | admin | 일정/허용항목 검증 |
| POST `/api/teacher/bridge-tokens` | admin | 새 고엔트로피 토큰 1회 표시 |
| GET/POST `/api/teacher/invitations` | admin | 초대 목록/발송, 이메일 및 역할 검증 |
| POST `/api/teacher/invitations/:id/revoke` | admin | 대기 초대 철회 및 감사 |
| POST `/api/teacher/invitations/accept` | 검증된 초대 Auth 세션 | 현재 유효한 초대와 계정 대조 후 활성화 |
| PATCH `/api/teacher/accounts/:id` | admin | 역할/활성 상태 변경, 마지막 admin 보호 |
| POST `/api/bridge/heartbeat` | bridge 전용 | DB health, capabilities, source scope |
| POST `/api/bridge/catalog` | bridge 전용 | version/chunk/checksum, 원자 publish |
| POST `/api/bridge/jobs/claim` | bridge 전용 | 최대 1개, lease token 반환 |
| POST `/api/bridge/jobs/:id/authorize` | bridge 전용 | 실행 직전 시간·회차·lease 재검증 |
| POST `/api/bridge/jobs/:id/report` | bridge 전용 | 영수증 기반 성공/실패/불명 결과 |
| POST `/api/bridge/jobs/:id/reconcile` | bridge 전용 | 만료 후에도 영수증 읽기로 결과 복구 |

예시 벌점 접수 응답은 HTTP 202와 `{requestId,state:"queued"}`이다. HTTP 202를 성공 부과로 표시하지 않는다. 중복 업무 요청은 409 `DUPLICATE_PENALTY`, 만료는 403 `ACTIVITY_CLOSED`, 중계 미연결은 503 `BRIDGE_UNAVAILABLE`, 잠금 제한은 429 `PIN_RATE_LIMITED`와 Retry-After를 사용한다.

서버는 브라우저가 보낸 points, teacherId, appliedDate를 받지 않는다. 받아도 무시하는 방식보다 스키마에서 거부한다. 학생·허용 항목·배점·담당교사·날짜는 서버에서 결정해 snapshot으로 기록한다.

## 9. 중계와 중복 방지 — 가장 먼저 정확히 구현할 부분

### 9.1 접수에서 완료까지

1. 브라우저는 부과 의도 1건당 UUID 하나를 만든다. 응답 유실 후에도 같은 UUID를 사용한다.
2. API는 원자 접수 RPC로 검증/요청/큐/감사를 저장한다.
3. 중계는 자신의 환경·scope·token으로 작업 하나를 claim한다.
4. 큐 claim은 `FOR UPDATE SKIP LOCKED` 또는 동등한 원자 처리로 한 작업을 한 lease에 할당한다.
5. 실행 직전 authorize 호출로 회차·대기 만료·중지·lease generation을 다시 확인한다.
6. SQL Server 트랜잭션에서 해당 request_id의 기존 영수증을 먼저 확인한다.
7. 기존 영수증이 있고 hash/scope가 일치하면 재쓰기 없이 결과를 반환한다.
8. 없으면 교사·학생·항목·배점·범위를 원본 조회로 확인한다. snapshot과 다르면 쓰지 않고 확인 필요 처리.
9. 원본 INSERT와 hguni 영수증 INSERT를 같은 트랜잭션으로 커밋한다.
10. 커밋된 원본 key와 결과를 클라우드에 보고한다. 서버 report는 멱등하게 처리한다.

### 9.2 SQL Server 영수증

새 프로젝트 전용 `dbo.HguniReceipt`를 기본 이름으로 한다. 기존 `UniCoolWebReceipt`를 공유하거나 변경하지 않는다.

필수 열: request_id PK, operation, source_scope, payload_hash, source_record_id, result_json, audit_json, committed_at. 취소에는 별도 request UUID를 사용하고 원래 request_id/record_id를 audit에 연결한다.

- 영수증 확인과 쓰기는 동시성 제어가 필요하다. 요청 ID 범위에 대한 SERIALIZABLE/key range lock 또는 동등한 검증된 패턴을 사용한다.
- unique 충돌이 난 뒤 원본 INSERT만 남지 않도록 `XACT_ABORT`, rollback, 오류 처리 경로를 검증한다.
- DB 영수증과 원본 테이블의 백업·복원 시점을 함께 관리한다. 영수증만 지우고 큐를 재생하지 않는다.
- 원본 DB에 영수증을 같은 트랜잭션으로 저장할 권한이 없으면 운영 자동 재시도를 활성화하지 않는다.
- source_scope는 시험/운영 및 DB 인스턴스를 구분하는 비밀이 아닌 식별값이다. 실행 대상 scope 불일치 시 fail closed.
- 모든 SQL은 매개변수화한다. 앱 API에서 임의 SQL을 받지 않는다.

### 9.3 장애별 정책

| 상황 | 처리 |
|---|---|
| 접수 응답 유실 | 동일 request_id로 재조회/재접수, 새 UUID 금지 |
| SQL 연결 전 실패 | 원본 쓰기 없음이 확실하면 유효시간 내 동일 job 재시도 |
| SQL timeout/연결 유실 | 커밋 여부를 단정하지 않고 uncertain, 영수증 조회로 복구 |
| 커밋 성공 후 report 실패 | 영수증 재조회 후 같은 결과 재보고 |
| lease 만료 | 무조건 새 쓰기 금지. 영수증 복구 및 재authorize 필요 |
| 대기 중 활동 종료 | expired_unsent로 처리, 이후 자동 입력 금지 |
| 실행 중 활동 종료 | 이미 실행 승인된 작업 결과 확인, 종료 후 신규 실행 금지 |
| 교사 긴급 중지 | 미실행 작업 차단, 진행 중 건은 결과 확인 후 필요 시 취소 |
| DB 내용과 카탈로그 불일치 | 확인 필요, 자동 배점 변경 후 입력 금지 |
| PC 두 대 실행 | 클라우드 lease + 원본 영수증으로 같은 job 중복 방지 |

lease generation은 stale worker가 cloud 상태를 덮어쓰는 것을 막는다. stale worker의 성공 보고가 오면 무조건 버리지 말고 영수증과 job identity를 검증해 reconciliation으로 수렴시킨다. 최종 성공을 뒤늦은 실패 보고가 덮어쓰지 못하게 상태 전이를 비교 후 변경한다.

영수증 확인은 활동 종료 후에도 가능하다. 영수증이 없는 것이 확정되고 트랜잭션 종료가 확인된 경우에만 ‘전송되지 않음’으로 종결한다. 확인할 수 없는 동안에는 uncertain을 유지한다. 클라우드와 SQL Server 사이에 분산 트랜잭션이 없으므로 ‘정확히 한 번’이라는 표현을 보장처럼 쓰지 말고 원본 영수증으로 재처리의 부작용을 막는다.

### 9.4 중계 readiness

중계 프로세스가 살아 있다는 것만으로 온라인으로 표시하지 않는다. heartbeat 최신, SQL health 최신, 담당교사 존재, 허용 항목 동기화, scope 일치, 영수증/쓰기 권한 준비가 모두 충족되어야 입력 가능이다. cancel capability는 별도 표시한다.

정책 수치는 환경변수로 두되 학교 PC 설정에서 임의로 보안 시간제한을 늘리지 못하도록 서버의 execute_before를 항상 상한으로 삼는다. 중계의 로컬 시계 오차는 serverTime과 monotonic elapsed로 감지하고 크게 벗어나면 쓰기를 멈춘다.

## 10. 취소 — 앱 표시와 유니쿨 실제 상태 일치

### 10.1 정상 취소 경로

1. 학생회가 자기 세션의 최근 입력 상세에서 이유를 입력하고 취소 요청.
2. 교사는 전체 대상 정보·원래 담당교사·입력시간·현재 반영 상태를 확인하고 승인 또는 거절.
3. 아직 claim되지 않은 대기 입력은 DB 트랜잭션으로 job을 차단하고 ‘미전송 취소’ 처리.
4. executing/uncertain 입력은 우선 영수증을 확인한다. 쓰기 여부를 모른 채 취소 완료로 만들지 않는다.
5. 반영된 입력은 승인된 별도 CANCEL job을 생성한다.
6. 중계는 original record ID, 학생 ID, 원래 teacher key, 코드/배점 등 snapshot을 검증한다.
7. 검증된 취소 방식으로 원본 변경 + 취소 영수증을 한 트랜잭션에 저장.
8. 결과 보고 후에만 cancel_succeeded. 기존 입력·승인·취소 이유는 보존.

취소 승인 교사와 원래 부과 교사는 서로 다를 수 있다. 새 사이트에서 승인 권한을 가진 교사는 이 사이트가 생성한 건에 한해서 취소를 승인할 수 있다. SQL 대상은 원래 입력의 teacher key를 사용하며 승인자의 key로 덮어쓰지 않는다. 기존 사이트나 기존 유니쿨에서 만든 임의의 기록을 취소하는 API는 제공하지 않는다.

### 10.2 현재 삭제 권한 제한에 대한 구현

- 개발 mock에서는 승인·취소·감사 전체 흐름을 완성한다.
- 실환경에서는 테이블·트리거·외래키·집계·교정점수 영향과 권한을 먼저 검증한다.
- 입력 전용 기존 계정에 광범위 DELETE 권한을 자동 부여하지 않는다. hguni 전용 최소권한 프로시저 등 범위를 제한할 방법을 검토한다.
- 실제 취소 capability가 false이면 `cancel_manual_required`로 표시한다. ‘삭제 성공’ 응답을 흉내 내지 않는다.
- 교사가 유니쿨에서 직접 처리한 뒤 중계가 원본 record 상태를 다시 읽어 결과를 확인하도록 한다. 단순 ‘처리했음’ 버튼만으로 원본 취소 증거를 만들지 않는다.
- 원본 행이 이미 없으면 ‘이미 없음 확인’이라는 별도 결과로 남기고 이 시스템이 삭제했다고 기록하지 않는다.
- 교정 잔액 등 원본 정책을 깨는 취소는 blocked로 처리하고 구체적인 교사 안내를 제공한다. 반대 부호의 점수를 임의 입력해 취소처럼 보이게 만들지 않는다.

자동 취소가 검증되지 않으면 전체 요구사항을 모두 완료했다고 보고하지 않는다. 앱 흐름 완료와 운영 자동 취소 미검증을 분리해 보고한다.

## 11. 설정 화면과 운영자 사용 흐름

환경설정은 한 화면에 모든 버튼을 펼치지 말고 다음 접이식 섹션으로 구성한다.

1. **활동시간**: 이름, 요일, 시작/종료, 허용항목, 사용 여부. 기본값 예시 아침 07:40–08:30/점심 12:30–13:30은 관리자가 저장하기 전 운영 활성화하지 않는다.
2. **활동 PIN**: 새 PIN/확인, 변경 시 현재 학생회 세션이 종료됨을 안내.
3. **담당교사**: 동기화된 이름과 원본 식별값의 안전한 구분 정보, 선택/연결 확인. 미연결이면 입력 차단.
4. **학교 PC 연결**: 온라인/연결 끊김, 마지막 확인, 데이터 동기화 시간, 입력/취소 가능 여부, 연결 토큰 발급/해제.
5. **교사 관리**: admin 전용 초대/정지/역할. 공개 회원가입 없음.
6. **화면 접근성**: 투명도 줄이기 등. 기술 설정을 학생회 화면에 노출하지 않음.

초기 준비 순서: 관리자 로그인 → 중계 연결 → 최소 목록 동기화 → 담당교사 지정 → 활동 및 항목 저장 → PIN 설정 → 시험 확인 → 운영 활성화. 준비되지 않은 항목은 단일 ‘준비 상태’ 목록에 표시한다.

## 12. Windows 중계 패키지와 PC 이전

### 12.1 패키지 구조

```text
hguni-bridge/
  app/                    # 컴파일된 실행 코드
  runtime/                # 배포 시 포함하거나 설치 안내하는 Node 런타임
  config/config.example.json
  config/config.local.json # 실제 설정, Git 제외
  state/                  # 복구 보조정보, 원본 완료 증거로 사용 금지
  logs/                   # 회전 로그, 개인정보 최소화
  Start.ps1
  Stop.ps1
  Install-Task.ps1
  Uninstall-Task.ps1
  Check-Connection.ps1
  README-ko.md
```

- `$PSScriptRoot` 기준 상대경로. 사용자 이름/드라이브 문자 하드코딩 금지.
- 시작은 한 인스턴스만 허용하고 graceful shutdown은 신규 claim을 멈춘 뒤 현재 작업 결과를 보고한다.
- 자동 시작은 Windows 작업 스케줄러에 hguni 전용 작업명으로 등록한다. 기존 유니쿨 중계 작업을 덮어쓰지 않는다.
- 자격증명은 로컬 보안 저장소 또는 사용자 ACL이 제한된 파일로 관리하고 로그/배포 ZIP에 포함하지 않는다.
- OS 암호화 비밀은 다른 PC에서 복호화되지 않을 수 있으므로 새 PC에서 재입력을 지원한다.
- 준비된 포터블 런타임의 배포 조건·버전·checksum을 검증한다. 런타임을 포함하지 않을 경우 필요한 설치 버전을 명시한다.
- 학교 PC에는 인바운드 포트 개방·공인 IP 등록이 필요하지 않은 구성을 유지한다.

### 12.2 이전 절차

1. 교사가 활동을 중지하고 미처리/확인 필요 목록을 확인한다.
2. 기존 중계의 신규 claim을 멈추고 진행 건을 종료/복구한다.
3. 기존 PC 자동실행 작업과 중계를 종료한다.
4. 버전이 고정된 운영 패키지 및 비밀 없는 설정을 새 PC에 복사한다.
5. 새 PC에 새 bridge token과 SQL 자격증명을 설정한다. 기존 token은 해제한다.
6. 새 PC에서 내부 SQL·외부 HTTPS·scope·권한·영수증 연결 검사.
7. 동일 원본 DB에 연결되어 영수증이 유지됨을 확인한다. DB까지 바뀌면 단순 PC 이전으로 취급하지 않는다.
8. 미확정 요청을 영수증으로 복구하고 기존 요청을 새 ID로 복제하지 않는다.
9. Windows 자동실행 등록 및 재부팅 검증 후 활동 재개.

태블릿 주소와 Vercel 환경의 PC 주소를 바꾸는 절차는 없다. 사이트·활동 설정·입력 이력은 클라우드에 남는다.

## 13. 구현 파일 지도

경로는 권장 구조다. 같은 책임이 명확하다면 소폭 조정할 수 있으나 핵심 검증을 route마다 복제하지 않는다.

```text
app/
  page.tsx
  teacher/login/page.tsx
  teacher/page.tsx
  teacher/settings/page.tsx
  api/council/.../route.ts
  api/teacher/.../route.ts
  api/bridge/.../route.ts
components/
  council/LockedView.tsx
  council/RosterView.tsx
  council/PenaltyEntry.tsx
  council/StudentSearch.tsx
  council/RecentHistory.tsx
  teacher/ActivityEditor.tsx
  teacher/CancellationReview.tsx
  teacher/ConnectionSettings.tsx
  ui/OpticalSurface.tsx
  ui/Button.tsx
lib/
  server/auth.ts             # 교사 검증, 역할 검사
  server/council-session.ts  # PIN/토큰 검증과 폐기
  server/csrf.ts
  server/db.ts               # 서버 전용 DB 클라이언트
  server/rate-limit.ts
  server/request-service.ts
  server/cancellation-service.ts
  server/bridge-auth.ts
  domain/activity-policy.ts
  domain/request-state.ts
  domain/validation.ts
  domain/contracts.ts
styles/optical-glass.css
bridge/
  main.ts
  runner.ts
  api-client.ts
  adapter.ts
  sqlserver.ts
  mock.ts
  receipt.sql
  verify-permissions.sql
  scripts/*.ps1
supabase/migrations/*.sql
tests/unit/*.test.ts
tests/integration/*.test.ts
tests/e2e/*.spec.ts
docs/
  design/liquid_optical_glass_design_system_improved.md
  integration-evidence.md
  deployment.md
  school-pc-setup.md
  pc-migration.md
  operations.md
  acceptance-report.md
.env.example
.gitignore
.github/workflows/ci.yml
README.md
```

`adapter.ts`는 listCatalog / health / applyPenalty / cancelPenalty / lookupReceipt의 타입 계약을 정의한다. mock과 SQL 어댑터는 동일 계약을 만족한다. mock 모드는 개발/시험에서만 허용하고 production 환경에서 mock + real-write 설정 조합을 거부한다.

## 14. 단계별 구현 작업과 통과 조건

각 단계가 끝날 때 작동 결과와 남은 외부 조건을 기록한다. 코드가 많다는 이유로 검증 단계를 건너뛰지 않는다.

### 단계 0 — 저장소 및 근거 확인

- 새 작업 폴더에서 git status/remote/branch 확인. 계획 작성 시 이 폴더는 `.git`만 있는 초기 저장소였고 커밋·remote가 없었다. 구현 시 다시 확인한다.
- hguni 원격의 기존 이력을 조회하고 존재하면 보존하면서 작업한다. 기존 history가 있는 원격에 unrelated 초기 history를 강제로 올리지 않는다.
- 첨부 디자인 파일과 기존 연동 문서를 읽고 `integration-evidence.md`에 확인/미확인/결정 구분.
- 출력물: 작업 구조, 의존성/버전, 실제 연동 확인 목록.
- 통과: 기존 프로젝트를 변경하지 않고 새 프로젝트에서 작업함을 확인.

### 단계 1 — UI 골격과 mock 흐름

- design 토큰과 optical surface, 잠금/명단/입력/내역/교사 화면 생성.
- 고정 가상 학생 5명 이상, 동명이인, 벌점 2개 이상으로 시연.
- mock에서는 ‘시험 화면’ 표시, 실제 운영과 명확히 분리.
- 통과: PIN → 명단 → 검색 → 항목 → 부과 → 내역 → 취소 요청이 모바일/태블릿에서 연결.

### 단계 2 — DB 및 인증

- migration, RLS, bootstrap admin, 초대 로그인, 세션과 PIN rate limit.
- 익명·학생회·teacher·admin·bridge 권한 분리.
- 통과: API 직접 호출로 권한 우회 불가, PIN 변경 즉시 세션 폐기.

### 단계 3 — 활동·카탈로그·설정

- 한국시간 회차 생성, 겹침/경계 검증, 담당교사 연결, 최소 카탈로그 원자 publish.
- 통과: 이름만 바뀐 학생도 원본 key 유지, 비활성 항목/학생 선택 차단, 미준비 상태 입력 차단.

### 단계 4 — 접수·큐·상태 복구

- 원자 접수, 중복 키, claim/authorize/report/reconcile, mock bridge.
- 연결 유실·lease 만료를 강제로 재현.
- 통과: 두 태블릿 동시 입력과 100번 동일 요청 재전송에서 요청/효과 1개.

### 단계 5 — 실제 SQL 어댑터

- 실제 schema/권한 읽기 검사, 전용 영수증 DDL, 입력 어댑터.
- 학교 연결 없이 개발할 경우 SQL Server 격리 시험 환경을 사용한다. 실제 쓰기 검증이 불가하면 그 사실을 보고한다.
- 통과: 원본 INSERT+영수증 원자성, commit 후 report 유실 복구, 원본 key와 교사·배점 검증.

### 단계 6 — 취소

- 미전송 취소, 반영 후 취소, executing/uncertain 대기, 승인/거절 감사.
- 자동 취소 불가 환경에서 수동 처리 필요 및 원본 재확인 경로.
- 통과: 권한 없는 원본 삭제 불가, 학생회 직접 승인 불가, 원본이 남아 있으면 취소 완료 불가.

### 단계 7 — Windows 패키징과 이전

- 시작/중지/연결검사/작업스케줄러 설치/제거 스크립트.
- 통과: 공백/한글 경로 실행, 재부팅 자동 시작, PC 두 대 중복 실행 복구, 새 PC 이전 안내 검증.

### 단계 8 — 최종 UI 및 운영 점검

- 화면별 버튼 수·터치 영역·대비·가상 키보드·Safari fallback 검증.
- busy/expired/uncertain/bridge offline 상태 스크린샷 기록.
- 통과: mock뿐 아니라 실제 API 연결 화면에서 주요 흐름 완료.

### 단계 9 — 배포·커밋·푸시·인계

- 개발/preview/production 분리, 설정/로그 점검, 빌드 및 수용 기준 검증.
- GitHub private hguni로 커밋/푸시하고 Vercel 및 신규 Supabase 연결.
- 실제 서비스 자격증명/학교 접속 권한이 없으면 가능한 코드를 모두 완성하고 정확한 남은 설정만 기록한다. 성공하지 않은 배포를 완료라고 하지 않는다.
- 통과: URL, commit SHA, 배포 상태, 테스트 결과, 실제 연동/취소 확인 여부, 운영 설명서 제공.

## 15. 수용 테스트 목록

단순 UI 스냅샷만으로 완료 처리하지 않는다. 상태·권한·중복·원본 효과를 검증한다.

| ID | 상황 | 기대 결과 |
|---|---|---|
| A01 | 07:39:59 / 07:40:00 / 08:30:00 | 잠김 / 열림 / 잠김 |
| A02 | 태블릿 시간을 임의 변경 | 서버 시간 제한 유지 |
| A03 | PIN 5회 실패 후 다른 서버 인스턴스 호출 | 공유 rate limit 유지 |
| A04 | PIN 변경 후 기존 세션 API 요청 | 거절, 화면 잠금 |
| A05 | 아침 세션으로 점심 입력 | 거절 |
| A06 | 미등록 교사 로그인 | 앱 데이터 접근 거절 |
| A07 | 학생회가 teacher/bridge API 호출 | 거절 |
| A08 | 익명/일반 Supabase 토큰으로 테이블·RPC 호출 | 접근 거절 |
| A09 | 담당자 변경 후 옛 내역 조회 | 당시 명단 유지 |
| A10 | 동명이인 검색 | 학년·반·번호로 구분, 자동 부과 없음 |
| A11 | 점수·teacherId·날짜 payload 변조 | 거절 |
| A12 | 같은 버튼 연속 탭·동일 UUID 반복 | 원본 1건 |
| A13 | 두 태블릿, 다른 UUID, 같은 학생/항목/회차 | 한 건만 접수 |
| A14 | SQL 커밋 직후 프로세스 종료 | 영수증으로 복구, 추가 INSERT 없음 |
| A15 | 두 중계 동시 claim/lease 만료 재claim | 동일 원본 효과 1건 |
| A16 | queued 중 종료/긴급 중지 | 신규 쓰기 없음 |
| A17 | SQL 실행 중 종료 | 완료 여부 복구, 거짓 미전송 표시 없음 |
| A18 | DB 연결 실패지만 heartbeat 성공 | 입력 불가 |
| A19 | 배점/담당교사/학생 상태 변경 | 확인 필요, 잘못된 값 쓰기 없음 |
| A20 | 취소 승인 API 중복 호출 | 취소 job/원본 효과 1건 |
| A21 | 취소 권한 없음 | 교사 직접 처리 필요, 취소 완료 금지 |
| A22 | 다른 서비스가 만든 record ID로 취소 시도 | 거절 |
| A23 | 원본 취소 커밋 후 report 유실 | 취소 영수증으로 복구 |
| A24 | 실행 중 입력을 취소 요청 | 결과 확인 후 적절한 취소 경로 |
| A25 | 오래된 worker가 성공 뒤 실패 보고 | 성공 상태 유지 |
| A26 | 운영 token으로 preview 접근 | 환경/scope 불일치 거절 |
| A27 | PC 이전·토큰 폐기 후 기존 PC 실행 | 기존 PC 신규 작업 거절 |
| A28 | 인터넷 offline 후 복구 | 브라우저 대기 입력 자동 제출 없음 |
| A29 | blur 미지원·reduced motion·키보드 탐색 | 내용과 조작 유지 |
| A30 | 가상 키보드 열린 태블릿 | 검색/학생 확인/부과가 가려져 오조작하지 않음 |
| A31 | 카탈로그 업로드 중 실패 | 이전 완전 버전 유지, 부분 명단 노출 없음 |
| A32 | 일정 동시 저장 및 겹침 | DB 원자성으로 중복 활동 방지 |
| A33 | source scope 또는 payload hash 불일치 영수증 | 쓰기 차단, 운영 확인 필요 |
| A34 | 백업 복원 후 남은 큐 | 영수증 일치 검증 후 복구, 자동 무차별 재생 없음 |
| A35 | 초대받지 않은 계정/공개 회원가입 시도 | 등록 및 앱 접근 거절 |
| A36 | 만료·철회·재발급 이전 초대 수락 | 거절, 계정 활성화 없음 |
| A37 | 초대 정상 수락 후 이메일·비밀번호 로그인 | teacher 권한으로 활성화, 관리자 자동 승격 없음 |
| A38 | 마지막 관리자 정지/강등 또는 teacher의 초대 시도 | 거절 |
| A39 | 비밀번호 재설정 만료·재사용 및 미등록 이메일 입력 | provider 검증에 따라 거절, 계정 존재 여부 비노출 |

검증 보고서에는 각 테스트의 실행 환경과 pass/fail/not-run을 기록한다. 실제 학교 DB에서 실행하지 않은 테스트를 mock 통과로 대신 표시하지 않는다.

## 16. 환경변수·배포·개인정보 운영

### 16.1 서버 환경 예시 이름

```dotenv
APP_ENV=development
APP_BASE_URL=http://localhost:3000
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
PIN_PEPPER=
BOOTSTRAP_ADMIN_EMAIL=
SOURCE_SCOPE=hguni-development
REAL_WRITES_ENABLED=false
```

이름은 사용 SDK에 맞춰 확정한다. publishable 외 secret 계열에는 NEXT_PUBLIC 접두사를 붙이지 않는다. 예시에는 실제 값 금지. 학교 SQL host/user/password는 이 Vercel 설정에 넣지 않고 중계 PC에만 저장한다.

중계 설정 항목: API base URL, bridge token, source scope, SQL host/database/port/user/password, TLS 검증 설정, 실행 모드, polling/health 값. 인증서 검증을 무조건 해제하는 예제를 기본값으로 제공하지 않는다.

### 16.2 배포 순서

1. hguni 전용 Supabase 프로젝트 및 Auth redirect URL 설정. 기존 프로젝트 연결 금지.
2. migration/RLS 적용, bootstrap admin, 공개 회원가입 차단 확인.
3. GitHub hguni가 private인지 확인. 비공개라고 비밀/학생 데이터를 올려도 되는 것은 아니다.
4. Vercel에 hguni 연결, Node/빌드 설정과 production 환경변수 지정.
5. preview는 시험 DB/시험 token/mock만 사용. 학교 운영 중계가 preview를 polling하지 못하게 source_scope/APP_ENV 대조.
6. Vercel 배포 후 교사 로그인/세션 cookie/Origin 검증/캐시 차단 확인.
7. 학교 PC 패키지 설치·새 token·DB scope/권한/영수증 확인.
8. 최소 명단 동기화 → 담당교사/활동/PIN 설정.
9. 허가된 시험 데이터로 입력·실제 취소 또는 수동 확인 경로 검증.
10. 운영 활성화, 첫 활동 종료 후 원본·앱 이력 대조.

유료 플랜/리소스 구매가 필요하면 비용과 대상을 구체적으로 확인받는다. 저장소 인증이나 서비스 접속 정보가 없을 때는 배포 URL을 지어내지 않는다.

### 16.3 로그와 복구

- 학생회에는 누적 점수·연락처·전체 학생 명단 다운로드를 제공하지 않는다.
- 로그에는 request/job ID·상태·오류 code 위주. PIN/token/password/전체 SQL payload 금지.
- 브라우저 캐시·analytics·오류 수집에 이름/학번/인증값을 포함하지 않는다.
- 기술 로그 보관 기본 30일로 제안한다. 감사/부과 이력과 학생 카탈로그의 실제 보관기간은 학교 운영 방침 확인 후 정하며 임의 법정기간을 단정하지 않는다.
- 학생 이름 등은 필요한 snapshot만 보관. 업무 중복/재시도용 영수증은 요청 재생 가능 기간보다 짧게 삭제하지 않는다.
- rollback은 새 접수 중지 → 진행 건 복구 → 이전 앱/중계 버전 복원 → 호환 migration 확인 순서. 원본 벌점을 일괄 삭제하는 것을 롤백으로 사용하지 않는다.
- README에는 DB/중계가 준비되지 않아도 mock로 화면을 실행하는 정확한 명령을 제공한다.

## 17. Git 커밋·푸시 요구사항

**구현 담당 AI는 구현과 검증을 마친 뒤 `https://github.com/kdyhg/hguni.git`에 변경사항을 커밋하고 푸시한다.** 사용자 요청에 포함된 작업이므로 안내만 하고 끝내지 않는다. 이 문서는 향후 구현자에게 그 작업을 지시하는 것이며, 계획 작성 자체에서 구현 커밋이나 배포를 수행했다는 뜻은 아니다.

1. 실제 새 작업 폴더에서 `git status`, `git remote -v`, branch, 원격 이력을 확인한다.
2. origin이 없으면 hguni를 등록한다. 다른 remote가 있으면 저장소가 맞는지 확인하고 관련 없는 저장소를 덮어쓰지 않는다.
3. 원격에 기존 커밋이 있으면 fetch 후 그 이력에서 작업한다. force push 금지.
4. 기본 작업 브랜치는 `codex/hguni-morning-guidance`로 만들고 원격 기본 브랜치 보호 규칙을 따른다.
5. `.gitignore`에 `.env*`(example 예외), node_modules, .next, 로그, 실제 로컬 설정, 덤프, 실데이터, 인증값을 추가한다. 필요한 예시 파일만 추적한다.
6. 단계별 의미 있는 커밋을 만들고 최종 diff에서 비밀/개인정보/기존 프로젝트 파일이 섞이지 않았는지 확인한다.
7. 프로젝트에 정의한 typecheck/lint/test/build 및 필요한 통합/E2E를 실행한다. 실행 못한 항목은 명시한다.
8. `git push -u origin codex/hguni-morning-guidance` 등 실제 브랜치에 push하고 `git ls-remote`로 SHA 일치를 확인한다.
9. Vercel production branch가 기본 브랜치인 경우 feature push만으로 production 배포했다고 하지 않는다. 보호 규칙에 따라 PR 또는 허용된 병합 경로를 사용하며 필요한 단계와 현재 배포를 구분한다.
10. PR을 만들었다면 URL을 제공한다. 인증 오류/원격 권한 부족이면 로컬 커밋까지 완료하고 정확한 오류와 필요한 연결 절차를 보고한다.

## 18. 완료 보고서와 구현자용 최종 지시

최종 인계물:

- 실행 가능한 새 웹앱 및 학교 PC 중계 소스/패키지 생성 스크립트.
- SQL migrations, hguni 전용 원본 영수증 스키마, 권한 검사 도구.
- 원문 디자인 문서와 적용된 실제 화면.
- 설치/환경설정/Vercel 배포/PC 이전/장애복구/취소 운영 설명서.
- `acceptance-report.md`: 실행한 테스트, 스크린샷, 실제 학교 연결 및 취소 검증 여부.
- 커밋 SHA·push 브랜치·GitHub URL·실제 배포 URL/상태.
- 미완료가 있다면 원인과 필요한 값/권한/다음 명령을 구체적으로 명시.

구현 담당 AI는 다음 지시를 그대로 작업의 기준으로 삼는다.

> 이 계획과 별도 첨부한 liquid_optical_glass_design_system_improved.md를 모두 읽고 유니쿨 아침선도 독립 사이트를 구현하세요. 기존 교사용 유니쿨 사이트의 파일이나 운영 설정을 수정하지 마세요. 학생회 화면은 교사 PIN 잠금 해제 → 담당자 이름 등록 → 학생 검색 → 항목 선택 → 큰 부과 버튼이라는 단순한 흐름으로 만드세요. Vercel·독립 DB·학교 Windows PC 중계 구조를 사용하고, 원본 영수증을 통한 중복 방지와 실제 상태에 근거한 취소를 구현하세요. 단계별 통과 조건과 수용 테스트를 검증하고 설치·이전 문서를 작성한 다음 https://github.com/kdyhg/hguni.git에 커밋하고 푸시하세요. 서비스 연결이 준비되면 배포까지 진행하고, 없는 자격증명이나 검증하지 않은 운영 결과를 임의로 성공 처리하지 마세요. 완료된 코드와 남은 외부 설정을 구분해 인계하세요.
