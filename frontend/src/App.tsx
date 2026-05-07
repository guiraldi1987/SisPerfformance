import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './pages/Layout';
import { ThemeProvider } from './theme';
import { ErrorBoundary } from './components/ErrorBoundary';

const SessaoDashboard = React.lazy(() => import('./pages/SessaoDashboard').then(m => ({ default: m.SessaoDashboard })));
const Jogadores       = React.lazy(() => import('./pages/Jogadores').then(m => ({ default: m.Jogadores })));
const Upload          = React.lazy(() => import('./pages/Upload').then(m => ({ default: m.Upload })));
const JogadorPerfil   = React.lazy(() => import('./pages/JogadorPerfil').then(m => ({ default: m.JogadorPerfil })));

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="flex items-center justify-center h-screen text-slate-500">Carregando…</div>}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/upload" replace />} />
                <Route path="/sessao/:id"  element={<SessaoDashboard />} />
                <Route path="/jogadores"   element={<Jogadores />} />
                <Route path="/jogador/:id" element={<JogadorPerfil />} />
                <Route path="/upload"      element={<Upload />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
