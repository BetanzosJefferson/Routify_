import { useActiveTab } from "@/hooks/use-active-tab";
import { cn } from "@/lib/utils";

interface TabNavigationProps {
  className?: string;
}

export function TabNavigation({ className }: TabNavigationProps) {
  const { activeTab, setTab } = useActiveTab();
  
  return (
    <div className={cn("block", className)}>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <TabItem 
            active={activeTab === "create-route"}
            onClick={() => setTab("create-route")}
          >
            Create Route
          </TabItem>
          <TabItem 
            active={activeTab === "publish-trip"}
            onClick={() => setTab("publish-trip")}
          >
            Publish Trip
          </TabItem>
          <TabItem 
            active={activeTab === "trips"}
            onClick={() => setTab("trips")}
          >
            Trips
          </TabItem>
          <TabItem 
            active={activeTab === "reservations"}
            onClick={() => setTab("reservations")}
          >
            Reservations
          </TabItem>
        </nav>
      </div>
    </div>
  );
}

interface TabItemProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabItem({ active, onClick, children }: TabItemProps) {
  return (
    <div 
      className={cn(
        "py-4 px-1 text-sm font-medium cursor-pointer",
        active 
          ? "text-primary border-b-2 border-primary" 
          : "text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300"
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
