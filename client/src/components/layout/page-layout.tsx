import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { TabType } from "@/hooks/use-active-tab";

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  activeTab?: TabType;
}

export function PageLayout({ children, title, activeTab = "create-route" }: PageLayoutProps) {
  // No necesitamos handleTabChange ya que no vamos a cambiar tabs en estas páginas
  const handleTabChange = (tab: TabType) => {
    // Solo para cumplir con el tipado de onTabChange
    console.log(tab);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            {title && (
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}