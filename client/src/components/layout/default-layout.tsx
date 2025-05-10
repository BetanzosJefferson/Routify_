import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { TabType } from "@/hooks/use-active-tab";

interface DefaultLayoutProps {
  children: ReactNode;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export function DefaultLayout({ 
  children, 
  activeTab = "create-route", 
  onTabChange = () => {} 
}: DefaultLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav activeTab={activeTab} onTabChange={onTabChange} />
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}