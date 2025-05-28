import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import CouponsPage from "@/components/coupons/coupons-page";
import { useAuth } from "@/hooks/use-auth";
import { TabType } from "@/hooks/use-active-tab";
import { hasAccessToSection } from "@/lib/role-based-permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function CouponsPageContainer() {
  const [activeTab, setActiveTab] = useState<TabType>("coupons");
  const { user } = useAuth();

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Verificar si el usuario tiene acceso a esta sección
  const canAccess = (sectionId: string): boolean => {
    if (!user) return false;
    return hasAccessToSection(user.role, sectionId);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            {canAccess("coupons") ? (
              <CouponsPage />
            ) : (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertTitle>Acceso Denegado</AlertTitle>
                <AlertDescription>
                  No tienes permisos para acceder a esta sección. Contacta al administrador si crees que deberías tener acceso.
                </AlertDescription>
              </Alert>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}