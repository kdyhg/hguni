# 로컬 서버 PC 이전

1. 교사가 긴급 중지하고 queued/executing/uncertain 건을 확인한다.
2. `서버종료.cmd`로 웹·중계·Sheets worker를 종료한다.
3. `데이터백업.cmd`로 만든 최신 백업과 `data/hguni.db`를 확인한다.
4. 새 PC에 동일한 승인 commit의 프로그램 폴더를 복사한다.
5. `data/hguni.db`, `.env.local`, 중계 설정, 사용 시 Google 키를 안전한 매체로 옮긴다.
6. 새 PC의 고정 IP가 달라졌다면 `.env.local`의 `APP_BASE_URL`을 수정한다.
7. `npm install`, `npm run build` 또는 `최초설치.cmd`를 실행한다. 기존 DB가 있으면 초기화하지 않는다.
8. `방화벽허용.cmd`, `서버시작.cmd`, `서버상태.cmd`를 실행한다.
9. 학생 검색·교사 로그인·카탈로그·영수증 조회를 확인한다.
10. 자동 시작을 새 PC에 등록하고, 기존 PC에서는 `자동시작해제.cmd`를 실행한다.

서버가 완전히 종료된 상태에서는 프로그램 폴더 전체 복사가 가능하다. 실행 중 백업은 단순 파일 복사 대신 `데이터백업.cmd`를 사용해야 WAL 내용까지 일관되게 보존된다.
