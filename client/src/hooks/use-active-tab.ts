import { useState, useEffect } from "react";
import { useLocation } from "wouter";

type TabType = "create-route" | "publish-trip" | "trips" | "reservations";

export function useActiveTab() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("create-route");

  useEffect(() => {
    // Parse the tab from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab") as TabType | null;
    
    if (tabParam) {
      setActiveTab(tabParam);
    } else if (location === "/dashboard" || location === "/") {
      // Default to create-route if no tab specified
      setActiveTab("create-route");
    }
  }, [location]);

  const setTab = (tab: TabType) => {
    setActiveTab(tab);
  };

  return { activeTab, setTab };
}
