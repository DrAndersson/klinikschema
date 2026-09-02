import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import Jourkalender from '@/app/page';
import '@/app/globals.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Appens rot-element saknas.');
}

createRoot(root).render(
  <StrictMode>
    <Jourkalender />
  </StrictMode>,
);
