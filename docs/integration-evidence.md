# 유니쿨 연동 근거

작성일: 2026-09-22. 이 문서는 기존 프로젝트를 읽기 전용으로 확인한 결과와 새 구현에서 아직 운영 검증이 필요한 사항을 분리한다.

## 확인한 근거

| 항목 | 확인 내용 | 새 구현 |
|---|---|---|
| 부과 교사 | `merit.t_id = teacher.key_num` | snapshot과 원본 재조회에 `teacherSourceId` 사용 |
| 학생 키 | `merit.st_id = student.st_id` | 이름·학년반번호가 아닌 `source_id` 사용 |
| 벌점 항목 | `merit_sel='D'`, 코드와 구분 동시 식별 | `D:<code>` 키와 원본 항목 재검증 |
| 배점 | 원본 부호 보존 | 브라우저 점수 입력을 거부하고 동기화 snapshot 사용 |
| 입력 열 | 날짜·시간·학생·구분·코드·내용·점수·교사·비고·class·작업일 | 매개변수화 INSERT에 반영 |
| 취소 | 기존 클라이언트는 기록 key로 물리 삭제 | 이 앱이 만든 record ID·학생·원래 교사·항목을 모두 대조 |
| 중복 방지 | 기존 웹 영수증 패턴은 원본 INSERT와 같은 트랜잭션 | 별도 `dbo.HguniReceipt` 사용, 기존 `UniCoolWebReceipt` 미변경 |

참조한 로컬 파일은 `C:/Users/user/Documents/ChatGPT/유니쿨`의 `README.md`, `docs/integration.md`, `bridge/adapter.ts`, `bridge/sqlserver.ts`, `bridge/receipt.sql`, `bridge/writer-permissions.ts`다. 파일을 복사하거나 변경하지 않았다.

## 확인하지 않은 운영 사실

- 실제 `merit`, `student`, `teacher`, `meritcode` 열의 자료형·길이·NULL·identity
- 서버 트리거, 참조 제약, 감사, 집계 후속 처리
- `class`의 정확한 학적 의미와 진급/이월 범위
- 운영 DB 계정의 영수증 DDL·INSERT·DELETE 최소 권한
- 삭제가 교정점수·집계·학교 정책에 미치는 영향
- 실제 학교망의 SQL TLS 인증서와 외부 HTTPS 접근

이 항목을 확인하기 전 `schemaVerified`, `realWritesEnabled`, `cancellationVerified`를 true로 설정하지 않는다. 실제 학교 DB 연결이나 쓰기는 이 구현 세션에서 수행하지 않았다.
