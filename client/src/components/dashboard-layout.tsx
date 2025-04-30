import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { TabType } from "@/hooks/use-active-tab";

type DashboardLayoutProps = {
  children: ReactNode;
  defaultTab?: TabType;
};

export function DashboardLayout({ children, defaultTab = "reservations" }: DashboardLayoutProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - visible en escritorio */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
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