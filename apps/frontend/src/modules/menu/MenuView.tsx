import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { menuApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { formatINR } from '@/lib/utils';
import { MenuItem, MenuCategory } from '@/types';
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
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  FolderPlus,
  Search,
} from 'lucide-react';

export const MenuView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');

  // Item Create/Edit Modal states
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemPriceINR, setItemPriceINR] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemIsVeg, setItemIsVeg] = useState(true);

  // Category Modal states
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: menuApi.listCategories,
  });

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => menuApi.listItems(),
  });

  const openAddItemModal = () => {
    setEditingItem(null);
    setItemName('');
    setItemCode('');
    setItemCategoryId(categories[0]?.id || '');
    setItemPriceINR('');
    setItemDescription('');
    setItemIsVeg(true);
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCode(item.item_code || '');
    setItemCategoryId(item.category_id);
    setItemPriceINR((item.base_price_paise / 100).toString());
    setItemDescription(item.description || '');
    setItemIsVeg(item.is_veg);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemCategoryId || !itemPriceINR) {
      addToast({ type: 'error', title: 'Validation', description: 'Please fill required fields.' });
      return;
    }

    try {
      const pricePaise = Math.round(parseFloat(itemPriceINR) * 100);
      if (editingItem) {
        await menuApi.updateItem(editingItem.id, {
          name: itemName.trim(),
          item_code: itemCode.trim() || null,
          category_id: itemCategoryId,
          base_price_paise: pricePaise,
          description: itemDescription.trim() || null,
          is_veg: itemIsVeg,
        });
        addToast({ type: 'success', title: 'Updated', description: 'Menu item updated.' });
      } else {
        await menuApi.createItem({
          name: itemName.trim(),
          item_code: itemCode.trim() || null,
          category_id: itemCategoryId,
          base_price_paise: pricePaise,
          description: itemDescription.trim() || null,
          is_veg: itemIsVeg,
          is_available: true,
        });
        addToast({ type: 'success', title: 'Created', description: 'Menu item created.' });
      }

      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      setIsItemModalOpen(false);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const handleToggleAvailability = async (id: string) => {
    try {
      await menuApi.toggleAvailability(id);
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await menuApi.deleteItem(id);
      addToast({ type: 'info', title: 'Deleted', description: 'Menu item deleted.' });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

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
        addToast({ type: 'success', title: 'Created', description: 'Category added.' });
      }
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCatModalOpen(false);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category ${name}?`)) return;
    try {
      await menuApi.deleteCategory(id);
      addToast({ type: 'info', title: 'Deleted', description: 'Category removed.' });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const filteredItems = menuItems.filter((item) => {
    if (selectedCatFilter !== 'all' && item.category_id !== selectedCatFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.item_code?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202124]">Menu & Pricing Catalog</h2>
          <p className="text-xs text-[#6B7280]">
            Manage categories, dishes, portion sizes, prices and availability
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center rounded-xl border border-[#E8EAF0] bg-white p-1 shadow-2xs">
            <button
              onClick={() => setActiveTab('items')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                activeTab === 'items' ? 'bg-[#F07818] text-white shadow-xs' : 'text-[#6B7280]'
              }`}
            >
              Dishes & Items ({menuItems.length})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                activeTab === 'categories' ? 'bg-[#F07818] text-white shadow-xs' : 'text-[#6B7280]'
              }`}
            >
              Categories ({categories.length})
            </button>
          </div>

          {activeTab === 'items' ? (
            <Button onClick={openAddItemModal} size="sm" variant="primary" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span>Add Menu Item</span>
            </Button>
          ) : (
            <Button
              onClick={() => {
                setEditingCategory(null);
                setCatName('');
                setCatDescription('');
                setIsCatModalOpen(true);
              }}
              size="sm"
              variant="primary"
              className="gap-1.5"
            >
              <FolderPlus className="h-4 w-4" />
              <span>Add Category</span>
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'items' ? (
        <div className="space-y-4">
          {/* Search & Category Filter bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[#E8EAF0] bg-white shadow-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search dish by name or code..."
                className="h-9 w-full rounded-lg border border-[#E8EAF0] pl-9 pr-3 text-xs text-[#202124] focus:border-[#F07818] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#6B7280]">Filter by:</span>
              <select
                value={selectedCatFilter}
                onChange={(e) => setSelectedCatFilter(e.target.value)}
                className="h-9 rounded-lg border border-[#E8EAF0] bg-white px-3 text-xs font-semibold text-[#202124] focus:outline-none focus:border-[#F07818]"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Items Table */}
          {isLoading ? (
            <LoadingState message="Loading dishes..." />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No items found"
              description="Click 'Add Menu Item' above to create dishes."
              actionLabel="Add First Item"
              onAction={openAddItemModal}
            />
          ) : (
            <div className="rounded-card border border-[#E8EAF0] bg-white shadow-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFB] border-b border-[#E8EAF0] text-[#6B7280] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Dish Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Portions / Variants</th>
                    <th className="py-3 px-4 text-right">Base Price</th>
                    <th className="py-3 px-4 text-center">Available</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAF0]">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAFAFB] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              item.is_veg ? 'bg-[#16865B]' : 'bg-[#D94343]'
                            }`}
                          />
                          <span className="font-bold text-[#202124]">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#9CA3AF]">
                        {item.item_code || '—'}
                      </td>
                      <td className="py-3 px-4 text-[#6B7280]">
                        {categories.find((c) => c.id === item.category_id)?.name || 'General'}
                      </td>
                      <td className="py-3 px-4">
                        {item.variants && item.variants.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {item.variants.map((v) => (
                              <span
                                key={v.id}
                                className="rounded bg-[#FFF0E3] px-1.5 py-0.5 text-[10px] font-semibold text-[#C85A0A]"
                              >
                                {v.name}: {formatINR(v.price_paise)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#9CA3AF]">Standard Portion</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-[#202124]">
                        {formatINR(item.base_price_paise)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item.id)}
                          className="cursor-pointer"
                        >
                          {item.is_available ? (
                            <span className="rounded-full bg-[#EBF7F2] text-[#16865B] px-2 py-0.5 text-[11px] font-bold">
                              In Stock
                            </span>
                          ) : (
                            <span className="rounded-full bg-[#FDECEC] text-[#D94343] px-2 py-0.5 text-[11px] font-bold">
                              Disabled
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditItemModal(item)}
                            className="p-1 text-[#6B7280] hover:text-[#F07818]"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="p-1 text-[#D94343] hover:text-[#b83232]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Categories Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const count = menuItems.filter((i) => i.category_id === cat.id).length;

            return (
              <Card key={cat.id} className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#202124]">{cat.name}</h4>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {cat.description || 'No description'} • {count} items
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(cat);
                      setCatName(cat.name);
                      setCatDescription(cat.description || '');
                      setIsCatModalOpen(true);
                    }}
                    className="p-1.5 text-[#6B7280] hover:text-[#F07818]"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="p-1.5 text-[#D94343] hover:text-[#b83232]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Item Create / Edit Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
        description="Enter dish name, category, and base price in INR"
        maxWidth="md"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <Input
            label="Dish Name *"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g. Paneer Butter Masala"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Item Code (Optional)"
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

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Base Price in INR (₹) *"
              type="number"
              step="0.5"
              value={itemPriceINR}
              onChange={(e) => setItemPriceINR(e.target.value)}
              placeholder="e.g. 240.00"
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#202124]">Food Type *</label>
              <div className="flex gap-2 h-10 items-center">
                <button
                  type="button"
                  onClick={() => setItemIsVeg(true)}
                  className={`flex-1 h-9 rounded-lg text-xs font-bold transition-colors ${
                    itemIsVeg
                      ? 'bg-[#EBF7F2] text-[#16865B] border border-[#16865B]'
                      : 'border text-[#6B7280]'
                  }`}
                >
                  Pure Veg
                </button>
                <button
                  type="button"
                  onClick={() => setItemIsVeg(false)}
                  className={`flex-1 h-9 rounded-lg text-xs font-bold transition-colors ${
                    !itemIsVeg
                      ? 'bg-[#FDECEC] text-[#D94343] border border-[#D94343]'
                      : 'border text-[#6B7280]'
                  }`}
                >
                  Non-Veg
                </button>
              </div>
            </div>
          </div>

          <Input
            label="Description (Optional)"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="Preparation style, key ingredients..."
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
            <Button type="button" onClick={() => setIsItemModalOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        description="Organize your menu sections"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <Input
            label="Category Name *"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="e.g. Starters & Appetizers"
            required
          />
          <Input
            label="Description (Optional)"
            value={catDescription}
            onChange={(e) => setCatDescription(e.target.value)}
            placeholder="Brief note about this section"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setIsCatModalOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
