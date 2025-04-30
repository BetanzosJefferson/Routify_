import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";

type DashboardLayoutProps = {
  children: ReactNode;
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - visible en escritorio */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Contenido de la página, con scroll */}
        <main className="flex-1 overflow-y-auto pt-16 md:pt-0 pb-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}