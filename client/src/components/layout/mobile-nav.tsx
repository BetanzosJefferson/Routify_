import { useState } from "react";
import { useLocation } from "wouter";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TabType } from "@/hooks/use-active-tab";

interface MobileNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  
  const handleNavClick = (tab: TabType) => {
    onTabChange(tab);
    setLocation(`/dashboard?tab=${tab}`);
    setOpen(false);
  };
  
  return (
    <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="mr-2" aria-label="Menu">
            <MenuIcon className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] sm:w-[300px] p-0">
          <div className="px-6 py-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">TransRoute</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <XIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <nav className="flex flex-col p-4">
            <NavLink 
              active={activeTab === "create-route"}
              onClick={() => handleNavClick("create-route")}
            >
              Rutas
            </NavLink>
            <NavLink 
              active={activeTab === "publish-trip"}
              onClick={() => handleNavClick("publish-trip")}
            >
              Publicar Viajes
            </NavLink>
            <NavLink 
              active={activeTab === "trips"}
              onClick={() => handleNavClick("trips")}
            >
              Viajes
            </NavLink>
            <NavLink 
              active={activeTab === "reservations"}
              onClick={() => handleNavClick("reservations")}
            >
              Reservaciones
            </NavLink>
            <NavLink 
              active={activeTab === "trip-summary"}
              onClick={() => handleNavClick("trip-summary")}
            >
              Resumen de Viajes
            </NavLink>
          </nav>
        </SheetContent>
      </Sheet>
      
      <h1 className="text-lg font-semibold text-gray-800">TransRoute</h1>
      <div className="w-12"></div>
    </div>
  );
}

interface NavLinkProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function NavLink({ active, onClick, children }: NavLinkProps) {
  return (
    <div 
      className={`flex items-center px-2 py-3 text-base font-medium rounded-md cursor-pointer ${
        active 
          ? "text-primary bg-gray-50" 
          : "text-gray-700 hover:bg-gray-100"
      }`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
