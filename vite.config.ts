import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// QA เป็น module หนึ่งของ EDMS: อยู่ที่ /qa/ หลัง auth-web (เหมือน /pe/)
// npm run dev → http://localhost:5176/qa/ (โหมด local)
// โหมด gateway ให้เปิดผ่าน http://localhost:5173/qa/ — auth-web จะ proxy /qa มาที่ port นี้
// port 5176: 5173 = auth-web, 5174 = pe-web, 5175 = frontend
//
// /api ถูกส่งต่อไปที่ backend (Go Fiber, :7072) — origin เดียวกันกับหน้าเว็บ จึงไม่ติด CORS
// และ cookie session ที่ได้จากการ login ที่ portal (:5175) ถูกแนบไปด้วย (cookie ของ localhost ใช้ร่วมกันทุก port)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const api = env.API_PROXY_TARGET || 'http://localhost:7072' // SERVER_PORT ใน backend/.env

  return {
    base: '/qa/',
    plugins: [
      tailwindcss(),
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    server: {
      port: 5176,
      strictPort: true,
      proxy: {
        '/api': { target: api },
      },
    },
  }
})
