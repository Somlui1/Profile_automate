/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SystemConfig } from '../types';
import { Settings, Shield, Key, Sliders, Database, Printer, Loader2 } from 'lucide-react';

interface SettingsTabProps {
  config: SystemConfig;
  onSaveConfig: (updated: SystemConfig) => void;
  addToast: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  addLog: (category: string, message: string, level?: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  config,
  onSaveConfig,
  addToast,
  addLog
}) => {
  const [ldapServer, setLdapServer] = useState(config.ldapServer);
  const [ldapUser, setLdapUser] = useState(config.ldapUser);
  const [ldapBase, setLdapBase] = useState(config.ldapBase);
  const [papercutUrl, setPapercutUrl] = useState(config.papercutUrl);
  const [papercutToken, setPapercutToken] = useState(config.papercutToken);
  const [mockMode, setMockMode] = useState<'mock' | 'live'>(config.mockMode);
  
  const [saving, setSaving] = useState(false);
  const [switchingLive, setSwitchingLive] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    addLog("SYSTEM", "อัปเดตโมดูลปลายทางของเซิร์ฟเวอร์ควบคุมหลักเสร็จสมบูรณ์", "INFO");

    setTimeout(() => {
      onSaveConfig({
        ldapServer,
        ldapUser,
        ldapBase,
        papercutUrl,
        papercutToken,
        mockMode
      });
      setSaving(false);
      addToast("บันทึกการตั้งค่าระบบและสภาพแวดล้อมเสร็จสิ้น", "success");
    }, 600);
  };

  const handleModeChange = (val: 'mock' | 'live') => {
    if (val === 'live') {
      setSwitchingLive(true);
      addToast("กำลังทดสอบเชื่อมโยงเครือข่ายความปลอดภัย AD LDAPs...", "info");

      setTimeout(() => {
        setSwitchingLive(false);
        setMockMode('mock'); // Revert back to mock automatically
        addToast("ไม่พบเซิร์ฟเวอร์ควบคุมหลักที่ระบุ (Connection Refused)! สลับกลับมายังโหมดจำลอง Mock Sandbox เพื่อความปลอดภัย", "error");
        addLog("SYSTEM", "การเชื่อมต่อ Live Directory ล้มเหลว (IP timeout) สลับกลับเซ็ตติ้ง mock", "ERROR");
      }, 1500);
    } else {
      setMockMode('mock');
      addToast("คืนค่าระเบียบการทดสอบไปยังระบบจำลองข้อมูล (Mock Sandbox Mode)", "info");
    }
  };

  return (
    <div className="bg-white border border-outline-variant p-6 lg:p-10 rounded-lg relative shadow-sm max-w-4xl mx-auto selection:bg-slate-200">
      <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
      
      <h3 className="text-subhead-sm font-bold text-primary mb-6 flex items-center gap-1.5 border-b pb-3 border-outline-variant shrink-0 select-none">
        <Sliders className="h-5 w-5 text-primary shrink-0" /> Integration Environment Configuration
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-12 gap-y-6 gap-x-4">
          
          <div className="col-span-12 md:col-span-6 space-y-2">
            <label className="font-bold text-xs uppercase text-slate-500 flex items-center gap-1">
              <Database className="h-3.5 w-3.5" /> Active Directory LDAP Server Host
            </label>
            <input 
              type="text" 
              required
              value={ldapServer}
              onChange={(e) => setLdapServer(e.target.value)}
              className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm font-semibold outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="col-span-12 md:col-span-6 space-y-2">
            <label className="font-bold text-xs uppercase text-slate-500 flex items-center gap-1">
              <Key className="h-3.5 w-3.5" /> LDAP Username Admin Account (Bind-DN)
            </label>
            <input 
              type="text" 
              required
              value={ldapUser}
              onChange={(e) => setLdapUser(e.target.value)}
              className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm font-mono truncate focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          <div className="col-span-12 md:col-span-6 space-y-2">
            <label className="font-bold text-xs uppercase text-slate-500 flex items-center gap-1">
              <Database className="h-3.5 w-3.5" /> Active Directory LDAP Search Base DN
            </label>
            <input 
              type="text" 
              required
              value={ldapBase}
              onChange={(e) => setLdapBase(e.target.value)}
              className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          <div className="col-span-12 md:col-span-6 space-y-2">
            <label className="font-bold text-xs uppercase text-slate-500 flex items-center gap-1">
              <Printer className="h-3.5 w-3.5" /> Papercut Printer Server XML-RPC Endpoint
            </label>
            <input 
              type="text" 
              required
              value={papercutUrl}
              onChange={(e) => setPapercutUrl(e.target.value)}
              className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          <div className="col-span-12 md:col-span-6 space-y-2">
            <label className="font-bold text-xs uppercase text-slate-500 flex items-center gap-1">
              <Key className="h-3.5 w-3.5" /> Papercut API Auth Secret Token
            </label>
            <input 
              type="password" 
              required
              value={papercutToken}
              onChange={(e) => setPapercutToken(e.target.value)}
              className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          <div className="col-span-12 md:col-span-6 space-y-2 select-none">
            <label className="font-bold text-xs uppercase text-slate-500 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 font-bold" /> Integration Live/Mock Toggle
            </label>
            <div className="relative">
              <select 
                value={mockMode}
                disabled={switchingLive}
                onChange={(e) => handleModeChange(e.target.value as any)}
                className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm font-semibold outline-none focus:ring-1 focus:ring-primary focus:border-primary select-none h-11"
              >
                <option value="mock">Fallback Mock Sandbox System (Local Enterprise Simulation)</option>
                <option value="live">Live Enterprise AD/Papercut Environment (Direct REST Sockets)</option>
              </select>
              {switchingLive && (
                <div className="absolute right-9 top-1/2 -translate-y-1/2 flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin text-primary mr-1" />
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 pt-6 border-t border-outline-variant flex justify-end shrink-0 select-none">
            <button 
              type="submit" 
              disabled={saving}
              className="px-8 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded shadow hover:bg-primary-container h-12 flex items-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Save System Configuration</span>
            </button>
          </div>

        </div>
      </form>
    </div>
  );
};
