import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export type TabType = "create-route" | "publish-trip" | "trips" | "reservations";

// Create a global state for tab management
const tabState = {
  activeTab: "create-route" as TabType
};

export function useActiveTab() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>(tabState.activeTab);

  // Keep local state in sync with global state
  useEffect(() => {
    setActiveTab(tabState.activeTab);

    // Parse URL parameters on mount
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab") as TabType | null;
    
    if (tabParam && ["create-route", "publish-trip", "trips", "reservations"].includes(tabParam)) {
      tabState.activeTab = tabParam;
      setActiveTab(tabParam);
    }
  }, []);

  // Function to change the active tab
  const setTab = (tab: TabType) => {
    // Update global state
    tabState.activeTab = tab;
    
    // Update local state
    setActiveTab(tab);
    
    // Update URL
    setLocation(`/dashboard?tab=${tab}`);
  };

  return { activeTab, setTab };
}
