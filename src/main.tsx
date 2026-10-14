import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import { router } from './routes';
import { antdTheme } from './theme/antdTheme';
import './styles/globals.css';
import { USE_GATEWAY_AUTH } from './lib/auth';

// โหมด gateway ตอน dev: ถ้าเปิด QA ตรงที่ port ของตัวเอง (:5176) จะไม่มี /api/auth → ย้ายไปเปิดผ่าน gateway (auth-web)
const GATEWAY = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:5173';
if (import.meta.env.DEV && USE_GATEWAY_AUTH && window.location.origin !== new URL(GATEWAY).origin) {
  window.location.replace(GATEWAY + window.location.pathname + window.location.search);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={antdTheme} locale={enUS}>
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
