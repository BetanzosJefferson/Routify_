import { useActiveTab } from "@/hooks/use-active-tab";
import { Link } from "wouter";
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
            href="/dashboard?tab=create-route" 
            active={activeTab === "create-route"}
            onClick={() => setTab("create-route")}
          >
            Create Route
          </TabItem>
          <TabItem 
            href="/dashboard?tab=publish-trip" 
            active={activeTab === "publish-trip"}
            onClick={() => setTab("publish-trip")}
          >
            Publish Trip
          </TabItem>
          <TabItem 
            href="/dashboard?tab=trips" 
            active={activeTab === "trips"}
            onClick={() => setTab("trips")}
          >
            Trips
          </TabItem>
          <TabItem 
            href="/dashboard?tab=reservations" 
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
  href: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabItem({ href, active, onClick, children }: TabItemProps) {
  return (
    <Link href={href}>
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
    </Link>
  );
}
