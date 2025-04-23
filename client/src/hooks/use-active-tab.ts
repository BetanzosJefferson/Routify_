import { useState, useEffect } from "react";
import { useLocation } from "wouter";

type TabType = "create-route" | "publish-trip" | "trips" | "reservations";

export function useActiveTab() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("create-route");

  useEffect(() => {
    // Parse the tab from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab") as TabType | null;
    
    if (tabParam && ["create-route", "publish-trip", "trips", "reservations"].includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (location === "/dashboard" || location === "/") {
      // Default to create-route if no tab specified
      setActiveTab("create-route");
    }
  }, [location, window.location.search]);

  const setTab = (tab: TabType) => {
    // Update the URL and the active tab
    setLocation(`/dashboard?tab=${tab}`);
    setActiveTab(tab);
  };

  return { activeTab, setTab };
}
