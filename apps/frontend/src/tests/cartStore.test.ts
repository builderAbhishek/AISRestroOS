import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '../store/cartStore';
import { MenuItem, MenuVariant, Addon } from '../types';

const mockMenuItem: MenuItem = {
  id: 'item-1',
  restaurant_id: 'rest-1',
  category_id: 'cat-1',
  name: 'Paneer Tikka',
  base_price_paise: 20000, // ₹200.00
  base_price_inr: 200.0,
  is_veg: true,
  is_available: true,
  has_variants: true,
  sort_order: 1,
  variants: [],
  addon_groups: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockVariant: MenuVariant = {
  id: 'var-1',
  item_id: 'item-1',
  name: 'Full Portion',
  price_paise: 26000, // ₹260.00
  price_inr: 260.0,
  is_default: true,
  is_available: true,
};

const mockAddon: Addon = {
  id: 'add-1',
  addon_group_id: 'group-1',
  name: 'Extra Mint Chutney',
  price_paise: 2000, // ₹20.00
  price_inr: 20.0,
  is_available: true,
};

describe('POS Cart Store', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it('initializes with empty cart and default dine-in order type', () => {
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.orderType).toBe('dine_in');
    expect(state.getSubtotalPaise()).toBe(0);
  });

  it('adds base item to cart and calculates line total', () => {
    useCartStore.getState().addItem(mockMenuItem, undefined, [], 2);
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(2);
    expect(state.items[0].unitPricePaise).toBe(20000);
    expect(state.items[0].lineTotalPaise).toBe(40000);
    expect(state.getSubtotalPaise()).toBe(40000);
  });

  it('correctly calculates unit price with variant and add-ons', () => {
    useCartStore.getState().addItem(mockMenuItem, mockVariant, [mockAddon], 1, 'Extra spicy');
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    // 26000 (variant) + 2000 (addon) = 28000 paise
    expect(state.items[0].unitPricePaise).toBe(28000);
    expect(state.items[0].lineTotalPaise).toBe(28000);
    expect(state.items[0].notes).toBe('Extra spicy');
  });

  it('updates quantity and removes item when quantity reaches zero', () => {
    useCartStore.getState().addItem(mockMenuItem, undefined, [], 1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);

    // Increase
    useCartStore.getState().updateQuantity(0, 1);
    expect(useCartStore.getState().items[0].quantity).toBe(2);
    expect(useCartStore.getState().items[0].lineTotalPaise).toBe(40000);

    // Decrease twice -> item should be removed
    useCartStore.getState().updateQuantity(0, -1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);

    useCartStore.getState().updateQuantity(0, -1);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('calculates percentage and amount discounts and taxes correctly', () => {
    useCartStore.getState().addItem(mockMenuItem, undefined, [], 1); // ₹200 (20000 paise)
    
    // 10% discount on ₹200 = ₹20 (2000 paise)
    useCartStore.getState().setDiscount('percentage', 10);
    expect(useCartStore.getState().getDiscountPaise()).toBe(2000);

    // 5% GST on taxable ₹180 (18000 paise) = ₹9.00 (900 paise)
    expect(useCartStore.getState().getEstimatedTaxPaise(5.0)).toBe(900);

    // Grand total = 18000 + 900 = 18900 paise (₹189.00)
    expect(useCartStore.getState().getGrandTotalPaise(5.0)).toBe(18900);
  });
});
