import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { restaurantApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { Restaurant } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/EmptyState';
import {
  Settings,
  Store,
  Printer,
  Database,
  Download,
  Sparkles,
  Save,
  ShieldCheck,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ['restaurant'],
    queryFn: restaurantApi.getCurrent,
  });

  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstRegistered, setGstRegistered] = useState(false);
  const [gstin, setGstin] = useState('');

  const [isTaxEnabled, setIsTaxEnabled] = useState<boolean>(true);
  const [isTaxInclusive, setIsTaxInclusive] = useState<boolean>(false);
  const [taxType, setTaxType] = useState<string>('CGST_SGST');
  const [taxRate, setTaxRate] = useState<number>(5.0);
  const [paperWidth, setPaperWidth] = useState<number>(80);
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [kotPrefix, setKotPrefix] = useState('KOT-');
  const [billFooter, setBillFooter] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name);
      setLegalName(restaurant.legal_name || '');
      setOwnerName(restaurant.owner_name);
      setPhone(restaurant.phone);
      setAddress(restaurant.address);
      setGstRegistered(restaurant.gst_registered);
      setGstin(restaurant.gstin || '');

      if (restaurant.settings) {
        setIsTaxEnabled(restaurant.settings.is_tax_enabled ?? true);
        setIsTaxInclusive(restaurant.settings.is_tax_inclusive ?? false);
        setTaxType(restaurant.settings.tax_type || 'CGST_SGST');
        setTaxRate(restaurant.settings.tax_rate_percent ?? 5.0);
        setPaperWidth(restaurant.settings.paper_width_mm);
        setInvoicePrefix(restaurant.settings.invoice_prefix);
        setKotPrefix(restaurant.settings.kot_prefix);
        setBillFooter(restaurant.settings.bill_footer_text);
      }
    }
  }, [restaurant]);

  if (isLoading) {
    return <LoadingState message="Loading settings..." />;
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await restaurantApi.updateProfile({
        name: name.trim(),
        legal_name: legalName.trim() || undefined,
        owner_name: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        gst_registered: gstRegistered,
        gstin: gstRegistered ? gstin.trim() : undefined,
      });

      await restaurantApi.updateSettings({
        is_tax_enabled: isTaxEnabled,
        is_tax_inclusive: isTaxInclusive,
        tax_type: taxType,
        tax_rate_percent: Number(taxRate),
        paper_width_mm: Number(paperWidth),
        invoice_prefix: invoicePrefix.trim(),
        kot_prefix: kotPrefix.trim(),
        bill_footer_text: billFooter.trim(),
      });

      addToast({
        type: 'success',
        title: 'Settings Saved',
        description: 'Restaurant and printing configuration updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['restaurant'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/v1/system/backup';
    addToast({
      type: 'info',
      title: 'Database Snapshot Downloaded',
      description: 'Point-in-time SQLite copy downloaded to your computer.',
    });
  };

  const handleSeedData = async () => {
    try {
      await restaurantApi.seedSampleData();
      addToast({
        type: 'success',
        title: 'Sample Data Seeded',
        description: 'Loaded sample categories, dishes and dining tables.',
      });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#202124]">Restaurant & POS Settings</h2>
        <p className="text-xs text-[#6B7280]">
          Configure business details, GST billing, thermal printing, and SQLite backups
        </p>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader className="border-b border-[#E8EAF0] pb-3">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-[#F07818]" />
              <CardTitle>Restaurant Identity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Restaurant Trade Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Legal Entity Name (Optional)"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Royal Spice Hospitality LLP"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Owner / General Manager *"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
              />
              <Input
                label="Primary Phone Number *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <Input
              label="Physical Address (Printed on Invoice Header) *"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />

            <div className="rounded-xl border border-[#E8EAF0] p-4 bg-[#FAFAFB] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#202124]">GSTIN Registration</span>
                  <p className="text-[11px] text-[#6B7280]">
                    Enable if your restaurant issues GST compliant Tax Invoices
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGstRegistered(true)}
                    className={`px-3 py-1 text-xs rounded-md font-semibold cursor-pointer ${
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
                    className={`px-3 py-1 text-xs rounded-md font-semibold cursor-pointer ${
                      !gstRegistered
                        ? 'bg-[#F07818] text-white'
                        : 'bg-white border border-[#E8EAF0] text-[#6B7280]'
                    }`}
                  >
                    Non-GST
                  </button>
                </div>
              </div>

              {gstRegistered && (
                <Input
                  label="GSTIN (15 Character Number)"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="e.g. 07AAAAA0000A1Z5"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Taxation & Thermal Printer Card */}
        <Card>
          <CardHeader className="border-b border-[#E8EAF0] pb-3">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-[#F07818]" />
              <CardTitle>Taxation & Thermal Printer Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            {/* Tax Enable Toggle */}
            <div className="rounded-xl border border-[#E8EAF0] p-4 bg-[#FAFAFB] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#202124]">Calculate & Charge Tax on Orders</span>
                  <p className="text-[11px] text-[#6B7280]">
                    Enable GST or Non-GST tax calculation on all bills and POS receipts
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTaxEnabled(true)}
                    className={`px-3 py-1 text-xs rounded-md font-semibold cursor-pointer transition-colors ${
                      isTaxEnabled
                        ? 'bg-[#16865B] text-white shadow-xs'
                        : 'bg-white border border-[#E8EAF0] text-[#6B7280]'
                    }`}
                  >
                    Tax Enabled
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTaxEnabled(false)}
                    className={`px-3 py-1 text-xs rounded-md font-semibold cursor-pointer transition-colors ${
                      !isTaxEnabled
                        ? 'bg-[#6B7280] text-white shadow-xs'
                        : 'bg-white border border-[#E8EAF0] text-[#6B7280]'
                    }`}
                  >
                    Tax Disabled (0%)
                  </button>
                </div>
              </div>

              {isTaxEnabled && (
                <div className="pt-3 border-t border-[#E8EAF0] space-y-4">
                  {/* Tax Inclusive vs Exclusive */}
                  <div>
                    <label className="text-xs font-semibold text-[#202124] block mb-1.5">
                      Pricing Mode (Tax Handling)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsTaxInclusive(false)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                          !isTaxInclusive
                            ? 'border-[#F07818] bg-[#FFF0E3]/40'
                            : 'border-[#E8EAF0] bg-white hover:bg-[#FAFAFB]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#202124]">Tax Exclusive (Standard)</span>
                          {!isTaxInclusive && (
                            <span className="h-2 w-2 rounded-full bg-[#F07818]" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#6B7280] mt-1">
                          Base price + Tax added at checkout (e.g. ₹200 item + 5% GST = ₹210 total)
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsTaxInclusive(true)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                          isTaxInclusive
                            ? 'border-[#F07818] bg-[#FFF0E3]/40'
                            : 'border-[#E8EAF0] bg-white hover:bg-[#FAFAFB]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#202124]">Tax Inclusive (MRP Style)</span>
                          {isTaxInclusive && (
                            <span className="h-2 w-2 rounded-full bg-[#F07818]" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#6B7280] mt-1">
                          Menu price includes tax (e.g. ₹210 item includes ₹10 GST, customer pays ₹210)
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Tax Type & Tax Rate */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[#202124]">Tax Structure / Regime</label>
                      <select
                        value={taxType}
                        onChange={(e) => setTaxType(e.target.value)}
                        className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-xs font-semibold text-[#202124]"
                      >
                        <option value="CGST_SGST">Intra-State GST (CGST + SGST split equally)</option>
                        <option value="IGST">Inter-State GST (IGST single rate)</option>
                        <option value="NON_GST">Non-GST / Local VAT</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[#202124]">Default Tax Rate (%)</label>
                      <select
                        value={taxRate}
                        onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                        className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-xs font-semibold text-[#202124]"
                      >
                        <option value={5.0}>5.0% (Standard Food & Beverage GST: 2.5% CGST + 2.5% SGST)</option>
                        <option value={12.0}>12.0% (AC Dining / Premium Tier: 6% + 6%)</option>
                        <option value={18.0}>18.0% (Hotel Restaurant / Banquet: 9% + 9%)</option>
                        <option value={28.0}>28.0% (Special Aerated Beverages: 14% + 14%)</option>
                        <option value={0.0}>0.0% (Exempt)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Thermal Printing Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#202124]">Thermal Roll Width</label>
                <select
                  value={paperWidth}
                  onChange={(e) => setPaperWidth(parseInt(e.target.value))}
                  className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-xs font-semibold text-[#202124]"
                >
                  <option value={80}>80mm (Desktop Thermal Printer, ~42 chars)</option>
                  <option value={58}>58mm (Handheld / Compact, ~32 chars)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#202124]">Receipt Footer Message</label>
                <input
                  value={billFooter}
                  onChange={(e) => setBillFooter(e.target.value)}
                  placeholder="Thank you for dining with us! Please visit again."
                  className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-xs text-[#202124]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Invoice Prefix"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV-"
              />
              <Input
                label="KOT Prefix"
                value={kotPrefix}
                onChange={(e) => setKotPrefix(e.target.value)}
                placeholder="KOT-"
              />
            </div>
          </CardContent>
        </Card>

        {/* Database & Persistence Actions Card */}
        <Card>
          <CardHeader className="border-b border-[#E8EAF0] pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-[#F07818]" />
              <CardTitle>Local Offline Database & Backups</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="rounded-xl border border-[#E8EAF0] bg-[#FAFAFB] p-4 text-xs space-y-2">
              <p className="font-semibold text-[#202124] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#16865B]" />
                Commercial Offline-First SQLite Engine
              </p>
              <p className="text-[#6B7280]">
                All transactions, orders, KOTs, and menu items are safely stored in your local SQLite
                database with WAL (Write-Ahead Logging) enabled.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="button"
                  onClick={handleDownloadBackup}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Database Snapshot (.db)</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleSeedData}
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-[#F07818]"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Reload Sample Menu & Tables</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" isLoading={isSaving} className="px-8 gap-2">
            <Save className="h-4 w-4" />
            <span>Save Settings</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
