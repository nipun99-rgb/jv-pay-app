import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/packages/$id")({
  component: () => <Outlet />,
});
