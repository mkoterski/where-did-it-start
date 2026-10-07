import '@fontsource/great-vibes/400.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/sacramento/400.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
