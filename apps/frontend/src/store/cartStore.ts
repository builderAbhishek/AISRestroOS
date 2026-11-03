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
  getEstimatedTaxPaise: (taxRatePercent: number) => number;
  getGrandTotalPaise: (taxRatePercent: number) => number;
  getTotalItemsCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  orderType: 'dine_in',
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

  setOrderType: (type) =>
    set({
      orderType: type,
      // If switching to takeaway/delivery, clear table
      ...(type !== 'dine_in' ? { selectedTableId: null, selectedTableNumber: null } : {}),
    }),

  setTable: (tableId, tableNumber) =>
    set({ selectedTableId: tableId, selectedTableNumber: tableNumber }),

  setCustomer: (name, phone, address = '') =>
    set({ customerName: name, customerPhone: phone, customerAddress: address }),

  setDiscount: (type, value) =>
    set({ discountType: type, discountValue: Math.max(0, value) }),

  setOrderNotes: (notes) => set({ orderNotes: notes }),

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
          ci.notes === notes
      );

      if (existingIdx >= 0) {
        const updated = [...state.items];
        const existing = updated[existingIdx];
        const newQty = existing.quantity + quantity;
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
          lineTotalPaise: unitPrice * newQty,
        };
        return { items: updated };
      }

      const newItem: CartItem = {
        menuItem: item,
        variant,
        addons,
        quantity,
        unitPricePaise: unitPrice,
        lineTotalPaise: unitPrice * quantity,
        notes,
      };

      return { items: [...state.items, newItem] };
    });
  },

  updateQuantity: (index, delta) => {
    set((state) => {
      const updated = [...state.items];
      const item = updated[index];
      if (!item) return state;

      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return { items: updated.filter((_, i) => i !== index) };
      }

      updated[index] = {
        ...item,
        quantity: newQty,
        lineTotalPaise: item.unitPricePaise * newQty,
      };
      return { items: updated };
    });
  },

  removeItem: (index) => {
    set((state) => ({
      items: state.items.filter((_, i) => i !== index),
    }));
  },

  updateNotes: (index, notes) => {
    set((state) => {
      const updated = [...state.items];
      if (updated[index]) {
        updated[index] = { ...updated[index], notes };
      }
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
          is_available: true,
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

    set({
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
    });
  },

  clearCart: () =>
    set({
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
    }),

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

  getEstimatedTaxPaise: (taxRatePercent) => {
    const subtotal = get().getSubtotalPaise();
    const discount = get().getDiscountPaise();
    const taxable = Math.max(0, subtotal - discount);
    if (taxable <= 0 || taxRatePercent <= 0) return 0;
    return Math.round((taxable * taxRatePercent) / 100);
  },

  getGrandTotalPaise: (taxRatePercent) => {
    const subtotal = get().getSubtotalPaise();
    const discount = get().getDiscountPaise();
    const tax = get().getEstimatedTaxPaise(taxRatePercent);
    return Math.max(0, subtotal - discount + tax);
  },

  getTotalItemsCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
