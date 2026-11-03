import React, { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { restaurantApi } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useQueryClient } from '@tanstack/react-query';
import { Store, Utensils, Printer, CheckCircle, Sparkles, Upload } from 'lucide-react';

export const SetupWizard: React.FC = () => {
  const { isSetupWizardOpen, closeSetupWizard, addToast } = useUIStore();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('Royal Heritage Restaurant & Cafe');
  const [ownerName, setOwnerName] = useState('Abhishek Kumar');
  const [phone, setPhone] = useState('9876543210');
  const [address, setAddress] = useState('Plot 42, Commercial Complex, MG Road, New Delhi');
  const [gstRegistered, setGstRegistered] = useState(true);
  const [gstin, setGstin] = useState('07AAAAA0000A1Z5');
  const [isTaxEnabled, setIsTaxEnabled] = useState(true);
  const [isTaxInclusive, setIsTaxInclusive] = useState(false);
  const [taxType, setTaxType] = useState('CGST_SGST');
  const [taxRatePercent, setTaxRatePercent] = useState<number>(5.0);
  const [paperWidthMm, setPaperWidthMm] = useState<number>(80);
  const [seedSampleMenu, setSeedSampleMenu] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ownerName.trim() || !phone.trim() || !address.trim()) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        description: 'Please complete all required fields.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await restaurantApi.setup({
        name: name.trim(),
        owner_name: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        currency: 'INR',
        currency_symbol: '₹',
        language: 'en',
        gst_registered: gstRegistered,
        gstin: gstRegistered ? gstin.trim() : null,
        is_tax_enabled: isTaxEnabled,
        is_tax_inclusive: isTaxInclusive,
        tax_rate_percent: Number(taxRatePercent),
        tax_type: taxType,
        paper_width_mm: Number(paperWidthMm),
        seed_sample_menu: seedSampleMenu,
      });

      addToast({
        type: 'success',
        title: 'Welcome to AISRestroOS!',
        description: 'Restaurant configured successfully. Ready to take orders!',
      });

      queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      closeSetupWizard();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Setup Failed',
        description: err.message || 'Could not configure restaurant.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isSetupWizardOpen}
      onClose={() => {}}
      title="Restaurant Setup Wizard"
      description="Configure your restaurant profile and offline POS settings"
      maxWidth="lg"
      showCloseButton={false}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {step === 1 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#FFF0E3] bg-[#FFF8F2] p-3 text-xs text-[#C85A0A] flex items-center gap-2">
              <Store className="h-5 w-5 shrink-0 text-[#F07818]" />
              <span>
                Enter your restaurant details. All data will be saved safely in your local offline
                SQLite database.
              </span>
            </div>

            <Input
              label="Restaurant Brand Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Royal Spice Restaurant"
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Owner / Manager Name *"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Abhishek Kumar"
                required
              />
              <Input
                label="Contact Phone Number *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                required
              />
            </div>

            <Input
              label="Restaurant Address *"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Shop 12, Main Market, MG Road"
              required
            />

            <div className="rounded-xl border border-[#E8EAF0] p-4 bg-[#FAFAFB] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#202124]">GST Registration</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGstRegistered(true)}
                    className={`px-3 py-1 text-xs rounded-md font-medium cursor-pointer transition-colors ${
                      gstRegistered
                        ? 'bg-[#F07818] text-white'
                        : 'bg-white border border-[#E8EAF0] text-[#6B7280]'
                    }`}
                  >
                    GST Registered
                  </button>
                  <button
                    type="button"
                    onClick={() => setGstRegistered(false)}
                    className={`px-3 py-1 text-xs rounded-md font-medium cursor-pointer transition-colors ${
                      !gstRegistered
                        ? 'bg-[#F07818] text-white'
                        : 'bg-white border border-[#E8EAF0] text-[#6B7280]'
                    }`}
                  >
                    Non-GST (Exempt)
                  </button>
                </div>
              </div>

              {gstRegistered && (
                <Input
                  label="GSTIN Number (Optional/Recommended)"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="e.g. 07AAAAA0000A1Z5"
                />
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => setStep(2)} variant="primary">
                Next: Tax & Printing &rarr;
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#FFF0E3] bg-[#FFF8F2] p-3 text-xs text-[#C85A0A] flex items-center gap-2">
              <Printer className="h-5 w-5 shrink-0 text-[#F07818]" />
              <span>Configure your GST rate, thermal paper roll size, and sample menu.</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#202124]">GST Rate (%)</label>
                <select
                  value={taxRatePercent}
                  onChange={(e) => {
                    const r = parseFloat(e.target.value);
                    setTaxRatePercent(r);
                    setIsTaxEnabled(r > 0);
                  }}
                  className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-sm text-[#202124] focus:border-[#F07818] focus:outline-none"
                >
                  <option value={5.0}>5.0% (Standard Restaurant GST: 2.5% CGST + 2.5% SGST)</option>
                  <option value={12.0}>12.0% (AC Dining / Premium Tier)</option>
                  <option value={18.0}>18.0% (Hotel / Banquet)</option>
                  <option value={0.0}>0.0% (Non-GST / Exempt)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#202124]">Thermal Paper Width</label>
                <select
                  value={paperWidthMm}
                  onChange={(e) => setPaperWidthMm(parseInt(e.target.value))}
                  className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-sm text-[#202124] focus:border-[#F07818] focus:outline-none"
                >
                  <option value={80}>80mm (Standard Desktop Receipt Printer)</option>
                  <option value={58}>58mm (Compact 2-inch Thermal Printer)</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-[#E8EAF0] p-3 bg-[#FAFAFB] space-y-2">
              <label className="text-xs font-semibold text-[#202124] block">Menu Pricing Mode</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsTaxInclusive(false)}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                    !isTaxInclusive
                      ? 'border-[#F07818] bg-[#FFF0E3]/50 font-bold text-[#202124]'
                      : 'border-[#E8EAF0] bg-white text-[#6B7280]'
                  }`}
                >
                  Tax Exclusive (Standard)
                  <p className="text-[10px] font-normal text-[#6B7280]">
                    Tax added on top at checkout
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setIsTaxInclusive(true)}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                    isTaxInclusive
                      ? 'border-[#F07818] bg-[#FFF0E3]/50 font-bold text-[#202124]'
                      : 'border-[#E8EAF0] bg-white text-[#6B7280]'
                  }`}
                >
                  Tax Inclusive (MRP)
                  <p className="text-[10px] font-normal text-[#6B7280]">
                    Menu prices already include GST
                  </p>
                </button>
              </div>
            </div>

            {/* Pre-populate sample menu checkbox */}
            <div className="rounded-xl border border-[#E8EAF0] p-4 bg-[#FAFAFB]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedSampleMenu}
                  onChange={(e) => setSeedSampleMenu(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-[#F07818] focus:ring-[#F07818]"
                />
                <div>
                  <span className="text-sm font-semibold text-[#202124] flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#F07818]" />
                    Pre-populate with delicious sample menu & tables (Recommended)
                  </span>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Instantly creates categories (Starters, Main Course, Biryani, Breads, Drinks)
                    with variants, add-ons and 8 dine-in tables so you can test POS right away.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E8EAF0]">
              <Button type="button" onClick={() => setStep(1)} variant="outline">
                &larr; Back
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting} className="px-6">
                <CheckCircle className="h-4 w-4" />
                <span>Complete Setup & Launch POS</span>
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
};
