import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { menuApi, tablesApi, ordersApi, kotApi, restaurantApi } from '@/services/api';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { formatINR } from '@/lib/utils';
import { MenuItem, OrderType, RestaurantTable } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import {
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  Receipt,
  ChevronDown,
  Armchair,
  Sparkles,
} from 'lucide-react';

export const POSView: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    orderType,
    setOrderType,
    selectedTableId,
    selectedTableNumber,
    setTable,
    activeOrderId,
    activeOrderCode,
    items: cartItems,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    loadExistingOrder,
    getSubtotalPaise,
    getDiscountPaise,
    getEstimatedTaxPaise,
    getGrandTotalPaise,
    getTotalItemsCount,
  } = useCartStore();

  const {
    routeParams,
    openVariantModal,
    openKOTModal,
    openSettlementModal,
    addToast,
  } = useUIStore();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'veg' | 'non_veg' | 'egg'>('all');
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [isSubmittingKOT, setIsSubmittingKOT] = useState(false);

  // 1. Restaurant Settings Query (to read active tax config)
  const { data: restaurant } = useQuery({
    queryKey: ['restaurant'],
    queryFn: restaurantApi.getCurrent,
  });

  const isTaxEnabled = restaurant?.settings?.is_tax_enabled ?? true;
  const isTaxInclusive = restaurant?.settings?.is_tax_inclusive ?? false;
  const taxRate = isTaxEnabled ? (restaurant?.settings?.tax_rate_percent ?? 0.0) : 0.0;
  const taxType = restaurant?.settings?.tax_type || 'CGST_SGST';

  // 2. Categories Query
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: menuApi.listCategories,
  });

  // 3. Isolated POS Menu Items Query
  const { data: menuItems = [], isLoading: isMenuLoading } = useQuery({
    queryKey: ['pos-menu-items'],
    queryFn: () => menuApi.listItems({ available_only: true }),
  });

  // 4. Tables Query
  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: () => tablesApi.listTables(),
    refetchInterval: 5000,
  });

  // Automatically resume active order or table from route parameters on mount
  useEffect(() => {
    if (routeParams.orderId && routeParams.orderId !== activeOrderId) {
      ordersApi.getOrder(routeParams.orderId).then((ord) => {
        loadExistingOrder(ord, menuItems);
      }).catch(console.error);
    } else if (routeParams.tableId && !selectedTableId) {
      tablesApi.getActiveOrder(routeParams.tableId).then((ord) => {
        if (ord) {
          loadExistingOrder(ord, menuItems);
        } else {
          const t = tables.find((x) => x.id === routeParams.tableId);
          if (t) setTable(t.id, t.table_number);
        }
      }).catch(console.error);
    }
  }, [routeParams.orderId, routeParams.tableId, menuItems, tables, activeOrderId, selectedTableId]);

  // Filter menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (selectedCategoryId !== 'all' && item.category_id !== selectedCategoryId) {
        return false;
      }
      if (itemTypeFilter !== 'all') {
        const effectiveType = item.item_type || (item.is_veg ? 'veg' : 'non_veg');
        if (effectiveType !== itemTypeFilter) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(term);
        const matchesCode = item.item_code?.toLowerCase().includes(term);
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    });
  }, [menuItems, selectedCategoryId, itemTypeFilter, searchTerm]);

  // Handle Item Click: If has variants or addons, open modal, else add directly
  const handleItemClick = (item: MenuItem) => {
    if ((item.variants && item.variants.length > 0) || (item.addon_groups && item.addon_groups.length > 0)) {
      openVariantModal(item);
    } else {
      addItem(item, undefined, [], 1, '');
    }
  };

  // Table selection logic
  const handleSelectTable = async (table: RestaurantTable) => {
    setIsTablePickerOpen(false);

    if (table.status === 'occupied') {
      try {
        let existingOrder: any = null;
        if (table.current_order_id) {
          existingOrder = await ordersApi.getOrder(table.current_order_id);
        } else {
          existingOrder = await tablesApi.getActiveOrder(table.id);
        }

        if (existingOrder) {
          loadExistingOrder(existingOrder, menuItems);
          addToast({
            type: 'info',
            title: `Resumed Table ${table.table_number}`,
            description: `Loaded active order ${existingOrder.order_code}. New items will append to this order.`,
          });
          return;
        }
      } catch (err: any) {
        addToast({
          type: 'error',
          title: 'Error loading table order',
          description: err.message,
        });
      }
    }
    setTable(table.id, table.table_number);
  };

  // STEP 3: "Add & Print KOT"
  const handleAddAndPrintKOT = async () => {
    if (cartItems.length === 0) {
      addToast({
        type: 'warning',
        title: 'Empty Cart',
        description: 'Please add at least one item before printing KOT.',
      });
      return;
    }

    if (orderType === 'dine_in' && !selectedTableId) {
      setIsTablePickerOpen(true);
      addToast({
        type: 'warning',
        title: 'Table Required',
        description: 'Please select a dine-in table.',
      });
      return;
    }

    setIsSubmittingKOT(true);
    try {
      let orderId = activeOrderId;

      if (!orderId) {
        // Save initial active order
        const createPayload = {
          order_type: orderType,
          table_id: selectedTableId,
          discount_type: useCartStore.getState().discountType,
          discount_value: useCartStore.getState().discountValue,
          customer_name: useCartStore.getState().customerName || undefined,
          customer_phone: useCartStore.getState().customerPhone || undefined,
          items: cartItems.map((ci) => ({
            menu_item_id: ci.menuItem.id,
            variant_id: ci.variant?.id,
            quantity: ci.quantity,
            notes: ci.notes,
            addons: ci.addons.map((a) => ({
              addon_id: a.id,
              addon_name: a.name,
              price_paise: a.price_paise,
            })),
          })),
        };

        const newOrder = await ordersApi.createOrder(createPayload);
        orderId = newOrder.id;
        loadExistingOrder(newOrder, menuItems);
      } else {
        // Update order with current cart items
        const updatePayload = {
          items: cartItems.map((ci) => ({
            menu_item_id: ci.menuItem.id,
            variant_id: ci.variant?.id,
            quantity: ci.quantity,
            notes: ci.notes,
            addons: ci.addons.map((a) => ({
              addon_id: a.id,
              addon_name: a.name,
              price_paise: a.price_paise,
            })),
          })),
        };
        const updatedOrder = await ordersApi.updateOrderItems(orderId, updatePayload);
        loadExistingOrder(updatedOrder, menuItems);
      }

      // Generate & Print KOT
      const printResult = await kotApi.generateKOT(orderId);
      openKOTModal(printResult);

      if (printResult.is_new_items_printed) {
        addToast({
          type: 'success',
          title: `KOT ${printResult.kot.kot_code} Sent`,
          description: `${printResult.kot.items.length} items sent to kitchen thermal printer.`,
        });
      } else {
        addToast({
          type: 'info',
          title: 'All Items Already Printed',
          description: 'No new items detected. Kitchen already has this order ticket.',
        });
      }

      // Refresh order to update printed_quantity flags
      const refreshedOrder = await ordersApi.getOrder(orderId);
      loadExistingOrder(refreshedOrder, menuItems);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'KOT Generation Failed',
        description: err.message,
      });
    } finally {
      setIsSubmittingKOT(false);
    }
  };

  // STEP 4: "Generate Bill / Settle"
  const handleGenerateBillSettle = async () => {
    if (cartItems.length === 0) {
      addToast({
        type: 'warning',
        title: 'Empty Cart',
        description: 'Please add at least one item before generating bill.',
      });
      return;
    }

    if (orderType === 'dine_in' && !selectedTableId) {
      setIsTablePickerOpen(true);
      addToast({
        type: 'warning',
        title: 'Table Required',
        description: 'Please select a dine-in table.',
      });
      return;
    }

    try {
      let orderId = activeOrderId;
      let orderToSettle = null;

      if (!orderId) {
        // Save order first
        const createPayload = {
          order_type: orderType,
          table_id: selectedTableId,
          discount_type: useCartStore.getState().discountType,
          discount_value: useCartStore.getState().discountValue,
          customer_name: useCartStore.getState().customerName || undefined,
          customer_phone: useCartStore.getState().customerPhone || undefined,
          items: cartItems.map((ci) => ({
            menu_item_id: ci.menuItem.id,
            variant_id: ci.variant?.id,
            quantity: ci.quantity,
            notes: ci.notes,
            addons: ci.addons.map((a) => ({
              addon_id: a.id,
              addon_name: a.name,
              price_paise: a.price_paise,
            })),
          })),
        };
        orderToSettle = await ordersApi.createOrder(createPayload);
        orderId = orderToSettle.id;
        loadExistingOrder(orderToSettle, menuItems);
      } else {
        // Ensure latest cart items are saved to backend
        const updatePayload = {
          items: cartItems.map((ci) => ({
            menu_item_id: ci.menuItem.id,
            variant_id: ci.variant?.id,
            quantity: ci.quantity,
            notes: ci.notes,
            addons: ci.addons.map((a) => ({
              addon_id: a.id,
              addon_name: a.name,
              price_paise: a.price_paise,
            })),
          })),
        };
        orderToSettle = await ordersApi.updateOrderItems(orderId, updatePayload);
        loadExistingOrder(orderToSettle, menuItems);
      }

      openSettlementModal(orderToSettle);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error Generating Bill',
        description: err.message,
      });
    }
  };

  const subtotalPaise = getSubtotalPaise();
  const discountPaise = getDiscountPaise();
  const estimatedTaxPaise = getEstimatedTaxPaise(taxRate, isTaxInclusive, isTaxEnabled);
  const grandTotalPaise = getGrandTotalPaise(taxRate, isTaxInclusive, isTaxEnabled);

  return (
    <div className="flex h-full w-full gap-4 overflow-hidden select-none">
      {/* ========================================================= */}
      {/* LEFT COLUMN: MENU CATALOG (~65% width)                   */}
      {/* ========================================================= */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-white rounded-card border border-[#E8EAF0] shadow-card">
        {/* POS Header Controls */}
        <div className="p-4 border-b border-[#E8EAF0] space-y-3 bg-[#FAFAFB]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Order Type Tabs */}
            <div className="flex items-center rounded-xl border border-[#E8EAF0] bg-white p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setOrderType('dine_in')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  orderType === 'dine_in'
                    ? 'bg-[#F07818] text-white shadow-xs'
                    : 'text-[#6B7280] hover:text-[#202124]'
                }`}
              >
                <UtensilsCrossed className="h-3.5 w-3.5" />
                <span>Dine-in</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderType('takeaway')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  orderType === 'takeaway'
                    ? 'bg-[#F07818] text-white shadow-xs'
                    : 'text-[#6B7280] hover:text-[#202124]'
                }`}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Takeaway</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderType('delivery')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  orderType === 'delivery'
                    ? 'bg-[#F07818] text-white shadow-xs'
                    : 'text-[#6B7280] hover:text-[#202124]'
                }`}
              >
                <Bike className="h-3.5 w-3.5" />
                <span>Delivery</span>
              </button>
            </div>

            {/* Table Selector for Dine-in */}
            {orderType === 'dine_in' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTablePickerOpen(!isTablePickerOpen)}
                  className="flex items-center gap-2 h-9 px-3 rounded-xl border border-[#F07818] bg-[#FFF0E3] text-[#C85A0A] font-bold text-xs shadow-2xs hover:bg-[#ffe4cc] transition-colors cursor-pointer"
                >
                  <Armchair className="h-4 w-4 text-[#F07818]" />
                  <span>
                    {selectedTableNumber ? `Table: ${selectedTableNumber}` : 'Select Table *'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {/* Table Picker Dropdown */}
                {isTablePickerOpen && (
                  <div className="absolute left-0 top-11 z-40 w-72 rounded-xl border border-[#E8EAF0] bg-white p-3 shadow-modal animate-in fade-in zoom-in-95">
                    <p className="text-xs font-bold text-[#202124] mb-2">Select Restaurant Table</p>
                    <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
                      {tables.map((t) => {
                        const isOccupied = t.status === 'occupied';
                        const isCurrent = t.id === selectedTableId;

                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectTable(t)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                              isCurrent
                                ? 'border-[#F07818] bg-[#F07818] text-white'
                                : isOccupied
                                ? 'border-[#F07818]/40 bg-[#FFF0E3] text-[#C85A0A]'
                                : 'border-[#E8EAF0] bg-[#FAFAFB] text-[#202124] hover:border-[#16865B] hover:bg-[#EBF7F2]'
                            }`}
                          >
                            <span>{t.table_number}</span>
                            <span className="text-[9px] font-normal opacity-80">
                              {isOccupied ? 'Occupied' : 'Free'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search Input & Item Type Toggles */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search item name or code..."
                  className="h-9 w-full rounded-xl border border-[#E8EAF0] bg-white pl-9 pr-3 text-xs text-[#202124] placeholder:text-[#9CA3AF] focus:border-[#F07818] focus:outline-none"
                />
              </div>

              {/* Veg / Non-Veg / Egg Toggle */}
              <div className="flex rounded-lg border border-[#E8EAF0] bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setItemTypeFilter('all')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                    itemTypeFilter === 'all' ? 'bg-[#F07818] text-white' : 'text-[#6B7280]'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setItemTypeFilter('veg')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                    itemTypeFilter === 'veg' ? 'bg-[#16865B] text-white' : 'text-[#16865B]'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[#16865B] inline-block" />
                  Veg
                </button>
                <button
                  type="button"
                  onClick={() => setItemTypeFilter('non_veg')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                    itemTypeFilter === 'non_veg' ? 'bg-[#D94343] text-white' : 'text-[#D94343]'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[#D94343] inline-block" />
                  Non-Veg
                </button>
                <button
                  type="button"
                  onClick={() => setItemTypeFilter('egg')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                    itemTypeFilter === 'egg' ? 'bg-[#E39D12] text-white' : 'text-[#E39D12]'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[#E39D12] inline-block" />
                  Egg
                </button>
              </div>
            </div>
          </div>

          {/* Category Navigation Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategoryId === 'all'
                  ? 'bg-[#F07818] text-white shadow-xs'
                  : 'bg-white border border-[#E8EAF0] text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              All Categories ({menuItems.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategoryId === cat.id
                    ? 'bg-[#F07818] text-white shadow-xs'
                    : 'bg-white border border-[#E8EAF0] text-[#6B7280] hover:text-[#202124]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isMenuLoading ? (
            <LoadingState message="Loading menu catalogue..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No items found"
              description="Try adjusting your search query, item type or category filter."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredItems.map((item) => {
                const hasVariants = item.variants && item.variants.length > 0;
                const hasAddons = item.addon_groups && item.addon_groups.length > 0;
                const itemType = item.item_type || (item.is_veg ? 'veg' : 'non_veg');

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="group relative flex flex-col justify-between rounded-xl border border-[#E8EAF0] bg-white p-3 hover:border-[#F07818] hover:shadow-card transition-all cursor-pointer"
                  >
                    <div>
                      {/* Top indicator & Item Code */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            itemType === 'veg'
                              ? 'border-[#16865B] text-[#16865B]'
                              : itemType === 'egg'
                              ? 'border-[#E39D12] text-[#E39D12]'
                              : 'border-[#D94343] text-[#D94343]'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              itemType === 'veg'
                                ? 'bg-[#16865B]'
                                : itemType === 'egg'
                                ? 'bg-[#E39D12]'
                                : 'bg-[#D94343]'
                            }`}
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          {item.is_bestseller && (
                            <span className="rounded bg-[#FFF0E3] px-1 py-0.2 text-[8px] font-bold text-[#C85A0A] uppercase">
                              ★ Bestseller
                            </span>
                          )}
                          {item.item_code && (
                            <span className="text-[10px] font-mono text-[#9CA3AF]">
                              {item.item_code}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Name & Portions tag */}
                      <h4 className="text-xs font-bold text-[#202124] group-hover:text-[#F07818] transition-colors line-clamp-2">
                        {item.name}
                      </h4>

                      {(hasVariants || hasAddons) && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="rounded bg-[#FFF0E3] px-1.5 py-0.5 text-[9px] font-bold text-[#C85A0A]">
                            {hasVariants ? 'Customisable' : 'Addons'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Price & Add button */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#F0F2F6]">
                      <span className="text-xs font-extrabold text-[#202124]">
                        {hasVariants ? 'From ' : ''}
                        {formatINR(item.base_price_paise)}
                      </span>

                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF0E3] text-[#F07818] group-hover:bg-[#F07818] group-hover:text-white transition-colors">
                        <Plus className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT COLUMN: CART & BILLING PANEL (~35% width)           */}
      {/* ========================================================= */}
      <div className="w-80 md:w-96 xl:w-[420px] flex flex-col h-full bg-white rounded-card border border-[#E8EAF0] shadow-card overflow-hidden shrink-0">
        {/* Cart Header */}
        <div className="p-4 border-b border-[#E8EAF0] bg-[#FAFAFB] flex items-center justify-between">
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#202124]">Active POS Order</h3>
              <Badge variant="bhagwa" size="sm">
                {orderType.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {orderType === 'dine_in'
                ? selectedTableNumber
                  ? `Table ${selectedTableNumber}`
                  : 'No table selected'
                : 'Direct Order'}{' '}
              {activeOrderCode && `• ${activeOrderCode}`}
            </p>
          </div>

          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-semibold text-[#D94343] hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Scrollable Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-[#E8EAF0]">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-[#9CA3AF] p-6">
              <ShoppingBag className="h-10 w-10 mb-2 opacity-40 text-[#F07818]" />
              <p className="text-xs font-semibold text-[#202124]">Cart is empty</p>
              <p className="text-[11px] text-[#6B7280] mt-1">
                Click any item from the menu catalog on the left to begin this order.
              </p>
            </div>
          ) : (
            cartItems.map((item, idx) => (
              <div key={idx} className="py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#202124]">
                        {item.menuItem.name}
                      </span>
                      {item.isExistingPrinted && (
                        <span className="rounded bg-[#EBF7F2] px-1 py-0.5 text-[9px] font-bold text-[#16865B]">
                          Sent to Kitchen
                        </span>
                      )}
                    </div>
                    {item.variant && (
                      <p className="text-[11px] font-medium text-[#C85A0A]">
                        Portion: {item.variant.name}
                      </p>
                    )}
                    {item.addons.length > 0 && (
                      <p className="text-[10px] text-[#6B7280]">
                        + {item.addons.map((a) => a.name).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[10px] italic text-[#F07818]">
                        Note: {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Line Total */}
                  <span className="text-xs font-bold text-[#202124] shrink-0">
                    {formatINR(item.lineTotalPaise)}
                  </span>
                </div>

                {/* Quantity Controls & Unit Price */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-[#6B7280]">
                    {formatINR(item.unitPricePaise)} each
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateQuantity(idx, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E8EAF0] text-[#202124] hover:bg-[#F7F8FA] cursor-pointer"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-[#202124]">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(idx, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E8EAF0] text-[#202124] hover:bg-[#F7F8FA] cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="ml-1 p-1 text-[#D94343] hover:bg-[#FDECEC] rounded cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bill Summary & POS Primary Actions */}
        <div className="p-4 border-t border-[#E8EAF0] bg-[#FAFAFB] space-y-3">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-[#6B7280]">
              <span>Subtotal ({getTotalItemsCount()} items)</span>
              <span className="font-semibold text-[#202124]">{formatINR(subtotalPaise)}</span>
            </div>
            {discountPaise > 0 && (
              <div className="flex justify-between text-[#D94343]">
                <span>Discount</span>
                <span className="font-semibold">-{formatINR(discountPaise)}</span>
              </div>
            )}
            
            {/* Dynamic Tax Display */}
            {isTaxEnabled && taxRate > 0 && (
              <div className="flex justify-between text-[#6B7280]">
                <span>
                  {isTaxInclusive ? 'Taxes Included' : 'Tax'} ({taxRate}% {taxType})
                </span>
                <span className="font-semibold text-[#202124]">
                  {isTaxInclusive ? '' : '+'}{formatINR(estimatedTaxPaise)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-1.5 border-t border-[#E8EAF0] text-sm">
              <span className="font-bold text-[#202124]">Grand Total</span>
              <span className="text-xl font-extrabold text-[#F07818]">
                {formatINR(grandTotalPaise)}
              </span>
            </div>
          </div>

          {/* TWO PRIMARY POS ACTIONS */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Primary Action 1: Add & Print KOT */}
            <Button
              type="button"
              onClick={handleAddAndPrintKOT}
              variant="secondary"
              isLoading={isSubmittingKOT}
              disabled={cartItems.length === 0}
              className="w-full text-xs font-bold gap-1.5 h-11 border border-[#F07818]/40"
            >
              <Printer className="h-4 w-4 text-[#F07818]" />
              <span>Add & Print KOT</span>
            </Button>

            {/* Primary Action 2: Generate Bill / Settle */}
            <Button
              type="button"
              onClick={handleGenerateBillSettle}
              variant="primary"
              disabled={cartItems.length === 0}
              className="w-full text-xs font-bold gap-1.5 h-11 shadow-md shadow-[#F07818]/25"
            >
              <Receipt className="h-4 w-4" />
              <span>Generate Bill / Settle</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
