/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LayoutDashboard, FileText, ListTodo, KeyRound, Settings, Menu, X, Printer, ShieldCheck, Search } from 'lucide-react';
import { SystemConfig } from '../types';

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  config: SystemConfig;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setTab, isOpen, setOpen, config }) => {
  const isMock = config.mockMode === 'mock';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full flex flex-col w-64 bg-primary text-on-primary border-r border-outline-variant z-50 transform lg:translate-x-0 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header brand details */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tighter text-white font-headline-md">AAPICO Suite</span>
            <span className="text-[10px] text-white/50 tracking-widest font-black -mt-1 uppercase">3-Tier System</span>
          </div>
          {/* Close Sidebar button for mobile */}
          <button className="lg:hidden p-1 text-white/80 hover:text-white cursor-pointer" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="p-4 flex flex-col gap-1 flex-grow overflow-y-auto custom-scrollbar">
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-black px-4 mb-2">Main Panels</p>

          <button
            onClick={() => { setTab('dashboard'); setOpen(false); }}
            className={`nav-item flex items-center gap-3 px-4 py-3 font-semibold transition-all duration-150 w-full text-left rounded-lg cursor-pointer ${
              currentTab === 'dashboard'
                ? 'text-white border-l-4 border-white bg-white/15'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />
            <span className="font-body text-sm">Directory Dashboard</span>
          </button>

          <button
            onClick={() => { setTab('pdf-provision'); setOpen(false); }}
            className={`nav-item flex items-center gap-3 px-4 py-3 font-semibold transition-all duration-150 w-full text-left relative rounded-lg cursor-pointer ${
              currentTab === 'pdf-provision'
                ? 'text-white border-l-4 border-white bg-white/15'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <FileText className="h-4.5 w-4.5 shrink-0" />
            <span className="font-body text-sm">PDF Auto-Provision</span>
            <span className="absolute right-4 top-3.5 flex h-2 w-2 rounded-full bg-secondary animate-pulse"></span>
          </button>

          <button
            onClick={() => { setTab('ad-explorer'); setOpen(false); }}
            className={`nav-item flex items-center gap-3 px-4 py-3 font-semibold transition-all duration-150 w-full text-left rounded-lg cursor-pointer ${
              currentTab === 'ad-explorer'
                ? 'text-white border-l-4 border-white bg-white/15'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Search className="h-4.5 w-4.5 shrink-0" />
            <span className="font-body text-sm">AD Explorer</span>
          </button>

          <button
            onClick={() => { setTab('job-queue'); setOpen(false); }}
            className={`nav-item flex items-center gap-3 px-4 py-3 font-semibold transition-all duration-150 w-full text-left rounded-lg cursor-pointer ${
              currentTab === 'job-queue'
                ? 'text-white border-l-4 border-white bg-white/15'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <ListTodo className="h-4.5 w-4.5 shrink-0" />
            <span className="font-body text-sm">Job Queue</span>
          </button>

          <p className="text-[10px] text-white/40 uppercase tracking-widest font-black px-4 mt-6 mb-2">Management</p>

          <button
            onClick={() => { setTab('m365'); setOpen(false); }}
            className={`nav-item flex items-center gap-3 px-4 py-3 font-semibold transition-all duration-150 w-full text-left rounded-lg cursor-pointer ${
              currentTab === 'm365'
                ? 'text-white border-l-4 border-white bg-white/15'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <KeyRound className="h-4.5 w-4.5 shrink-0" />
            <span className="font-body text-sm">M365 Licenses</span>
          </button>

          <button
            onClick={() => { setTab('settings'); setOpen(false); }}
            className={`nav-item flex items-center gap-3 px-4 py-3 font-semibold transition-all duration-150 w-full text-left rounded-lg cursor-pointer ${
              currentTab === 'settings'
                ? 'text-white border-l-4 border-white bg-white/15'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Settings className="h-4.5 w-4.5 shrink-0" />
            <span className="font-body text-sm">System Settings</span>
          </button>
        </div>

        {/* Environment Status Indicators */}
        <div className="px-6 py-4 bg-primary-container border-t border-white/10 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-white/70">
            <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> AD LDAP:</span>
            <span
              className={`px-2 py-0.5 font-bold uppercase rounded text-[9px] ${
                isMock ? 'bg-secondary text-white' : 'bg-rose-600 text-white animate-pulse'
              }`}
            >
              {isMock ? 'MOCK ACTIVE' : 'RETRYING'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/70">
            <span className="flex items-center gap-1"><Printer className="h-3.5 w-3.5" /> Papercut API:</span>
            <span
              className={`px-2 py-0.5 font-bold uppercase rounded text-[9px] ${
                isMock ? 'bg-secondary text-white' : 'bg-rose-600 text-white animate-pulse'
              }`}
            >
              {isMock ? 'MOCK ACTIVE' : 'RETRYING'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
