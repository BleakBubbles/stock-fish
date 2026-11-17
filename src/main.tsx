import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyThemeToDocument } from './theme/css';
import { App } from './App';
import './index.css';

applyThemeToDocument(document.documentElement);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
