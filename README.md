# Personal Expense Tracker

## 핵심 기능

- 회원가입 / 로그인
- 수입·지출 등록
- 거래 수정 / 삭제
- 카테고리 설정
- 월별 내역 조회
- 월별 총수입 / 총지출 / 잔액
- 카테고리별 지출 통계

## 문서

| | |
|---|---|
| [docs/기획서.md](docs/기획서.md) | 화면·기능 명세와 판단 근거 |
| [docs/설계.md](docs/설계.md) | 데이터 모델 · RLS · DB 함수 · 프론트 구조 |
| [e2e/README.md](e2e/README.md) | 검증 실행 방법 |

## 실행

```bash
npm install
cp .env.example .env.local          # Supabase URL / anon key
npm run dev                         # http://localhost:5173
```

Supabase 프로젝트에는 `supabase/migrations/` 의 SQL 을 번호 순서대로 실행한다.

## 검증

```bash
npx playwright install chromium         # 한 번만
cp .env.test.example .env.test.local    # 테스트 전용 계정

npm run test:e2e     # 통합 검증 67건 × 3회
npm run test:ux      # 사용성 — 탭 수와 마찰 측정
```

개발 서버가 떠 있어야 한다. 테스트는 계정을 초기화하므로 **전용 계정**을 쓴다.
자세한 내용은 [e2e/README.md](e2e/README.md).

## 배포

`main` 에 push 하면 GitHub Actions 가 검증을 돌린 뒤 Cloudflare Pages 로 올린다
([.github/workflows/ci.yml](.github/workflows/ci.yml)). 서버 코드가 없어서 올리는 것은
`dist/` 뿐이다. 프로젝트는 첫 배포에서 자동으로 만들어진다.

**한 번만 할 일 — 리포지터리 시크릿 4개** (Settings → Secrets and variables → Actions)

| 시크릿 | 어디서 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | 같은 화면 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 대시보드 우측 (또는 URL 의 해시) |
| `CLOUDFLARE_API_TOKEN` | My Profile → API Tokens → **Cloudflare Pages: Edit** 권한 |

하나라도 비면 배포 잡이 **시작 단계에서 멈춘다.** Vite 는 빌드 시점에 값을 끼워 넣으므로
빈 채로 올리면 "설정이 필요합니다" 화면만 뜨는 앱이 배포되고 나중에 고칠 수 없다.
anon key 는 공개돼도 되는 값이다 — 데이터 격리는 RLS 가 강제한다 ([docs/설계.md](docs/설계.md)).

`pages.dev` 주소는 워크플로의 `PROJECT` 이름에서 나온다. 전역으로 유일해야 해서 이미
쓰이는 이름이면 프로젝트 생성이 실패한다 — 그 한 줄만 고친다.

**배포 후 Supabase 에 Redirect URL 을 등록한다** (Authentication → URL Configuration).
등록하지 않으면 인증·재설정 메일의 링크가 `localhost` 로 가서 가입을 끝낼 수 없다.

**이메일 인증이 필수인데 Supabase 기본 메일 발송은 개발용이다.** 시간당 발송 수가
적게 제한돼 있어 여러 명이 가입하면 메일이 가지 않는다. 실사용자를 받으려면
Authentication → Emails 에서 커스텀 SMTP(Resend·SendGrid 등)를 붙인다.

`public/_redirects` 가 SPA 폴백을 담당한다. 없으면 메일 링크(`/reset-password`)와
새로고침이 404 가 된다.

`public/guide.html` 은 앱을 설명하는 정적 페이지다. 로그인 전 화면과 설정에서
링크한다 ([src/lib/links.ts](src/lib/links.ts)). 라우터가 다루지 않으므로 `/guide.html` 로
바로 열린다.

## 스택

Vite · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query · React Router ·
Supabase (PostgreSQL + Auth + RLS). 서버 코드는 없다 — 브라우저가 RLS 가 걸린 DB 를
직접 호출한다.
