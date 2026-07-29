import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * GitHub Pages 프로젝트 사이트의 하위 경로.
 *
 * 주소가 aubepluieh3.github.io/expense-tracker/ 라서 에셋과 라우터가 이 접두사를
 * 알아야 한다. 리포지터리 이름에서 오는 값이므로 **레포 이름을 바꾸면 여기도 바꾼다.**
 *
 * 개발 서버는 '/' 로 남긴다. dev 까지 하위 경로로 옮기면 e2e(E2E_BASE_URL 기본값
 * http://localhost:5173)와 로컬 Redirect URL 이 한꺼번에 어긋난다. 앱 코드는 이 값을
 * 직접 읽지 않는다 — import.meta.env.BASE_URL 로 받으므로 dev·배포가 저절로 맞는다.
 */
const BASE = '/expense-tracker/'

/**
 * SPA 폴백.
 *
 * GitHub Pages 는 Cloudflare 의 _redirects 를 모르고 리라이트 규칙을 줄 방법도 없다.
 * 대신 404.html 이 있으면 없는 경로 요청에 그 파일을 응답하면서 **주소는 그대로 둔다** —
 * 앱 껍데기를 거기 놓으면 라우터가 이어받아 정상 화면이 된다.
 *
 * 빌드 산출물을 복사해야 한다. public/404.html 로 둘 수 없다 — 에셋 파일명에 붙는
 * 해시가 빌드마다 바뀌므로 그 순간의 index.html 만이 올바른 참조를 갖는다.
 *
 * 이게 없으면 주소를 직접 열거나 새로고침할 때 404 다. 특히 비밀번호 재설정과
 * 이메일 인증은 메일 링크가 곧 첫 요청이라(/reset-password) 기능 자체가 죽는다.
 */
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
    },
  }
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  plugins: [react(), tailwindcss(), spaFallback()],
  server: {
    // 포트를 고정한다. Vite 기본 동작은 포트가 막혔을 때 조용히 다음 번호로 옮겨가는데,
    // 그러면 Supabase 에 등록한 Redirect URL 과 어긋나서 인증 메일 링크가 엉뚱한 곳으로 간다.
    // strictPort 를 켜면 옮기는 대신 에러로 알려주므로 어긋난 채 돌아가는 일이 없다.
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
