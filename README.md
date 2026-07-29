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

https://aubepluieh3.github.io/expense-tracker/

`main` 에 push 하면 GitHub Actions 가 검증을 돌린 뒤 GitHub Pages 로 올린다
([.github/workflows/ci.yml](.github/workflows/ci.yml)). 서버 코드가 없어서 올리는 것은
`dist/` 뿐이다.

**Pages 를 고른 이유는 배포에 외부 자격 증명이 필요 없다는 것이다.** 워크플로가 그
실행에만 주어지는 OIDC 토큰으로 인증하므로, 호스팅 업체 계정을 만들고 API 토큰을
시크릿에 넣는 단계가 사라진다.

**한 번만 할 일 — 리포지터리 시크릿 2개** (Settings → Secrets and variables → Actions)

| 시크릿 | 어디서 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | 같은 화면 |

하나라도 비면 배포 잡이 **시작 단계에서 멈춘다.** Vite 는 빌드 시점에 값을 끼워 넣으므로
빈 채로 올리면 "설정이 필요합니다" 화면만 뜨는 앱이 배포되고 나중에 고칠 수 없다.
anon key 는 공개돼도 되는 값이다 — 데이터 격리는 RLS 가 강제한다 ([docs/설계.md](docs/설계.md)).

### 하위 경로

프로젝트 사이트라 주소가 `/expense-tracker/` 아래에 있다. [vite.config.ts](vite.config.ts) 의
`BASE` 한 곳에서 정하고, 앱은 `import.meta.env.BASE_URL` 로 받는다 — 라우터 `basename`,
`authRedirectTo`, 설명서 링크가 모두 그 값을 쓰므로 dev(`/`)와 배포가 저절로 맞는다.
**레포 이름을 바꾸면 `BASE` 도 바꾼다.**

SPA 폴백은 `dist/404.html` 이다. Pages 는 리라이트 규칙을 줄 수 없어서, 빌드가
`index.html` 을 복사해 둔다([vite.config.ts](vite.config.ts) 의 `spaFallback`). 없으면
새로고침과 메일 링크(`/reset-password`)가 죽는다. 대가로 딥 링크는 화면이 정상이어도
HTTP 상태가 404 다 — Pages 에서 피할 수 없다.

### 대시보드에서 할 일

**Supabase Redirect URL 등록** (Authentication → URL Configuration). 등록하지 않으면
인증·재설정 메일의 링크가 엉뚱한 곳으로 가서 가입을 끝낼 수 없다.

```
https://aubepluieh3.github.io/expense-tracker/**
http://localhost:5173/**
```

**이메일 인증이 필수인데 Supabase 기본 메일 발송은 개발용이다.** 시간당 발송 수가
적게 제한돼 있어 여러 명이 가입하면 메일이 가지 않는다. 실사용자를 받으려면
Authentication → Emails 에서 커스텀 SMTP(Resend·SendGrid 등)를 붙인다.

### 설명서 페이지

`public/guide.html` 은 앱을 설명하는 정적 페이지다. 로그인 전 화면과 설정에서
링크한다 ([src/lib/links.ts](src/lib/links.ts)). 라우터가 다루지 않으므로 `guide.html` 로
바로 열리고, 로그인 없이 볼 수 있다.

## 스택

Vite · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query · React Router ·
Supabase (PostgreSQL + Auth + RLS). 서버 코드는 없다 — 브라우저가 RLS 가 걸린 DB 를
직접 호출한다.
