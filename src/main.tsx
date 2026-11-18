import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyThemeToDocument } from './theme/css';
import { App } from './App';
import { PixelScaleProvider } from './ui/pixel/PixelScaleProvider';
import './index.css';
import { watchInstall } from './ui/install';

applyThemeToDocument(document.documentElement);
watchInstall();

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <PixelScaleProvider>
      <App />
    </PixelScaleProvider>
  </StrictMode>,
);
