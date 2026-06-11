/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Menu, ChevronRight } from 'lucide-react';

interface TopBarProps {
  currentTab: string;
  setOpen: (open: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ currentTab, setOpen }) => {
  // Breadcrumb configurations
  let section = "Provisioning Suite";
  let page = "Directory Dashboard";
  let title = "Directory & Sync Dashboard";

  if (currentTab === 'pdf-provision') {
    page = "PDF Auto-Provision";
    title = "PDF Dynamic Provisioning Step Flow";
  } else if (currentTab === 'job-queue') {
    page = "Job Queue";
    title = "Job Queue Management";
  } else if (currentTab === 'm365') {
    page = "M365 Licenses";
    title = "Microsoft 365 License Inventory";
  } else if (currentTab === 'settings') {
    page = "API Settings";
    title = "System Configurations";
  }

  return (
    <header className="flex justify-between items-center w-full px-6 lg:px-8 h-20 bg-surface border-b border-outline-variant z-30 shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger Menu on Mobile */}
        <button
          onClick={() => setOpen(true)}
          className="lg:hidden p-2 text-primary focus:outline-none flex items-center justify-center cursor-pointer rounded hover:bg-slate-100"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-on-surface-variant text-[10px] uppercase tracking-widest font-black">
            <span>{section}</span>
            <ChevronRight className="h-3 w-3 text-outline shrink-0" />
            <span className="text-primary">{page}</span>
          </div>
          <h1 className="font-headline-md text-xl lg:text-2xl font-black text-primary leading-none mt-1">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
            </span>
            <span className="font-medium">Backend REST API Connect</span>
          </div>
        </div>

        <div className="flex items-center gap-3 border-l border-outline-variant pl-4 lg:pl-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-on-surface">Admin User</p>
            <p className="text-[9px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Global Admin
            </p>
          </div>
          <img
            alt="Admin Profile"
            className="w-10 h-10 object-cover rounded-full border border-primary bg-primary-container"
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
            onError={(e) => {
              e.currentTarget.src = "https://api.dicebear.com/7.x/initials/svg?seed=AU";
            }}
          />
        </div>
      </div>
    </header>
  );
};
