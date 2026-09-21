# 중계 PC 이전

1. 교사가 활동을 긴급 중지하고 queued/executing/uncertain 목록을 확인한다.
2. 기존 PC에서 `Stop.ps1`로 신규 claim을 멈춘다. 진행 건은 `HguniReceipt`로 결과를 수렴시킨다.
3. 기존 `HguniMorningBridge` 작업을 제거한다.
4. 같은 승인 commit의 비밀 없는 패키지만 새 PC로 복사한다.
5. 새 bridge token을 발급하고 새 PC에서 SQL 자격증명을 다시 입력한다. OS 암호화 비밀을 복사해 재사용하지 않는다.
6. 기존 token을 비활성화한다.
7. 새 PC에서 외부 HTTPS, 내부 SQL, source scope, 영수증, 최소 권한을 검사한다.
8. 같은 원본 DB와 `HguniReceipt`가 유지되는지 확인한다. DB까지 바뀌면 단순 PC 이전으로 처리하지 않는다.
9. uncertain 요청은 기존 request ID로 reconcile하고 새 ID로 복제하지 않는다.
10. 자동 시작과 재부팅을 검증한 뒤 활동을 재개한다.

Vercel 주소, Supabase 데이터, 활동 설정과 이력은 PC 이전으로 바뀌지 않는다.
