import { useState } from 'react';
import { useLocation } from 'wouter';
import { CompanyLinkCreator } from '@/components/transfers/company-link-creator';
import { CompanyLinkList } from '@/components/transfers/company-link-list';
import { TransferRequestsList } from '@/components/transfers/transfer-requests-list';
import { TransferHistoryList } from '@/components/transfers/transfer-history-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Topbar } from '@/components/layout/topbar';
import { TabType } from '@/hooks/use-active-tab';
import { useAuth } from '@/hooks/use-auth';

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState('links');
  const [location] = useLocation();
  const [activeNavTab, setActiveNavTab] = useState<TabType>("create-route");
  const { user } = useAuth();
  const isOwner = user?.role === 'dueño';

  const handleTabChange = (tab: TabType) => {
    setActiveNavTab(tab);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeNavTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav activeTab={activeNavTab} onTabChange={handleTabChange} />
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="container mx-auto space-y-6">
              <header>
                <h1 className="text-3xl font-bold tracking-tight">Transferencias entre Empresas</h1>
                <p className="text-muted-foreground mt-2">
                  Gestiona las transferencias de pasajeros entre empresas vinculadas
                </p>
              </header>

              <Tabs 
                defaultValue="links" 
                value={activeTab} 
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="links">Vínculos Empresariales</TabsTrigger>
                  <TabsTrigger value="requests">Solicitudes</TabsTrigger>
                  <TabsTrigger value="history">Historial</TabsTrigger>
                </TabsList>

                <TabsContent value="links" className="space-y-6 mt-6">
                  {isOwner && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <CompanyLinkCreator />
                      <CompanyLinkList />
                    </div>
                  )}
                  {!isOwner && (
                    <div className="py-12 text-center">
                      <p className="text-muted-foreground">
                        Solo los usuarios con rol de dueño pueden gestionar vínculos entre empresas.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="requests" className="space-y-6 mt-6">
                  <TransferRequestsList />
                </TabsContent>

                <TabsContent value="history" className="space-y-6 mt-6">
                  <TransferHistoryList />
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}