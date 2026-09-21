# 학교 PC 중계 설치

## 사전 조건

- Node.js 22 이상 또는 학교가 검증한 고정 포터블 런타임
- 학교 PC에서 Vercel 주소로 outbound HTTPS 가능
- UniCool SQL Server로 TLS 연결 가능
- `dbo.HguniControl`, `dbo.HguniReceipt` 생성 및 최소 권한 검토 완료
- 원본 스키마·트리거·백업 정책 검증 완료

## 설치

1. 승인된 release/commit의 저장소를 공백·한글 경로에서도 접근 가능한 로컬 폴더에 둔다.
2. `npm ci --omit=dev` 또는 조직이 검증한 패키지를 설치한다.
3. `bridge/config/config.example.json`을 `config.local.json`으로 복사한다.
4. API 주소, 일회 표시 bridge token, source scope, SQL 연결값을 입력한다. 실제 설정은 Git/ZIP에 넣지 않는다.
5. 초기에는 `schemaVerified=false`, `realWritesEnabled=false`, `cancellationVerified=false`를 유지한다.
6. DBA와 `bridge/verify-permissions.sql` 결과를 확인하고 `bridge/receipt.sql`을 검토 적용한다.
7. 조회 전용 연결을 먼저 확인한 뒤 승인된 시험 DB에서 `schemaVerified=true`로 바꿔 `Check-Connection.ps1`을 실행한다.
8. 입력 원자성·영수증 복구를 확인한 뒤에만 `realWritesEnabled=true`로 바꾼다.
9. 취소는 별도 삭제 정책·트리거·집계를 검증한 뒤에만 `cancellationVerified=true`로 바꾼다.
10. `Install-Task.ps1`로 `HguniMorningBridge` 자동 시작 작업을 등록하고 재부팅 후 heartbeat를 확인한다.

## 로그와 비밀

로그는 `bridge/logs`, PID 등 보조 상태는 `bridge/state`에 둔다. 로그에 학생 전체 payload, PIN, token, SQL password를 출력하지 않는다. Windows ACL로 실제 설정 파일을 실행 계정과 관리자만 읽게 제한한다. 인바운드 포트나 공인 IP는 필요하지 않다.
