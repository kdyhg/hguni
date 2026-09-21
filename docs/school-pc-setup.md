# 학교 PC와 유니쿨 중계 설정

## 중계 설정

1. 교사 설정에서 일회 표시되는 bridge token을 발급한다.
2. `bridge/config/config.example.json`을 `config.local.json`으로 복사한다.
3. `apiBaseUrl`은 `http://127.0.0.1:3000`, `sourceScope`는 `.env.local`과 동일하게 입력한다.
4. token과 SQL host/database/user/password를 입력한다.
5. 처음에는 `schemaVerified=false`, `realWritesEnabled=false`, `cancellationVerified=false`를 유지한다.
6. DBA와 `bridge/verify-permissions.sql`, `bridge/receipt.sql`을 검토한다.
7. 조회·카탈로그 동기화를 검증한 뒤 `schemaVerified=true`로 바꾼다.
8. 승인된 시험 학생으로 입력·영수증·재시도를 검증한 뒤에만 앱과 중계의 실제 쓰기 스위치를 모두 켠다.
9. 취소는 DELETE·트리거·집계 영향을 별도로 검증한 뒤 `cancellationVerified=true`로 바꾼다.

`서버시작.cmd`는 `config.local.json`이 있을 때 중계를 함께 시작합니다. 중계가 없거나 설정이 잘못되면 웹 서버는 실행되지만 학생회 화면은 안전하게 잠깁니다.

## 폴더

| 경로 | 내용 | 이전/백업 |
|---|---|---|
| `data/hguni.db` | 앱 운영 원본 | 필수 |
| `backups/` | 최근 SQLite 백업 30개 | 권장 |
| `.env.local` | 로컬 환경·비밀값 | 안전하게 별도 이전 |
| `bridge/config/config.local.json` | SQL·중계 비밀값 | 안전하게 별도 이전 |
| `config/google-service-account.json` | 선택적 Google 키 | 사용 시 별도 이전 |
| `logs/` | 진단 로그 | 선택 |

비밀 파일은 실행 계정과 관리자만 읽도록 Windows ACL을 제한하고 ZIP·Git·메신저에 올리지 않는다.
