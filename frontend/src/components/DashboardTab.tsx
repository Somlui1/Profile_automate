/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DirectoryUser, SystemConfig } from '../types';
import { ShieldCheck, Search, RefreshCw, Trash2, Database, Users, CheckCircle, Info, FileSpreadsheet } from 'lucide-react';

interface DashboardTabProps {
  users: DirectoryUser[];
  onForceSync: (uid: string) => void;
  onDelete: (uid: string) => void;
  logs: string[];
  clearLogs: () => void;
  config: SystemConfig;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  users,
  onForceSync,
  onDelete,
  logs,
  clearLogs,
  config
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Local filtering
  const filteredUsers = users.filter((user) => {
    const term = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(term) ||
      user.uid.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.dept.toLowerCase().includes(term) ||
      user.title.toLowerCase().includes(term)
    );
  });

  const isMock = config.mockMode === 'mock';

  return (
    <div className="space-y-6">
      {/* Statistics Cards Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-outline-variant p-6 rounded-lg relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
          <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Active Directory Users</p>
          <h3 className="text-3xl font-black text-primary mt-1 font-headline-md">{users.length}</h3>
          <span className="text-[11px] text-secondary font-bold flex items-center gap-1 mt-1">
            <CheckCircle className="h-3 w-3 inline shrink-0" /> Fully Synced LDAP Base
          </span>
        </div>

        <div className="bg-white border border-outline-variant p-6 rounded-lg relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-secondary" />
          <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Papercut Synced Status</p>
          <h3 className="text-3xl font-black text-secondary mt-1 font-headline-md">100%</h3>
          <span className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-1">
            Printers auto-mapped on logon
          </span>
        </div>

        <div className="bg-white border border-outline-variant p-6 rounded-lg relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-tertiary" />
          <p className="text-[10px] font-bold text-outline uppercase tracking-wider">LDAP Domain Status</p>
          <h3 className="text-[14px] font-black text-tertiary mt-2.5 flex items-center gap-1.5 leading-none">
            <span className={`h-2.5 w-2.5 rounded-full inline-block ${isMock ? 'bg-secondary animate-pulse' : 'bg-rose-500'}`} />
            {isMock ? 'ONLINE (MOCK)' : 'OFFLINE - RETRYING'}
          </h3>
          <span className="text-[11px] text-outline font-mono truncate block mt-1" title={config.ldapBase}>
            {config.ldapBase}
          </span>
        </div>

        <div className="bg-white border border-outline-variant p-6 rounded-lg relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-error" />
          <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Pending PDF Requests</p>
          <h3 className="text-3xl font-black text-error mt-1 font-headline-md">2</h3>
          <span className="text-[11px] text-on-surface-variant mt-1 block">Awaiting import verification</span>
        </div>
      </div>

      {/* Directory Synchronization Table Card */}
      <div className="bg-white border border-outline-variant rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 border-b border-outline-variant bg-surface-container-low flex flex-wrap justify-between items-center gap-4">
          <div>
            <h3 className="font-bold text-primary text-base flex items-center gap-1.5">
              <Database className="h-5 w-5 text-primary" /> Active Directory &amp; Papercut Synchronization Table
            </h3>
            <p className="text-xs text-on-surface-variant font-body">
              รายชื่อผู้ใช้งานจริงทั้งหมดที่ถูกสแกนจากระบบ Active Directory LDAP และซิงค์ Papercut แล้ว
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-outline font-semibold shrink-0">ค้นหาผู้ใช้:</span>
            <div className="relative w-full sm:w-60">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pl-8 border border-outline-variant text-xs rounded focus:ring-1 focus:ring-primary outline-none"
                placeholder="กรองด้วยชื่อ, อีเมล, แผนก..."
              />
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-tertiary text-on-tertiary text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4 font-bold text-white">AD Account Name</th>
                <th className="p-4 font-bold text-white">Email Address</th>
                <th className="p-4 font-bold text-white">Department / Job Title</th>
                <th className="p-4 font-bold text-white">Print Code</th>
                <th className="p-4 font-bold text-white">LDAP OU Path</th>
                <th className="p-4 font-bold text-white text-right">Directory Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body text-sm bg-white">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-surface-container transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-primary">{user.name}</div>
                      <div className="text-[10px] text-outline font-mono">sAMAccountName: {user.uid}</div>
                    </td>
                    <td className="p-4 text-xs font-mono text-on-surface">{user.email}</td>
                    <td className="p-4 text-xs text-on-surface">
                      <div className="font-semibold">{user.dept}</div>
                      <div className="text-[11px] text-outline">{user.title}</div>
                    </td>
                    <td className="p-4 text-xs font-mono font-bold tracking-widest text-primary">
                      {user.printCode || 'N/A'}
                    </td>
                    <td
                      className="p-4 text-[10px] font-mono text-outline truncate max-w-[200px]"
                      title={user.ou}
                    >
                      {user.ou}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => onForceSync(user.uid)}
                        className="text-xs bg-surface-container-high hover:bg-primary hover:text-white transition-all text-primary font-bold px-3 py-1 mr-2 rounded cursor-pointer duration-100 flex-inline items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3 inline shrink-0 -mt-0.5" /> FORCE SYNC
                      </button>
                      <button
                        onClick={() => onDelete(user.uid)}
                        className="text-xs text-error hover:underline font-bold cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3 inline shrink-0 -mt-0.5" /> DELETE
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-xs text-outline italic">
                     ไม่พบรายชื่อผู้ใช้ที่ระบุตามเกณฑ์การค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Sequence Logs Terminal Console */}
      <div className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-6 font-mono text-xs shadow-xl relative overflow-hidden mt-8">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block animate-pulse" />
            <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            <span className="ml-2 font-bold text-slate-400">Enterprise REST API Transaction Log Console</span>
          </div>
          <button
            onClick={clearLogs}
            className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] font-bold uppercase transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5 inline shrink-0" /> ล้างประวัติ (Clear Logs)
          </button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 min-h-[120px] flex flex-col">
          {logs.map((log, index) => {
            let colorClass = 'text-slate-300';
            if (log.includes('[SUCCESS]')) colorClass = 'text-green-400';
            if (log.includes('[ERROR]')) colorClass = 'text-rose-400';
            if (log.includes('[WARN]')) colorClass = 'text-amber-300';

            return (
              <div key={index} className={`${colorClass} font-mono leading-relaxed`}>
                {log}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
