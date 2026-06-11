/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { M365Sku } from '../types';
import { KeyRound, ShieldAlert, BadgeAlert, CheckCircle, Search, RefreshCw, Layers } from 'lucide-react';

interface M365TabProps {
  licenses: M365Sku[];
  onRefresh: () => void;
  loading: boolean;
}

export const M365Tab: React.FC<M365TabProps> = ({
  licenses,
  onRefresh,
  loading
}) => {
  const [search, setSearch] = useState('');

  const filtered = licenses.filter((lic) => {
    return lic.skuPartNumber.toLowerCase().includes(search.toLowerCase());
  });

  const availableCount = licenses.filter((l) => l.availableUnits > 0).length;
  const outOfStockCount = licenses.filter((l) => l.availableUnits <= 0).length;

  return (
    <div className="space-y-6">
      
      {/* License Stocks Bento summaries grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0 select-none">
        <div className="bg-white border border-outline-variant p-6 rounded-lg relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
          <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Product types</p>
          <h3 className="text-3xl font-black text-primary mt-1 font-headline-md">{licenses.length}</h3>
          <span className="text-[11px] text-primary-container font-semibold mt-1 inline-block">Microsoft 365 Subscriptions</span>
        </div>

        <div className="bg-white border border-outline-variant p-6 rounded-lg relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-secondary" />
          <p className="text-[10px] font-bold text-outline uppercase tracking-wider">In Stock (Available)</p>
          <h3 className="text-3xl font-black text-secondary mt-1 font-headline-md">{availableCount}</h3>
          <span className="text-[11px] text-secondary font-bold flex items-center gap-1 mt-1 inline-block">
             Licenses ready to assign
          </span>
        </div>

        <div className="bg-white border border-outline-variant p-6 rounded-lg relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-error" />
          <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Out of Stock</p>
          <h3 className="text-3xl font-black text-error mt-1 font-headline-md">{outOfStockCount}</h3>
          <span className="text-[11px] text-error font-bold flex items-center gap-1 mt-1 inline-block">
             Procurements required soon
          </span>
        </div>
      </div>

      {/* Main License listings table */}
      <div className="bg-white border border-outline-variant rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 border-b border-outline-variant bg-surface-container-low flex flex-wrap justify-between items-center gap-4 select-none shrink-0">
          <div>
            <h3 className="font-bold text-primary text-base flex items-center gap-1.5">
              <Layers className="h-5 w-5 text-primary shrink-0" /> Microsoft 365 License Inventory Catalog
            </h3>
            <p className="text-xs text-on-surface-variant font-body">
              ข้อมูลผลิตภัณฑ์ลิขสิทธิ์ความปลอดภัยที่ดึงผ่าน Microsoft Graph API (https://graph.microsoft.com/v1.0/subscribedSkus)
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary-container text-white font-black uppercase tracking-widest px-4 py-2 rounded.5 transition-all select-none duration-100 cursor-pointer h-9 shrink-0"
            >
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span>Sync Graph</span>
            </button>
            <div className="relative w-full sm:w-48">
              <input 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหา SKU..."
                className="w-full text-xs p-2.5 pl-8 border border-outline-variant rounded outline-none h-9 focus:ring-1 focus:ring-primary focus:border-primary bg-white"
              />
              <Search className="h-4 w-4 text-outline absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-tertiary text-on-tertiary text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4 font-bold text-white">License Product Name (SkuPartNumber)</th>
                <th className="p-4 font-bold text-white text-center">Purchased (Prepaid)</th>
                <th className="p-4 font-bold text-white text-center">Assigned (Consumed)</th>
                <th className="p-4 font-bold text-white text-center">Available Units</th>
                <th className="p-4 font-bold text-white text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body text-sm bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-slate-400 italic">
                    <LoaderCw className="h-5 w-5 animate-spin text-primary inline-block mr-1.5" /> Loading live subscriptions data from tenant Microsoft AD Cloud directory...
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((sku) => {
                  const isAvailable = sku.availableUnits > 0;
                  return (
                    <tr key={sku.skuPartNumber} className="hover:bg-surface-container transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-primary">{sku.skuPartNumber}</div>
                        <div className="text-[10px] text-outline font-mono">skuId: {sku.skuId}</div>
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-slate-700">{sku.prepaidUnits}</td>
                      <td className="p-4 text-center font-mono font-medium text-slate-700">{sku.consumedUnits}</td>
                      <td className={`p-4 text-center font-mono font-bold text-sm ${isAvailable ? 'text-secondary' : 'text-error'}`}>
                        {sku.availableUnits}
                      </td>
                      <td className="p-4 text-right">
                        {isAvailable ? (
                          <span className="px-2.5 py-1 bg-secondary/15 text-secondary text-xs rounded-full font-black uppercase tracking-wider border border-secondary/15">
                            Available
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-error/15 text-error text-xs rounded-full font-black uppercase tracking-wider border border-error/15">
                            Out of Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-slate-400 italic">
                    ไม่พบรายการผลิตภัณฑ์สิทธิ์ตามเกณฑ์ค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

// Simple loader helper inline
const LoaderCw = ({ className }: { className?: string }) => (
  <RefreshCw className={className} />
);
