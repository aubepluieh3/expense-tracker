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

## 스택

Vite · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query · React Router ·
Supabase (PostgreSQL + Auth + RLS). 서버 코드는 없다 — 브라우저가 RLS 가 걸린 DB 를
직접 호출한다.
