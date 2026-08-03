import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/demo")({
  component: DemoLayout,
});

function DemoLayout() {
  return (
    <div className="pipeline-scope">
      <Outlet />
    </div>
  );
}
