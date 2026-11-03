import React, { useState, useEffect, useMemo } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatINR } from '@/lib/utils';
import { MenuVariant, Addon, AddonGroup } from '@/types';
import { Plus, Minus, Check, MessageSquare, AlertCircle } from 'lucide-react';

export const VariantSelectorModal: React.FC = () => {
  const { isVariantModalOpen, closeVariantModal, selectedMenuItemForVariants } = useUIStore();
  const { addItem } = useCartStore();

  const item = selectedMenuItemForVariants;

  const [selectedVariant, setSelectedVariant] = useState<MenuVariant | undefined>(undefined);
  const [selectedAddonsByGroup, setSelectedAddonsByGroup] = useState<Record<string, Addon[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (item) {
      if (item.variants && item.variants.length > 0) {
        const defaultVar = item.variants.find((v) => v.is_default && v.is_available) || item.variants[0];
        setSelectedVariant(defaultVar);
      } else {
        setSelectedVariant(undefined);
      }
      setSelectedAddonsByGroup({});
      setQuantity(1);
      setNotes('');
    }
  }, [item]);

  // Flatten all selected addons across all groups
  const allSelectedAddons = useMemo(() => {
    const list: Addon[] = [];
    Object.values(selectedAddonsByGroup).forEach((addons) => {
      list.push(...addons);
    });
    return list;
  }, [selectedAddonsByGroup]);

  // Validation: check min_selection for required groups
  const validationError = useMemo(() => {
    if (!item || !item.addon_groups) return null;
    for (const group of item.addon_groups) {
      const selected = selectedAddonsByGroup[group.id] || [];
      const minReq = group.is_required ? Math.max(1, group.min_selection || 1) : (group.min_selection || 0);
      if (selected.length < minReq) {
        return `Please select at least ${minReq} option for "${group.name}".`;
      }
    }
    return null;
  }, [item, selectedAddonsByGroup]);

  if (!item) return null;

  const handleToggleAddon = (group: AddonGroup, addon: Addon) => {
    const current = selectedAddonsByGroup[group.id] || [];
    const exists = current.some((a) => a.id === addon.id);

    if (exists) {
      // Uncheck
      setSelectedAddonsByGroup((prev) => ({
        ...prev,
        [group.id]: current.filter((a) => a.id !== addon.id),
      }));
    } else {
      // Check
      if (group.max_selection === 1) {
        // Single select (radio behavior)
        setSelectedAddonsByGroup((prev) => ({
          ...prev,
          [group.id]: [addon],
        }));
      } else {
        // Multi select up to max_selection
        const max = group.max_selection || 10;
        if (current.length >= max) return; // Reached max
        setSelectedAddonsByGroup((prev) => ({
          ...prev,
          [group.id]: [...current, addon],
        }));
      }
    }
  };

  const unitPrice =
    (selectedVariant ? selectedVariant.price_paise : item.base_price_paise) +
    allSelectedAddons.reduce((sum, a) => sum + a.price_paise, 0);

  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    if (validationError) return;
    addItem(item, selectedVariant, allSelectedAddons, quantity, notes.trim());
    closeVariantModal();
  };

  return (
    <Modal
      isOpen={isVariantModalOpen}
      onClose={closeVariantModal}
      title={item.name}
      description={item.description || 'Customise portion, add-ons and preparation notes'}
      maxWidth="md"
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Variant Selection */}
        {item.variants && item.variants.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                Choose Portion / Size *
              </label>
              <Badge variant="neutral" size="sm">Choose 1</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {item.variants.map((v) => {
                const isSelected = selectedVariant?.id === v.id;
                const isAvailable = v.is_available;

                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => setSelectedVariant(v)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      !isAvailable
                        ? 'opacity-50 cursor-not-allowed bg-[#F7F8FA] border-[#E8EAF0]'
                        : isSelected
                        ? 'border-[#F07818] bg-[#FFF0E3] shadow-2xs cursor-pointer'
                        : 'border-[#E8EAF0] bg-white hover:bg-[#F7F8FA] cursor-pointer'
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-bold ${isSelected ? 'text-[#C85A0A]' : 'text-[#202124]'}`}>
                        {v.name}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">
                        {isAvailable ? formatINR(v.price_paise) : 'Unavailable'}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F07818] text-white">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Addon Groups */}
        {item.addon_groups && item.addon_groups.length > 0 && (
          <div className="space-y-4">
            {item.addon_groups.map((group) => {
              const currentGroupAddons = selectedAddonsByGroup[group.id] || [];
              const isSingleSelect = group.max_selection === 1;

              return (
                <div key={group.id} className="rounded-xl border border-[#E8EAF0] p-3 space-y-2.5 bg-[#FAFAFB]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                        {group.name}
                      </span>
                      <p className="text-[10px] text-[#6B7280]">
                        {group.is_required
                          ? `Required • Select ${group.min_selection || 1}${group.max_selection > 1 ? ` to ${group.max_selection}` : ''}`
                          : `Optional • Up to ${group.max_selection}`}
                      </p>
                    </div>
                    <Badge variant={group.is_required ? 'bhagwa' : 'neutral'} size="sm">
                      {group.is_required ? 'Required' : 'Optional'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    {group.addons.map((addon) => {
                      const isChecked = currentGroupAddons.some((a) => a.id === addon.id);
                      const isAvailable = addon.is_available;

                      return (
                        <button
                          key={addon.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => handleToggleAddon(group, addon)}
                          className={`flex w-full items-center justify-between p-2.5 rounded-lg border text-left transition-colors ${
                            !isAvailable
                              ? 'opacity-50 cursor-not-allowed bg-[#F7F8FA] border-[#E8EAF0]'
                              : isChecked
                              ? 'border-[#F07818] bg-[#FFF8F2] cursor-pointer'
                              : 'border-[#E8EAF0] bg-white hover:bg-[#F7F8FA] cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-4 w-4 items-center justify-center ${
                                isSingleSelect ? 'rounded-full' : 'rounded'
                              } border ${
                                isChecked
                                  ? 'border-[#F07818] bg-[#F07818] text-white'
                                  : 'border-[#D1D5DB] bg-white'
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <span className="text-xs font-medium text-[#202124]">{addon.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-[#6B7280]">
                            {!isAvailable
                              ? 'Unavailable'
                              : addon.price_paise > 0
                              ? `+${formatINR(addon.price_paise)}`
                              : 'Free'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Special Instructions Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#202124] uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-[#F07818]" />
            Kitchen Instructions / Special Notes
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Less spicy, crispy, no onion, separate dip"
          />
        </div>

        {/* Validation warning if required addon is unselected */}
        {validationError && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#FDECEC] text-[#D94343] text-xs font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Quantity & Add to Cart footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E8EAF0]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8EAF0] text-[#202124] hover:bg-[#F7F8FA] cursor-pointer"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-[#202124]">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8EAF0] text-[#202124] hover:bg-[#F7F8FA] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <Button
            type="button"
            onClick={handleAddToCart}
            disabled={!!validationError}
            variant="primary"
            className="px-6"
          >
            Add to Cart • {formatINR(totalPrice)}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
