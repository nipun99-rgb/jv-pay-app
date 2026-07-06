import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ShellProvider } from '@/contexts/ShellContext';
import { RequireAuth } from '@/components/auth/RequireAuth';

// Eagerly loaded
import LoginPage from '@/pages/LoginPage';
import GlobalDashboard from '@/pages/GlobalDashboard';

// Lazy-loaded (code-split)
const ContractListPage = lazy(() => import('@/pages/ContractListPage'));
const PackageIntakePage = lazy(() => import('@/pages/PackageIntakePage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const PackageLayout = lazy(() => import('@/pages/package/PackageLayout'));
const IngestPage = lazy(() => import('@/pages/package/IngestPage'));
const CoverPage = lazy(() => import('@/pages/package/CoverPage'));
const File1Page = lazy(() => import('@/pages/package/File1Page'));
const PlanPage = lazy(() => import('@/pages/package/PlanPage'));
const File2Page = lazy(() => import('@/pages/package/File2Page'));
const ExceptionsPage = lazy(() => import('@/pages/package/ExceptionsPage'));
const HitlPage = lazy(() => import('@/pages/package/HitlPage'));
const CompletePage = lazy(() => import('@/pages/package/CompletePage'));

function LazyFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
      Loading...
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      element: <RequireAuth />,
      children: [
        { index: true, element: <GlobalDashboard /> },
        {
          path: 'contracts',
          element: <Suspense fallback={<LazyFallback />}><ContractListPage /></Suspense>,
        },
        {
          path: 'packages/new',
          element: <Suspense fallback={<LazyFallback />}><PackageIntakePage /></Suspense>,
        },
        {
          path: 'packages/:packageId',
          element: <Suspense fallback={<LazyFallback />}><PackageLayout /></Suspense>,
          children: [
            {
              path: 'ingest',
              element: <Suspense fallback={<LazyFallback />}><IngestPage /></Suspense>,
            },
            {
              path: 'cover',
              element: <Suspense fallback={<LazyFallback />}><CoverPage /></Suspense>,
            },
            {
              path: 'file1',
              element: <Suspense fallback={<LazyFallback />}><File1Page /></Suspense>,
            },
            {
              path: 'plan',
              element: <Suspense fallback={<LazyFallback />}><PlanPage /></Suspense>,
            },
            {
              path: 'file2',
              element: <Suspense fallback={<LazyFallback />}><File2Page /></Suspense>,
            },
            {
              path: 'exceptions',
              element: <Suspense fallback={<LazyFallback />}><ExceptionsPage /></Suspense>,
            },
            {
              path: 'hitl',
              element: <Suspense fallback={<LazyFallback />}><HitlPage /></Suspense>,
            },
            {
              path: 'complete',
              element: <Suspense fallback={<LazyFallback />}><CompletePage /></Suspense>,
            },
          ],
        },
        {
          path: 'reports',
          element: <Suspense fallback={<LazyFallback />}><ReportsPage /></Suspense>,
        },
        {
          path: 'settings',
          element: <div className="p-6"><h1 className="text-2xl font-semibold">Settings</h1></div>,
        },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  }
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ShellProvider>
          <RouterProvider router={router} />
        </ShellProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
