import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { BoardingList } from "@/components/boarding-list/boarding-list";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { TabType } from "@/hooks/use-active-tab";

export default function ConductorPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("boarding-list");
  
  // Tab change handler for child components
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const DriverContent = () => (
    <div className="py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portal del Conductor</h1>
          <p className="text-muted-foreground">
            Gestiona tus listas de abordaje para los viajes asignados
          </p>
        </div>
      </div>

      <BoardingList />
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            <DriverContent />
          </main>
        </div>
      </div>
    </div>
  );
}