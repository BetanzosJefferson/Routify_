import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

export type TabType = 
  | "create-route" 
  | "publish-trip" 
  | "trips" 
  | "reservations" 
  | "passenger-list" 
  | "users" 
  | "companies"
  | "vehicles"
  | "coupons"
  | "commissions"
  | "my-commissions"
  | "reservation-requests"
  | "cashier"; // Nueva pestaña para la sección de Caja

export function useActiveTab() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("trips" as TabType);

  // Sincronizar la URL con la pestaña activa
  useEffect(() => {
    // Obtener la pestaña activa del parámetro de URL 'tab'
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab') as TabType | null;
    
    if (tabParam) {
      setActiveTab(tabParam);
    } else if (location === '/' || location === '/dashboard') {
      // Si no hay parámetro pero estamos en la página principal, mostrar dashboard
      const searchParams = new URLSearchParams();
      searchParams.set('tab', activeTab);
      const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
      window.history.replaceState(null, '', newUrl);
    }
  }, [location]);

  // Función para cambiar la pestaña activa
  const handleSetActiveTab = (tab: TabType) => {
    setActiveTab(tab);
    
    // Actualizar la URL
    if (location === '/' || location === '/dashboard') {
      const searchParams = new URLSearchParams();
      searchParams.set('tab', tab);
      const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
      window.history.replaceState(null, '', newUrl);
    }
  };

  return { activeTab, setActiveTab: handleSetActiveTab };
}