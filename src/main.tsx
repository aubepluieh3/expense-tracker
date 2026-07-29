import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'
import { AuthProvider } from '@/auth/AuthProvider'
import { queryClient } from '@/lib/queryClient'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/*
        배포본은 하위 경로에 있다 (aubepluieh3.github.io/expense-tracker/).
        basename 이 없으면 라우터가 '/expense-tracker/stats' 를 어떤 라우트에도
        못 맞춰서 첫 화면부터 빈 화면이 된다. BASE_URL 은 Vite 가 넣어 주므로
        dev('/')와 배포가 저절로 맞는다 (vite.config.ts).
      */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
