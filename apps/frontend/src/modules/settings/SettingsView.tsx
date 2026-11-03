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
        setTaxRate(restaurant.settings.tax_rate_percent);
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
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#202124]">Default GST Rate (%)</label>
                <select
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                  className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-xs font-semibold text-[#202124]"
                >
                  <option value={5.0}>5.0% (2.5% CGST + 2.5% SGST)</option>
                  <option value={12.0}>12.0% (6% CGST + 6% SGST)</option>
                  <option value={18.0}>18.0% (9% CGST + 9% SGST)</option>
                  <option value={0.0}>0.0% (Non-GST / Exempt)</option>
                </select>
              </div>

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

            <Input
              label="Receipt Footer Thank You Message"
              value={billFooter}
              onChange={(e) => setBillFooter(e.target.value)}
              placeholder="Thank you for dining with us! Please visit again."
            />
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
