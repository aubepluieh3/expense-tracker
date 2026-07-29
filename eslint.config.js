import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

/**
 * 규칙 선택 기준: **사람이 리뷰에서 반복해서 잡게 되는 것만** 켠다.
 *
 * 스타일은 하나도 켜지 않는다 — 들여쓰기·따옴표·줄바꿈은 Prettier 가 정한다.
 * 마지막에 prettier 설정을 넣어 겹치는 규칙을 끈다. 둘이 같은 것을 두고
 * 다투면 저장할 때마다 파일이 왕복한다.
 *
 * 타입 정보를 쓰는 규칙(recommendedTypeChecked)을 켠 이유는 floating promise 다.
 * 이 앱은 mutateAsync 와 supabase 호출이 곳곳에 있어서, await 을 빼먹으면
 * 에러가 조용히 사라진다 — 실패가 성공처럼 보이는 종류의 버그이고, 실제로
 * 이 저장소가 커밋 두 개를 그걸 고치는 데 썼다(catch 없는 삭제, 닫고 나서 await).
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '*.tsbuildinfo'] },

  // ── 앱 소스 (타입 정보 사용)
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, prettier],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // 컴포넌트 파일에서 컴포넌트 아닌 것을 export 하면 HMR 이 깨진다.
      // 상수 export 는 이 저장소가 의도적으로 쓴다(TYPE_OPTIONS, rowClass, HANDLED).
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // 미사용 변수는 에러. _ 로 시작하는 것만 허용한다 —
      // onError: (_err, _vars, ctx) 처럼 자리를 비울 수 없는 콜백 인자가 있다.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // void 로 명시한 것은 통과시킨다. 이 저장소는 이미 `void mutate()` 로
      // "결과를 안 기다린다"를 표시하는 습관이 있다.
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],

      // onClick={() => void foo()} 를 쓰는 이유가 이 규칙이다. 켜 둔다.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },

  // ── 검증 스크립트 (Node, 타입 정보 없음)
  {
    files: ['e2e/**/*.mjs'],
    extends: [js.configs.recommended, prettier],
    languageOptions: {
      globals: globals.node,
    },
  },

  // ── 설정 파일
  {
    files: ['*.config.{js,ts}'],
    extends: [js.configs.recommended, prettier],
    languageOptions: { globals: globals.node },
  },
)
