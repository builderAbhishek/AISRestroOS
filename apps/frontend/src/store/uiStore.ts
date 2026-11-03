import { create } from 'zustand';
import { MenuItem, Order, KOTPrintResult } from '@/types';

export type NavRoute =
  | 'dashboard'
  | 'pos'
  | 'orders'
  | 'menu'
  | 'tables'
  | 'settings'
  | 'customers'
  | 'inventory'
  | 'reports';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
}

interface UIState {
  currentRoute: NavRoute;
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
  receiptModalData: { receiptText: string; invoiceNumber: string } | null;

  // Toasts
  toasts: ToastMessage[];

  // Actions
  setCurrentRoute: (route: NavRoute) => void;
  toggleSidebar: () => void;
  openSetupWizard: () => void;
  closeSetupWizard: () => void;
  openVariantModal: (item: MenuItem) => void;
  closeVariantModal: () => void;
  openSettlementModal: (order: Order) => void;
  closeSettlementModal: () => void;
  openKOTModal: (result: KOTPrintResult) => void;
  closeKOTModal: () => void;
  openReceiptModal: (receiptText: string, invoiceNumber: string) => void;
  closeReceiptModal: () => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentRoute: 'dashboard',
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

  setCurrentRoute: (route) => set({ currentRoute: route }),
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

  openReceiptModal: (receiptText, invoiceNumber) =>
    set({ isReceiptModalOpen: true, receiptModalData: { receiptText, invoiceNumber } }),
  closeReceiptModal: () =>
    set({ isReceiptModalOpen: false, receiptModalData: null }),

  addToast: (toast) => {
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
