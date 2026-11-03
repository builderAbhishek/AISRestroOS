import { create } from 'zustand';
import { MenuItem, Order, KOTPrintResult } from '@/types';

export type NavRoute =
  | 'dashboard'
  | 'pos'
  | 'orders'
  | 'menu'
  | 'tables'
  | 'cash'
  | 'settings'
  | 'customers'
  | 'inventory'
  | 'reports';

export interface RouteParams {
  tableId?: string;
  orderId?: string;
  [key: string]: string | undefined;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
}

interface UIState {
  currentRoute: NavRoute;
  routeParams: RouteParams;
  isSidebarCollapsed: boolean;
  
  // Modals
  isSetupWizardOpen: boolean;
  isVariantModalOpen: boolean;
  selectedMenuItemForVariants: MenuItem | null;
  isSettlementModalOpen: boolean;
  orderForSettlement: Order | null;
  isKOTModalOpen: boolean;
  kotPrintResult: KOTPrintResult | null;
  isReceiptModalOpen: boolean;
  receiptModalData: { receiptText: string; invoiceNumber: string; orderId?: string } | null;

  // Toasts
  toasts: ToastMessage[];

  // Actions
  setCurrentRoute: (route: NavRoute, params?: RouteParams) => void;
  navigateTo: (route: NavRoute, params?: RouteParams) => void;
  toggleSidebar: () => void;
  openSetupWizard: () => void;
  closeSetupWizard: () => void;
  openVariantModal: (item: MenuItem) => void;
  closeVariantModal: () => void;
  openSettlementModal: (order: Order) => void;
  closeSettlementModal: () => void;
  openKOTModal: (result: KOTPrintResult) => void;
  closeKOTModal: () => void;
  openReceiptModal: (receiptText: string, invoiceNumber: string, orderId?: string) => void;
  closeReceiptModal: () => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

function parseHash(): { route: NavRoute; params: RouteParams } {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return { route: 'dashboard', params: {} };
    const [rawRoute, rawQuery] = hash.split('?');
    const validRoutes: NavRoute[] = [
      'dashboard', 'pos', 'orders', 'menu', 'tables', 'cash', 'settings', 'customers', 'inventory', 'reports'
    ];
    const route = validRoutes.includes(rawRoute as NavRoute) ? (rawRoute as NavRoute) : 'dashboard';
    const params: RouteParams = {};
    if (rawQuery) {
      const sp = new URLSearchParams(rawQuery);
      sp.forEach((val, key) => {
        params[key] = val;
      });
    }
    return { route, params };
  } catch {
    return { route: 'dashboard', params: {} };
  }
}

const initial = typeof window !== 'undefined' ? parseHash() : { route: 'dashboard' as NavRoute, params: {} };

export const useUIStore = create<UIState>((set) => ({
  currentRoute: initial.route,
  routeParams: initial.params,
  isSidebarCollapsed: false,
  isSetupWizardOpen: false,
  isVariantModalOpen: false,
  selectedMenuItemForVariants: null,
  isSettlementModalOpen: false,
  orderForSettlement: null,
  isKOTModalOpen: false,
  kotPrintResult: null,
  isReceiptModalOpen: false,
  receiptModalData: null,
  toasts: [],

  setCurrentRoute: (route, params = {}) => {
    if (typeof window !== 'undefined') {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      window.location.hash = qs ? `${route}?${qs}` : route;
    }
    set({ currentRoute: route, routeParams: params });
  },

  navigateTo: (route, params = {}) => {
    if (typeof window !== 'undefined') {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      window.location.hash = qs ? `${route}?${qs}` : route;
    }
    set({ currentRoute: route, routeParams: params });
  },

  toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
  openSetupWizard: () => set({ isSetupWizardOpen: true }),
  closeSetupWizard: () => set({ isSetupWizardOpen: false }),

  openVariantModal: (item) =>
    set({ isVariantModalOpen: true, selectedMenuItemForVariants: item }),
  closeVariantModal: () =>
    set({ isVariantModalOpen: false, selectedMenuItemForVariants: null }),

  openSettlementModal: (order) =>
    set({ isSettlementModalOpen: true, orderForSettlement: order }),
  closeSettlementModal: () =>
    set({ isSettlementModalOpen: false, orderForSettlement: null }),

  openKOTModal: (result) =>
    set({ isKOTModalOpen: true, kotPrintResult: result }),
  closeKOTModal: () =>
    set({ isKOTModalOpen: false, kotPrintResult: null }),

  openReceiptModal: (receiptText, invoiceNumber, orderId) =>
    set({ isReceiptModalOpen: true, receiptModalData: { receiptText, invoiceNumber, orderId } }),
  closeReceiptModal: () =>
    set({ isReceiptModalOpen: false, receiptModalData: null }),

  addToast: (toast) => {
    // Avoid duplicate toast spam for identical active notifications
    const existing = useUIStore.getState().toasts.find(
      (t) => t.title === toast.title && t.type === toast.type && t.description === toast.description
    );
    if (existing) {
      return;
    }
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    const duration = toast.duration || 4000;
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Listen to hash changes for browser back/forward or manual hash updates
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const { route, params } = parseHash();
    useUIStore.setState({ currentRoute: route, routeParams: params });
  });
}
