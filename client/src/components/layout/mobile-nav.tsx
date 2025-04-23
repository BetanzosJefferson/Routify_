import { useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useActiveTab } from "@/hooks/use-active-tab";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { setTab } = useActiveTab();
  
  const handleNavClick = (tab: "create-route" | "publish-trip" | "trips" | "reservations") => {
    setTab(tab);
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
            <NavLink onClick={() => handleNavClick("create-route")}>
              Create Route
            </NavLink>
            <NavLink onClick={() => handleNavClick("publish-trip")}>
              Publish Trip
            </NavLink>
            <NavLink onClick={() => handleNavClick("trips")}>
              Trips
            </NavLink>
            <NavLink onClick={() => handleNavClick("reservations")}>
              Reservations
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
  onClick: () => void;
  children: React.ReactNode;
}

function NavLink({ onClick, children }: NavLinkProps) {
  return (
    <div 
      className="flex items-center px-2 py-3 text-base font-medium text-gray-700 hover:bg-gray-100 rounded-md cursor-pointer"
      onClick={onClick}
    >
      {children}
    </div>
  );
}
