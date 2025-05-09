import React, { useState } from 'react';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';
import { MobileNav } from './mobile-nav';
import { useActiveTab } from '@/hooks/use-active-tab';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { activeTab, setActiveTab } = useActiveTab();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-gray-900">
      {/* Sidebar (desktop) */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="w-64 flex flex-col">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* Mobile sidebar */}
      <MobileNav open={sidebarOpen} setOpen={setSidebarOpen}>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      </MobileNav>

      {/* Content area */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <TopBar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}