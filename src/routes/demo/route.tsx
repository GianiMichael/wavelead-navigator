import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/demo")({
  component: DemoLayout,
});

function DemoLayout() {
  return (
    <div className="pipeline-scope">
      <div className="sticky top-0 z-50 grad-fill px-4 py-2 text-center text-xs font-medium text-black">
        Demo Mode — fictional sample data, no real API calls or outreach are being made
      </div>
      <Outlet />
    </div>
  );
}
