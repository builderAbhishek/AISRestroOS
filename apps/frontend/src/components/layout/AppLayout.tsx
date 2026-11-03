import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { restaurantApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { SetupWizard } from './SetupWizard';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { VariantSelectorModal } from '@/modules/pos/VariantSelectorModal';
import { KOTPreviewModal } from '@/modules/pos/KOTPreviewModal';
import { SettlementModal } from '@/modules/pos/SettlementModal';
import { CustomerReceiptModal } from '@/modules/pos/CustomerReceiptModal';

import { DashboardView } from '@/modules/dashboard/DashboardView';
import { POSView } from '@/modules/pos/POSView';
import { OrdersView } from '@/modules/orders/OrdersView';
import { MenuView } from '@/modules/menu/MenuView';
import { TablesView } from '@/modules/tables/TablesView';
import { SettingsView } from '@/modules/settings/SettingsView';
import { InventoryView } from '@/modules/inventory/InventoryView';
import { ReportsView } from '@/modules/reports/ReportsView';
import { PlaceholderView } from '@/modules/placeholders/PlaceholderView';

export const AppLayout: React.FC = () => {
  const { currentRoute, openSetupWizard } = useUIStore();

  const { data: restaurant, isError } = useQuery({
    queryKey: ['restaurant'],
    queryFn: restaurantApi.getCurrent,
    retry: false,
  });

  // If restaurant is not configured yet (e.g. 404 from backend), pop open the setup wizard
  useEffect(() => {
    if (isError) {
      openSetupWizard();
    }
  }, [isError, openSetupWizard]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F7F8FA] text-[#202124]">
      {/* Collapsible Sidebar */}
      <Sidebar restaurant={restaurant} />

      {/* Main Container */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {/* Top Header */}
        <TopHeader restaurant={restaurant} />

        {/* Dynamic Page Content with Independent Scroll */}
        <main className={`flex-1 min-h-0 flex flex-col p-4 md:p-6 ${currentRoute === 'pos' ? 'h-full overflow-hidden' : 'overflow-y-auto'}`}>
          {currentRoute === 'dashboard' && <DashboardView />}
          {currentRoute === 'pos' && <POSView />}
          {currentRoute === 'orders' && <OrdersView />}
          {currentRoute === 'menu' && <MenuView />}
          {currentRoute === 'tables' && <TablesView />}
          {currentRoute === 'settings' && <SettingsView />}
          {currentRoute === 'inventory' && <InventoryView />}
          {currentRoute === 'reports' && <ReportsView />}
          {currentRoute === 'customers' && <PlaceholderView route={currentRoute} />}
        </main>
      </div>

      {/* Global Modals */}
      <SetupWizard />
      <VariantSelectorModal />
      <KOTPreviewModal />
      <SettlementModal />
      <CustomerReceiptModal />

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
  );
};
