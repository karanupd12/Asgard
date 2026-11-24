import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Spinner } from "@/components/ui";
import Landing from "@/pages/Landing";

// Route-level code splitting: the landing page never downloads vault code.
const GalleryPage = lazy(() => import("@/pages/GalleryPage"));
const AlbumsPage = lazy(() => import("@/pages/AlbumsPage").then((m) => ({ default: m.AlbumsPage })));
const AlbumPage = lazy(() => import("@/pages/AlbumsPage").then((m) => ({ default: m.AlbumPage })));
const SharingPage = lazy(() => import("@/pages/SharingPages").then((m) => ({ default: m.SharingPage })));
const SharedWithMePage = lazy(() => import("@/pages/SharingPages").then((m) => ({ default: m.SharedWithMePage })));
const SharedOwnerPage = lazy(() => import("@/pages/SharingPages").then((m) => ({ default: m.SharedOwnerPage })));

const Loading = () => (
  <div className="flex justify-center py-32">
    <Spinner />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<GalleryPage />} />
            <Route path="albums" element={<AlbumsPage />} />
            <Route path="albums/:id" element={<AlbumPage />} />
            <Route path="shared" element={<SharedWithMePage />} />
            <Route path="shared/:owner" element={<SharedOwnerPage />} />
            <Route path="sharing" element={<SharingPage />} />
          </Route>
          <Route
            path="*"
            element={
              <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
                <p className="text-5xl font-semibold">404</p>
                <Link to="/" className="text-sm text-accent hover:underline">
                  Back home
                </Link>
              </div>
            }
          />
        </Routes>
      </Suspense>
      <Toaster position="bottom-right" theme="system" richColors closeButton />
    </BrowserRouter>
  );
}
