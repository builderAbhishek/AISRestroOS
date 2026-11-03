import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { menuApi, restaurantApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { formatINR } from '@/lib/utils';
import { MenuItem, MenuCategory, AddonGroup, Restaurant } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Copy,
  CheckCircle,
  AlertCircle,
  FolderPlus,
  Search,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Clock,
  Layers,
  Tag,
  Sliders,
  X,
  Percent,
  Check,
  Flame,
  Star,
  Info,
} from 'lucide-react';

interface VariantDraft {
  name: string;
  price_inr: string;
  is_default: boolean;
  is_available: boolean;
}

interface AddonDraft {
  name: string;
  price_inr: string;
  is_available: boolean;
}

export const MenuView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  const [activeTab, setActiveTab] = useState<'items' | 'categories' | 'addons'>('items');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'veg' | 'non_veg' | 'egg'>('all');
  const [selectedAvailabilityFilter, setSelectedAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');

  // Item Create/Edit Modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemModalTab, setItemModalTab] = useState<'basic' | 'pricing' | 'variants' | 'addons' | 'prep'>('basic');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Item Form Fields
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemType, setItemType] = useState<'veg' | 'non_veg' | 'egg'>('veg');
  const [itemIsAvailable, setItemIsAvailable] = useState(true);
  const [itemIsRecommended, setItemIsRecommended] = useState(false);
  const [itemIsBestseller, setItemIsBestseller] = useState(false);
  const [itemSortOrder, setItemSortOrder] = useState<number>(0);

  // Item Pricing & Tax Fields
  const [itemBasePriceINR, setItemBasePriceINR] = useState('');
  const [itemTaxMode, setItemTaxMode] = useState<'inherit' | 'inclusive' | 'exclusive'>('inherit');
  const [itemTaxOverrideStr, setItemTaxOverrideStr] = useState('');

  // Item Variants & Addons
  const [variantsList, setVariantsList] = useState<VariantDraft[]>([]);
  const [selectedAddonGroupIds, setSelectedAddonGroupIds] = useState<string[]>([]);
  const [itemPrepMinutes, setItemPrepMinutes] = useState('');

  // Inline/Quick Addon Group Creation Modal
  const [isNewAddonGroupModalOpen, setIsNewAddonGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIsRequired, setNewGroupIsRequired] = useState(false);
  const [newGroupMinSelection, setNewGroupMinSelection] = useState<number>(0);
  const [newGroupMaxSelection, setNewGroupMaxSelection] = useState<number>(3);
  const [newGroupAddons, setNewGroupAddons] = useState<AddonDraft[]>([
    { name: 'Extra Portion', price_inr: '40.00', is_available: true },
  ]);

  // Category Modal states
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');

  // Confirmation Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: 'Confirm',
    onConfirm: () => {},
  });

  // Queries
  const { data: restaurant } = useQuery<Restaurant>({
    queryKey: ['restaurant'],
    queryFn: restaurantApi.getCurrent,
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<MenuCategory[]>({
    queryKey: ['categories'],
    queryFn: menuApi.listCategories,
  });

  const { data: menuItems = [], isLoading: isLoadingItems } = useQuery<MenuItem[]>({
    queryKey: ['menu-items'],
    queryFn: () => menuApi.listItems(),
  });

  const { data: addonGroups = [] } = useQuery<AddonGroup[]>({
    queryKey: ['addon-groups'],
    queryFn: menuApi.listAddonGroups,
  });

  // Open Add Item Modal
  const openAddItemModal = () => {
    setEditingItem(null);
    setItemModalTab('basic');
    setItemName('');
    setItemCode('');
    setItemCategoryId(categories[0]?.id || '');
    setItemDescription('');
    setItemImageUrl('');
    setItemType('veg');
    setItemIsAvailable(true);
    setItemIsRecommended(false);
    setItemIsBestseller(false);
    setItemSortOrder(menuItems.length);
    setItemBasePriceINR('');
    setItemTaxMode('inherit');
    setItemTaxOverrideStr('');
    setVariantsList([]);
    setSelectedAddonGroupIds([]);
    setItemPrepMinutes('15');
    setIsItemModalOpen(true);
  };

  // Open Edit Item Modal
  const openEditItemModal = (item: MenuItem) => {
    setEditingItem(item);
    setItemModalTab('basic');
    setItemName(item.name);
    setItemCode(item.item_code || '');
    setItemCategoryId(item.category_id);
    setItemDescription(item.description || '');
    setItemImageUrl(item.image_url || '');
    setItemType(item.item_type || (item.is_veg ? 'veg' : 'non_veg'));
    setItemIsAvailable(item.is_available);
    setItemIsRecommended(Boolean(item.is_recommended));
    setItemIsBestseller(Boolean(item.is_bestseller));
    setItemSortOrder(item.sort_order || 0);

    setItemBasePriceINR((item.base_price_paise / 100).toString());
    if (item.is_tax_inclusive === null || item.is_tax_inclusive === undefined) {
      setItemTaxMode('inherit');
    } else {
      setItemTaxMode(item.is_tax_inclusive ? 'inclusive' : 'exclusive');
    }
    setItemTaxOverrideStr(
      item.tax_rate_override_percent !== null && item.tax_rate_override_percent !== undefined
        ? item.tax_rate_override_percent.toString()
        : ''
    );

    if (item.variants && item.variants.length > 0) {
      setVariantsList(
        item.variants.map((v) => ({
          name: v.name,
          price_inr: (v.price_paise / 100).toString(),
          is_default: v.is_default,
          is_available: v.is_available,
        }))
      );
    } else {
      setVariantsList([]);
    }

    if (item.addon_groups && item.addon_groups.length > 0) {
      setSelectedAddonGroupIds(item.addon_groups.map((g) => g.id));
    } else {
      setSelectedAddonGroupIds([]);
    }

    setItemPrepMinutes(item.preparation_time_minutes ? item.preparation_time_minutes.toString() : '');
    setIsItemModalOpen(true);
  };

  // Live Price Preview Calculation
  const pricePreview = useMemo(() => {
    const rawPrice = parseFloat(itemBasePriceINR);
    if (isNaN(rawPrice) || rawPrice <= 0) {
      return null;
    }

    const settings = restaurant?.settings;
    const isTaxEnabled = settings?.is_tax_enabled ?? true;
    const defaultTaxRate = settings?.tax_rate_percent ?? 5.0;
    const defaultInclusive = settings?.is_tax_inclusive ?? false;
    const taxType = settings?.tax_type || 'CGST_SGST';

    const effectiveInclusive =
      itemTaxMode === 'inherit' ? defaultInclusive : itemTaxMode === 'inclusive';

    let effectiveRate = defaultTaxRate;
    if (itemTaxOverrideStr.trim() !== '') {
      const parsedOverride = parseFloat(itemTaxOverrideStr);
      if (!isNaN(parsedOverride)) {
        effectiveRate = parsedOverride;
      }
    }

    const pricePaise = Math.round(rawPrice * 100);

    if (!isTaxEnabled || effectiveRate === 0) {
      return {
        basePaise: pricePaise,
        taxablePaise: pricePaise,
        taxPaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        finalPaise: pricePaise,
        taxType: 'NON_GST',
        effectiveRate: 0,
        isTaxInclusive: effectiveInclusive,
        isTaxEnabled: false,
      };
    }

    let taxablePaise = 0;
    let taxPaise = 0;
    let finalPaise = 0;

    if (effectiveInclusive) {
      finalPaise = pricePaise;
      taxPaise = Math.round((finalPaise * effectiveRate) / (100.0 + effectiveRate));
      taxablePaise = finalPaise - taxPaise;
    } else {
      taxablePaise = pricePaise;
      taxPaise = Math.round((taxablePaise * effectiveRate) / 100.0);
      finalPaise = taxablePaise + taxPaise;
    }

    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;

    if (taxType === 'CGST_SGST') {
      cgstPaise = Math.round(taxPaise / 2);
      sgstPaise = taxPaise - cgstPaise;
    } else if (taxType === 'IGST') {
      igstPaise = taxPaise;
    }

    return {
      basePaise: pricePaise,
      taxablePaise,
      taxPaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      finalPaise,
      taxType,
      effectiveRate,
      isTaxInclusive: effectiveInclusive,
      isTaxEnabled: true,
    };
  }, [itemBasePriceINR, itemTaxMode, itemTaxOverrideStr, restaurant]);

  // Variant Helpers
  const handleAddVariantRow = () => {
    const isFirst = variantsList.length === 0;
    setVariantsList([
      ...variantsList,
      {
        name: isFirst ? 'Regular' : 'Large',
        price_inr: itemBasePriceINR || '250.00',
        is_default: isFirst,
        is_available: true,
      },
    ]);
  };

  const handleRemoveVariantRow = (index: number) => {
    const updated = variantsList.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some((v) => v.is_default)) {
      updated[0].is_default = true;
    }
    setVariantsList(updated);
  };

  const handleSetDefaultVariant = (index: number) => {
    setVariantsList(
      variantsList.map((v, i) => ({
        ...v,
        is_default: i === index,
      }))
    );
  };

  // Addon Group Helpers
  const handleToggleAddonGroup = (groupId: string) => {
    if (selectedAddonGroupIds.includes(groupId)) {
      setSelectedAddonGroupIds(selectedAddonGroupIds.filter((id) => id !== groupId));
    } else {
      setSelectedAddonGroupIds([...selectedAddonGroupIds, groupId]);
    }
  };

  // Quick Addon Group Creation Handler
  const handleSaveNewAddonGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      addToast({ type: 'error', title: 'Validation', description: 'Group name is required.' });
      return;
    }
    const validAddons = newGroupAddons.filter((a) => a.name.trim() !== '');
    if (validAddons.length === 0) {
      addToast({ type: 'error', title: 'Validation', description: 'Add at least one option to the group.' });
      return;
    }

    try {
      const created = await menuApi.createAddonGroup({
        name: newGroupName.trim(),
        is_required: newGroupIsRequired,
        min_selection: newGroupIsRequired ? Math.max(1, newGroupMinSelection) : newGroupMinSelection,
        max_selection: Math.max(1, newGroupMaxSelection),
        addons: validAddons.map((a) => ({
          name: a.name.trim(),
          price_paise: Math.round(parseFloat(a.price_inr || '0') * 100),
          is_available: a.is_available,
        })),
      });

      addToast({
        type: 'success',
        title: 'Add-on Group Created',
        description: `Group "${created.name}" created and attached to this item.`,
      });

      queryClient.invalidateQueries({ queryKey: ['addon-groups'] });
      setSelectedAddonGroupIds((prev) => [...prev, created.id]);
      setIsNewAddonGroupModalOpen(false);
      setNewGroupName('');
      setNewGroupAddons([{ name: 'Extra Cheese', price_inr: '50.00', is_available: true }]);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  // Save Item (Create or Update)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      addToast({ type: 'error', title: 'Validation', description: 'Dish name is required.' });
      setItemModalTab('basic');
      return;
    }
    if (!itemCategoryId) {
      addToast({ type: 'error', title: 'Validation', description: 'Category selection is required.' });
      setItemModalTab('basic');
      return;
    }
    if (!itemBasePriceINR || isNaN(parseFloat(itemBasePriceINR)) || parseFloat(itemBasePriceINR) < 0) {
      addToast({ type: 'error', title: 'Validation', description: 'Valid base price in INR is required.' });
      setItemModalTab('pricing');
      return;
    }

    // Validate variants if any
    const payloadVariants = variantsList.map((v) => ({
      name: v.name.trim(),
      price_paise: Math.round(parseFloat(v.price_inr || '0') * 100),
      is_default: v.is_default,
      is_available: v.is_available,
    }));

    if (payloadVariants.length > 0 && !payloadVariants.some((v) => v.is_default)) {
      payloadVariants[0].is_default = true;
    }

    const pricePaise = Math.round(parseFloat(itemBasePriceINR) * 100);

    const isTaxInclusiveValue =
      itemTaxMode === 'inherit' ? null : itemTaxMode === 'inclusive';

    const taxRateOverrideValue =
      itemTaxOverrideStr.trim() !== '' ? parseFloat(itemTaxOverrideStr) : null;

    const prepTimeMinutes =
      itemPrepMinutes.trim() !== '' ? parseInt(itemPrepMinutes, 10) : null;

    try {
      if (editingItem) {
        await menuApi.updateItem(editingItem.id, {
          name: itemName.trim(),
          item_code: itemCode.trim() || null,
          category_id: itemCategoryId,
          description: itemDescription.trim() || null,
          image_url: itemImageUrl.trim() || null,
          base_price_paise: pricePaise,
          is_veg: itemType === 'veg',
          item_type: itemType,
          is_available: itemIsAvailable,
          is_recommended: itemIsRecommended,
          is_bestseller: itemIsBestseller,
          is_tax_inclusive: isTaxInclusiveValue,
          tax_rate_override_percent: taxRateOverrideValue,
          preparation_time_minutes: prepTimeMinutes,
          sort_order: Number(itemSortOrder) || 0,
          variants: payloadVariants.length > 0 ? payloadVariants : [],
          addon_group_ids: selectedAddonGroupIds,
        });

        addToast({
          type: 'success',
          title: 'Dish Updated',
          description: `"${itemName.trim()}" has been updated.`,
        });
      } else {
        await menuApi.createItem({
          name: itemName.trim(),
          item_code: itemCode.trim() || null,
          category_id: itemCategoryId,
          description: itemDescription.trim() || null,
          image_url: itemImageUrl.trim() || null,
          base_price_paise: pricePaise,
          is_veg: itemType === 'veg',
          item_type: itemType,
          is_available: itemIsAvailable,
          is_recommended: itemIsRecommended,
          is_bestseller: itemIsBestseller,
          is_tax_inclusive: isTaxInclusiveValue,
          tax_rate_override_percent: taxRateOverrideValue,
          preparation_time_minutes: prepTimeMinutes,
          sort_order: Number(itemSortOrder) || 0,
          variants: payloadVariants.length > 0 ? payloadVariants : undefined,
          addon_group_ids: selectedAddonGroupIds,
        });

        addToast({
          type: 'success',
          title: 'Dish Created',
          description: `"${itemName.trim()}" added to your menu.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['pos-menu-items'] });
      setIsItemModalOpen(false);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error Saving Dish', description: err.message });
    }
  };

  // Inline Availability Toggle
  const handleToggleAvailability = async (id: string, currentStatus: boolean, name: string) => {
    try {
      await menuApi.toggleAvailability(id);
      addToast({
        type: 'info',
        title: currentStatus ? 'Marked Unavailable' : 'Marked Available',
        description: `"${name}" is now ${currentStatus ? 'hidden from POS' : 'active on POS'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['pos-menu-items'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  // Duplicate Item
  const handleDuplicateItem = async (id: string, name: string) => {
    try {
      const duplicated = await menuApi.duplicateItem(id);
      addToast({
        type: 'success',
        title: 'Dish Duplicated',
        description: `Created copy "${duplicated.name}".`,
      });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['pos-menu-items'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Duplication Failed', description: err.message });
    }
  };

  // Delete Item Confirmation
  const promptDeleteItem = (item: MenuItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Menu Item?',
      description: `Are you sure you want to delete "${item.name}"? Historical orders and receipts will retain this item safely via soft-delete.`,
      actionLabel: 'Delete Item',
      onConfirm: async () => {
        try {
          await menuApi.deleteItem(item.id);
          addToast({
            type: 'info',
            title: 'Dish Deleted',
            description: `"${item.name}" has been removed from active menu.`,
          });
          queryClient.invalidateQueries({ queryKey: ['menu-items'] });
          queryClient.invalidateQueries({ queryKey: ['pos-menu-items'] });
        } catch (err: any) {
          addToast({ type: 'error', title: 'Error', description: err.message });
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Category Actions
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      if (editingCategory) {
        await menuApi.updateCategory(editingCategory.id, {
          name: catName.trim(),
          description: catDescription.trim() || undefined,
        });
        addToast({ type: 'success', title: 'Updated', description: 'Category updated.' });
      } else {
        await menuApi.createCategory({
          name: catName.trim(),
          description: catDescription.trim() || undefined,
          sort_order: categories.length + 1,
        });
        addToast({ type: 'success', title: 'Created', description: 'Category created.' });
      }
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCatModalOpen(false);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const handleReorderCategory = async (catIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? catIndex - 1 : catIndex + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newOrder = [...categories];
    const temp = newOrder[catIndex];
    newOrder[catIndex] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const payload = newOrder.map((c, idx) => ({
      id: c.id,
      sort_order: idx + 1,
    }));

    try {
      await menuApi.reorderCategories(payload);
      addToast({ type: 'success', title: 'Categories Reordered', description: 'Sort order updated.' });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['pos-menu-items'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const promptDeleteCategory = (cat: MenuCategory) => {
    const itemCount = menuItems.filter((i) => i.category_id === cat.id).length;
    setConfirmDialog({
      isOpen: true,
      title: `Delete Category "${cat.name}"?`,
      description: `This category currently contains ${itemCount} dish(es). Deleting it will safely deactivate the category and items without breaking historical orders.`,
      actionLabel: 'Delete Category',
      onConfirm: async () => {
        try {
          await menuApi.deleteCategory(cat.id);
          addToast({ type: 'info', title: 'Category Deleted', description: `"${cat.name}" removed.` });
          queryClient.invalidateQueries({ queryKey: ['categories'] });
          queryClient.invalidateQueries({ queryKey: ['menu-items'] });
          queryClient.invalidateQueries({ queryKey: ['pos-menu-items'] });
        } catch (err: any) {
          addToast({ type: 'error', title: 'Error', description: err.message });
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Addon Group Actions
  const promptDeleteAddonGroup = (group: AddonGroup) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Add-on Group "${group.name}"?`,
      description: `Are you sure you want to delete this customization group? It will be unlinked from any dishes using it.`,
      actionLabel: 'Delete Add-on Group',
      onConfirm: async () => {
        try {
          await menuApi.deleteAddonGroup(group.id);
          addToast({ type: 'info', title: 'Deleted', description: `Add-on group "${group.name}" removed.` });
          queryClient.invalidateQueries({ queryKey: ['addon-groups'] });
        } catch (err: any) {
          addToast({ type: 'error', title: 'Error', description: err.message });
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Category filter
      if (selectedCatFilter !== 'all' && item.category_id !== selectedCatFilter) {
        return false;
      }
      // Food Type filter
      if (selectedTypeFilter !== 'all') {
        const itemEffectiveType = item.item_type || (item.is_veg ? 'veg' : 'non_veg');
        if (itemEffectiveType !== selectedTypeFilter) return false;
      }
      // Availability filter
      if (selectedAvailabilityFilter === 'available' && !item.is_available) return false;
      if (selectedAvailabilityFilter === 'unavailable' && item.is_available) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          item.name.toLowerCase().includes(term) ||
          (item.item_code && item.item_code.toLowerCase().includes(term)) ||
          (item.description && item.description.toLowerCase().includes(term))
        );
      }
      return true;
    });
  }, [menuItems, selectedCatFilter, selectedTypeFilter, selectedAvailabilityFilter, searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202124] flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#F07818]" />
            <span>Menu & Pricing Catalog</span>
          </h2>
          <p className="text-xs text-[#6B7280]">
            Manage categories, dishes, portion sizes, prices, add-on groups, and offline tax settings
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Navigation Tabs */}
          <div className="flex items-center rounded-xl border border-[#E8EAF0] bg-white p-1 shadow-2xs">
            <button
              onClick={() => setActiveTab('items')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'items'
                  ? 'bg-[#F07818] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              Dishes & Items ({menuItems.length})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'categories'
                  ? 'bg-[#F07818] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              Categories ({categories.length})
            </button>
            <button
              onClick={() => setActiveTab('addons')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'addons'
                  ? 'bg-[#F07818] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              Add-on Groups ({addonGroups.length})
            </button>
          </div>

          {activeTab === 'items' && (
            <Button onClick={openAddItemModal} size="sm" variant="primary" className="gap-1.5 shadow-xs">
              <Plus className="h-4 w-4" />
              <span>Add Menu Item</span>
            </Button>
          )}

          {activeTab === 'categories' && (
            <Button
              onClick={() => {
                setEditingCategory(null);
                setCatName('');
                setCatDescription('');
                setIsCatModalOpen(true);
              }}
              size="sm"
              variant="primary"
              className="gap-1.5 shadow-xs"
            >
              <FolderPlus className="h-4 w-4" />
              <span>Add Category</span>
            </Button>
          )}

          {activeTab === 'addons' && (
            <Button
              onClick={() => {
                setNewGroupName('');
                setNewGroupIsRequired(false);
                setNewGroupMinSelection(0);
                setNewGroupMaxSelection(3);
                setNewGroupAddons([{ name: 'Extra Cheese', price_inr: '50.00', is_available: true }]);
                setIsNewAddonGroupModalOpen(true);
              }}
              size="sm"
              variant="primary"
              className="gap-1.5 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>New Add-on Group</span>
            </Button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: MENU ITEMS CATALOG                                       */}
      {/* ============================================================== */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Search & Multidimensional Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[#E8EAF0] bg-white shadow-xs">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by dish name, code or description..."
                className="h-9 w-full rounded-lg border border-[#E8EAF0] pl-9 pr-3 text-xs text-[#202124] focus:border-[#F07818] focus:outline-none transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#202124]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#6B7280]">Category:</span>
                <select
                  value={selectedCatFilter}
                  onChange={(e) => setSelectedCatFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#E8EAF0] bg-white px-2.5 text-xs font-semibold text-[#202124] focus:outline-none focus:border-[#F07818]"
                >
                  <option value="all">All Categories ({menuItems.length})</option>
                  {categories.map((c) => {
                    const count = menuItems.filter((i) => i.category_id === c.id).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Food Type Filter Buttons */}
              <div className="flex items-center rounded-lg border border-[#E8EAF0] bg-[#FAFAFB] p-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('all')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer transition-colors ${
                    selectedTypeFilter === 'all'
                      ? 'bg-white text-[#202124] shadow-2xs'
                      : 'text-[#6B7280] hover:text-[#202124]'
                  }`}
                >
                  All Types
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('veg')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer transition-colors ${
                    selectedTypeFilter === 'veg'
                      ? 'bg-[#EBF7F2] text-[#16865B] shadow-2xs border border-[#16865B]/30'
                      : 'text-[#6B7280] hover:text-[#16865B]'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[#16865B]" />
                  <span>Veg</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('non_veg')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer transition-colors ${
                    selectedTypeFilter === 'non_veg'
                      ? 'bg-[#FDECEC] text-[#D94343] shadow-2xs border border-[#D94343]/30'
                      : 'text-[#6B7280] hover:text-[#D94343]'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[#D94343]" />
                  <span>Non-Veg</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('egg')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer transition-colors ${
                    selectedTypeFilter === 'egg'
                      ? 'bg-[#FFF6E6] text-[#D97706] shadow-2xs border border-[#D97706]/30'
                      : 'text-[#6B7280] hover:text-[#D97706]'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[#D97706]" />
                  <span>Egg</span>
                </button>
              </div>

              {/* Availability Filter */}
              <select
                value={selectedAvailabilityFilter}
                onChange={(e) => setSelectedAvailabilityFilter(e.target.value as any)}
                className="h-9 rounded-lg border border-[#E8EAF0] bg-white px-2.5 text-xs font-semibold text-[#202124] focus:outline-none focus:border-[#F07818]"
              >
                <option value="all">All Availability</option>
                <option value="available">In Stock Only</option>
                <option value="unavailable">Disabled Only</option>
              </select>

              {/* Reset filter button */}
              {(searchTerm || selectedCatFilter !== 'all' || selectedTypeFilter !== 'all' || selectedAvailabilityFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCatFilter('all');
                    setSelectedTypeFilter('all');
                    setSelectedAvailabilityFilter('all');
                  }}
                  className="px-2 py-1 text-xs text-[#F07818] hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table of Dishes */}
          {isLoadingItems ? (
            <LoadingState message="Loading menu catalog..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No dishes found"
              description={
                searchTerm || selectedCatFilter !== 'all' || selectedTypeFilter !== 'all'
                  ? 'No menu items match your active filters. Try adjusting your search query.'
                  : "Your restaurant catalog is currently empty. Click 'Add Menu Item' above to start building your menu."
              }
              actionLabel="Add Menu Item"
              onAction={openAddItemModal}
            />
          ) : (
            <div className="rounded-xl border border-[#E8EAF0] bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFB] border-b border-[#E8EAF0] text-[#6B7280] font-semibold">
                    <tr>
                      <th className="py-3 px-4 min-w-[200px]">Dish & Information</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Portions / Variants</th>
                      <th className="py-3 px-3">Add-ons</th>
                      <th className="py-3 px-3 text-right">Base Price</th>
                      <th className="py-3 px-3 text-center">Tax Profile</th>
                      <th className="py-3 px-3 text-center">In Stock</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAF0]">
                    {filteredItems.map((item) => {
                      const itemCategory = categories.find((c) => c.id === item.category_id);
                      const effectiveType = item.item_type || (item.is_veg ? 'veg' : 'non_veg');

                      return (
                        <tr key={item.id} className="hover:bg-[#FAFAFB] transition-colors">
                          {/* Dish Name & Badges */}
                          <td className="py-3 px-4">
                            <div className="flex items-start gap-2.5">
                              {/* Type Dot Badge */}
                              <div
                                className={`h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center mt-0.5 ${
                                  effectiveType === 'veg'
                                    ? 'border-[#16865B] bg-[#EBF7F2]'
                                    : effectiveType === 'egg'
                                    ? 'border-[#D97706] bg-[#FFF6E6]'
                                    : 'border-[#D94343] bg-[#FDECEC]'
                                }`}
                                title={
                                  effectiveType === 'veg'
                                    ? 'Pure Vegetarian'
                                    : effectiveType === 'egg'
                                    ? 'Contains Egg'
                                    : 'Non-Vegetarian'
                                }
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    effectiveType === 'veg'
                                      ? 'bg-[#16865B]'
                                      : effectiveType === 'egg'
                                      ? 'bg-[#D97706]'
                                      : 'bg-[#D94343]'
                                  }`}
                                />
                              </div>

                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-[#202124] text-sm leading-tight">
                                    {item.name}
                                  </span>
                                  {item.item_code && (
                                    <span className="rounded bg-[#F4F5F7] px-1.5 py-0.5 font-mono text-[10px] text-[#6B7280]">
                                      {item.item_code}
                                    </span>
                                  )}
                                  {item.is_bestseller && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FFF0E3] px-1.5 py-0.2 text-[10px] font-bold text-[#C85A0A]">
                                      <Flame className="h-3 w-3" />
                                      Bestseller
                                    </span>
                                  )}
                                  {item.is_recommended && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[#EBF7F2] px-1.5 py-0.2 text-[10px] font-bold text-[#16865B]">
                                      <Star className="h-3 w-3" />
                                      Chef's Pick
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-[11px] text-[#6B7280] line-clamp-1 mt-0.5 max-w-sm">
                                    {item.description}
                                  </p>
                                )}
                                {item.preparation_time_minutes && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-[#9CA3AF] mt-0.5">
                                    <Clock className="h-3 w-3" /> {item.preparation_time_minutes} mins prep
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-3 text-[#4B5563] font-medium">
                            <span className="rounded-md bg-[#F4F5F7] px-2 py-1 text-xs">
                              {itemCategory?.name || 'General'}
                            </span>
                          </td>

                          {/* Variants / Portions */}
                          <td className="py-3 px-3">
                            {item.variants && item.variants.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {item.variants.map((v) => (
                                    <span
                                      key={v.id}
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                                        v.is_default
                                          ? 'bg-[#FFF0E3] border-[#F07818]/40 text-[#C85A0A]'
                                          : 'bg-white border-[#E8EAF0] text-[#4B5563]'
                                      }`}
                                      title={v.is_default ? 'Default Portion' : undefined}
                                    >
                                      {v.name}: {formatINR(v.price_paise)}
                                      {v.is_default ? ' ★' : ''}
                                    </span>
                                  ))}
                                </div>
                                <span className="text-[10px] text-[#9CA3AF]">
                                  {item.variants.length} portion size(s)
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#9CA3AF] text-[11px]">Standard Portion</span>
                            )}
                          </td>

                          {/* Add-on Groups Attached */}
                          <td className="py-3 px-3">
                            {item.addon_groups && item.addon_groups.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[140px]">
                                {item.addon_groups.map((g) => (
                                  <span
                                    key={g.id}
                                    className="rounded bg-[#F4F5F7] px-1.5 py-0.5 text-[10px] font-semibold text-[#4B5563]"
                                  >
                                    {g.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[#9CA3AF] text-[11px]">None</span>
                            )}
                          </td>

                          {/* Base Price */}
                          <td className="py-3 px-3 text-right">
                            <span className="font-extrabold text-[#202124] text-sm">
                              {formatINR(item.base_price_paise)}
                            </span>
                          </td>

                          {/* Tax Profile */}
                          <td className="py-3 px-3 text-center">
                            {item.is_tax_inclusive !== null && item.is_tax_inclusive !== undefined ? (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  item.is_tax_inclusive
                                    ? 'bg-[#EBF7F2] text-[#16865B]'
                                    : 'bg-[#FFF0E3] text-[#C85A0A]'
                                }`}
                              >
                                {item.is_tax_inclusive ? 'Tax Incl.' : 'Tax Excl.'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#9CA3AF]">Inherit ({restaurant?.settings?.is_tax_inclusive ? 'Incl' : 'Excl'})</span>
                            )}
                            {item.tax_rate_override_percent !== null && item.tax_rate_override_percent !== undefined && (
                              <div className="text-[10px] text-[#C85A0A] font-bold">
                                {item.tax_rate_override_percent}% rate
                              </div>
                            )}
                          </td>

                          {/* Inline Availability Toggle */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleAvailability(item.id, item.is_available, item.name)}
                              className="cursor-pointer inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                              title={item.is_available ? 'Click to mark Out of Stock' : 'Click to mark In Stock'}
                            >
                              {item.is_available ? (
                                <span className="rounded-full bg-[#EBF7F2] text-[#16865B] px-2.5 py-1 text-[11px] font-bold border border-[#16865B]/20">
                                  In Stock
                                </span>
                              ) : (
                                <span className="rounded-full bg-[#FDECEC] text-[#D94343] px-2.5 py-1 text-[11px] font-bold border border-[#D94343]/20">
                                  Disabled
                                </span>
                              )}
                            </button>
                          </td>

                          {/* Actions: Edit, Duplicate, Delete */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditItemModal(item)}
                                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#F07818] hover:bg-[#FFF0E3] transition-colors"
                                title="Edit Dish"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(item.id, item.name)}
                                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#202124] hover:bg-[#F4F5F7] transition-colors"
                                title="Duplicate Dish"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => promptDeleteItem(item)}
                                className="p-1.5 rounded-lg text-[#D94343] hover:text-[#b83232] hover:bg-[#FDECEC] transition-colors"
                                title="Delete Dish"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: CATEGORIES MANAGEMENT                                    */}
      {/* ============================================================== */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#FFF0E3] bg-[#FFF8F2] p-3 text-xs text-[#C85A0A] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-[#F07818]" />
              Categories organize dishes on POS and printed KOTs. Use Move Up/Down to rearrange the display sequence on POS.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingCategory(null);
                setCatName('');
                setCatDescription('');
                setIsCatModalOpen(true);
              }}
              className="gap-1 bg-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Category</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat, index) => {
              const count = menuItems.filter((i) => i.category_id === cat.id).length;

              return (
                <Card key={cat.id} className="p-4 flex flex-col justify-between hover:border-[#F07818]/40 transition-colors">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-md bg-[#FFF0E3] text-[#C85A0A] text-xs font-extrabold flex items-center justify-center">
                          {cat.sort_order || index + 1}
                        </span>
                        <h4 className="text-sm font-bold text-[#202124]">{cat.name}</h4>
                      </div>
                      <Badge variant="neutral" className="text-[10px]">
                        {count} dishes
                      </Badge>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-2 line-clamp-2">
                      {cat.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-4 border-t border-[#E8EAF0]">
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleReorderCategory(index, 'up')}
                        className={`p-1.5 rounded border border-[#E8EAF0] text-xs ${
                          index === 0
                            ? 'text-[#D1D5DB] cursor-not-allowed'
                            : 'text-[#6B7280] hover:text-[#F07818] hover:bg-[#FFF0E3] cursor-pointer'
                        }`}
                        title="Move Up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === categories.length - 1}
                        onClick={() => handleReorderCategory(index, 'down')}
                        className={`p-1.5 rounded border border-[#E8EAF0] text-xs ${
                          index === categories.length - 1
                            ? 'text-[#D1D5DB] cursor-not-allowed'
                            : 'text-[#6B7280] hover:text-[#F07818] hover:bg-[#FFF0E3] cursor-pointer'
                        }`}
                        title="Move Down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Edit & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(cat);
                          setCatName(cat.name);
                          setCatDescription(cat.description || '');
                          setIsCatModalOpen(true);
                        }}
                        className="p-1.5 rounded text-[#6B7280] hover:text-[#F07818] hover:bg-[#FFF0E3]"
                        title="Edit Category"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => promptDeleteCategory(cat)}
                        className="p-1.5 rounded text-[#D94343] hover:text-[#b83232] hover:bg-[#FDECEC]"
                        title="Delete Category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: ADD-ON GROUPS MANAGEMENT                                */}
      {/* ============================================================== */}
      {activeTab === 'addons' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#FFF0E3] bg-[#FFF8F2] p-3 text-xs text-[#C85A0A] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-[#F07818]" />
              Add-on groups (e.g. Extra Cheese, Sauces, Toppings) allow customer customization in POS with single or multi-select rules.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNewGroupName('');
                setNewGroupIsRequired(false);
                setNewGroupMinSelection(0);
                setNewGroupMaxSelection(3);
                setNewGroupAddons([{ name: 'Extra Cheese', price_inr: '50.00', is_available: true }]);
                setIsNewAddonGroupModalOpen(true);
              }}
              className="gap-1 bg-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Group</span>
            </Button>
          </div>

          {addonGroups.length === 0 ? (
            <EmptyState
              title="No add-on groups yet"
              description="Create customization groups like Extra Toppings, Crusts, or Sauces to link to your dishes."
              actionLabel="Create First Add-on Group"
              onAction={() => setIsNewAddonGroupModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {addonGroups.map((group) => (
                <Card key={group.id} className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-[#202124]">{group.name}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              group.is_required
                                ? 'bg-[#FDECEC] text-[#D94343]'
                                : 'bg-[#EBF7F2] text-[#16865B]'
                            }`}
                          >
                            {group.is_required ? 'Required Group' : 'Optional Group'}
                          </span>
                          <span className="text-[10px] text-[#6B7280]">
                            Min: {group.min_selection} • Max: {group.max_selection}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => promptDeleteAddonGroup(group)}
                        className="p-1 rounded text-[#D94343] hover:bg-[#FDECEC]"
                        title="Delete Group"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#E8EAF0] space-y-1.5">
                      <span className="text-[11px] font-bold text-[#6B7280] block">Included Options:</span>
                      {group.addons && group.addons.length > 0 ? (
                        <div className="space-y-1">
                          {group.addons.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#FAFAFB]"
                            >
                              <span className="font-medium text-[#202124]">{a.name}</span>
                              <span className="font-bold text-[#C85A0A]">
                                +{formatINR(a.price_paise)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[#9CA3AF]">No options in this group</span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* EXPANDED TABBED ADD / EDIT ITEM MODAL                           */}
      {/* ============================================================== */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? `Edit Dish: ${editingItem.name}` : 'Add New Menu Item'}
        description="Configure food type, pricing, variants, add-on groups, and offline tax profile"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveItem} className="space-y-5">
          {/* Modal Tabs Header */}
          <div className="flex border-b border-[#E8EAF0] -mx-6 px-6 bg-[#FAFAFB] gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setItemModalTab('basic')}
              className={`py-2.5 px-3.5 text-xs font-bold border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                itemModalTab === 'basic'
                  ? 'border-[#F07818] text-[#F07818]'
                  : 'border-transparent text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              1. Basic Info *
            </button>
            <button
              type="button"
              onClick={() => setItemModalTab('pricing')}
              className={`py-2.5 px-3.5 text-xs font-bold border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                itemModalTab === 'pricing'
                  ? 'border-[#F07818] text-[#F07818]'
                  : 'border-transparent text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              2. Pricing & Taxes *
            </button>
            <button
              type="button"
              onClick={() => setItemModalTab('variants')}
              className={`py-2.5 px-3.5 text-xs font-bold border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                itemModalTab === 'variants'
                  ? 'border-[#F07818] text-[#F07818]'
                  : 'border-transparent text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              3. Portions / Variants ({variantsList.length})
            </button>
            <button
              type="button"
              onClick={() => setItemModalTab('addons')}
              className={`py-2.5 px-3.5 text-xs font-bold border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                itemModalTab === 'addons'
                  ? 'border-[#F07818] text-[#F07818]'
                  : 'border-transparent text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              4. Customization & Add-ons ({selectedAddonGroupIds.length})
            </button>
            <button
              type="button"
              onClick={() => setItemModalTab('prep')}
              className={`py-2.5 px-3.5 text-xs font-bold border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                itemModalTab === 'prep'
                  ? 'border-[#F07818] text-[#F07818]'
                  : 'border-transparent text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              5. Prep & Notes
            </button>
          </div>

          {/* TAB 1: BASIC INFORMATION */}
          {itemModalTab === 'basic' && (
            <div className="space-y-4 pt-1">
              <Input
                label="Dish / Item Name *"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Butter Chicken Handi / Paneer Tikka"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Item Code / SKU (Optional)"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  placeholder="e.g. MC-01"
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#202124]">Category *</label>
                  <select
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                    className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-xs font-semibold text-[#202124]"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Food Type Selector */}
              <div>
                <label className="text-xs font-semibold text-[#202124] block mb-1.5">
                  Food Classification (Veg / Non-Veg / Egg) *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setItemType('veg')}
                    className={`h-11 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-colors ${
                      itemType === 'veg'
                        ? 'border-[#16865B] bg-[#EBF7F2] text-[#16865B] shadow-2xs'
                        : 'border-[#E8EAF0] bg-white text-[#6B7280]'
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full bg-[#16865B]" />
                    <span>Pure Veg</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemType('non_veg')}
                    className={`h-11 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-colors ${
                      itemType === 'non_veg'
                        ? 'border-[#D94343] bg-[#FDECEC] text-[#D94343] shadow-2xs'
                        : 'border-[#E8EAF0] bg-white text-[#6B7280]'
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full bg-[#D94343]" />
                    <span>Non-Veg</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemType('egg')}
                    className={`h-11 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-colors ${
                      itemType === 'egg'
                        ? 'border-[#D97706] bg-[#FFF6E6] text-[#D97706] shadow-2xs'
                        : 'border-[#E8EAF0] bg-white text-[#6B7280]'
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full bg-[#D97706]" />
                    <span>Egg Dish</span>
                  </button>
                </div>
              </div>

              {/* Short Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#202124]">Short Description (Optional)</label>
                <textarea
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Ingredients, preparation style, allergen warnings..."
                  rows={2}
                  className="rounded-btn border border-[#E8EAF0] p-2.5 text-xs text-[#202124] focus:border-[#F07818] focus:outline-none"
                />
              </div>

              {/* Badges & Toggles */}
              <div className="rounded-xl border border-[#E8EAF0] p-3.5 bg-[#FAFAFB] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#202124]">Active on POS Menu</span>
                    <p className="text-[11px] text-[#6B7280]">When enabled, billers can add this item to cart</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItemIsAvailable(!itemIsAvailable)}
                    className={`px-3 py-1 text-xs rounded-md font-bold cursor-pointer transition-colors ${
                      itemIsAvailable
                        ? 'bg-[#16865B] text-white shadow-xs'
                        : 'bg-[#D94343] text-white shadow-xs'
                    }`}
                  >
                    {itemIsAvailable ? 'In Stock (Active)' : 'Unavailable (Hidden)'}
                  </button>
                </div>

                <div className="pt-2.5 border-t border-[#E8EAF0] grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsBestseller}
                      onChange={(e) => setItemIsBestseller(e.target.checked)}
                      className="h-4 w-4 rounded text-[#F07818] focus:ring-[#F07818]"
                    />
                    <span className="text-xs font-bold text-[#202124] flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 text-[#F07818]" />
                      Mark as Bestseller
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsRecommended}
                      onChange={(e) => setItemIsRecommended(e.target.checked)}
                      className="h-4 w-4 rounded text-[#F07818] focus:ring-[#F07818]"
                    />
                    <span className="text-xs font-bold text-[#202124] flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-[#16865B]" />
                      Chef's Recommendation
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRICING & TAXATION */}
          {itemModalTab === 'pricing' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Base Price in INR (₹) *"
                  type="number"
                  step="0.5"
                  value={itemBasePriceINR}
                  onChange={(e) => setItemBasePriceINR(e.target.value)}
                  placeholder="e.g. 250.00"
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#202124]">Tax Mode for this Item</label>
                  <select
                    value={itemTaxMode}
                    onChange={(e) => setItemTaxMode(e.target.value as any)}
                    className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-xs font-semibold text-[#202124]"
                  >
                    <option value="inherit">
                      Inherit Restaurant Default ({restaurant?.settings?.is_tax_inclusive ? 'Tax Inclusive' : 'Tax Exclusive'})
                    </option>
                    <option value="exclusive">Force Tax Exclusive (Tax added at checkout)</option>
                    <option value="inclusive">Force Tax Inclusive (Price already includes tax)</option>
                  </select>
                </div>
              </div>

              {/* Tax Override */}
              <div className="rounded-xl border border-[#E8EAF0] p-3.5 bg-[#FAFAFB] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#202124]">Custom Tax Rate Override (Optional)</span>
                    <p className="text-[11px] text-[#6B7280]">
                      Leave empty to use restaurant's default GST ({restaurant?.settings?.tax_rate_percent ?? 5.0}%)
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setItemTaxOverrideStr('')}
                      className="px-2 py-0.5 text-[10px] rounded bg-white border border-[#E8EAF0] text-[#6B7280] hover:text-[#202124]"
                    >
                      Default
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemTaxOverrideStr('0')}
                      className="px-2 py-0.5 text-[10px] rounded bg-white border border-[#E8EAF0] text-[#6B7280] hover:text-[#202124]"
                    >
                      0%
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemTaxOverrideStr('5')}
                      className="px-2 py-0.5 text-[10px] rounded bg-white border border-[#E8EAF0] text-[#6B7280] hover:text-[#202124]"
                    >
                      5%
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemTaxOverrideStr('12')}
                      className="px-2 py-0.5 text-[10px] rounded bg-white border border-[#E8EAF0] text-[#6B7280] hover:text-[#202124]"
                    >
                      12%
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemTaxOverrideStr('18')}
                      className="px-2 py-0.5 text-[10px] rounded bg-white border border-[#E8EAF0] text-[#6B7280] hover:text-[#202124]"
                    >
                      18%
                    </button>
                  </div>
                </div>

                <Input
                  placeholder="e.g. 18.0 for special items or leave blank"
                  type="number"
                  step="0.1"
                  value={itemTaxOverrideStr}
                  onChange={(e) => setItemTaxOverrideStr(e.target.value)}
                />
              </div>

              {/* Price Preview Card */}
              {pricePreview && (
                <div className="rounded-xl border border-[#F07818]/30 bg-[#FFF0E3]/30 p-4 space-y-2.5">
                  <span className="text-xs font-bold text-[#C85A0A] flex items-center gap-1.5">
                    <Info className="h-4 w-4" />
                    Bill Calculation Preview ({pricePreview.isTaxInclusive ? 'Tax Inclusive' : 'Tax Exclusive'})
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded bg-white border border-[#E8EAF0]">
                      <span className="text-[10px] text-[#6B7280] block">Entered Base</span>
                      <span className="font-bold text-[#202124]">
                        {formatINR(pricePreview.basePaise)}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-white border border-[#E8EAF0]">
                      <span className="text-[10px] text-[#6B7280] block">Taxable Value</span>
                      <span className="font-bold text-[#202124]">
                        {formatINR(pricePreview.taxablePaise)}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-white border border-[#E8EAF0]">
                      <span className="text-[10px] text-[#6B7280] block">
                        Tax ({pricePreview.effectiveRate}%)
                      </span>
                      <span className="font-bold text-[#C85A0A]">
                        {formatINR(pricePreview.taxPaise)}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#FFF0E3] border border-[#F07818]/40">
                      <span className="text-[10px] font-bold text-[#C85A0A] block">Customer Pays</span>
                      <span className="font-extrabold text-[#C85A0A]">
                        {formatINR(pricePreview.finalPaise)}
                      </span>
                    </div>
                  </div>

                  {pricePreview.isTaxEnabled && pricePreview.taxType === 'CGST_SGST' && (
                    <p className="text-[11px] text-[#6B7280]">
                      Breakdown: CGST ({pricePreview.effectiveRate / 2}%): {formatINR(pricePreview.cgstPaise)} + SGST ({pricePreview.effectiveRate / 2}%): {formatINR(pricePreview.sgstPaise)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VARIANTS & PORTION SIZES */}
          {itemModalTab === 'variants' && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#202124]">Portion Sizes & Variants</h4>
                  <p className="text-[11px] text-[#6B7280]">
                    Add options like Small, Medium, Large, Half, Full. Leave empty for standard single portion.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddVariantRow}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Portion Variant</span>
                </Button>
              </div>

              {variantsList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E8EAF0] p-6 text-center text-xs text-[#6B7280] bg-[#FAFAFB]">
                  No portion variants configured. This dish will sell at the base price of{' '}
                  <strong className="text-[#202124]">{itemBasePriceINR ? `₹${itemBasePriceINR}` : '—'}</strong>.
                </div>
              ) : (
                <div className="space-y-2">
                  {variantsList.map((variant, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-xl border border-[#E8EAF0] bg-white"
                    >
                      {/* Default Radio */}
                      <label className="flex items-center gap-1.5 cursor-pointer shrink-0" title="Set as default portion">
                        <input
                          type="radio"
                          name="defaultVariant"
                          checked={variant.is_default}
                          onChange={() => handleSetDefaultVariant(index)}
                          className="h-4 w-4 text-[#F07818] focus:ring-[#F07818]"
                        />
                        <span className="text-[10px] font-bold text-[#6B7280]">Default</span>
                      </label>

                      {/* Name */}
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) => {
                          const updated = [...variantsList];
                          updated[index].name = e.target.value;
                          setVariantsList(updated);
                        }}
                        placeholder="e.g. Full / Large"
                        className="h-9 flex-1 rounded-lg border border-[#E8EAF0] px-3 text-xs text-[#202124]"
                      />

                      {/* Price in INR */}
                      <div className="relative w-32 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6B7280] font-bold">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          value={variant.price_inr}
                          onChange={(e) => {
                            const updated = [...variantsList];
                            updated[index].price_inr = e.target.value;
                            setVariantsList(updated);
                          }}
                          placeholder="Price"
                          className="h-9 w-full rounded-lg border border-[#E8EAF0] pl-6 pr-2 text-xs text-[#202124] font-bold"
                        />
                      </div>

                      {/* Available Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...variantsList];
                          updated[index].is_available = !updated[index].is_available;
                          setVariantsList(updated);
                        }}
                        className={`px-2 py-1 text-[10px] rounded font-bold ${
                          variant.is_available
                            ? 'bg-[#EBF7F2] text-[#16865B]'
                            : 'bg-[#FDECEC] text-[#D94343]'
                        }`}
                      >
                        {variant.is_available ? 'Available' : 'Disabled'}
                      </button>

                      {/* Remove Row */}
                      <button
                        type="button"
                        onClick={() => handleRemoveVariantRow(index)}
                        className="p-1.5 text-[#D94343] hover:bg-[#FDECEC] rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ADD-ON GROUPS */}
          {itemModalTab === 'addons' && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#202124]">Attach Customization Groups</h4>
                  <p className="text-[11px] text-[#6B7280]">
                    Select which add-on groups are available when customer orders this dish in POS
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsNewAddonGroupModalOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create New Group</span>
                </Button>
              </div>

              {addonGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E8EAF0] p-6 text-center text-xs text-[#6B7280] bg-[#FAFAFB]">
                  No add-on groups created yet. Click 'Create New Group' above to add toppings, dips or crusts.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addonGroups.map((group) => {
                    const isChecked = selectedAddonGroupIds.includes(group.id);
                    return (
                      <div
                        key={group.id}
                        onClick={() => handleToggleAddonGroup(group.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-[#F07818] bg-[#FFF0E3]/30 shadow-2xs'
                            : 'border-[#E8EAF0] bg-white hover:bg-[#FAFAFB]'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold text-[#202124] block">
                              {group.name}
                            </span>
                            <span className="text-[10px] text-[#6B7280]">
                              {group.is_required ? 'Required' : 'Optional'} • Max {group.max_selection} choices
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by div
                            className="mt-0.5 h-4 w-4 rounded text-[#F07818] focus:ring-[#F07818]"
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {group.addons?.slice(0, 3).map((a) => (
                            <span
                              key={a.id}
                              className="rounded bg-white border border-[#E8EAF0] px-1.5 py-0.5 text-[9px] text-[#4B5563]"
                            >
                              {a.name} (+{formatINR(a.price_paise)})
                            </span>
                          ))}
                          {(group.addons?.length || 0) > 3 && (
                            <span className="text-[9px] text-[#9CA3AF] self-center">
                              +{(group.addons?.length || 0) - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PREPARATION & NOTES */}
          {itemModalTab === 'prep' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Average Preparation Time (Minutes)"
                  type="number"
                  value={itemPrepMinutes}
                  onChange={(e) => setItemPrepMinutes(e.target.value)}
                  placeholder="e.g. 15"
                />

                <Input
                  label="Display Order / Sequence"
                  type="number"
                  value={itemSortOrder}
                  onChange={(e) => setItemSortOrder(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <Input
                label="Image URL (Optional)"
                value={itemImageUrl}
                onChange={(e) => setItemImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
              />
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E8EAF0] -mx-6 px-6 bg-[#FAFAFB]">
            <Button type="button" onClick={() => setIsItemModalOpen(false)} variant="outline">
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {itemModalTab !== 'prep' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const tabs: Array<'basic' | 'pricing' | 'variants' | 'addons' | 'prep'> = [
                      'basic',
                      'pricing',
                      'variants',
                      'addons',
                      'prep',
                    ];
                    const currentIndex = tabs.indexOf(itemModalTab);
                    if (currentIndex < tabs.length - 1) {
                      setItemModalTab(tabs[currentIndex + 1]);
                    }
                  }}
                >
                  Next Section &rarr;
                </Button>
              )}
              <Button type="submit" variant="primary">
                {editingItem ? 'Update Dish' : 'Save Dish to Catalog'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* QUICK ADD-ON GROUP CREATION MODAL                               */}
      {/* ============================================================== */}
      <Modal
        isOpen={isNewAddonGroupModalOpen}
        onClose={() => setIsNewAddonGroupModalOpen(false)}
        title="Create Add-on Customization Group"
        description="e.g. Extra Cheese, Choose Dressing, Cooking Level"
        maxWidth="md"
      >
        <form onSubmit={handleSaveNewAddonGroup} className="space-y-4">
          <Input
            label="Group Name *"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="e.g. Extra Toppings / Pizza Crust"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#202124]">Selection Type</label>
              <select
                value={newGroupIsRequired ? 'required' : 'optional'}
                onChange={(e) => setNewGroupIsRequired(e.target.value === 'required')}
                className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-xs font-semibold text-[#202124]"
              >
                <option value="optional">Optional Selection</option>
                <option value="required">Mandatory Selection</option>
              </select>
            </div>

            <Input
              label="Maximum Allowed Choices"
              type="number"
              min="1"
              max="10"
              value={newGroupMaxSelection}
              onChange={(e) => setNewGroupMaxSelection(parseInt(e.target.value) || 1)}
              required
            />
          </div>

          {/* Add-on options list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#202124]">Options & Additional Prices</label>
              <button
                type="button"
                onClick={() =>
                  setNewGroupAddons([
                    ...newGroupAddons,
                    { name: '', price_inr: '0.00', is_available: true },
                  ])
                }
                className="text-xs font-bold text-[#F07818] hover:underline"
              >
                + Add Another Option
              </button>
            </div>

            {newGroupAddons.map((addon, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Mozzarella Cheese"
                  value={addon.name}
                  onChange={(e) => {
                    const updated = [...newGroupAddons];
                    updated[idx].name = e.target.value;
                    setNewGroupAddons(updated);
                  }}
                  className="h-9 flex-1 rounded-lg border border-[#E8EAF0] px-3 text-xs text-[#202124]"
                  required
                />
                <div className="relative w-28 shrink-0">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6B7280] font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    value={addon.price_inr}
                    onChange={(e) => {
                      const updated = [...newGroupAddons];
                      updated[idx].price_inr = e.target.value;
                      setNewGroupAddons(updated);
                    }}
                    placeholder="Price"
                    className="h-9 w-full rounded-lg border border-[#E8EAF0] pl-6 pr-2 text-xs text-[#202124] font-bold"
                  />
                </div>
                {newGroupAddons.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setNewGroupAddons(newGroupAddons.filter((_, i) => i !== idx))
                    }
                    className="p-1.5 text-[#D94343] hover:bg-[#FDECEC] rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EAF0]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewAddonGroupModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create & Attach Group
            </Button>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* CATEGORY ADD / EDIT MODAL                                       */}
      {/* ============================================================== */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        description="Organize your menu sections (e.g. Starters, Main Course, Beverages)"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <Input
            label="Category Name *"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="e.g. Biryani & Rice Bowls"
            required
          />
          <Input
            label="Description (Optional)"
            value={catDescription}
            onChange={(e) => setCatDescription(e.target.value)}
            placeholder="Brief note about this menu section"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setIsCatModalOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* DELETION CONFIRMATION DIALOG                                    */}
      {/* ============================================================== */}
      <Modal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        title={confirmDialog.title}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-[#FDECEC] text-[#D94343] shrink-0 mt-0.5">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="text-xs text-[#4B5563] leading-relaxed">
              {confirmDialog.description}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E8EAF0]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={confirmDialog.onConfirm}
              className="bg-[#D94343] hover:bg-[#b83232] text-white"
            >
              {confirmDialog.actionLabel}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
