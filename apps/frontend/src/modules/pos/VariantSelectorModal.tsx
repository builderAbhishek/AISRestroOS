import React, { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatINR } from '@/lib/utils';
import { MenuVariant, Addon } from '@/types';
import { Plus, Minus, Check, MessageSquare } from 'lucide-react';

export const VariantSelectorModal: React.FC = () => {
  const { isVariantModalOpen, closeVariantModal, selectedMenuItemForVariants } = useUIStore();
  const { addItem } = useCartStore();

  const item = selectedMenuItemForVariants;

  const [selectedVariant, setSelectedVariant] = useState<MenuVariant | undefined>(undefined);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (item) {
      if (item.variants && item.variants.length > 0) {
        const defaultVar = item.variants.find((v) => v.is_default) || item.variants[0];
        setSelectedVariant(defaultVar);
      } else {
        setSelectedVariant(undefined);
      }
      setSelectedAddons([]);
      setQuantity(1);
      setNotes('');
    }
  }, [item]);

  if (!item) return null;

  const handleToggleAddon = (addon: Addon) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((a) => a.id === addon.id);
      if (exists) {
        return prev.filter((a) => a.id !== addon.id);
      } else {
        return [...prev, addon];
      }
    });
  };

  const unitPrice =
    (selectedVariant ? selectedVariant.price_paise : item.base_price_paise) +
    selectedAddons.reduce((sum, a) => sum + a.price_paise, 0);

  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    addItem(item, selectedVariant, selectedAddons, quantity, notes.trim());
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
      <div className="space-y-5">
        {/* Variant Selection */}
        {item.variants && item.variants.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#202124] uppercase tracking-wider">
              Choose Portion / Size
            </label>
            <div className="grid grid-cols-2 gap-2">
              {item.variants.map((v) => {
                const isSelected = selectedVariant?.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariant(v)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#F07818] bg-[#FFF0E3] shadow-2xs'
                        : 'border-[#E8EAF0] bg-white hover:bg-[#F7F8FA]'
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-bold ${isSelected ? 'text-[#C85A0A]' : 'text-[#202124]'}`}>
                        {v.name}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">{formatINR(v.price_paise)}</p>
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
            {item.addon_groups.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                    {group.name}
                  </label>
                  <span className="text-[10px] text-[#6B7280]">
                    {group.is_required ? '(Required)' : '(Optional)'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.addons.map((addon) => {
                    const isChecked = selectedAddons.some((a) => a.id === addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => handleToggleAddon(addon)}
                        className={`flex w-full items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-[#F07818] bg-[#FFF8F2]'
                            : 'border-[#E8EAF0] bg-white hover:bg-[#F7F8FA]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
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
                          {addon.price_paise > 0 ? `+${formatINR(addon.price_paise)}` : 'Free'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Special Instructions Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#202124] uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-[#F07818]" />
            Kitchen Preparation Notes
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Less spicy, crispy, no onion, separate dip"
          />
        </div>

        {/* Quantity & Add to Cart footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E8EAF0]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8EAF0] text-[#202124] hover:bg-[#F7F8FA]"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-[#202124]">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8EAF0] text-[#202124] hover:bg-[#F7F8FA]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <Button type="button" onClick={handleAddToCart} variant="primary" className="px-6">
            Add to Cart • {formatINR(totalPrice)}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
