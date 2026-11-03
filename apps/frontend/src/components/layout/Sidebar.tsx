import React from 'react';
import { useUIStore, NavRoute } from '@/store/uiStore';
import { Restaurant } from '@/types';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ReceiptText,
  BookOpen,
  Grid3X3,
  Settings,
  Users,
  Boxes,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Flame,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItemDef {
  id: NavRoute;
  label: string;
  icon: React.ReactNode;
  isPlaceholder?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'pos', label: 'Point of Sale (POS)', icon: <UtensilsCrossed className="h-5 w-5" /> },
  { id: 'orders', label: 'Orders & KOTs', icon: <ReceiptText className="h-5 w-5" /> },
  { id: 'menu', label: 'Menu Management', icon: <BookOpen className="h-5 w-5" /> },
  { id: 'tables', label: 'Table Management', icon: <Grid3X3 className="h-5 w-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  { id: 'customers', label: 'Customers', icon: <Users className="h-5 w-5" />, isPlaceholder: true },
  { id: 'inventory', label: 'Inventory', icon: <Boxes className="h-5 w-5" />, isPlaceholder: true },
  { id: 'reports', label: 'Reports & Analytics', icon: <BarChart3 className="h-5 w-5" />, isPlaceholder: true },
];

export const Sidebar: React.FC<{ restaurant?: Restaurant | null }> = ({ restaurant }) => {
  const { currentRoute, setCurrentRoute, isSidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-[#E8EAF0] bg-white transition-all duration-200 select-none shrink-0 h-full relative z-20',
        isSidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-[#E8EAF0] px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F07818] to-[#C85A0A] text-white shadow-md shadow-[#F07818]/25">
            <Flame className="h-6 w-6 fill-white" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-base font-bold tracking-tight text-[#202124]">
                AIS<span className="text-[#F07818]">Restro</span>OS
              </span>
              <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">
                Commercial Offline POS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = currentRoute === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentRoute(item.id)}
              title={isSidebarCollapsed ? item.label : undefined}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all text-left cursor-pointer',
                isActive
                  ? 'bg-[#FFF0E3] text-[#F07818] font-semibold shadow-xs'
                  : 'text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#202124]',
                isSidebarCollapsed && 'justify-center px-0'
              )}
            >
              {/* Left active highlight line */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-md bg-[#F07818]" />
              )}

              <span
                className={cn(
                  'shrink-0 transition-colors',
                  isActive ? 'text-[#F07818]' : 'text-[#6B7280] group-hover:text-[#202124]'
                )}
              >
                {item.icon}
              </span>

              {!isSidebarCollapsed && (
                <div className="flex flex-1 items-center justify-between truncate">
                  <span className="truncate">{item.label}</span>
                  {item.isPlaceholder && (
                    <span className="rounded-md bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-medium text-[#9CA3AF]">
                      Soon
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Restaurant Info & Collapse Toggle */}
      <div className="border-t border-[#E8EAF0] p-3 bg-[#FAFAFB]">
        {!isSidebarCollapsed && restaurant && (
          <div className="mb-2 flex items-center gap-2.5 rounded-lg border border-[#E8EAF0] bg-white p-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF0E3] text-[#F07818]">
              <Store className="h-4 w-4" />
            </div>
            <div className="truncate">
              <p className="truncate text-xs font-semibold text-[#202124]">{restaurant.name}</p>
              <p className="truncate text-[10px] text-[#6B7280]">
                {restaurant.gst_registered ? `GST: ${restaurant.gstin || 'Reg'}` : 'Non-GST'}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-medium text-[#6B7280] hover:bg-[#F0F2F6] hover:text-[#202124] transition-colors"
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
