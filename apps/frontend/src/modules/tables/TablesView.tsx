import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tablesApi, ordersApi, menuApi, billingApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';
import { formatINR } from '@/lib/utils';
import { RestaurantTable, Order } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import {
  Armchair,
  Users,
  UtensilsCrossed,
  Receipt,
  Plus,
  Trash2,
  Edit2,
  ArrowRightLeft,
  Power,
  Clock,
  CreditCard,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const TablesView: React.FC = () => {
  const queryClient = useQueryClient();
  const { navigateTo, openSettlementModal, addToast } = useUIStore();
  const { setOrderType, setTable, loadExistingOrder, clearCart } = useCartStore();

  // Selected Section filter
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // Add / Edit Table Modal state
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [section, setSection] = useState('Main Hall');
  const [displayOrder, setDisplayOrder] = useState('0');

  // Table Transfer Modal state
  const [transferSourceTable, setTransferSourceTable] = useState<RestaurantTable | null>(null);
  const [transferTargetTableId, setTransferTargetTableId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Queries
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['tables-stats'],
    queryFn: () => tablesApi.getStats(),
    refetchInterval: 5000,
  });

  const { data: tables = [], isLoading, isFetching, refetch: refetchTables } = useQuery({
    queryKey: ['tables', selectedSection],
    queryFn: () => tablesApi.listTables(selectedSection !== 'all' ? selectedSection : undefined),
    refetchInterval: 5000,
  });

  // Extract unique sections
  const sections = useMemo(() => {
    return Array.from(new Set(tables.map((t) => t.section || 'Main Hall')));
  }, [tables]);

  // Available target tables for transfer
  const availableTargetTables = useMemo(() => {
    return tables.filter(
      (t) => t.status === 'available' && t.is_active && t.id !== transferSourceTable?.id
    );
  }, [tables, transferSourceTable]);

  // Open / Resume Table in POS
  const handleOpenTableInPOS = async (table: RestaurantTable) => {
    if (!table.is_active) {
      addToast({
        type: 'warning',
        title: 'Table Disabled',
        description: `Table ${table.table_number} is currently disabled. Enable it from settings to take orders.`,
      });
      return;
    }

    setOrderType('dine_in');
    setTable(table.id, table.table_number);

    if (table.status === 'occupied' || table.status === 'bill_generated') {
      try {
        let order: Order | null = null;
        if (table.current_order_id) {
          order = await ordersApi.getOrder(table.current_order_id);
        } else {
          order = await tablesApi.getActiveOrder(table.id);
        }

        if (order) {
          const allItems = await menuApi.listItems();
          loadExistingOrder(order, allItems);
          addToast({
            type: 'info',
            title: `Resumed Table ${table.table_number}`,
            description: `Loaded active order ${order.order_code} into POS.`,
          });
          navigateTo('pos', { tableId: table.id, orderId: order.id });
          return;
        }
      } catch (err: any) {
        addToast({ type: 'error', title: 'Error Loading Order', description: err.message });
      }
    } else {
      // Free table -> start new dine-in cart
      clearCart();
      setOrderType('dine_in');
      setTable(table.id, table.table_number);
    }

    navigateTo('pos', { tableId: table.id });
  };

  // Quick Action: Generate Bill directly from Table
  const handleGenerateBillFromTable = async (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!table.current_order_id) return;
    try {
      await billingApi.generateBill(table.current_order_id);
      addToast({
        type: 'success',
        title: 'Bill Generated',
        description: `Invoice generated for Table ${table.table_number}. Status updated to Bill Pending.`,
      });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['tables-stats'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Billing Error', description: err.message });
    }
  };

  // Quick Action: Settle directly from Table
  const handleSettleFromTable = async (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!table.current_order_id) return;
    try {
      const order = await ordersApi.getOrder(table.current_order_id);
      openSettlementModal(order);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  // Open Edit Modal
  const handleEditClick = (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTable(table);
    setTableNumber(table.table_number);
    setCapacity(table.capacity.toString());
    setSection(table.section);
    setDisplayOrder(table.display_order?.toString() || '0');
  };

  // Toggle Active State
  const handleToggleActive = async (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await tablesApi.toggleActive(table.id);
      addToast({
        type: 'info',
        title: table.is_active ? 'Table Disabled' : 'Table Enabled',
        description: `Table ${table.table_number} is now ${table.is_active ? 'disabled' : 'active'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['tables-stats'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Cannot Toggle', description: err.message });
    }
  };

  // Delete Table
  const handleDeleteTable = async (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete table ${table.table_number}? This cannot be undone.`)) return;
    try {
      await tablesApi.deleteTable(table.id);
      addToast({ type: 'info', title: 'Table Deleted', description: `Table ${table.table_number} removed.` });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['tables-stats'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Cannot Delete Table', description: err.message });
    }
  };

  // Submit Add / Edit Table
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim()) return;

    try {
      if (editingTable) {
        await tablesApi.updateTable(editingTable.id, {
          table_number: tableNumber.trim(),
          capacity: parseInt(capacity) || 4,
          section: section.trim() || 'Main Hall',
          display_order: parseInt(displayOrder) || 0,
        });
        addToast({ type: 'success', title: 'Table Updated', description: `Table ${tableNumber} updated.` });
      } else {
        await tablesApi.createTable({
          table_number: tableNumber.trim(),
          capacity: parseInt(capacity) || 4,
          section: section.trim() || 'Main Hall',
          display_order: parseInt(displayOrder) || 0,
        });
        addToast({ type: 'success', title: 'Table Created', description: `Table ${tableNumber} added.` });
      }
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['tables-stats'] });
      setIsAddTableOpen(false);
      setEditingTable(null);
      setTableNumber('');
      setCapacity('4');
      setSection('Main Hall');
      setDisplayOrder('0');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Save Failed', description: err.message });
    }
  };

  // Table Transfer Execution
  const handleExecuteTransfer = async () => {
    if (!transferSourceTable || !transferTargetTableId) return;
    setIsTransferring(true);
    try {
      await tablesApi.transferTable(transferSourceTable.id, transferTargetTableId);
      const targetTable = tables.find((t) => t.id === transferTargetTableId);
      addToast({
        type: 'success',
        title: 'Order Transferred',
        description: `Order successfully transferred from Table ${transferSourceTable.table_number} to Table ${targetTable?.table_number}.`,
      });
      setTransferSourceTable(null);
      setTransferTargetTableId('');
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['tables-stats'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Transfer Failed', description: err.message });
    } finally {
      setIsTransferring(false);
    }
  };

  // Calculate elapsed time from created_at
  const formatElapsed = (isoDate?: string) => {
    if (!isoDate) return null;
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMins = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMins < 60) return `${diffMins}m`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#202124]">Floor Plan & Table Management</h2>
          <p className="text-xs text-[#6B7280]">
            Monitor dining floor capacity, live table occupancy, bill generation, and order transfers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchTables();
              refetchStats();
            }}
            className="gap-1.5 h-8 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => {
              setEditingTable(null);
              setTableNumber('');
              setCapacity('4');
              setSection('Main Hall');
              setDisplayOrder('0');
              setIsAddTableOpen(true);
            }}
            size="sm"
            variant="primary"
            className="gap-1.5 h-8 text-xs font-semibold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Table</span>
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E8EAF0] bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">Total Tables</span>
          <span className="text-2xl font-black text-[#202124] mt-0.5 block">{stats?.total_tables || tables.length}</span>
          <span className="text-[10px] text-[#6B7280]">Active floor capacity</span>
        </div>

        <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#065F46] uppercase tracking-wider block">Available</span>
          <span className="text-2xl font-black text-[#059669] mt-0.5 block">{stats?.available_tables || 0}</span>
          <span className="text-[10px] text-[#065F46]">Ready to seat guests</span>
        </div>

        <div className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#9A3412] uppercase tracking-wider block">Occupied</span>
          <span className="text-2xl font-black text-[#EA580C] mt-0.5 block">{stats?.occupied_tables || 0}</span>
          <span className="text-[10px] text-[#9A3412]">Dining in progress</span>
        </div>

        <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#5B21B6] uppercase tracking-wider block">Bill Pending</span>
          <span className="text-2xl font-black text-[#7C3AED] mt-0.5 block">{stats?.bill_pending_tables || 0}</span>
          <span className="text-[10px] text-[#5B21B6]">Bill generated / Awaiting pay</span>
        </div>
      </div>

      {/* Section Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedSection('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            selectedSection === 'all'
              ? 'bg-[#F07818] text-white shadow-xs'
              : 'bg-white text-[#4B5563] border border-[#E8EAF0] hover:border-[#D1D5DB]'
          }`}
        >
          All Sections ({tables.length})
        </button>
        {sections.map((sec) => {
          const count = tables.filter((t) => (t.section || 'Main Hall') === sec).length;
          return (
            <button
              key={sec}
              onClick={() => setSelectedSection(sec)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedSection === sec
                  ? 'bg-[#F07818] text-white shadow-xs'
                  : 'bg-white text-[#4B5563] border border-[#E8EAF0] hover:border-[#D1D5DB]'
              }`}
            >
              {sec} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Table Layout */}
      {isLoading ? (
        <LoadingState message="Loading tables..." />
      ) : tables.length === 0 ? (
        <EmptyState
          title="No dining tables found"
          description="Create your first dining table to accept Dine-in orders on POS."
          actionLabel="Add Table"
          onAction={() => setIsAddTableOpen(true)}
        />
      ) : (
        <div className="space-y-6">
          {(selectedSection === 'all' ? sections : [selectedSection]).map((secName) => {
            const secTables = tables.filter((t) => (t.section || 'Main Hall') === secName);
            if (secTables.length === 0) return null;

            return (
              <div key={secName} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#E8EAF0] pb-2">
                  <Armchair className="h-4 w-4 text-[#F07818]" />
                  <h3 className="text-sm font-bold text-[#202124]">{secName}</h3>
                  <span className="text-xs text-[#6B7280]">({secTables.length} tables)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                  {secTables.map((table) => {
                    const isOccupied = table.status === 'occupied';
                    const isBillPending = table.status === 'bill_generated';
                    const isAvailable = table.status === 'available' && table.is_active;
                    const isDisabled = !table.is_active;

                    // Elapsed duration
                    const elapsed = formatElapsed(table.current_order_created_at);

                    // Dynamic styling based on status
                    let borderClass = 'border-[#E8EAF0] bg-white hover:border-[#059669] hover:shadow-md';
                    let badgeVariant: any = 'success';
                    let badgeLabel = 'FREE';

                    if (isDisabled) {
                      borderClass = 'border-[#E5E7EB] bg-[#F9FAFB] opacity-60';
                      badgeVariant = 'secondary';
                      badgeLabel = 'DISABLED';
                    } else if (isBillPending) {
                      borderClass = 'border-[#7C3AED] bg-[#FAF5FF] shadow-sm';
                      badgeVariant = 'secondary';
                      badgeLabel = 'BILL PENDING';
                    } else if (isOccupied) {
                      borderClass = 'border-[#F07818] bg-[#FFF8F2] shadow-sm';
                      badgeVariant = 'bhagwa';
                      badgeLabel = 'OCCUPIED';
                    }

                    return (
                      <div
                        key={table.id}
                        onClick={() => handleOpenTableInPOS(table)}
                        className={`group relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer ${borderClass}`}
                      >
                        {/* Top info: Table Number + Capacity + Badge */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg font-black text-[#202124]">
                                {table.table_number}
                              </span>
                              {isDisabled && (
                                <span className="text-[10px] text-red-500 font-bold">(Off)</span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#6B7280] flex items-center gap-1 mt-0.5">
                              <Users className="h-3 w-3" />
                              <span>{table.capacity} Seats</span>
                            </p>
                          </div>

                          <Badge size="sm" variant={badgeVariant}>
                            {badgeLabel}
                          </Badge>
                        </div>

                        {/* Active Order Details (if occupied or bill pending) */}
                        {(isOccupied || isBillPending) && (
                          <div className="mt-3 p-2.5 rounded-lg bg-white/80 border border-[#E8EAF0] space-y-1 text-xs">
                            <div className="flex justify-between items-center text-[11px] text-[#6B7280]">
                              <span className="font-bold text-[#F07818]">
                                {table.current_order_code || 'ORD-—'}
                              </span>
                              {elapsed && (
                                <span className="flex items-center gap-1 text-[10px] text-[#6B7280]">
                                  <Clock className="h-2.5 w-2.5" />
                                  {elapsed}
                                </span>
                              )}
                            </div>
                            <div className="flex justify-between items-baseline pt-0.5">
                              <span className="text-[11px] text-[#6B7280]">Bill Total:</span>
                              <span className="font-extrabold text-[#202124]">
                                {formatINR(table.current_order_total_paise || 0)}
                              </span>
                            </div>
                            {(table.current_order_due_paise || 0) > 0 && (
                              <div className="flex justify-between items-baseline text-[11px]">
                                <span className="text-[#DC2626] font-medium">Due:</span>
                                <span className="font-bold text-[#DC2626]">
                                  {formatINR(table.current_order_due_paise || 0)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Quick Action Footer */}
                        <div className="mt-3 pt-2.5 border-t border-[#E8EAF0] flex items-center justify-between text-xs">
                          {isAvailable && (
                            <span className="text-xs font-bold text-[#059669]">
                              + Seat / Open POS
                            </span>
                          )}
                          {isOccupied && (
                            <span className="text-xs font-bold text-[#C85A0A]">
                              Resume Order in POS →
                            </span>
                          )}
                          {isBillPending && (
                            <span className="text-xs font-bold text-[#7C3AED]">
                              Awaiting Settlement →
                            </span>
                          )}
                          {isDisabled && (
                            <span className="text-[11px] font-semibold text-[#9CA3AF]">
                              Table Disabled
                            </span>
                          )}

                          {/* Action Toolbar on Hover */}
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {/* Bill / Settle buttons if active */}
                            {(isOccupied || isBillPending) && (
                              <>
                                <button
                                  type="button"
                                  title="Transfer Table"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTransferSourceTable(table);
                                    setTransferTargetTableId('');
                                  }}
                                  className="p-1 text-[#6B7280] hover:text-[#202124] hover:bg-black/5 rounded cursor-pointer"
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Generate Bill"
                                  onClick={(e) => handleGenerateBillFromTable(table, e)}
                                  className="p-1 text-[#6B7280] hover:text-[#7C3AED] hover:bg-black/5 rounded cursor-pointer"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Settle Order"
                                  onClick={(e) => handleSettleFromTable(table, e)}
                                  className="p-1 text-[#059669] hover:bg-green-100 rounded cursor-pointer"
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}

                            {/* CRUD & Status */}
                            <button
                              type="button"
                              title="Edit Table"
                              onClick={(e) => handleEditClick(table, e)}
                              className="p-1 text-[#6B7280] hover:text-[#202124] hover:bg-black/5 rounded cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title={table.is_active ? 'Disable Table' : 'Enable Table'}
                              onClick={(e) => handleToggleActive(table, e)}
                              className={`p-1 rounded cursor-pointer ${
                                table.is_active ? 'text-[#6B7280] hover:text-red-500' : 'text-green-600 hover:bg-green-50'
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                            {!isOccupied && !isBillPending && (
                              <button
                                type="button"
                                title="Delete Table"
                                onClick={(e) => handleDeleteTable(table, e)}
                                className="p-1 text-[#DC2626] hover:bg-red-50 rounded cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Table Modal */}
      <Modal
        isOpen={isAddTableOpen || !!editingTable}
        onClose={() => {
          setIsAddTableOpen(false);
          setEditingTable(null);
        }}
        title={editingTable ? `Edit Table ${editingTable.table_number}` : 'Add New Restaurant Table'}
        description="Configure table designation, seating capacity, and floor section"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveTable} className="space-y-4">
          <Input
            label="Table Number / Code *"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="e.g. T1, T2, Garden-1"
            required
          />
          <Input
            label="Seating Capacity *"
            type="number"
            min={1}
            max={50}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="4"
            required
          />
          <Input
            label="Section / Floor *"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="e.g. Main Hall, Ground Floor, Terrace"
            required
          />
          <Input
            label="Display Order (Optional)"
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            placeholder="0"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
            <Button
              type="button"
              onClick={() => {
                setIsAddTableOpen(false);
                setEditingTable(null);
              }}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="font-bold">
              {editingTable ? 'Save Changes' : 'Create Table'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Table Transfer Modal */}
      {transferSourceTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-[#F07818]">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#202124]">
                  Transfer Table {transferSourceTable.table_number}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Move active order ({transferSourceTable.current_order_code}) to an available table
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1">
                  Select Destination Table *
                </label>
                {availableTargetTables.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    No available tables found on the floor. Please free up or add a table first.
                  </div>
                ) : (
                  <select
                    value={transferTargetTableId}
                    onChange={(e) => setTransferTargetTableId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-[#E8EAF0] bg-white focus:border-[#F07818] focus:outline-none font-medium"
                  >
                    <option value="">-- Choose an available table --</option>
                    {availableTargetTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Table {t.table_number} ({t.section} • {t.capacity} seats)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setTransferSourceTable(null);
                  setTransferTargetTableId('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!transferTargetTableId || isTransferring}
                isLoading={isTransferring}
                onClick={handleExecuteTransfer}
                className="font-bold"
              >
                Confirm Transfer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
