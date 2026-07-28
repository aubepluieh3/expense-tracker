import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
})
