import './App.css'
import { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Onboarding from '@/pages/Onboarding';

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout
    ? <Layout currentPageName={currentPageName}>{children}</Layout>
    : <>{children}</>;

// Redirects unauthenticated users to /Login
const PrivateRoute = ({ children }) => {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  if (isLoadingAuth) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/Login" replace />;
  return children;
};

// Redirects already-authenticated users away from auth pages
const PublicRoute = ({ children }) => {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  if (isLoadingAuth) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/Dashboard" replace />;
  return children;
};

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public auth routes — no sidebar Layout */}
      <Route path="/Login"      element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/Register"   element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/Onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to={`/${mainPageKey}`} replace />} />

      {/* Protected app pages — wrapped in Layout */}
      {Object.entries(Pages).map(([name, Page]) => (
        <Route
          key={name}
          path={`/${name}`}
          element={
            <PrivateRoute>
              <LayoutWrapper currentPageName={name}>
                {/* Per-page boundary: a page crash keeps the nav shell alive */}
                <ErrorBoundary>
                  <Page />
                </ErrorBoundary>
              </LayoutWrapper>
            </PrivateRoute>
          }
        />
      ))}

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  </Suspense>
);

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NavigationTracker />
            <AppRoutes />
          </Router>
          <Toaster />
          <VisualEditAgent />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
