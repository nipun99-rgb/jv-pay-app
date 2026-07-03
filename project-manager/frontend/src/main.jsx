import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { ShellProvider } from "./contexts/ShellContext.jsx";
import AppShell from "./components/AppShell.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

// Eagerly loaded (small, always needed)
import LoginPage from "./pages/LoginPage.jsx";
import GlobalDashboard from "./pages/GlobalDashboard.jsx";

// Lazy-loaded (code-split)
const ContractListPage = lazy(() => import("./pages/ContractListPage.jsx"));
const PackageIntakePage = lazy(() => import("./pages/PackageIntakePage.jsx"));
const PackageLayout = lazy(() => import("./pages/package/PackageLayout.jsx"));
const IngestPage = lazy(() => import("./pages/package/IngestPage.jsx"));
const File1Page = lazy(() => import("./pages/package/File1Page.jsx"));
const PlanPage = lazy(() => import("./pages/package/PlanPage.jsx"));
const File2Page = lazy(() => import("./pages/package/File2Page.jsx"));
const CompletePage = lazy(() => import("./pages/package/CompletePage.jsx"));
const ExceptionsPage = lazy(() => import("./pages/package/ExceptionsPage.jsx"));
const HitlPage = lazy(() => import("./pages/package/HitlPage.jsx"));

function LazyFallback() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading...</div>;
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <GlobalDashboard /> },
      { path: "contracts", element: <Suspense fallback={<LazyFallback />}><ContractListPage /></Suspense> },
      { path: "packages/new", element: <Suspense fallback={<LazyFallback />}><PackageIntakePage /></Suspense> },
      {
        path: "packages/:packageId",
        element: <Suspense fallback={<LazyFallback />}><PackageLayout /></Suspense>,
        children: [
          { path: "ingest", element: <Suspense fallback={<LazyFallback />}><IngestPage /></Suspense> },
          { path: "file1", element: <Suspense fallback={<LazyFallback />}><File1Page /></Suspense> },
          { path: "plan", element: <Suspense fallback={<LazyFallback />}><PlanPage /></Suspense> },
          { path: "file2", element: <Suspense fallback={<LazyFallback />}><File2Page /></Suspense> },
          { path: "complete", element: <Suspense fallback={<LazyFallback />}><CompletePage /></Suspense> },
          { path: "exceptions", element: <Suspense fallback={<LazyFallback />}><ExceptionsPage /></Suspense> },
          { path: "hitl", element: <Suspense fallback={<LazyFallback />}><HitlPage /></Suspense> },
        ],
      },
      { path: "settings", element: <div className="p-6"><h1 className="text-2xl font-semibold">Settings</h1></div> },
      { path: "reports", element: <div className="p-6"><h1 className="text-2xl font-semibold">Reports</h1></div> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ShellProvider>
          <RouterProvider router={router} />
        </ShellProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
