"use client";

import dynamic from "next/dynamic";

const DreadJengaLab = dynamic(
  () =>
    import("@/components/jenga3d/DreadJengaLab").then((m) => m.DreadJengaLab),
  { ssr: false, loading: () => <TowerTestLoading /> }
);

function TowerTestLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted font-body">
      <div className="text-center space-y-2">
        <div className="spinner mx-auto" role="status" aria-label="Loading" />
        <p>Loading tower…</p>
      </div>
    </div>
  );
}

export default function TowerTestPage() {
  return <DreadJengaLab />;
}
