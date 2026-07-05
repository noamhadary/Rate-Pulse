import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BusinessProvider } from './context/BusinessContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';

const Dashboard    = lazy(() => import('./pages/Dashboard'));
const Reviews      = lazy(() => import('./pages/Reviews'));
const Analytics    = lazy(() => import('./pages/Analytics'));
const Reports      = lazy(() => import('./pages/Reports'));
const Onboarding   = lazy(() => import('./pages/Onboarding'));
const Settings     = lazy(() => import('./pages/Settings'));
const SeedDemo     = lazy(() => import('./pages/SeedDemo'));
const Login          = lazy(() => import('./pages/auth/Login'));
const Register       = lazy(() => import('./pages/auth/Register'));
const AuthCallback   = lazy(() => import('./pages/auth/AuthCallback'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/auth/ResetPassword'));
const LandingPage  = lazy(() => import('./pages/LandingPage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <span className="material-symbols-outlined animate-spin text-secondary text-[32px]">progress_activity</span>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BusinessProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"              element={<LandingPage />} />
              <Route path="/auth/login"           element={<Login />} />
              <Route path="/auth/register"        element={<Register />} />
              <Route path="/auth/callback"        element={<AuthCallback />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/reset-password"  element={<ResetPassword />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard"  element={<Dashboard />} />
                  <Route path="/reviews"    element={<Reviews />} />
                  <Route path="/analytics"  element={<Analytics />} />
                  <Route path="/reports"    element={<Reports />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/settings"   element={<Settings />} />
                  <Route path="/seed"       element={<SeedDemo />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </BusinessProvider>
    </AuthProvider>
  );
}
