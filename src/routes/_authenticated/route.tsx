import { createFileRoute, redirect, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <>
      <Outlet />
      <button
        onClick={() => void signOut()}
        className="fixed bottom-5 right-5 z-50 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs text-white/70 backdrop-blur transition-colors hover:text-white"
      >
        Sign out
      </button>
    </>
  );
}
