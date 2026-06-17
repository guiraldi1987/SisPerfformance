import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './pages/Layout';
import { ThemeProvider } from './theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './components/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { installFetchInterceptor } from './lib/authClient';

// Patch global no fetch — injeta Authorization e trata 401. Único side-effect
// no boot do app; tem que rodar ANTES de qualquer chamada à API.
installFetchInterceptor();

const SessaoDashboard = React.lazy(() => import('./pages/SessaoDashboard').then(m => ({ default: m.SessaoDashboard })));
const Jogadores       = React.lazy(() => import('./pages/Jogadores').then(m => ({ default: m.Jogadores })));
const Upload          = React.lazy(() => import('./pages/Upload').then(m => ({ default: m.Upload })));
const JogadorPerfil   = React.lazy(() => import('./pages/JogadorPerfil').then(m => ({ default: m.JogadorPerfil })));
const Painel          = React.lazy(() => import('./pages/Painel').then(m => ({ default: m.Painel })));
const Sessoes         = React.lazy(() => import('./pages/Sessoes').then(m => ({ default: m.Sessoes })));
const Comparar        = React.lazy(() => import('./pages/Comparar').then(m => ({ default: m.Comparar })));
const Usuarios        = React.lazy(() => import('./pages/Usuarios').then(m => ({ default: m.Usuarios })));
const Backups         = React.lazy(() => import('./pages/Backups').then(m => ({ default: m.Backups })));
const NotFound        = React.lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const Login           = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <Suspense fallback={<div className="flex items-center justify-center h-screen text-slate-500">Carregando…</div>}>
                <Routes>
                  {/* Rota pública */}
                  <Route path="/login" element={<Login />} />

                  {/* Rotas protegidas — Layout só renderiza com sessão válida */}
                  <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="/painel" replace />} />
                    <Route path="/painel"      element={<Painel />} />
                    <Route path="/sessoes"     element={<Sessoes />} />
                    <Route path="/sessao/:id"  element={<SessaoDashboard />} />
                    <Route path="/jogadores"   element={<Jogadores />} />
                    <Route path="/jogador/:id" element={<JogadorPerfil />} />
                    <Route path="/upload"      element={<Upload />} />
                    <Route path="/comparar"    element={<Comparar />} />
                    <Route path="/usuarios"    element={<Usuarios />} />
                    <Route path="/backups"     element={<Backups />} />
                    <Route path="*"            element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
