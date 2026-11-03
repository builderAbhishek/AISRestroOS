import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  LayoutDashboard,
  Tags,
  Truck,
  ShoppingCart,
  BookOpen,
  AlertTriangle,
  History,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Package,
  Layers,
  DollarSign,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { inventoryApi, menuApi } from '@/services/api';
import {
  InventoryItem,
  InventoryCategory,
  Supplier,
  Purchase,
  Recipe,
  WastageRecord,
  StockMovement,
  MenuItem,
} from '@/types';
import { Badge } from '@/components/ui/Badge';
import { useUIStore } from '@/store/uiStore';

type InventoryTab =
  | 'dashboard'
  | 'items'
  | 'categories'
  | 'suppliers'
  | 'purchases'
  | 'recipes'
  | 'wastage'
  | 'movements';

export const InventoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<InventoryTab>('dashboard');
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();
  const notify = (title: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    addToast({ title, type });
  };

  // Queries
  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['inventoryDashboard'],
    queryFn: inventoryApi.getDashboard,
  });

  const { data: items = [], isLoading: isItemsLoading } = useQuery({
    queryKey: ['inventoryItems'],
    queryFn: () => inventoryApi.listItems(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['inventoryCategories'],
    queryFn: inventoryApi.listCategories,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['inventorySuppliers'],
    queryFn: inventoryApi.listSuppliers,
  });

  const { data: purchases = [], isLoading: isPurchasesLoading } = useQuery({
    queryKey: ['inventoryPurchases'],
    queryFn: () => inventoryApi.listPurchases(),
  });

  const { data: recipes = [], isLoading: isRecipesLoading } = useQuery({
    queryKey: ['inventoryRecipes'],
    queryFn: inventoryApi.listRecipes,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems'],
    queryFn: () => menuApi.listItems(),
  });

  const { data: wastageList = [] } = useQuery({
    queryKey: ['inventoryWastage'],
    queryFn: inventoryApi.listWastage,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['inventoryMovements'],
    queryFn: () => inventoryApi.listMovements(),
  });

  // State for Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemFormData, setItemFormData] = useState({
    name: '',
    sku: '',
    category_id: '',
    supplier_id: '',
    unit: 'kg',
    current_stock: 0,
    minimum_stock: 0,
    reorder_level: 0,
    cost_per_unit_paise: 0,
    notes: '',
  });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supData, setSupData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
  });

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: '',
    invoice_number: '',
    notes: '',
    auto_receive: true,
    items: [{ inventory_item_id: '', quantity: 1, unit: 'kg', unit_cost_inr: 0 }],
  });

  const [showWastageModal, setShowWastageModal] = useState(false);
  const [wastageForm, setWastageForm] = useState({
    inventory_item_id: '',
    quantity: 1,
    reason: 'Spoilage',
    notes: '',
  });

  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    inventory_item_id: '',
    adjustment_type: 'add',
    quantity: 1,
    reason: 'Physical count adjustment',
    notes: '',
  });

  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    menu_item_id: '',
    variant_id: '',
    notes: '',
    ingredients: [{ inventory_item_id: '', quantity: 0.1, unit: 'kg' }],
  });

  // Filtering states
  const [itemSearch, setItemSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: (data: any) => {
      const sanitized = {
        ...data,
        category_id: data.category_id ? data.category_id : undefined,
        supplier_id: data.supplier_id ? data.supplier_id : undefined,
        sku: data.sku && typeof data.sku === 'string' && data.sku.trim() ? data.sku.trim() : undefined,
      };
      return editingItem
        ? inventoryApi.updateItem(editingItem.id, sanitized)
        : inventoryApi.createItem(sanitized);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] });
      setShowItemModal(false);
      setEditingItem(null);
      notify(editingItem ? 'Item updated successfully' : 'Item added successfully', 'success');
    },
    onError: (err: any) => notify(err.message || 'Failed to save inventory item', 'error'),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => inventoryApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryCategories'] });
      setShowCategoryModal(false);
      setCatName('');
      setCatDesc('');
      notify('Category created', 'success');
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: (data: any) => inventoryApi.createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventorySuppliers'] });
      setShowSupplierModal(false);
      setSupData({ name: '', contact_person: '', phone: '', email: '', address: '', gst_number: '' });
      notify('Supplier added', 'success');
    },
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (data: any) => inventoryApi.createPurchase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryPurchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryDashboard'] });
      setShowPurchaseModal(false);
      notify('Purchase order saved', 'success');
    },
    onError: (err: any) => notify(err.message, 'error'),
  });

  const receivePurchaseMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.receivePurchase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryPurchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryDashboard'] });
      notify('Purchase received and stock incremented', 'success');
    },
  });

  const cancelPurchaseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      inventoryApi.cancelPurchase(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryPurchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryDashboard'] });
      notify('Purchase cancelled & stock reversed', 'info');
    },
  });

  const recordWastageMutation = useMutation({
    mutationFn: (data: any) => inventoryApi.recordWastage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryWastage'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryDashboard'] });
      setShowWastageModal(false);
      notify('Wastage logged and stock deducted', 'success');
    },
    onError: (err: any) => notify(err.message, 'error'),
  });

  const recordAdjustmentMutation = useMutation({
    mutationFn: (data: any) => inventoryApi.recordAdjustment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryDashboard'] });
      setShowAdjustmentModal(false);
      notify('Stock adjustment applied', 'success');
    },
    onError: (err: any) => notify(err.message, 'error'),
  });

  const saveRecipeMutation = useMutation({
    mutationFn: (data: any) => inventoryApi.createOrUpdateRecipe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryRecipes'] });
      setShowRecipeModal(false);
      notify('Recipe saved successfully', 'success');
    },
    onError: (err: any) => notify(err.message, 'error'),
  });

  // Filtered items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(itemSearch.toLowerCase()));
    const matchesCat =
      selectedCatFilter === 'all' || item.category_id === selectedCatFilter;
    const matchesLow = !lowStockFilter || item.current_stock <= item.reorder_level;
    return matchesSearch && matchesCat && matchesLow;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E8EAED] gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#202124] flex items-center gap-2">
            <Boxes className="w-7 h-7 text-[#F07818]" />
            Inventory & Stock Management
          </h1>
          <p className="text-xs text-[#5F6368]">
            Offline-first stock tracking, purchase orders, recipes & consumption ledger
          </p>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setAdjustmentForm({
                inventory_item_id: items[0]?.id || '',
                adjustment_type: 'add',
                quantity: 1,
                reason: 'Physical count adjustment',
                notes: '',
              });
              setShowAdjustmentModal(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E8EAED] bg-white hover:bg-[#F1F3F4] text-[#3C4043] flex items-center gap-1.5 shadow-sm transition"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Adjust Stock
          </button>
          <button
            onClick={() => {
              setWastageForm({
                inventory_item_id: items[0]?.id || '',
                quantity: 1,
                reason: 'Spoilage',
                notes: '',
              });
              setShowWastageModal(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E8EAED] bg-white hover:bg-[#F1F3F4] text-[#3C4043] flex items-center gap-1.5 shadow-sm transition"
          >
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Record Wastage
          </button>
          <button
            onClick={() => {
              setPurchaseForm({
                supplier_id: suppliers[0]?.id || '',
                invoice_number: '',
                notes: '',
                auto_receive: true,
                items: [{ inventory_item_id: items[0]?.id || '', quantity: 1, unit: 'kg', unit_cost_inr: 100 }],
              });
              setShowPurchaseModal(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition"
          >
            <ShoppingCart className="w-4 h-4" />
            New Purchase
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setItemFormData({
                name: '',
                sku: '',
                category_id: categories[0]?.id || '',
                supplier_id: suppliers[0]?.id || '',
                unit: 'kg',
                current_stock: 0,
                minimum_stock: 0,
                reorder_level: 0,
                cost_per_unit_paise: 0,
                notes: '',
              });
              setShowItemModal(true);
            }}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#F07818] hover:bg-[#D9670E] text-white flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Add Stock Item
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E8EAED] gap-2 overflow-x-auto text-xs font-medium text-[#5F6368]">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'items', label: `Stock Items (${items.length})`, icon: Boxes },
          { id: 'categories', label: `Categories (${categories.length})`, icon: Tags },
          { id: 'suppliers', label: `Suppliers (${suppliers.length})`, icon: Truck },
          { id: 'purchases', label: `Purchases (${purchases.length})`, icon: ShoppingCart },
          { id: 'recipes', label: `Recipes (${recipes.length})`, icon: BookOpen },
          { id: 'wastage', label: `Wastage (${wastageList.length})`, icon: AlertTriangle },
          { id: 'movements', label: 'Movement Ledger', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as InventoryTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-[#F07818] text-[#F07818] font-bold'
                  : 'border-transparent hover:text-[#202124] hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#5F6368] font-medium">
                  <span>Total Stock Items</span>
                  <Boxes className="w-4 h-4 text-[#F07818]" />
                </div>
                <div className="mt-2 text-2xl font-bold text-[#202124]">
                  {dashboard?.total_items || items.length}
                </div>
                <span className="text-[11px] text-emerald-600 font-medium">Active in database</span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#5F6368] font-medium">
                  <span>Total Stock Value</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-bold text-[#202124]">
                  ₹{((dashboard?.total_stock_value_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-[#5F6368]">Weighted avg cost</span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#5F6368] font-medium">
                  <span>Low Stock Items</span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-600">
                  {dashboard?.low_stock_count || 0}
                </div>
                <span className="text-[11px] text-amber-700">At or below reorder level</span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#5F6368] font-medium">
                  <span>Out of Stock</span>
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <div className="mt-2 text-2xl font-bold text-red-600">
                  {dashboard?.out_of_stock_count || 0}
                </div>
                <span className="text-[11px] text-red-600">0 or negative stock</span>
              </div>
            </div>

            {/* Daily Movement Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#5F6368] font-medium">Today's Purchases</div>
                  <div className="text-lg font-bold text-emerald-700 mt-1">
                    ₹{((dashboard?.today_purchases_paise || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#5F6368] font-medium">Today's Stock Consumption</div>
                  <div className="text-lg font-bold text-blue-700 mt-1">
                    ₹{((dashboard?.today_consumption_paise || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#5F6368] font-medium">Today's Recorded Wastage</div>
                  <div className="text-lg font-bold text-red-700 mt-1">
                    ₹{((dashboard?.today_wastage_paise || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Tables / Lists Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Low Stock Alerts */}
              <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm p-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
                  <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Low Stock & Reorder Alerts
                  </h3>
                  <button
                    onClick={() => {
                      setLowStockFilter(true);
                      setActiveTab('items');
                    }}
                    className="text-xs text-[#F07818] font-medium hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="divide-y divide-[#E8EAED] mt-2">
                  {(!dashboard?.low_stock_items || dashboard.low_stock_items.length === 0) ? (
                    <div className="py-6 text-center text-xs text-[#5F6368]">
                      All inventory stock levels are healthy!
                    </div>
                  ) : (
                    dashboard.low_stock_items.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-[#202124]">{item.name}</div>
                          <div className="text-[11px] text-[#5F6368]">
                            Reorder: {item.reorder_level} {item.unit} | Min: {item.minimum_stock} {item.unit}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              item.current_stock <= 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.current_stock} {item.unit}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Stock Movements */}
              <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm p-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
                  <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-500" />
                    Recent Stock Movements
                  </h3>
                  <button
                    onClick={() => setActiveTab('movements')}
                    className="text-xs text-[#F07818] font-medium hover:underline"
                  >
                    Full Ledger
                  </button>
                </div>
                <div className="divide-y divide-[#E8EAED] mt-2">
                  {(!dashboard?.recent_movements || dashboard.recent_movements.length === 0) ? (
                    <div className="py-6 text-center text-xs text-[#5F6368]">
                      No stock movements recorded yet.
                    </div>
                  ) : (
                    dashboard.recent_movements.slice(0, 6).map((mov) => (
                      <div key={mov.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-medium text-[#202124]">{mov.item_name}</div>
                          <div className="text-[10px] text-[#5F6368]">{mov.reason || mov.movement_type}</div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-mono font-bold text-xs ${
                              mov.quantity_change > 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {mov.quantity_change > 0 ? `+${mov.quantity_change}` : mov.quantity_change}{' '}
                            {mov.unit}
                          </span>
                          <div className="text-[10px] text-[#5F6368]">
                            Bal: {mov.quantity_after} {mov.unit}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. STOCK ITEMS TAB */}
        {activeTab === 'items' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E8EAED] shadow-sm">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by item name or SKU..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#E8EAED] focus:outline-none focus:ring-1 focus:ring-[#F07818]"
                  />
                </div>

                <select
                  value={selectedCatFilter}
                  onChange={(e) => setSelectedCatFilter(e.target.value)}
                  className="py-1.5 px-3 text-xs rounded-lg border border-[#E8EAED] bg-white focus:outline-none focus:ring-1 focus:ring-[#F07818]"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLowStockFilter(!lowStockFilter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    lowStockFilter
                      ? 'bg-amber-500 border-amber-600 text-white'
                      : 'border-[#E8EAED] bg-white text-[#5F6368] hover:bg-gray-50'
                  }`}
                >
                  Low Stock Only
                </button>
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E8EAED] text-[#5F6368] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-right">Min / Reorder</th>
                    <th className="py-3 px-4 text-right">Cost/Unit</th>
                    <th className="py-3 px-4 text-right">Stock Valuation</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED]">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#5F6368]">
                        No inventory items found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F8F9FA] transition">
                        <td className="py-3 px-4 font-semibold text-[#202124]">
                          {item.name}
                          {item.notes && <div className="text-[10px] text-gray-400">{item.notes}</div>}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-500">{item.sku || '—'}</td>
                        <td className="py-3 px-4 text-gray-600">{item.category_name || 'General'}</td>
                        <td className="py-3 px-4 text-right font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono ${
                              item.current_stock <= 0
                                ? 'bg-red-100 text-red-700'
                                : item.current_stock <= item.reorder_level
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.current_stock} {item.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-500 font-mono">
                          {item.minimum_stock} / {item.reorder_level} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#202124]">
                          ₹{(item.cost_per_unit_paise / 100).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold font-mono text-emerald-700">
                          ₹{((item.stock_value_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setItemFormData({
                                  name: item.name,
                                  sku: item.sku || '',
                                  category_id: item.category_id || '',
                                  supplier_id: item.supplier_id || '',
                                  unit: item.unit,
                                  current_stock: item.current_stock,
                                  minimum_stock: item.minimum_stock,
                                  reorder_level: item.reorder_level,
                                  cost_per_unit_paise: item.cost_per_unit_paise,
                                  notes: item.notes || '',
                                });
                                setShowItemModal(true);
                              }}
                              className="text-xs text-[#F07818] hover:underline font-medium"
                            >
                              Edit
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => {
                                setAdjustmentForm({
                                  inventory_item_id: item.id,
                                  adjustment_type: 'add',
                                  quantity: 1,
                                  reason: 'Count update',
                                  notes: '',
                                });
                                setShowAdjustmentModal(true);
                              }}
                              className="text-xs text-blue-600 hover:underline font-medium"
                            >
                              Adjust
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. CATEGORIES TAB */}
        {activeTab === 'categories' && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#202124]">Inventory Categories</h2>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F07818] text-white flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E8EAED] text-[#5F6368] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED]">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F8F9FA]">
                      <td className="py-3 px-4 font-semibold text-[#202124]">{c.name}</td>
                      <td className="py-3 px-4 text-gray-500">{c.description || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            if (confirm(`Delete category "${c.name}"?`)) {
                              inventoryApi.deleteCategory(c.id).then(() => {
                                queryClient.invalidateQueries({ queryKey: ['inventoryCategories'] });
                                notify('Category removed', 'info');
                              });
                            }
                          }}
                          className="text-xs text-red-600 hover:underline font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. SUPPLIERS TAB */}
        {activeTab === 'suppliers' && (
          <div className="space-y-4 max-w-5xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#202124]">Suppliers & Vendors</h2>
              <button
                onClick={() => setShowSupplierModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F07818] text-white flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Supplier
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E8EAED] text-[#5F6368] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4">Contact Person</th>
                    <th className="py-3 px-4">Phone / Email</th>
                    <th className="py-3 px-4">GSTIN</th>
                    <th className="py-3 px-4">Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED]">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F8F9FA]">
                      <td className="py-3 px-4 font-semibold text-[#202124]">{s.name}</td>
                      <td className="py-3 px-4 text-gray-700">{s.contact_person || '—'}</td>
                      <td className="py-3 px-4 text-gray-600">
                        <div>{s.phone}</div>
                        {s.email && <div className="text-[10px] text-gray-400">{s.email}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">{s.gstin || s.gst_number || '—'}</td>
                      <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{s.address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. PURCHASES TAB */}
        {activeTab === 'purchases' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#202124]">Purchase Orders (POs)</h2>
              <button
                onClick={() => {
                  setPurchaseForm({
                    supplier_id: suppliers[0]?.id || '',
                    invoice_number: '',
                    notes: '',
                    auto_receive: true,
                    items: [{ inventory_item_id: items[0]?.id || '', quantity: 1, unit: 'kg', unit_cost_inr: 100 }],
                  });
                  setShowPurchaseModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Create Purchase Order
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E8EAED] text-[#5F6368] font-semibold">
                  <tr>
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4 text-right">Total Cost</th>
                    <th className="py-3 px-4 text-right">Paid / Due</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED]">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#5F6368]">
                        No purchase records yet. Click "Create Purchase Order" to add one.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-[#F8F9FA]">
                        <td className="py-3 px-4 font-mono font-bold text-[#202124]">{p.purchase_number}</td>
                        <td className="py-3 px-4 font-medium">{p.supplier_name || 'Direct / Cash'}</td>
                        <td className="py-3 px-4 font-mono text-gray-500">{p.invoice_number || '—'}</td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900 font-mono">
                          ₹{(p.total_cost_paise / 100).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <span className="text-emerald-700">₹{(p.paid_amount_paise / 100).toFixed(2)}</span>
                          {p.due_amount_paise > 0 && (
                            <div className="text-[10px] text-red-600 font-bold">
                              Due: ₹{(p.due_amount_paise / 100).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              p.status === 'received'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'draft'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {p.status === 'draft' && (
                              <button
                                onClick={() => receivePurchaseMutation.mutate(p.id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px]"
                              >
                                Receive
                              </button>
                            )}
                            {p.status !== 'cancelled' && (
                              <button
                                onClick={() => {
                                  const reason = prompt('Reason for cancelling purchase order?');
                                  if (reason) cancelPurchaseMutation.mutate({ id: p.id, reason });
                                }}
                                className="text-xs text-red-600 hover:underline font-medium"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. RECIPES TAB */}
        {activeTab === 'recipes' && (
          <div className="space-y-4 max-w-5xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#202124]">Recipe & Ingredient Mapping</h2>
                <p className="text-xs text-[#5F6368]">
                  Link menu items to raw inventory ingredients for automatic deduction on POS order settlement
                </p>
              </div>
              <button
                onClick={() => {
                  setRecipeForm({
                    menu_item_id: menuItems[0]?.id || '',
                    variant_id: '',
                    notes: '',
                    ingredients: [{ inventory_item_id: items[0]?.id || '', quantity: 0.1, unit: 'kg' }],
                  });
                  setShowRecipeModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F07818] text-white flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Map Menu Item Recipe
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recipes.length === 0 ? (
                <div className="col-span-2 py-12 text-center bg-white rounded-xl border border-[#E8EAED] text-xs text-[#5F6368]">
                  No recipes mapped yet. Map recipes to enable automatic stock deduction and COGS reporting.
                </div>
              ) : (
                recipes.map((r) => (
                  <div key={r.id} className="p-4 bg-white rounded-xl border border-[#E8EAED] shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-[#202124]">{r.menu_item_name}</h4>
                          {r.variant_name && (
                            <span className="text-[11px] text-[#F07818] font-semibold">
                              Variant: {r.variant_name}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500 font-medium">Portion Cost</span>
                          <div className="text-sm font-bold text-emerald-700 font-mono">
                            ₹{(r.total_cost_paise / 100).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Ingredients list */}
                      <div className="mt-3 pt-3 border-t border-[#E8EAED] space-y-1.5 text-xs">
                        <div className="text-[11px] font-semibold text-gray-500 uppercase">Ingredients</div>
                        {r.ingredients.map((ing) => (
                          <div key={ing.id} className="flex justify-between text-gray-700">
                            <span>
                              {ing.inventory_item_name} ({ing.quantity} {ing.unit})
                            </span>
                            <span className="font-mono text-gray-500">
                              ₹{(ing.total_cost_paise / 100).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E8EAED] flex justify-end">
                      <button
                        onClick={() => {
                          if (confirm(`Remove recipe for ${r.menu_item_name}?`)) {
                            inventoryApi.deleteRecipe(r.id).then(() => {
                              queryClient.invalidateQueries({ queryKey: ['inventoryRecipes'] });
                              notify('Recipe removed', 'info');
                            });
                          }
                        }}
                        className="text-xs text-red-600 hover:underline font-medium"
                      >
                        Remove Recipe
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 7. WASTAGE & ADJUSTMENTS TAB */}
        {activeTab === 'wastage' && (
          <div className="space-y-6 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-red-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Record Wastage / Spoilage
                  </h3>
                  <p className="text-xs text-red-700 mt-1">
                    Log expired, damaged, spilled, or burnt stock items with mandatory reasons.
                  </p>
                </div>
                <button
                  onClick={() => setShowWastageModal(true)}
                  className="mt-4 w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Record Wastage Entry
                </button>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-blue-600" />
                    Manual Stock Audit Correction
                  </h3>
                  <p className="text-xs text-blue-700 mt-1">
                    Correct stock counts following physical inventory audits (Add, Subtract, or Set Exact).
                  </p>
                </div>
                <button
                  onClick={() => setShowAdjustmentModal(true)}
                  className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Apply Stock Adjustment
                </button>
              </div>
            </div>

            {/* Wastage Log Table */}
            <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[#E8EAED]">
                <h3 className="text-sm font-bold text-[#202124]">Wastage History</h3>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E8EAED] text-[#5F6368] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-right">Cost Loss</th>
                    <th className="py-3 px-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED]">
                  {wastageList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No wastage recorded.
                      </td>
                    </tr>
                  ) : (
                    wastageList.map((w) => (
                      <tr key={w.id} className="hover:bg-[#F8F9FA]">
                        <td className="py-3 px-4 text-gray-500 font-mono">
                          {w.created_at ? new Date(w.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#202124]">{w.item_name}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-600">
                          {w.quantity} {w.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-700">
                          ₹{(w.cost_paise / 100).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-gray-700">{w.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. MOVEMENTS LEDGER TAB */}
        {activeTab === 'movements' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#202124]">Stock Movement Ledger</h2>
                <p className="text-xs text-[#5F6368]">
                  Immutable chronological audit log of all stock increases, consumption, wastage, and adjustments
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E8EAED] text-[#5F6368] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4 text-center">Movement Type</th>
                    <th className="py-3 px-4 text-right">Quantity Change</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                    <th className="py-3 px-4 text-right">Total Cost</th>
                    <th className="py-3 px-4">Audit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED]">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No stock movement records found.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-[#F8F9FA]">
                        <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                          {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#202124]">{m.item_name}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              m.movement_type.includes('IN')
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.movement_type.includes('SALE')
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {m.movement_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          <span className={m.quantity_change >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change} {m.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                          {m.quantity_after} {m.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-700">
                          ₹{(m.total_cost_paise / 100).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-[11px]">{m.reason || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
              <h3 className="font-bold text-base text-[#202124]">
                {editingItem ? 'Edit Inventory Item' : 'New Inventory Item'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basmati Rice, Fresh Paneer"
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] focus:ring-1 focus:ring-[#F07818]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-gray-700">SKU / Code</label>
                  <input
                    type="text"
                    placeholder="RAW-RIC-01"
                    value={itemFormData.sku}
                    onChange={(e) => setItemFormData({ ...itemFormData, sku: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                  />
                </div>
                <div>
                  <label className="font-medium text-gray-700">Category</label>
                  <select
                    value={itemFormData.category_id}
                    onChange={(e) => setItemFormData({ ...itemFormData, category_id: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] bg-white"
                  >
                    <option value="">General</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-gray-700">Unit of Measure</label>
                  <select
                    value={itemFormData.unit}
                    onChange={(e) => setItemFormData({ ...itemFormData, unit: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] bg-white font-medium"
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="L">Litre (L)</option>
                    <option value="ml">Millilitre (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="packet">Packet</option>
                    <option value="bottle">Bottle</option>
                    <option value="box">Box</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-gray-700">Supplier</label>
                  <select
                    value={itemFormData.supplier_id}
                    onChange={(e) => setItemFormData({ ...itemFormData, supplier_id: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] bg-white"
                  >
                    <option value="">Direct / Cash</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-medium text-gray-700">Initial Stock</label>
                  <input
                    type="number"
                    step="any"
                    disabled={!!editingItem}
                    value={itemFormData.current_stock}
                    onChange={(e) => setItemFormData({ ...itemFormData, current_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                  />
                </div>
                <div>
                  <label className="font-medium text-gray-700">Min Stock</label>
                  <input
                    type="number"
                    step="any"
                    value={itemFormData.minimum_stock}
                    onChange={(e) => setItemFormData({ ...itemFormData, minimum_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                  />
                </div>
                <div>
                  <label className="font-medium text-gray-700">Reorder Level</label>
                  <input
                    type="number"
                    step="any"
                    value={itemFormData.reorder_level}
                    onChange={(e) => setItemFormData({ ...itemFormData, reorder_level: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-gray-700">Purchase Cost Per Unit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={itemFormData.cost_per_unit_paise / 100}
                  onChange={(e) =>
                    setItemFormData({
                      ...itemFormData,
                      cost_per_unit_paise: Math.round((parseFloat(e.target.value) || 0) * 100),
                    })
                  }
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EAED]">
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="px-4 py-2 rounded-lg border border-[#E8EAED] text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createItemMutation.mutate(itemFormData)}
                disabled={!itemFormData.name.trim() || createItemMutation.isPending}
                className="px-4 py-2 rounded-lg bg-[#F07818] hover:bg-[#D9670E] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {createItemMutation.isPending ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CATEGORY */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-[#202124]">Add Category</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dairy, Spices, Vegetables"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                />
              </div>
              <div>
                <label className="font-medium text-gray-700">Description</label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EAED]">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => createCategoryMutation.mutate({ name: catName, description: catDesc })}
                disabled={!catName.trim()}
                className="px-4 py-2 rounded-lg bg-[#F07818] text-white text-xs font-semibold shadow-sm"
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-[#202124]">Add Supplier</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700">Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Farm Fresh Supplies"
                  value={supData.name}
                  onChange={(e) => setSupData({ ...supData, name: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-gray-700">Contact Person</label>
                  <input
                    type="text"
                    value={supData.contact_person}
                    onChange={(e) => setSupData({ ...supData, contact_person: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                  />
                </div>
                <div>
                  <label className="font-medium text-gray-700">Phone</label>
                  <input
                    type="text"
                    value={supData.phone}
                    onChange={(e) => setSupData({ ...supData, phone: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-gray-700">GSTIN</label>
                  <input
                    type="text"
                    placeholder="24AAAAA0000A1Z5"
                    value={supData.gst_number}
                    onChange={(e) => setSupData({ ...supData, gst_number: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                  />
                </div>
                <div>
                  <label className="font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={supData.email}
                    onChange={(e) => setSupData({ ...supData, email: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                  />
                </div>
              </div>
              <div>
                <label className="font-medium text-gray-700">Address</label>
                <textarea
                  rows={2}
                  value={supData.address}
                  onChange={(e) => setSupData({ ...supData, address: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EAED]">
              <button
                onClick={() => setShowSupplierModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => createSupplierMutation.mutate(supData)}
                disabled={!supData.name.trim()}
                className="px-4 py-2 rounded-lg bg-[#F07818] text-white text-xs font-semibold shadow-sm"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW PURCHASE */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-[#202124]">Create Purchase Order</h3>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-gray-700">Supplier</label>
                  <select
                    value={purchaseForm.supplier_id}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] bg-white"
                  >
                    <option value="">Direct Store / Cash</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Supplier Invoice #</label>
                  <input
                    type="text"
                    placeholder="INV-9908"
                    value={purchaseForm.invoice_number}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_number: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className="font-medium text-gray-700 mb-2 block">Purchase Items</label>
                <div className="space-y-2">
                  {purchaseForm.items.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={line.inventory_item_id}
                        onChange={(e) => {
                          const newItems = [...purchaseForm.items];
                          const selected = items.find((i) => i.id === e.target.value);
                          newItems[idx].inventory_item_id = e.target.value;
                          if (selected) {
                            newItems[idx].unit = selected.unit;
                            newItems[idx].unit_cost_inr = selected.cost_per_unit_paise / 100;
                          }
                          setPurchaseForm({ ...purchaseForm, items: newItems });
                        }}
                        className="flex-1 p-2 rounded-lg border border-[#E8EAED] bg-white"
                      >
                        <option value="">Select Item</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="any"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => {
                          const newItems = [...purchaseForm.items];
                          newItems[idx].quantity = parseFloat(e.target.value) || 0;
                          setPurchaseForm({ ...purchaseForm, items: newItems });
                        }}
                        className="w-20 p-2 rounded-lg border border-[#E8EAED]"
                      />

                      <span className="w-12 text-gray-500 font-mono text-center">{line.unit}</span>

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Cost (₹)"
                        value={line.unit_cost_inr}
                        onChange={(e) => {
                          const newItems = [...purchaseForm.items];
                          newItems[idx].unit_cost_inr = parseFloat(e.target.value) || 0;
                          setPurchaseForm({ ...purchaseForm, items: newItems });
                        }}
                        className="w-24 p-2 rounded-lg border border-[#E8EAED]"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (purchaseForm.items.length > 1) {
                            setPurchaseForm({
                              ...purchaseForm,
                              items: purchaseForm.items.filter((_, i) => i !== idx),
                            });
                          }
                        }}
                        className="text-red-500 hover:text-red-700 px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPurchaseForm({
                      ...purchaseForm,
                      items: [
                        ...purchaseForm.items,
                        { inventory_item_id: items[0]?.id || '', quantity: 1, unit: 'kg', unit_cost_inr: 0 },
                      ],
                    })
                  }
                  className="mt-2 text-xs font-semibold text-[#F07818] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Another Item
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="auto_receive"
                  checked={purchaseForm.auto_receive}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, auto_receive: e.target.checked })}
                  className="rounded text-[#F07818] focus:ring-[#F07818]"
                />
                <label htmlFor="auto_receive" className="text-gray-700 font-medium">
                  Immediately receive stock into inventory (increments stock now)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EAED]">
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const payload = {
                    supplier_id: purchaseForm.supplier_id || undefined,
                    invoice_number: purchaseForm.invoice_number || undefined,
                    auto_receive: purchaseForm.auto_receive,
                    notes: purchaseForm.notes || undefined,
                    items: purchaseForm.items.map((i) => ({
                      inventory_item_id: i.inventory_item_id,
                      quantity: i.quantity,
                      unit: i.unit,
                      unit_cost_paise: Math.round(i.unit_cost_inr * 100),
                    })),
                  };
                  createPurchaseMutation.mutate(payload);
                }}
                disabled={purchaseForm.items.some((i) => !i.inventory_item_id || i.quantity <= 0)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                Save Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECORD WASTAGE */}
      {showWastageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Record Stock Wastage
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700">Inventory Item *</label>
                <select
                  value={wastageForm.inventory_item_id}
                  onChange={(e) => setWastageForm({ ...wastageForm, inventory_item_id: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] bg-white font-medium"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Stock: {i.current_stock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700">Wasted Quantity *</label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={wastageForm.quantity}
                  onChange={(e) => setWastageForm({ ...wastageForm, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700">Reason *</label>
                <select
                  value={wastageForm.reason}
                  onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] bg-white"
                >
                  <option value="Spoilage / Expired">Spoilage / Expired</option>
                  <option value="Burnt in Cooking">Burnt in Cooking</option>
                  <option value="Kitchen Spill / Dropped">Kitchen Spill / Dropped</option>
                  <option value="Quality Rejection">Quality Rejection</option>
                  <option value="Customer Return">Customer Return</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700">Notes</label>
                <input
                  type="text"
                  placeholder="Optional details"
                  value={wastageForm.notes}
                  onChange={(e) => setWastageForm({ ...wastageForm, notes: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EAED]">
              <button
                onClick={() => setShowWastageModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => recordWastageMutation.mutate(wastageForm)}
                disabled={!wastageForm.inventory_item_id || wastageForm.quantity <= 0}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                Log Wastage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-blue-900 flex items-center gap-1.5">
              <Boxes className="w-5 h-5 text-blue-600" />
              Stock Adjustment
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700">Inventory Item *</label>
                <select
                  value={adjustmentForm.inventory_item_id}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, inventory_item_id: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] bg-white font-medium"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Current: {i.current_stock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700">Action Type *</label>
                <select
                  value={adjustmentForm.adjustment_type}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] bg-white font-semibold"
                >
                  <option value="add">Add to current stock (+)</option>
                  <option value="subtract">Subtract from current stock (-)</option>
                  <option value="set">Set exact stock balance (=)</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-gray-700">Quantity *</label>
                <input
                  type="number"
                  step="any"
                  value={adjustmentForm.quantity}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700">Mandatory Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly physical audit correction"
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EAED]">
              <button
                onClick={() => setShowAdjustmentModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => recordAdjustmentMutation.mutate(adjustmentForm)}
                disabled={!adjustmentForm.reason.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECIPE MAPPING */}
      {showRecipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-[#202124]">Map Menu Item Recipe</h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-gray-700">Menu Item *</label>
                <select
                  value={recipeForm.menu_item_id}
                  onChange={(e) => {
                    const mId = e.target.value;
                    const selected = menuItems.find((m) => m.id === mId);
                    setRecipeForm({
                      ...recipeForm,
                      menu_item_id: mId,
                      variant_id: selected?.variants?.[0]?.id || '',
                    });
                  }}
                  className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] bg-white font-semibold"
                >
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (₹{m.base_price_inr})
                    </option>
                  ))}
                </select>
              </div>

              {/* Variant selection if menu item has variants */}
              {(() => {
                const selectedMenuItem = menuItems.find((m) => m.id === recipeForm.menu_item_id);
                if (selectedMenuItem?.variants && selectedMenuItem.variants.length > 0) {
                  return (
                    <div>
                      <label className="font-medium text-gray-700">Variant (Optional)</label>
                      <select
                        value={recipeForm.variant_id}
                        onChange={(e) => setRecipeForm({ ...recipeForm, variant_id: e.target.value })}
                        className="w-full mt-1 p-2 rounded-lg border border-[#E8EAED] bg-white"
                      >
                        <option value="">Base / Default Recipe</option>
                        {selectedMenuItem.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} (₹{v.price_inr})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Ingredients list */}
              <div>
                <label className="font-medium text-gray-700 mb-2 block">Ingredients per Portion</label>
                <div className="space-y-2">
                  {recipeForm.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={ing.inventory_item_id}
                        onChange={(e) => {
                          const newIngs = [...recipeForm.ingredients];
                          const selected = items.find((i) => i.id === e.target.value);
                          newIngs[idx].inventory_item_id = e.target.value;
                          if (selected) newIngs[idx].unit = selected.unit;
                          setRecipeForm({ ...recipeForm, ingredients: newIngs });
                        }}
                        className="flex-1 p-2 rounded-lg border border-[#E8EAED] bg-white"
                      >
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit}) - ₹{(i.cost_per_unit_paise / 100).toFixed(2)}/{i.unit}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="any"
                        placeholder="Quantity"
                        value={ing.quantity}
                        onChange={(e) => {
                          const newIngs = [...recipeForm.ingredients];
                          newIngs[idx].quantity = parseFloat(e.target.value) || 0;
                          setRecipeForm({ ...recipeForm, ingredients: newIngs });
                        }}
                        className="w-24 p-2 rounded-lg border border-[#E8EAED]"
                      />

                      <span className="w-12 text-gray-500 font-mono text-center">{ing.unit}</span>

                      <button
                        type="button"
                        onClick={() => {
                          if (recipeForm.ingredients.length > 1) {
                            setRecipeForm({
                              ...recipeForm,
                              ingredients: recipeForm.ingredients.filter((_, i) => i !== idx),
                            });
                          }
                        }}
                        className="text-red-500 hover:text-red-700 px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setRecipeForm({
                      ...recipeForm,
                      ingredients: [
                        ...recipeForm.ingredients,
                        { inventory_item_id: items[0]?.id || '', quantity: 0.1, unit: 'kg' },
                      ],
                    })
                  }
                  className="mt-2 text-xs font-semibold text-[#F07818] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Another Ingredient
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EAED]">
              <button
                onClick={() => setShowRecipeModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const payload = {
                    menu_item_id: recipeForm.menu_item_id,
                    variant_id: recipeForm.variant_id || undefined,
                    notes: recipeForm.notes || undefined,
                    ingredients: recipeForm.ingredients.map((ing) => ({
                      inventory_item_id: ing.inventory_item_id,
                      quantity: ing.quantity,
                      unit: ing.unit,
                    })),
                  };
                  saveRecipeMutation.mutate(payload);
                }}
                disabled={recipeForm.ingredients.some((i) => !i.inventory_item_id || i.quantity <= 0)}
                className="px-4 py-2 rounded-lg bg-[#F07818] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                Save Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
