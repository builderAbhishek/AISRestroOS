import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { restaurantApi, printingApi, backupApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { Restaurant, BackupRecord } from '@/types';
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
  Upload,
  Sparkles,
  Save,
  ShieldCheck,
  Percent,
  ReceiptText,
  Info,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Clock,
  HardDrive,
  FileCheck,
} from 'lucide-react';

type SettingsTab = 'profile' | 'tax' | 'printer' | 'receipt' | 'backup' | 'general';

export const SettingsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast, openReceiptModal } = useUIStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: restaurant, isLoading } = useQuery({
    queryKey: ['restaurant'],
    queryFn: restaurantApi.getCurrent,
  });

  const { data: backups = [], isLoading: isBackupsLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: backupApi.list,
  });

  const { data: systemInfo } = useQuery({
    queryKey: ['systemInfo'],
    queryFn: restaurantApi.getSystemInfo,
  });

  // Profile States
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstRegistered, setGstRegistered] = useState(false);
  const [gstin, setGstin] = useState('');
  const [fssai, setFssai] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Tax States
  const [isTaxEnabled, setIsTaxEnabled] = useState(true);
  const [isTaxInclusive, setIsTaxInclusive] = useState(false);
  const [taxType, setTaxType] = useState('CGST_SGST');
  const [taxRate, setTaxRate] = useState(5.0);
  const [previewAmount, setPreviewAmount] = useState(1000);
  const [taxPreviewResult, setTaxPreviewResult] = useState<any>(null);

  // Printer States
  const [paperWidth, setPaperWidth] = useState(80);
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [kotPrefix, setKotPrefix] = useState('KOT-');
  const [kotPrinterName, setKotPrinterName] = useState('Default');
  const [billPrinterName, setBillPrinterName] = useState('Default');
  const [autoCutPaper, setAutoCutPaper] = useState(true);
  const [defaultFormat, setDefaultFormat] = useState<'58mm' | '80mm' | 'a4'>('80mm');
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  // Receipt Customization States
  const [billFooter, setBillFooter] = useState('');
  const [showLogoOnReceipt, setShowLogoOnReceipt] = useState(true);
  const [showFssaiOnReceipt, setShowFssaiOnReceipt] = useState(true);
  const [showGstinOnReceipt, setShowGstinOnReceipt] = useState(true);
  const [showCustomerOnReceipt, setShowCustomerOnReceipt] = useState(true);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(true);
  const [receiptHeaderNote, setReceiptHeaderNote] = useState('');

  // Auto-backup States
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState('daily');
  const [autoBackupTime, setAutoBackupTime] = useState('23:00');
  const [autoBackupPath, setAutoBackupPath] = useState('');
  const [backupRetention, setBackupRetention] = useState(15);

  // Restore Modal State
  const [restoreModalFile, setRestoreModalFile] = useState<BackupRecord | null>(null);
  const [restoreValidation, setRestoreValidation] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name || '');
      setLegalName(restaurant.legal_name || '');
      setOwnerName(restaurant.owner_name || '');
      setPhone(restaurant.phone || '');
      setEmail(restaurant.email || '');
      setAddress(restaurant.address || '');
      setGstRegistered(restaurant.gst_registered || false);
      setGstin(restaurant.gstin || '');
      setFssai(restaurant.fssai_number || '');
      setLogoUrl(restaurant.logo_url || '');

      const s = restaurant.settings;
      if (s) {
        setIsTaxEnabled(s.is_tax_enabled ?? true);
        setIsTaxInclusive(s.is_tax_inclusive ?? false);
        setTaxType(s.tax_type || 'CGST_SGST');
        setTaxRate(s.tax_rate_percent ?? 5.0);
        setPaperWidth(s.paper_width_mm || 80);
        setInvoicePrefix(s.invoice_prefix || 'INV-');
        setKotPrefix(s.kot_prefix || 'KOT-');
        setKotPrinterName(s.kot_printer_name || 'Default');
        setBillPrinterName(s.bill_printer_name || 'Default');
        setAutoCutPaper(s.auto_cut_paper ?? true);
        setDefaultFormat((s.default_print_format as any) || '80mm');

        setBillFooter(s.bill_footer_text || 'Thank you for dining with us! Please visit again.');
        setShowLogoOnReceipt(s.show_logo_on_receipt ?? true);
        setShowFssaiOnReceipt(s.show_fssai_on_receipt ?? true);
        setShowGstinOnReceipt(s.show_gstin_on_receipt ?? true);
        setShowCustomerOnReceipt(s.show_customer_info_on_receipt ?? true);
        setShowTaxBreakdown(s.show_tax_breakdown_on_receipt ?? true);
        setReceiptHeaderNote(s.receipt_header_note || '');

        setAutoBackupEnabled(s.auto_backup_enabled ?? false);
        setAutoBackupInterval(s.auto_backup_interval || 'daily');
        setAutoBackupTime(s.auto_backup_time || '23:00');
        setAutoBackupPath(s.auto_backup_path || '');
        setBackupRetention(s.backup_retention_count || 15);
      }
    }
  }, [restaurant]);

  // Recalculate tax preview whenever params change
  useEffect(() => {
    restaurantApi
      .taxPreview({
        amount_paise: Math.round(previewAmount * 100),
        tax_rate_percent: Number(taxRate),
        tax_type: taxType,
        is_tax_inclusive: isTaxInclusive,
        is_tax_enabled: isTaxEnabled,
      })
      .then(setTaxPreviewResult)
      .catch(() => {});
  }, [previewAmount, taxRate, taxType, isTaxInclusive, isTaxEnabled]);

  if (isLoading) {
    return <LoadingState message="Loading settings..." />;
  }

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await restaurantApi.updateProfile({
        name: name.trim(),
        legal_name: legalName.trim() || undefined,
        owner_name: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim(),
        gst_registered: gstRegistered,
        gstin: gstRegistered ? gstin.trim() : undefined,
        fssai_number: fssai.trim() || undefined,
        logo_url: logoUrl || undefined,
      });

      await restaurantApi.updateSettings({
        is_tax_enabled: isTaxEnabled,
        is_tax_inclusive: isTaxInclusive,
        tax_type: taxType,
        tax_rate_percent: Number(taxRate),
        paper_width_mm: Number(paperWidth),
        invoice_prefix: invoicePrefix.trim(),
        kot_prefix: kotPrefix.trim(),
        kot_printer_name: kotPrinterName.trim(),
        bill_printer_name: billPrinterName.trim(),
        auto_cut_paper: autoCutPaper,
        default_print_format: defaultFormat,
        bill_footer_text: billFooter.trim(),
        show_logo_on_receipt: showLogoOnReceipt,
        show_fssai_on_receipt: showFssaiOnReceipt,
        show_gstin_on_receipt: showGstinOnReceipt,
        show_customer_info_on_receipt: showCustomerOnReceipt,
        show_tax_breakdown_on_receipt: showTaxBreakdown,
        receipt_header_note: receiptHeaderNote.trim() || undefined,
        auto_backup_enabled: autoBackupEnabled,
        auto_backup_interval: autoBackupInterval,
        auto_backup_time: autoBackupTime,
        auto_backup_path: autoBackupPath.trim() || undefined,
        backup_retention_count: Number(backupRetention),
      });

      addToast({
        type: 'success',
        title: 'Settings Saved',
        description: 'Restaurant profile and configuration updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      queryClient.invalidateQueries({ queryKey: ['systemInfo'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error Saving Settings', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await restaurantApi.uploadLogo(file);
      setLogoUrl(res.logo_url);
      addToast({
        type: 'success',
        title: 'Logo Uploaded',
        description: 'New restaurant logo saved to local storage.',
      });
      queryClient.invalidateQueries({ queryKey: ['restaurant'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Upload Failed', description: err.message });
    }
  };

  const handleTestPrint = async (format: '58mm' | '80mm') => {
    setIsTestPrinting(true);
    try {
      const res = await printingApi.testPrint({
        printer_name: billPrinterName || 'Default Thermal',
        paper_format: format,
      });
      openReceiptModal(res.receipt_text, 'TEST-PRINT');
      addToast({
        type: 'success',
        title: 'Test Print Generated',
        description: res.message,
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Test Print Failed', description: err.message });
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await backupApi.create(autoBackupPath || undefined);
      addToast({
        type: 'success',
        title: 'Backup Created',
        description: `Archive saved: ${res.filename} (${(res.file_size_bytes / 1024).toFixed(1)} KB)`,
      });
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['systemInfo'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Backup Failed', description: err.message });
    }
  };

  const handleDeleteBackup = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete backup "${name}"?`)) return;
    try {
      await backupApi.delete(id);
      addToast({ type: 'info', title: 'Backup Deleted', description: `Removed ${name}` });
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Delete Failed', description: err.message });
    }
  };

  const startRestoreFlow = async (backup: BackupRecord) => {
    setRestoreModalFile(backup);
    setIsValidating(true);
    setRestoreValidation(null);
    try {
      const res = await backupApi.validate(backup.file_path);
      setRestoreValidation(res);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Validation Failed', description: err.message });
      setRestoreModalFile(null);
    } finally {
      setIsValidating(false);
    }
  };

  const confirmRestore = async () => {
    if (!restoreModalFile) return;
    setIsRestoring(true);
    try {
      const res = await backupApi.restore(restoreModalFile.file_path);
      addToast({
        type: 'success',
        title: 'Database Restored Successfully',
        description: `Restored from ${restoreModalFile.filename}. A safety backup was saved.`,
      });
      setRestoreModalFile(null);
      queryClient.invalidateQueries();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Restore Failed', description: err.message });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E8EAF0]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202124] flex items-center gap-2">
            <Settings className="h-6 w-6 text-[#F07818]" />
            Settings & Local System Configuration
          </h2>
          <p className="text-xs text-[#6B7280]">
            Manage business profile, GST tax calculations, thermal printers, receipt layout, SQLite backups and system storage
          </p>
        </div>
        <Button
          type="button"
          onClick={() => handleSaveProfile()}
          disabled={isSaving}
          className="bg-[#F07818] hover:bg-[#D9660E] text-white flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving Changes...' : 'Save Settings'}
        </Button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-[#E8EAF0] gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-[#F07818] text-[#F07818] bg-[#FFF0E3]/40'
              : 'border-transparent text-[#6B7280] hover:text-[#202124]'
          }`}
        >
          <Store className="h-4 w-4" /> Restaurant Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tax')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'tax'
              ? 'border-[#F07818] text-[#F07818] bg-[#FFF0E3]/40'
              : 'border-transparent text-[#6B7280] hover:text-[#202124]'
          }`}
        >
          <Percent className="h-4 w-4" /> Tax Settings
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('printer')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'printer'
              ? 'border-[#F07818] text-[#F07818] bg-[#FFF0E3]/40'
              : 'border-transparent text-[#6B7280] hover:text-[#202124]'
          }`}
        >
          <Printer className="h-4 w-4" /> Printer Configuration
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receipt')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'receipt'
              ? 'border-[#F07818] text-[#F07818] bg-[#FFF0E3]/40'
              : 'border-transparent text-[#6B7280] hover:text-[#202124]'
          }`}
        >
          <ReceiptText className="h-4 w-4" /> Receipt Customization
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'backup'
              ? 'border-[#F07818] text-[#F07818] bg-[#FFF0E3]/40'
              : 'border-transparent text-[#6B7280] hover:text-[#202124]'
          }`}
        >
          <Database className="h-4 w-4" /> Backup & Restore
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-[#F07818] text-[#F07818] bg-[#FFF0E3]/40'
              : 'border-transparent text-[#6B7280] hover:text-[#202124]'
          }`}
        >
          <Info className="h-4 w-4" /> General & Storage
        </button>
      </div>

      {/* Tab 1: Restaurant Profile */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-[#E8EAF0] pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4 text-[#F07818]" /> Restaurant Business Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Logo Upload Section */}
              <div className="flex items-center gap-6 p-4 rounded-xl bg-[#F7F8FA] border border-[#E8EAF0]">
                <div className="w-20 h-20 rounded-xl bg-white border border-[#E8EAF0] flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Store className="h-8 w-8 text-[#9AA0A6]" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-semibold text-[#202124]">Restaurant Logo</h4>
                  <p className="text-xs text-[#6B7280]">
                    Stored permanently in local Windows app data directory. Printed on customer receipts if enabled.
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload Logo
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLogoUrl('')}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Remove Logo
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Restaurant Trade Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Royal Heritage Restro"
                  required
                />
                <Input
                  label="Legal Entity Name (Optional)"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Royal Heritage Hospitality Pvt Ltd"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Owner / General Manager *"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  required
                />
                <Input
                  label="Contact Phone Number *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Business Email (Optional)"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  label="FSSAI License Number (Optional)"
                  value={fssai}
                  onChange={(e) => setFssai(e.target.value)}
                  placeholder="14-digit FSSAI Lic No."
                />
              </div>

              <Input
                label="Full Address (Printed on invoices) *"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />

              {/* GSTIN Box */}
              <div className="p-4 rounded-xl border border-[#E8EAF0] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-[#202124]">GST Registration</span>
                    <p className="text-xs text-[#6B7280]">
                      Enable if your food establishment is registered under Indian GST regulations.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={gstRegistered}
                    onChange={(e) => setGstRegistered(e.target.checked)}
                    className="h-5 w-5 rounded border-[#D1D5DB] text-[#F07818] focus:ring-[#F07818]"
                  />
                </div>

                {gstRegistered && (
                  <div className="pt-2">
                    <Input
                      label="GSTIN (15-Character Tax Identification Number) *"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 07AAAAA0000A1Z5"
                      maxLength={15}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Tax Settings */}
      {activeTab === 'tax' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-[#E8EAF0] pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4 text-[#F07818]" /> Centralized Tax Engine Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <strong>Audit Note:</strong> Modifying tax settings applies to newly generated orders only.
                Historical invoices, payments, and closed financial ledgers are preserved immutably.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202124]">Tax Status</label>
                  <select
                    value={isTaxEnabled ? 'enabled' : 'disabled'}
                    onChange={(e) => setIsTaxEnabled(e.target.value === 'enabled')}
                    className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-xs focus:border-[#F07818] focus:outline-none"
                  >
                    <option value="enabled">Enabled (Charge GST on Orders)</option>
                    <option value="disabled">Disabled (No Tax Calculated)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202124]">Pricing Model</label>
                  <select
                    value={isTaxInclusive ? 'inclusive' : 'exclusive'}
                    onChange={(e) => setIsTaxInclusive(e.target.value === 'inclusive')}
                    className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-xs focus:border-[#F07818] focus:outline-none"
                  >
                    <option value="exclusive">Exclusive (Tax added on top of item price)</option>
                    <option value="inclusive">Inclusive (Menu prices include GST)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202124]">GST Structure</label>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-xs focus:border-[#F07818] focus:outline-none"
                  >
                    <option value="CGST_SGST">Intra-State: CGST + SGST (Equal Split)</option>
                    <option value="IGST">Inter-State: IGST (Full Rate)</option>
                    <option value="NON_GST">Non-GST / Exempt</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202124]">Default Tax Rate (%)</label>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-xs focus:border-[#F07818] focus:outline-none"
                  >
                    <option value={0}>0% (Exempted)</option>
                    <option value={5}>5.0% (Standard Restaurant Composite / AC)</option>
                    <option value={12}>12.0% (Beverages / Standard Goods)</option>
                    <option value={18}>18.0% (Hotel Dine-in & Outdoor Catering)</option>
                    <option value={28}>28.0% (Aerated Drinks / Luxury)</option>
                  </select>
                </div>
              </div>

              {/* Live Tax Preview Calculator */}
              <div className="mt-6 p-4 rounded-xl bg-[#F7F8FA] border border-[#E8EAF0] space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                  Live Calculation Verification Preview
                </h4>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#202124] font-medium">Sample Dish Price: ₹</span>
                  <input
                    type="number"
                    value={previewAmount}
                    onChange={(e) => setPreviewAmount(Math.max(1, Number(e.target.value)))}
                    className="w-32 rounded-lg border border-[#E8EAF0] bg-white px-3 py-1.5 text-xs font-semibold text-[#202124]"
                  />
                  <span className="text-xs text-[#6B7280]">({isTaxInclusive ? 'Inclusive' : 'Exclusive'})</span>
                </div>

                {taxPreviewResult && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-2.5 rounded-lg bg-white border border-[#E8EAF0]">
                      <span className="text-[10px] text-[#6B7280] block">Taxable Base</span>
                      <span className="text-sm font-bold text-[#202124]">
                        ₹{(taxPreviewResult.taxable_amount_paise / 100).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-[#E8EAF0]">
                      <span className="text-[10px] text-[#6B7280] block">
                        {taxType === 'CGST_SGST' ? `CGST (${taxRate / 2}%)` : 'IGST'}
                      </span>
                      <span className="text-sm font-bold text-[#202124]">
                        ₹{((taxType === 'CGST_SGST' ? taxPreviewResult.cgst_paise : taxPreviewResult.igst_paise) / 100).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-[#E8EAF0]">
                      <span className="text-[10px] text-[#6B7280] block">
                        {taxType === 'CGST_SGST' ? `SGST (${taxRate / 2}%)` : 'Total Tax'}
                      </span>
                      <span className="text-sm font-bold text-[#202124]">
                        ₹{((taxType === 'CGST_SGST' ? taxPreviewResult.sgst_paise : taxPreviewResult.tax_paise) / 100).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#FFF0E3] border border-[#F07818]/30">
                      <span className="text-[10px] text-[#F07818] font-bold block">Customer Total</span>
                      <span className="text-sm font-extrabold text-[#F07818]">
                        ₹{(taxPreviewResult.grand_total_paise / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: Printer Configuration */}
      {activeTab === 'printer' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-[#E8EAF0] pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Printer className="h-4 w-4 text-[#F07818]" /> Hardware & Thermal Printer Routing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202124]">Thermal Paper Format</label>
                  <select
                    value={defaultFormat}
                    onChange={(e) => {
                      const fmt = e.target.value as any;
                      setDefaultFormat(fmt);
                      setPaperWidth(fmt === '58mm' ? 58 : 80);
                    }}
                    className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-xs focus:border-[#F07818] focus:outline-none"
                  >
                    <option value="80mm">80mm Thermal (Standard ESC/POS 42-48 col)</option>
                    <option value="58mm">58mm Thermal (Compact 32 col)</option>
                    <option value="a4">A4 Full Sheet (Laser/Inkjet Invoice)</option>
                  </select>
                </div>

                <Input
                  label="Invoice Bill Number Prefix"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                  placeholder="INV-"
                />

                <Input
                  label="Kitchen KOT Number Prefix"
                  value={kotPrefix}
                  onChange={(e) => setKotPrefix(e.target.value.toUpperCase())}
                  placeholder="KOT-"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Billing Counter Printer Name"
                  value={billPrinterName}
                  onChange={(e) => setBillPrinterName(e.target.value)}
                  placeholder="e.g. POS-80 or USB Thermal Printer"
                />
                <Input
                  label="Kitchen KOT Printer Name"
                  value={kotPrinterName}
                  onChange={(e) => setKotPrinterName(e.target.value)}
                  placeholder="e.g. Kitchen-Printer-USB"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-[#E8EAF0] bg-[#F7F8FA]">
                <div>
                  <span className="text-xs font-semibold text-[#202124]">Hardware Auto-Cut Paper</span>
                  <p className="text-[11px] text-[#6B7280]">
                    Sends ESC/POS GS V 0 cut feed signal after ticket printing.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoCutPaper}
                  onChange={(e) => setAutoCutPaper(e.target.checked)}
                  className="h-5 w-5 rounded border-[#D1D5DB] text-[#F07818] focus:ring-[#F07818]"
                />
              </div>

              {/* Test Print Section */}
              <div className="pt-4 border-t border-[#E8EAF0] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-[#202124]">Diagnostic Test Prints</h4>
                  <p className="text-[11px] text-[#6B7280]">
                    Verify printer alignment and receipt margins.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isTestPrinting}
                    onClick={() => handleTestPrint('80mm')}
                    className="text-xs"
                  >
                    Test 80mm Print
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isTestPrinting}
                    onClick={() => handleTestPrint('58mm')}
                    className="text-xs"
                  >
                    Test 58mm Print
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: Receipt Customization */}
      {activeTab === 'receipt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <Card>
              <CardHeader className="border-b border-[#E8EAF0] pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-[#F07818]" /> Receipt Elements & Layout
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Input
                  label="Header Sub-Note (Optional branding line)"
                  value={receiptHeaderNote}
                  onChange={(e) => setReceiptHeaderNote(e.target.value)}
                  placeholder="e.g. Authentic North Indian & Tandoor Cuisine"
                />

                <Input
                  label="Footer Message (Printed at the bottom)"
                  value={billFooter}
                  onChange={(e) => setBillFooter(e.target.value)}
                  placeholder="e.g. Thank you for dining with us! Please visit again."
                />

                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                    Receipt Content Visibility Toggles
                  </h4>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#E8EAF0] bg-white">
                    <span className="text-xs text-[#202124] font-medium">Show Restaurant Logo</span>
                    <input
                      type="checkbox"
                      checked={showLogoOnReceipt}
                      onChange={(e) => setShowLogoOnReceipt(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D1D5DB] text-[#F07818] focus:ring-[#F07818]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#E8EAF0] bg-white">
                    <span className="text-xs text-[#202124] font-medium">Show GSTIN Registration</span>
                    <input
                      type="checkbox"
                      checked={showGstinOnReceipt}
                      onChange={(e) => setShowGstinOnReceipt(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D1D5DB] text-[#F07818] focus:ring-[#F07818]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#E8EAF0] bg-white">
                    <span className="text-xs text-[#202124] font-medium">Show FSSAI License Number</span>
                    <input
                      type="checkbox"
                      checked={showFssaiOnReceipt}
                      onChange={(e) => setShowFssaiOnReceipt(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D1D5DB] text-[#F07818] focus:ring-[#F07818]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#E8EAF0] bg-white">
                    <span className="text-xs text-[#202124] font-medium">Show Customer Name & Phone</span>
                    <input
                      type="checkbox"
                      checked={showCustomerOnReceipt}
                      onChange={(e) => setShowCustomerOnReceipt(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D1D5DB] text-[#F07818] focus:ring-[#F07818]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#E8EAF0] bg-white">
                    <span className="text-xs text-[#202124] font-medium">Detailed CGST/SGST Breakdown</span>
                    <input
                      type="checkbox"
                      checked={showTaxBreakdown}
                      onChange={(e) => setShowTaxBreakdown(e.target.checked)}
                      className="h-4 w-4 rounded border-[#D1D5DB] text-[#F07818] focus:ring-[#F07818]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Live Interactive Thermal Ticket Preview */}
          <div className="lg:col-span-5">
            <Card className="sticky top-6">
              <CardHeader className="border-b border-[#E8EAF0] pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                  Live Thermal Receipt Preview ({defaultFormat})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 flex justify-center">
                <div
                  className={`bg-[#FFFEF9] border border-[#D5D7DC] p-4 font-mono text-[11px] leading-tight text-[#111827] shadow-md rounded-sm select-none ${
                    defaultFormat === '58mm' ? 'w-64' : 'w-80'
                  }`}
                >
                  {showLogoOnReceipt && logoUrl && (
                    <div className="flex justify-center pb-2">
                      <img src={logoUrl} alt="Logo" className="h-8 max-w-[120px] object-contain grayscale" />
                    </div>
                  )}

                  <div className="text-center font-bold text-xs">{name || 'RESTAURANT NAME'}</div>
                  {receiptHeaderNote && (
                    <div className="text-center text-[10px] text-[#4B5563]">{receiptHeaderNote}</div>
                  )}
                  <div className="text-center text-[10px] text-[#4B5563]">{address || 'Restaurant Address'}</div>
                  <div className="text-center text-[10px] text-[#4B5563]">Ph: {phone || '9876543210'}</div>
                  {showGstinOnReceipt && gstRegistered && gstin && (
                    <div className="text-center text-[10px] font-semibold">GSTIN: {gstin}</div>
                  )}
                  {showFssaiOnReceipt && fssai && (
                    <div className="text-center text-[10px]">FSSAI Lic: {fssai}</div>
                  )}

                  <div className="my-2 border-b border-dashed border-[#9CA3AF]" />
                  <div className="text-center font-bold text-[11px]">TAX INVOICE</div>
                  <div className="my-2 border-b border-dashed border-[#9CA3AF]" />

                  <div className="flex justify-between text-[10px]">
                    <span>Inv #: {invoicePrefix}0042</span>
                    <span>Ord: ORD-0042</span>
                  </div>
                  <div className="text-[10px] text-[#4B5563]">Date: 03-Nov-2026 05:30 PM</div>
                  <div className="flex justify-between text-[10px]">
                    <span>Type: DINE IN</span>
                    <span>Table: T1</span>
                  </div>

                  {showCustomerOnReceipt && (
                    <div className="text-[10px] text-[#4B5563]">Customer: Walk-in Guest</div>
                  )}

                  <div className="my-2 border-b border-dashed border-[#9CA3AF]" />
                  <div className="flex justify-between font-bold text-[10px]">
                    <span className="w-1/2">Item</span>
                    <span className="text-center w-8">Qty</span>
                    <span className="text-right flex-1">Price</span>
                  </div>
                  <div className="my-1 border-b border-dashed border-[#E5E7EB]" />

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="w-1/2 truncate">Paneer Tikka Full</span>
                      <span className="text-center w-8">1</span>
                      <span className="text-right flex-1">240.00</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="w-1/2 truncate">Butter Naan</span>
                      <span className="text-center w-8">2</span>
                      <span className="text-right flex-1">90.00</span>
                    </div>
                  </div>

                  <div className="my-2 border-b border-dashed border-[#9CA3AF]" />
                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>INR 330.00</span>
                    </div>

                    {isTaxEnabled && (
                      <>
                        {showTaxBreakdown && taxType === 'CGST_SGST' ? (
                          <>
                            <div className="flex justify-between text-[#4B5563]">
                              <span>CGST ({taxRate / 2}%):</span>
                              <span>INR {(330 * (taxRate / 200)).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[#4B5563]">
                              <span>SGST ({taxRate / 2}%):</span>
                              <span>INR {(330 * (taxRate / 200)).toFixed(2)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-[#4B5563]">
                            <span>Tax ({taxRate}%):</span>
                            <span>INR {(330 * (taxRate / 100)).toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="my-2 border-b border-dashed border-[#9CA3AF]" />
                  <div className="flex justify-between font-extrabold text-xs">
                    <span>GRAND TOTAL:</span>
                    <span>
                      INR {(330 + (isTaxEnabled && !isTaxInclusive ? 330 * (taxRate / 100) : 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="my-2 border-b border-dashed border-[#9CA3AF]" />

                  <div className="text-center text-[10px] text-[#4B5563] pt-1">
                    {billFooter || 'Thank you! Visit again.'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 5: Backup & Restore */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Top Backup Actions Card */}
          <Card>
            <CardHeader className="border-b border-[#E8EAF0] pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#F07818]" /> Point-in-Time SQLite Safe Backup
                </CardTitle>
                <p className="text-xs text-[#6B7280]">
                  Uses SQLite online backup engine. Backs up active transactions and flushes WAL journals safely.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleCreateBackup}
                className="bg-[#F07818] hover:bg-[#D9660E] text-white flex items-center gap-2 text-xs"
              >
                <Download className="h-3.5 w-3.5" /> Backup Now
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Automated Schedule Box */}
              <div className="p-4 rounded-xl border border-[#E8EAF0] bg-[#F7F8FA] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                      Automated Offline Backup Schedule
                    </h4>
                    <p className="text-[11px] text-[#6B7280]">
                      Runs in-process in the Windows desktop app. Does not require cloud connectivity or Docker.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoBackupEnabled}
                    onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                    className="h-5 w-5 rounded border-[#D1D5DB] text-[#F07818] focus:ring-[#F07818]"
                  />
                </div>

                {autoBackupEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#202124]">Frequency</label>
                      <select
                        value={autoBackupInterval}
                        onChange={(e) => setAutoBackupInterval(e.target.value)}
                        className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-1.5 text-xs"
                      >
                        <option value="daily">Daily Schedule</option>
                        <option value="weekly">Weekly (Sundays)</option>
                      </select>
                    </div>

                    <Input
                      label="Scheduled Time (HH:MM)"
                      type="time"
                      value={autoBackupTime}
                      onChange={(e) => setAutoBackupTime(e.target.value)}
                    />

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#202124]">Retention Count</label>
                      <select
                        value={backupRetention}
                        onChange={(e) => setBackupRetention(Number(e.target.value))}
                        className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-1.5 text-xs"
                      >
                        <option value={7}>Keep last 7 backups</option>
                        <option value={15}>Keep last 15 backups (Recommended)</option>
                        <option value={30}>Keep last 30 backups</option>
                      </select>
                    </div>
                  </div>
                )}

                <Input
                  label="Custom Destination Folder (Optional, e.g. External USB drive E:\RestaurantBackups)"
                  value={autoBackupPath}
                  onChange={(e) => setAutoBackupPath(e.target.value)}
                  placeholder="Leave blank to use default safe app data directory"
                />
              </div>

              {/* Backup History Table */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                    Backup Archives History ({backups.length})
                  </h4>
                  {systemInfo && (
                    <span className="text-[11px] text-[#6B7280]">
                      Default Folder: <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">{systemInfo.backup_directory}</code>
                    </span>
                  )}
                </div>

                {isBackupsLoading ? (
                  <LoadingState message="Scanning backup records..." />
                ) : backups.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#6B7280] border border-dashed rounded-xl bg-white">
                    No backup archives found yet. Click <strong>Backup Now</strong> to take your first safety copy.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#E8EAF0] rounded-xl bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F7F8FA] border-b border-[#E8EAF0] text-[#6B7280] font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Filename / Archive</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Created At</th>
                          <th className="py-2.5 px-3 text-right">Size</th>
                          <th className="py-2.5 px-3 text-center">Tables / Records</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8EAF0]">
                        {backups.map((b) => (
                          <tr key={b.id} className="hover:bg-[#F7F8FA]/60">
                            <td className="py-2.5 px-3 font-mono font-medium text-[#202124]">
                              {b.filename}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant={
                                  b.backup_type === 'safety_pre_restore'
                                    ? 'warning'
                                    : b.backup_type === 'automatic'
                                    ? 'bhagwa'
                                    : 'neutral'
                                }
                                size="sm"
                              >
                                {b.backup_type}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-[#6B7280]">
                              {b.created_at ? new Date(b.created_at).toLocaleString() : 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-[#202124] font-medium">
                              {(b.file_size_bytes / 1024).toFixed(1)} KB
                            </td>
                            <td className="py-2.5 px-3 text-center text-[#6B7280]">
                              {b.tables_count} tbls / {b.records_count} recs
                            </td>
                            <td className="py-2.5 px-3 text-right space-x-2">
                              <a
                                href={backupApi.getDownloadUrl(b.id)}
                                download={b.filename}
                                className="inline-flex items-center text-xs font-semibold text-[#F07818] hover:underline"
                              >
                                Download
                              </a>
                              <button
                                type="button"
                                onClick={() => startRestoreFlow(b)}
                                className="inline-flex items-center text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBackup(b.id, b.filename)}
                                className="inline-flex items-center text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Restore Confirmation Modal */}
          {restoreModalFile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-3 text-amber-600">
                  <AlertTriangle className="h-6 w-6 shrink-0" />
                  <h3 className="text-base font-bold text-[#202124]">
                    Confirm Safe Database Restore
                  </h3>
                </div>

                <p className="text-xs text-[#4B5563] leading-relaxed">
                  You are about to restore the local database from{' '}
                  <strong className="text-[#202124]">{restoreModalFile.filename}</strong>.
                </p>

                {isValidating ? (
                  <LoadingState message="Validating archive checksum and SQLite integrity..." />
                ) : restoreValidation ? (
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#6B7280]">Restaurant Name:</span>
                      <strong className="text-[#202124]">
                        {restoreValidation.metadata.restaurant_name}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280]">Backup Created:</span>
                      <span className="text-[#202124]">
                        {new Date(restoreValidation.metadata.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280]">Integrity Check:</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Passed (OK)
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  <strong>Safety Guarantee:</strong> An automatic point-in-time safety snapshot of your current database will be saved before restore begins. If any error occurs, your system rolls back automatically.
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRestoreModalFile(null)}
                    disabled={isRestoring}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={confirmRestore}
                    disabled={isRestoring || isValidating}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isRestoring ? 'Restoring Database...' : 'Yes, Restore Database'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: General Settings & Local Storage */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-[#E8EAF0] pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-[#F07818]" /> System Storage & Environmental Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {systemInfo ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[#E8EAF0] bg-white space-y-2">
                    <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider block">
                      Software Architecture
                    </span>
                    <div className="flex justify-between text-xs py-1 border-b border-gray-100">
                      <span className="text-[#6B7280]">Application Name:</span>
                      <strong className="text-[#202124]">{systemInfo.app_name}</strong>
                    </div>
                    <div className="flex justify-between text-xs py-1 border-b border-gray-100">
                      <span className="text-[#6B7280]">Software Version:</span>
                      <strong className="text-[#202124]">v{systemInfo.app_version} Commercial</strong>
                    </div>
                    <div className="flex justify-between text-xs py-1 border-b border-gray-100">
                      <span className="text-[#6B7280]">Operation Mode:</span>
                      <strong className="text-emerald-700">100% Offline Capable</strong>
                    </div>
                    <div className="flex justify-between text-xs py-1">
                      <span className="text-[#6B7280]">Database Engine:</span>
                      <strong className="text-[#202124]">{systemInfo.database_engine} (WAL Mode)</strong>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[#E8EAF0] bg-white space-y-2">
                    <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider block">
                      Local SQLite Storage Stats
                    </span>
                    <div className="flex justify-between text-xs py-1 border-b border-gray-100">
                      <span className="text-[#6B7280]">Database File Size:</span>
                      <strong className="text-[#202124]">{systemInfo.database_size_display}</strong>
                    </div>
                    <div className="flex justify-between text-xs py-1 border-b border-gray-100">
                      <span className="text-[#6B7280]">Total Orders Processed:</span>
                      <strong className="text-[#202124]">{systemInfo.total_orders}</strong>
                    </div>
                    <div className="flex justify-between text-xs py-1 border-b border-gray-100">
                      <span className="text-[#6B7280]">Total Menu Dishes:</span>
                      <strong className="text-[#202124]">{systemInfo.total_menu_items}</strong>
                    </div>
                    <div className="flex justify-between text-xs py-1">
                      <span className="text-[#6B7280]">Total Cash Shifts:</span>
                      <strong className="text-[#202124]">{systemInfo.total_shifts}</strong>
                    </div>
                  </div>

                  <div className="md:col-span-2 p-4 rounded-xl border border-[#E8EAF0] bg-[#F7F8FA] space-y-2">
                    <span className="text-xs font-bold text-[#202124]">Local File System Paths (Read-Only)</span>
                    <div className="text-xs text-[#4B5563] space-y-1">
                      <div>
                        <strong>SQLite Database Path:</strong>{' '}
                        <code className="bg-white border px-1.5 py-0.5 rounded text-[11px] font-mono break-all">
                          {systemInfo.database_file_path}
                        </code>
                      </div>
                      <div>
                        <strong>Backup Archive Directory:</strong>{' '}
                        <code className="bg-white border px-1.5 py-0.5 rounded text-[11px] font-mono break-all">
                          {systemInfo.backup_directory}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <LoadingState message="Loading system telemetry..." />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
