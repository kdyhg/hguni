# 배포 안내

## 1. 전용 Supabase

1. 기존 서비스와 분리된 프로젝트를 만든다.
2. `supabase/migrations/001_core.sql`부터 `005_access_control.sql`까지 순서대로 적용한다.
3. 프로젝트 DB 설정에 `app.source_scope`를 운영 `SOURCE_SCOPE`와 동일하게 지정한다.
4. 공개 회원가입을 끄고 Site URL과 `/teacher/accept-invite`, `/teacher/reset-password` redirect URL을 allowlist에 등록한다.
5. SQL 검사에서 `anon`/`authenticated`가 앱 테이블과 RPC를 직접 실행할 수 없는지 확인한다.
6. Dashboard에서 최초 관리자 이메일을 초대하고 이메일 확인 뒤 `npm run bootstrap-admin`을 한 번 실행한다.

## 2. Vercel

GitHub의 private `kdyhg/hguni` 저장소를 새 Vercel 프로젝트에 연결한다. 운영 환경변수:

```dotenv
APP_ENV=production
APP_BASE_URL=https://실제주소
USE_MOCK_DATA=false
NEXT_PUBLIC_SUPABASE_URL=https://프로젝트.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_URL=https://프로젝트.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
PIN_PEPPER=서로다른-고엔트로피-비밀값
BOOTSTRAP_ADMIN_EMAIL=최초관리자@학교도메인
SOURCE_SCOPE=hguni-production-school-a
REAL_WRITES_ENABLED=false
```

`SUPABASE_SECRET_KEY`, `PIN_PEPPER`에는 `NEXT_PUBLIC_`을 붙이지 않는다. 학교 SQL host/user/password는 Vercel에 넣지 않는다. Preview에는 별도 Supabase와 별도 scope·token만 사용하며 운영 중계가 Preview를 poll하지 못하게 한다.

## 3. 활성화 순서

1. 배포 후 교사 로그인·쿠키·Origin 검사·`Cache-Control: no-store` 확인
2. 설정에서 bridge token을 한 번 발급하고 즉시 학교 PC에 저장
3. 학교 PC 연결 검사, 카탈로그 업로드, 담당교사 선택
4. 활동시간·허용항목·PIN 저장
5. 허가된 시험 학생으로 입력과 영수증 복구 확인
6. 자동 취소가 검증되지 않았으면 수동 확인 상태 유지
7. 운영 검증을 마친 뒤에만 Vercel `REAL_WRITES_ENABLED`와 학교 PC `realWritesEnabled`를 승인 절차에 따라 변경

이 저장소에는 실제 Supabase/Vercel 자격증명이 없어 이 세션에서 원격 서비스 배포를 수행하지 않았다.
