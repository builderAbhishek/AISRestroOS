import React, { useState, useEffect } from 'react';
import { useUIStore, NavRoute } from '@/store/uiStore';
import { Restaurant } from '@/types';
import {
  Clock,
  Printer,
  ShieldCheck,
  User,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const ROUTE_TITLES: Record<NavRoute, { title: string; subtitle: string }> = {
  dashboard: { title: 'Executive Dashboard', subtitle: 'Live sales, order metrics & performance' },
  pos: { title: 'Billing Point of Sale', subtitle: 'Fast offline dine-in, takeaway & delivery' },
  orders: { title: 'Order History & KOTs', subtitle: 'Live tickets, invoices and reprints' },
  menu: { title: 'Menu Management', subtitle: 'Categories, items, pricing & variants' },
  tables: { title: 'Table Layout & Management', subtitle: 'Real-time floor sections & seating' },
  settings: { title: 'Restaurant Settings', subtitle: 'Profile, GST taxation & thermal printer config' },
  cash: { title: 'Cash Register & Shifts', subtitle: 'Drawer reconciliation, cash in/out & daily expenses' },
  customers: { title: 'Customer Database', subtitle: 'Customer history and contacts' },
  inventory: { title: 'Inventory & Stock Management', subtitle: 'Ingredients, purchase orders, recipes & wastage' },
  reports: { title: 'Financial & Tax Reports', subtitle: 'Sales analytics, tax reports and CSV exports' },
};

export const TopHeader: React.FC<{ restaurant?: Restaurant | null }> = ({ restaurant }) => {
  const { currentRoute, setCurrentRoute, openSetupWizard } = useUIStore();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleString('en-IN', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const routeInfo = ROUTE_TITLES[currentRoute] || { title: 'AISRestroOS', subtitle: '' };

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-[#E8EAF0] bg-white px-6 select-none shrink-0 z-10">
      {/* Page Title & Breadcrumbs */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-[#202124]">{routeInfo.title}</h1>
          {restaurant && (
            <span className="rounded-md bg-[#FFF0E3] px-2 py-0.5 text-[11px] font-semibold text-[#C85A0A]">
              {restaurant.name}
            </span>
          )}
        </div>
        <p className="text-xs text-[#6B7280]">{routeInfo.subtitle}</p>
      </div>

      {/* Right Controls & Status Badges */}
      <div className="flex items-center gap-3">
        {/* Realtime Clock */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-[#E8EAF0] bg-[#FAFAFB] px-3 py-1.5 text-xs font-medium text-[#202124]">
          <Clock className="h-3.5 w-3.5 text-[#F07818]" />
          <span>{currentTime}</span>
        </div>

        {/* Local Offline Ready Badge */}
        <div
          title="Running completely offline with local SQLite database"
          className="flex items-center gap-1.5 rounded-lg border border-[#16865B]/20 bg-[#EBF7F2] px-2.5 py-1.5 text-xs font-medium text-[#16865B]"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16865B] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16865B]"></span>
          </span>
          <span className="hidden sm:inline">Offline-First Local</span>
        </div>

        {/* Printer Status */}
        <div
          title="Thermal receipt & KOT printer configured (80mm/58mm)"
          className="hidden md:flex items-center gap-1.5 rounded-lg border border-[#E8EAF0] bg-[#FAFAFB] px-2.5 py-1.5 text-xs text-[#6B7280]"
        >
          <Printer className="h-3.5 w-3.5 text-[#6B7280]" />
          <span>Printer: Ready</span>
        </div>

        {/* Local Operator */}
        <div className="flex items-center gap-1.5 rounded-lg border border-[#E8EAF0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#202124]">
          <User className="h-3.5 w-3.5 text-[#6B7280]" />
          <span className="hidden sm:inline">Cashier / Operator</span>
        </div>

        {/* Quick New Order Button */}
        {currentRoute !== 'pos' && (
          <Button
            onClick={() => setCurrentRoute('pos')}
            size="sm"
            variant="primary"
            className="gap-1.5 shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New POS Order</span>
          </Button>
        )}
      </div>
    </header>
  );
};
