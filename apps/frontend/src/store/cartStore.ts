import { create } from 'zustand';
import { OrderType, MenuItem, MenuVariant, Addon, OrderItem, Order } from '@/types';

export interface CartItem {
  id?: string;
  menuItem: MenuItem;
  variant?: MenuVariant;
  addons: Addon[];
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  notes?: string;
  isExistingPrinted?: boolean;
}

interface CartState {
  orderType: OrderType;
  selectedTableId: string | null;
  selectedTableNumber: string | null;
  activeOrderId: string | null;
  activeOrderCode: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  discountType: 'percentage' | 'amount' | null;
  discountValue: number;
  orderNotes: string;

  // Actions
  setOrderType: (type: OrderType) => void;
  setTable: (tableId: string | null, tableNumber: string | null) => void;
  setCustomer: (name: string, phone: string, address?: string) => void;
  setDiscount: (type: 'percentage' | 'amount' | null, value: number) => void;
  setOrderNotes: (notes: string) => void;
  
  addItem: (
    item: MenuItem,
    variant?: MenuVariant,
    addons?: Addon[],
    quantity?: number,
    notes?: string
  ) => void;
  updateQuantity: (index: number, delta: number) => void;
  removeItem: (index: number) => void;
  updateNotes: (index: number, notes: string) => void;
  loadExistingOrder: (order: Order, allMenuItems: MenuItem[]) => void;
  clearCart: () => void;

  // Selectors
  getSubtotalPaise: () => number;
  getDiscountPaise: () => number;
  getEstimatedTaxPaise: (taxRatePercent: number, isTaxInclusive?: boolean, isTaxEnabled?: boolean) => number;
  getGrandTotalPaise: (taxRatePercent: number, isTaxInclusive?: boolean, isTaxEnabled?: boolean) => number;
  getTotalItemsCount: () => number;
}

const STORAGE_KEY = 'aisrestroos_cart_state_v1';

function loadPersistedState(): Partial<CartState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persistState(state: Partial<CartState>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        orderType: state.orderType,
        selectedTableId: state.selectedTableId,
        selectedTableNumber: state.selectedTableNumber,
        activeOrderId: state.activeOrderId,
        activeOrderCode: state.activeOrderCode,
        customerName: state.customerName,
        customerPhone: state.customerPhone,
        customerAddress: state.customerAddress,
        items: state.items,
        discountType: state.discountType,
        discountValue: state.discountValue,
        orderNotes: state.orderNotes,
      })
    );
  } catch {}
}

const initialSaved = loadPersistedState();

export const useCartStore = create<CartState>((set, get) => ({
  orderType: initialSaved.orderType || 'dine_in',
  selectedTableId: initialSaved.selectedTableId || null,
  selectedTableNumber: initialSaved.selectedTableNumber || null,
  activeOrderId: initialSaved.activeOrderId || null,
  activeOrderCode: initialSaved.activeOrderCode || null,
  customerName: initialSaved.customerName || '',
  customerPhone: initialSaved.customerPhone || '',
  customerAddress: initialSaved.customerAddress || '',
  items: initialSaved.items || [],
  discountType: initialSaved.discountType || null,
  discountValue: initialSaved.discountValue || 0,
  orderNotes: initialSaved.orderNotes || '',

  setOrderType: (type) => {
    set((state) => {
      const next = {
        orderType: type,
        ...(type !== 'dine_in' ? { selectedTableId: null, selectedTableNumber: null } : {}),
      };
      persistState({ ...state, ...next });
      return next;
    });
  },

  setTable: (tableId, tableNumber) => {
    set((state) => {
      const next = { selectedTableId: tableId, selectedTableNumber: tableNumber };
      persistState({ ...state, ...next });
      return next;
    });
  },

  setCustomer: (name, phone, address = '') => {
    set((state) => {
      const next = { customerName: name, customerPhone: phone, customerAddress: address };
      persistState({ ...state, ...next });
      return next;
    });
  },

  setDiscount: (type, value) => {
    set((state) => {
      const next = { discountType: type, discountValue: Math.max(0, value) };
      persistState({ ...state, ...next });
      return next;
    });
  },

  setOrderNotes: (notes) => {
    set((state) => {
      const next = { orderNotes: notes };
      persistState({ ...state, ...next });
      return next;
    });
  },

  addItem: (item, variant, addons = [], quantity = 1, notes = '') => {
    set((state) => {
      const unitPrice =
        (variant ? variant.price_paise : item.base_price_paise) +
        addons.reduce((sum, a) => sum + a.price_paise, 0);

      // Check if identical item with same variant and addons exists in cart
      const existingIdx = state.items.findIndex(
        (ci) =>
          ci.menuItem.id === item.id &&
          ci.variant?.id === variant?.id &&
          ci.addons.length === addons.length &&
          ci.addons.every((a) => addons.some((na) => na.id === a.id)) &&
          (ci.notes || '') === (notes || '')
      );

      let updatedItems: CartItem[];
      if (existingIdx >= 0) {
        updatedItems = [...state.items];
        const existing = updatedItems[existingIdx];
        const newQty = existing.quantity + quantity;
        updatedItems[existingIdx] = {
          ...existing,
          quantity: newQty,
          lineTotalPaise: unitPrice * newQty,
        };
      } else {
        const newItem: CartItem = {
          menuItem: item,
          variant,
          addons,
          quantity,
          unitPricePaise: unitPrice,
          lineTotalPaise: unitPrice * quantity,
          notes,
        };
        updatedItems = [...state.items, newItem];
      }

      persistState({ ...state, items: updatedItems });
      return { items: updatedItems };
    });
  },

  updateQuantity: (index, delta) => {
    set((state) => {
      const updated = [...state.items];
      const item = updated[index];
      if (!item) return state;

      const newQty = item.quantity + delta;
      let finalItems: CartItem[];
      if (newQty <= 0) {
        finalItems = updated.filter((_, i) => i !== index);
      } else {
        updated[index] = {
          ...item,
          quantity: newQty,
          lineTotalPaise: item.unitPricePaise * newQty,
        };
        finalItems = updated;
      }

      persistState({ ...state, items: finalItems });
      return { items: finalItems };
    });
  },

  removeItem: (index) => {
    set((state) => {
      const finalItems = state.items.filter((_, i) => i !== index);
      persistState({ ...state, items: finalItems });
      return { items: finalItems };
    });
  },

  updateNotes: (index, notes) => {
    set((state) => {
      const updated = [...state.items];
      if (updated[index]) {
        updated[index] = { ...updated[index], notes };
      }
      persistState({ ...state, items: updated });
      return { items: updated };
    });
  },

  loadExistingOrder: (order, allMenuItems) => {
    const loadedItems: CartItem[] = order.items.map((oi) => {
      const baseMenuItem =
        allMenuItems.find((m) => m.id === oi.menu_item_id) ||
        ({
          id: oi.menu_item_id,
          name: oi.item_name,
          base_price_paise: oi.unit_price_paise,
          is_veg: true,
          item_type: 'veg',
          is_available: true,
          is_recommended: false,
          is_bestseller: false,
          has_variants: !!oi.variant_id,
          variants: [],
          addon_groups: [],
          sort_order: 0,
        } as unknown as MenuItem);

      const variant = baseMenuItem.variants?.find((v) => v.id === oi.variant_id);
      const addons: Addon[] = (oi.addons || []).map((a) => ({
        id: a.addon_id || a.addon_name,
        addon_group_id: '',
        name: a.addon_name,
        price_paise: a.price_paise,
        price_inr: a.price_paise / 100,
        is_available: true,
      }));

      return {
        id: oi.id,
        menuItem: baseMenuItem,
        variant,
        addons,
        quantity: oi.quantity,
        unitPricePaise: oi.unit_price_paise,
        lineTotalPaise: oi.line_total_paise,
        notes: oi.notes || '',
        isExistingPrinted: oi.kot_status === 'printed',
      };
    });

    const nextState = {
      orderType: order.order_type,
      selectedTableId: order.table_id || null,
      selectedTableNumber: order.table_number_snapshot || null,
      activeOrderId: order.id,
      activeOrderCode: order.order_code,
      customerName: order.customer_name || '',
      customerPhone: order.customer_phone || '',
      customerAddress: order.customer_address || '',
      items: loadedItems,
      discountType: order.discount_type || null,
      discountValue: order.discount_value || 0,
      orderNotes: order.notes || '',
    };

    persistState(nextState);
    set(nextState);
  },

  clearCart: () => {
    const emptyState = {
      selectedTableId: null,
      selectedTableNumber: null,
      activeOrderId: null,
      activeOrderCode: null,
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      items: [],
      discountType: null,
      discountValue: 0,
      orderNotes: '',
    };
    persistState(emptyState);
    set(emptyState);
  },

  getSubtotalPaise: () => {
    return get().items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  },

  getDiscountPaise: () => {
    const { items, discountType, discountValue } = get();
    const subtotal = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
    if (!discountType || discountValue <= 0 || subtotal <= 0) return 0;
    if (discountType === 'percentage') {
      return Math.min(subtotal, Math.round((subtotal * discountValue) / 100));
    }
    return Math.min(subtotal, Math.round(discountValue * 100));
  },

  getEstimatedTaxPaise: (taxRatePercent, isTaxInclusive = false, isTaxEnabled = true) => {
    if (!isTaxEnabled || taxRatePercent <= 0) return 0;
    const subtotal = get().getSubtotalPaise();
    const discount = get().getDiscountPaise();
    const net = Math.max(0, subtotal - discount);
    if (net <= 0) return 0;
    if (isTaxInclusive) {
      return Math.round((net * taxRatePercent) / (100 + taxRatePercent));
    }
    return Math.round((net * taxRatePercent) / 100);
  },

  getGrandTotalPaise: (taxRatePercent, isTaxInclusive = false, isTaxEnabled = true) => {
    const subtotal = get().getSubtotalPaise();
    const discount = get().getDiscountPaise();
    const net = Math.max(0, subtotal - discount);
    if (!isTaxEnabled || taxRatePercent <= 0) return net;
    if (isTaxInclusive) {
      return net;
    }
    const tax = Math.round((net * taxRatePercent) / 100);
    return net + tax;
  },

  getTotalItemsCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
