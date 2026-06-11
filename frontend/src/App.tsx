/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ToastContainer } from './components/Toast';
import { DashboardTab } from './components/DashboardTab';
import { PDFProvisionTab } from './components/PDFProvisionTab';
import { JobQueueTab } from './components/JobQueueTab';
import { M365Tab } from './components/M365Tab';
import { SettingsTab } from './components/SettingsTab';
import { ADExplorerTab } from './components/ADExplorerTab';
import { DirectoryUser, Job, ToastMessage, SystemConfig, M365Sku } from './types';

export default function App() {
  const [currentTab, setTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [licenses, setLicenses] = useState<M365Sku[]>([]);
  const [loadingLicenses, setLoadingLicenses] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Enterprise logs console
  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [SYSTEM] [SUCCESS] AAPICO REST API Gateway initialized & Ready in Sandbox Environment`
  ]);

  // System Environment Settings
  const [config, setConfig] = useState<SystemConfig>({
    ldapServer: "ldap://192.168.10.2",
    ldapUser: "CN=Admin,CN=Users,DC=aapico,DC=com",
    ldapBase: "DC=aapico,DC=com",
    papercutUrl: "http://192.168.20.5:9191/api",
    papercutToken: "••••••••••••••••",
    mockMode: "mock"
  });

  // Load initial datasets from our running Express server API endpoints
  useEffect(() => {
    fetchDirectoryUsers();
    fetchJobs();
    fetchLicenses();
  }, []);

  // Poll for background Job Queue updates in real-time
  useEffect(() => {
    fetchJobs(); // initial immediately
    const timer = setInterval(() => {
      fetchJobs();
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const fetchDirectoryUsers = async () => {
    try {
      // For initial loading, we pull exact users list
      // If server is not fully up or running we can fall back to client mock seed arrays
      const res = await fetch('/api/v1/user/ad/check-user?query=anek&exact=false');
      if (res.ok) {
        // If the checking is up, let's load initial Users list
        const list = [
          {
            uid: "anek.ph",
            name: "Anek Phromsiri",
            email: "anek.p@aapico.com",
            title: "Director of Engineering",
            dept: "Engineering",
            printCode: "112233",
            ou: "OU=Engineering,OU=Users,DC=aapico,DC=com",
            papercut: "Synced (Auto)",
            status: "Active"
          },
          {
            uid: "somsak.so",
            name: "Somsak Sombat",
            email: "somsak.s@aapico.com",
            title: "IT Operations Manager",
            dept: "Information Technology",
            printCode: "445566",
            ou: "OU=Users,DC=aapico,DC=com",
            papercut: "Synced (Auto)",
            status: "Active"
          },
          {
            uid: "vipha.ji",
            name: "Vipha Jinda",
            email: "vipha.j@aapico.com",
            title: "VP of HR & Admin",
            dept: "Human Resources",
            printCode: "998811",
            ou: "OU=Users,DC=aapico,DC=com",
            papercut: "Synced (Auto)",
            status: "Active"
          }
        ];
        setDirectoryUsers(list);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/v1/jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLicenses = async () => {
    setLoadingLicenses(true);
    try {
      const response = await fetch('/api/v1/m365/licenses');
      if (response.ok) {
        const data = await response.json();
        setLicenses(data.licenses || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLicenses(false);
    }
  };

  // Toast dispatch helper
  const addToast = (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
    const id = Date.now().toString();
    const newToast: ToastMessage = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    // auto dismiss toast
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Append transaction console logs
  const addLog = (category: string, message: string, level = "INFO") => {
    const formatted = `[${new Date().toLocaleTimeString()}] [${category}] [${level}] ${message}`;
    setLogs((prev) => [...prev, formatted]);
  };

  const clearLogsCommand = () => {
    setLogs([`[${new Date().toLocaleTimeString()}] [SYSTEM] [INFO] Database logs cleared. Standing by...`]);
    addToast("ล้างประวัติ Log Console สำเร็จ", "info");
  };

  // --- ACTIONS FLOW DISPATCHERS ---

  // Force synchronizations
  const handleForceSync = (uid: string) => {
    const targetUser = directoryUsers.find((u) => u.uid === uid);
    if (!targetUser) return;

    addToast(`กำลังส่งสัญญาณอัปเดตระบบการพิมพ์สำหรับ: ${targetUser.name}`, 'info');
    addLog("PAPERCUT", `สั่งซิงค์รหัส Papercut ย้อนหลังแบบบังคับ (Force) สำหรับผู้ใช้: ${uid}`, "INFO");

    setTimeout(() => {
      addToast("ซิงค์ระบบเครื่องพิมพ์เสร็จสิ้น", 'success');
      addLog("PAPERCUT", `เครื่องพิมพ์รับทราบข้อมูลรหัสควบคุม: ${targetUser.printCode} บัญชีปลอดภัย`, "SUCCESS");
    }, 1000);
  };

  // User Deletions attributes
  const handleADDelete = (uid: string) => {
    const targetUser = directoryUsers.find((u) => u.uid === uid);
    if (!targetUser) return;

    setDirectoryUsers((prev) => prev.filter((u) => u.uid !== uid));
    addToast(`ลบข้อมูลและรหัสพิมพ์ของ ${targetUser.name} ออกจากระบบแล้ว`, 'warning');
    addLog("LDAP", `ดำเนินการลบบัญชีออกจากการควบคุม AD: ${uid}`, "WARN");
    addLog("PAPERCUT", "ยกเลิกการเข้าถึง Papercut และยกเลิกสิทธิ์การเชื่อมต่อรหัสพิมพ์พนักงาน", "WARN");
  };

  // Manual AD Account Creation submit handler
  const handleAddUser = (user: DirectoryUser) => {
    // Avoid double inserts
    setDirectoryUsers((prev) => {
      const exists = prev.some((u) => u.uid === user.uid);
      if (exists) return prev;
      return [...prev, user];
    });
  };

  // Control Background queue items
  const handleControlJob = async (jobId: string, action: 'cancel' | 'pause' | 'resume') => {
    try {
      const response = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (response.ok) {
        addToast(`ส่งคำสั่ง ${action.toUpperCase()} ไปยัง Job: ${jobId.slice(0, 8)}`, 'info');
        addLog("QUEUE", `ส่ง Action [${action.toUpperCase()}] สั่งแก้ไขสถานะ Queue Job ID ${jobId}`, "INFO");
        fetchJobs(); // reload lists immediately
      } else {
        throw new Error();
      }
    } catch (e) {
      addToast("การทำรายการบนคิวล้มเหลว", "error");
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex overflow-hidden w-full font-sans">
      
      {/* Toast popup Alert stacks */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Primary Sidebar navigator */}
      <Sidebar 
        currentTab={currentTab} 
        setTab={setTab} 
        isOpen={sidebarOpen} 
        setOpen={setSidebarOpen} 
        config={config}
      />

      {/* Main viewport area */}
      <main className="w-full lg:pl-64 flex flex-col h-screen relative bg-background overflow-hidden min-w-0">
        
        {/* Top bar header */}
        <TopBar currentTab={currentTab} setOpen={setSidebarOpen} />

        {/* Child canvas layout */}
        <div className="flex-grow overflow-y-auto custom-scrollbar px-6 py-8 lg:px-8 pb-32">
          <div className="max-w-[1200px] mx-auto">
            {currentTab === 'dashboard' && (
              <DashboardTab
                users={directoryUsers}
                onForceSync={handleForceSync}
                onDelete={handleADDelete}
                logs={logs}
                clearLogs={clearLogsCommand}
                config={config}
              />
            )}

            {currentTab === 'pdf-provision' && (
              <PDFProvisionTab
                onAddUser={handleAddUser}
                addToast={addToast}
                addLog={addLog}
                config={config}
                onJobCreated={fetchJobs}
              />
            )}

            {currentTab === 'job-queue' && (
              <JobQueueTab
                jobs={jobs}
                onControlJob={handleControlJob}
                addToast={addToast}
              />
            )}

            {currentTab === 'm365' && (
              <M365Tab
                licenses={licenses}
                onRefresh={fetchLicenses}
                loading={loadingLicenses}
              />
            )}

            {currentTab === 'settings' && (
              <SettingsTab
                config={config}
                onSaveConfig={setConfig}
                addToast={addToast}
                addLog={addLog}
              />
            )}

            {currentTab === 'ad-explorer' && (
              <ADExplorerTab
                users={directoryUsers}
                config={config}
              />
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
