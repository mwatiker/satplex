import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import AppOptimized from './AppOptimized.tsx'
import TestSpinner from './components/TestSpinner';
import { HelmetProvider } from 'react-helmet-async'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppOptimized />} />
          <Route path="/satellite/:noradId" element={<AppOptimized />} />
          <Route path="/spinner" element={<TestSpinner />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
