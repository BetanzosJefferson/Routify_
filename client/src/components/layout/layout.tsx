import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useLocation } from "wouter";
import { TabType } from "@/hooks/use-active-tab";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [activeTab, setActiveTab] = useState<TabType>("publish-trip");
  const [location] = useLocation();
  
  // Determinar activeTab basado en la ruta actual (para mantener la navegación coherente)
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };
  
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}