/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DirectoryUser, ADObject, ADNode } from '../types';
import { ADPropertiesModal } from './ADPropertiesModal';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Search,
  RefreshCw,
  Check,
  Copy,
  Mail,
  Phone,
  Globe,
  FileText,
  Sliders,
  User,
  Users,
  Monitor,
  Layers,
  Briefcase,
  Building,
  MapPin,
  Calendar,
  ShieldAlert,
  Info,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  X,
  PlusCircle,
  FolderPlus,
  Compass,
  Printer
} from 'lucide-react';

interface ADExplorerTabProps {
  users: DirectoryUser[];
  config: React.ComponentState;
}

// Full directory AD Object interface modeling real LDAP / ADUC schemas


// Tree structure model for Left Console Tree Sidebar representation
export const ADExplorerTab: React.FC<ADExplorerTabProps> = ({ users = [], config }) => {
  // State for all domain objects (Dynamic array syncing users list with customized Computers/Groups mock nodes)
  

  // Selection / Navigation navigation state
  const [selectedOUDn, setSelectedOUDn] = useState<string>('DC=aapico,DC=com');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expanded Left Panel Tree state
  const [expandedOUs, setExpandedOUs] = useState<Record<string, boolean>>({
    'DC=aapico,DC=com': true,
    'OU=AH,DC=aapico,DC=com': true
  });

  // Modal Dialog visual States
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [activePropertyObject, setActivePropertyObject] = useState<ADObject | null>(null);

  // Object Creation modal visual States
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    firstName: '',
    lastName: '',
    logonName: '',
    description: '',
    dept: 'IT Infrastructure Quality Control',
    title: 'QA Automation Tester',
    password: 'AducTestPassword2026!',
    employeeId: '99999999',
    ou: 'OU=IT,OU=AH,DC=aapico,DC=com'
  });

  // Action toasts / copy indicators
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const [nodesCache, setNodesCache] = useState<Record<string, ADNode[]>>({});
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({});

  const fetchTreeNodes = async (dn: string) => {
    if (nodesCache[dn]) return; // Already fetched
    setLoadingNodes(prev => ({ ...prev, [dn]: true }));
    try {
      const res = await fetch(`/api/v1/user/ad/tree?parent_dn=${encodeURIComponent(dn)}`);
      if (res.ok) {
        const data = await res.json();
        setNodesCache(prev => ({ ...prev, [dn]: data.nodes || [] }));
      } else {
        console.error("Failed to fetch AD tree nodes for", dn);
        setNodesCache(prev => ({ ...prev, [dn]: [] }));
      }
    } catch (error) {
      console.error("Error fetching AD tree nodes:", error);
      setNodesCache(prev => ({ ...prev, [dn]: [] }));
    } finally {
      setLoadingNodes(prev => ({ ...prev, [dn]: false }));
    }
  };

  // Initial fetch for root
  useEffect(() => {
    fetchTreeNodes('DC=aapico,DC=com');
  }, []);

  // Fetch when expanding a node
  useEffect(() => {
    Object.keys(expandedOUs).forEach(dn => {
      if (expandedOUs[dn]) {
        fetchTreeNodes(dn);
      }
    });
  }, [expandedOUs]);

  // Fetch when selecting a node (to populate the table)
  useEffect(() => {
    fetchTreeNodes(selectedOUDn);
  }, [selectedOUDn]);

  const getCurrentOUObjects = (): ADNode[] => {
    let list = nodesCache[selectedOUDn] || [];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      list = list.filter(obj => 
        obj.name.toLowerCase().includes(query) ||
        obj.type.toLowerCase().includes(query) ||
        (obj.description && obj.description.toLowerCase().includes(query))
      );
    }
    return list;
  };

  const currentObjectsList = getCurrentOUObjects();

  // Left click Tree folder nodes to open
  const handleTreeClick = (dn: string) => {
    setSelectedOUDn(dn);
    setSelectedRowIndex(null);
  };

  const toggleOUExpansion = (e: React.MouseEvent, dn: string) => {
    e.stopPropagation();
    setExpandedOUs(prev => ({
      ...prev,
      [dn]: !prev[dn]
    }));
  };

  // Trigger double click dialog popup
  const handleRowDoubleClick = (obj: ADNode) => {
    if (['ou', 'container', 'domain'].includes(obj.type)) {
      setSelectedOUDn(obj.dn);
      setSelectedRowIndex(null);
      
      // Auto-expand this node and all of its parent chain in the tree
      const parts = obj.dn.split(/(?<!\\),/);
      const newExpanded = { ...expandedOUs };
      newExpanded[obj.dn] = true;
      for (let i = 1; i < parts.length; i++) {
        const parentDn = parts.slice(i).join(',');
        newExpanded[parentDn] = true;
      }
      setExpandedOUs(newExpanded);
    } else if (obj.type === 'user' || obj.type === 'group') {
      setActivePropertyObject({ ...obj } as unknown as ADObject);
      setIsPropertiesOpen(true);
    } else {
      showActionToast("Properties viewer is restricted to User and Group objects only.");
    }
  };

  // Toolbar Actions Trigger
  const handleOpenActiveProperties = () => {
    if (selectedRowIndex !== null && currentObjectsList[selectedRowIndex]) {
      handleRowDoubleClick(currentObjectsList[selectedRowIndex]);
    }
  };

  const handleDeleteActiveObject = () => {
    if (selectedRowIndex !== null && currentObjectsList[selectedRowIndex]) {
      const target = currentObjectsList[selectedRowIndex];
      if (window.confirm(`Are you sure you want to delete Active Directory Object: ${target.name}?`)) {
        // Read-only mode: simulated delete by hiding it locally
        setNodesCache(prev => ({
          ...prev,
          [selectedOUDn]: (prev[selectedOUDn] || []).filter(o => o.dn !== target.dn)
        }));
        setSelectedRowIndex(null);
        showActionToast(`Disabled / Deleted ADUC directory object: ${target.name}`);
      }
    }
  };

  // Simple notifications
  const showActionToast = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 3000);
  };

  // Simulated Save of Edit Attributes inside Properties window
  const handleSaveProperties = () => {
    if (!activePropertyObject) return;
    setIsPropertiesOpen(false);
    showActionToast(`Successfully saved directory settings for: ${activePropertyObject.name}`);
  };

  // Interactive Create User Pipeline Simulator
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { firstName, lastName, logonName, description, dept, title, password, employeeId, ou } = newUserForm;
    if (!logonName) return;

    const namesCombined = `${firstName} ${lastName}`.trim() || logonName;
    const cleanOU = ou || selectedOUDn;

    const attributes: Record<string, string> = {};
    for (let i = 1; i <= 15; i++) {
      attributes[`extensionAttribute${i}`] = i === 1 ? employeeId : '';
    }

    try {
      const response = await fetch('http://localhost:8000/api/v1/user/ad/create-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          logonName,
          description,
          dept,
          title,
          password,
          employeeId,
          ou: cleanOU
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        showActionToast(`Failed to create user: ${errorData.detail || response.statusText}`);
        return;
      }

      const created: ADObject = {
        name: namesCombined,
        type: 'user',
        description: description || `${employeeId} (Sync Queued)`,
        dn: `CN=${namesCombined},${cleanOU}`,
        parentDn: cleanOU,
        givenName: firstName,
        sn: lastName,
        displayName: namesCombined,
        sAMAccountName: logonName,
        userPrincipalName: `${logonName}@aapico.com`,
        userWorkstations: 'All Computers',
        userAccountControl: 512, // Normal Account state
        accountExpires: 'Never',
        pwdLastSet: 'Never (Must Change)',
        mustChangePwd: true,
        pwdNeverExpires: false,
        title,
        department: dept,
        company: 'AH',
        manager: 'Witthaya Treeklee',
        memberOf: ['Domain Users', 'AAPICO Group VPN'],
        employeeID: employeeId,
        employeeType: 'Regular-Staff',
        mailNickname: logonName,
        extensionAttributes: attributes,
        comment: 'Created dynamically inside MMC ADUC Sandbox.'
      };

      fetchTreeNodes(cleanOU);
      setIsCreateUserOpen(false);

      // Reset form
      setNewUserForm({
        firstName: '',
        lastName: '',
        logonName: '',
        description: '',
        dept: 'IT Infrastructure Quality Control',
        title: 'QA Automation Tester',
        password: 'AducTestPassword2026!',
        employeeId: '99999999',
        ou: selectedOUDn
      });

      showActionToast(`Integrated newly queued user user account '${logonName}' into directory structure!`);
    } catch (err) {
      showActionToast(`Error creating user: ${err}`);
    }
  };

  // Recursive tree view rendering for left sidebar (OUs/Containers)
  const renderConsoleTreeNode = (node: ADNode, depth = 0): React.ReactNode => {
    const isExpanded = expandedOUs[node.dn];
    const isSelected = selectedOUDn === node.dn;

    return (
      <div key={node.dn} className="select-none text-xs font-sans">
        <div
          onClick={() => handleTreeClick(node.dn)}
          className={`flex items-center gap-1.5 py-1 px-1.5 rounded-sm cursor-pointer transition-colors ${isSelected
            ? 'bg-[#3b72ab] text-white font-medium shadow-2xs'
            : 'text-slate-800 hover:bg-[#e4eef6]'
            }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          {/* Collapse/Expand state arrows */}
          {node.has_children ? (
            <button
              onClick={(e) => toggleOUExpansion(e, node.dn)}
              type="button"
              className="text-[#555] hover:text-black py-0.5 px-1 rounded cursor-pointer shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className={`h-3 w-3 ${isSelected ? 'text-white' : 'text-slate-600'}`} />
              ) : (
                <ChevronRight className={`h-3 w-3 ${isSelected ? 'text-white' : 'text-slate-600'}`} />
              )}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          {/* Differentiate directory node icons */}
          {node.type === 'domain' ? (
            <Globe className={`h-4 w-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#3b72ab]'}`} />
          ) : node.type === 'ou' ? (
            // Custom golden folder look with inner details (classic OU representation)
            <div className="relative shrink-0 select-none">
              <Folder className={`h-4 w-4 shrink-0 ${isSelected ? 'text-white' : 'text-amber-500 fill-amber-200'}`} />
              <div className={`absolute top-1 right-[2px] w-1.5 h-1.5 rounded-xs border-[1px] ${isSelected ? 'bg-white border-[#3b72ab]' : 'bg-[#3b72ab] border-white'
                }`} />
            </div>
          ) : (
            <Folder className={`h-4 w-4 shrink-0 ${isSelected ? 'text-white' : 'text-amber-500 fill-amber-100'}`} />
          )}

          <span className="truncate leading-none select-none">{node.name}</span>
        </div>

        {/* Child level recursive nodes */}
        {node.has_children && isExpanded && (
          <div className="relative mt-0.5">
            <div
              className="absolute top-0 bottom-2.5 w-px border-l border-dashed border-slate-300 left-[15px]"
              style={{ paddingLeft: `${depth * 14}px` }}
            />
            {loadingNodes[node.dn] ? (
              <div className="text-[10px] text-slate-400 italic py-1" style={{ paddingLeft: `${(depth + 1) * 14 + 6}px` }}>
                Loading...
              </div>
            ) : (
              (nodesCache[node.dn] || [])
                .filter(c => ['domain', 'ou', 'container'].includes(c.type))
                .map(child => renderConsoleTreeNode(child, depth + 1))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-auto min-h-[750px] bg-[#f0f0f0] border border-slate-350 rounded-lg shadow-md flex flex-col font-sans overflow-hidden text-slate-900 text-xs">

      {/* 1. COMPACT ACTIVE DIRECTORY TITLE BAR */}
      <div className="bg-[#0a246a] text-white px-4 py-2 flex justify-between items-center select-none shrink-0 font-medium">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-[#a6c8f0]" />
          <span className="text-xs font-bold tracking-wide select-none font-sans text-slate-100">
            Active Directory Domain Service Console [aapico.com]
          </span>
        </div>
        <div className="bg-[#3b72ab] text-white px-2 py-0.5 rounded-sm font-mono font-bold text-[9px] uppercase select-none tracking-wider">
          Read-Only Mode
        </div>
      </div>

      {/* 3. WINDOWS MMC ADUC COMPACT TOOLBAR */}
      <div className="bg-[#f5f5f5] px-3 py-2 border-b border-[#b0b0b0] flex flex-wrap justify-between items-center gap-3 select-none select-none">

        {/* Navigation, Hierarchy paths, Action Tools */}
        <div className="flex items-center gap-1.5 flex-wrap">

          <button
            onClick={() => handleTreeClick('DC=aapico,DC=com')}
            className="p-1.5 hover:bg-[#d8e6f3] text-slate-700 hover:text-[#3b72ab] rounded border border-transparent hover:border-[#b0cde8] cursor-pointer"
            title="Root Domain Location"
          >
            <Compass className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-slate-300 mx-1" />

          {/* Context Tools linked to selection */}
          <button
            onClick={handleOpenActiveProperties}
            disabled={selectedRowIndex === null || !['user', 'group'].includes(currentObjectsList[selectedRowIndex]?.type)}
            className={`px-2 py-1 border rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${selectedRowIndex !== null && ['user', 'group'].includes(currentObjectsList[selectedRowIndex]?.type)
              ? 'bg-white border-slate-300 hover:border-[#3b72ab] hover:bg-[#e4eef6] text-[#001f56]'
              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50'
              }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Properties (View Only)</span>
          </button>

          <div className="w-px h-5 bg-slate-300 mx-1" />

          <button
            onClick={() => {
              // simulated reload
              setSelectedRowIndex(null);
              showActionToast("Successfully synced and updated local Active Directory tree.");
            }}
            className="p-1 hover:bg-[#d8e6f3] text-slate-600 rounded border border-transparent hover:border-[#b0cde8] cursor-pointer"
            title="Refresh Object Lists"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

        </div>

        {/* Searching bar filter */}
        <div className="relative max-w-xs w-full select-all">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search matching objects in OU..."
            className="w-full text-xs p-1.5 pl-8 border border-slate-300 outline-none rounded-md bg-white focus:ring-1 focus:ring-[#3b72ab] focus:border-[#3b72ab] placeholder:text-slate-400 h-8 font-sans"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 px-1 text-slate-400 hover:text-[#3b72ab] font-bold">×</button>
          )}
        </div>

      </div>

      {/* ACTION ALERTS AND NOTIFICATIONS IN MMC PANEL */}
      {actionSuccessMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-[#0f5132] px-4 py-2 flex items-center gap-2 select-none select-none font-sans font-semibold">
          <Check className="h-4 w-4 bg-emerald-500 text-white rounded-full p-0.5 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* 4. MAIN WORKSPACE / SPLIT PANES (Left navigation tree & right contents view table) */}
      <div className="flex-grow flex flex-col md:flex-row min-h-[500px] h-[550px] items-stretch overflow-hidden">

        {/* LEFT COMPONENT: The Console Scope Tree */}
        <aside className="w-full md:w-[260px] bg-white border-b md:border-b-0 md:border-r border-[#b0b0b0] flex flex-col justify-between overflow-hidden select-none select-none shrink-0">

          <div className="bg-[#e4eef6] px-2.5 py-1.5 border-b border-[#b0b0b0] text-[10px] font-bold uppercase tracking-wider text-[#001f56] select-none font-sans">
            Console Root Directory Tree
          </div>

          <div className="flex-grow overflow-y-auto p-2.5 space-y-1 bg-white">
            {/* Hierarchical folder branches entry point */}
            {renderConsoleTreeNode({
              dn: 'DC=aapico,DC=com',
              name: 'aapico.com',
              type: 'domain',
              has_children: true
            } as ADNode)}
          </div>

          {/* Left panel indicator */}
          <div className="p-2 border-t border-[#dedede] bg-slate-50 text-[10px] font-mono select-none text-slate-400">
            Current OU DN: {selectedOUDn.replace(',DC=aapico,DC=com', '')}
          </div>

        </aside>

        {/* RIGHT COMPONENT: Object List View compact table */}
        <section className="flex-grow bg-[#fff] flex flex-col justify-between overflow-hidden">

          {/* Header context label */}
          <div className="bg-[#e3ecf5]/50 px-3.5 py-1.5 border-b border-[#c0c0c0] flex justify-between items-center select-none text-[11px] text-[#001f56] font-bold tracking-wide select-none">
            <span>Name Location: CN={selectedOUDn}</span>
            <span className="bg-[#3b72ab]/10 text-[#3b72ab] px-1.5 py-0.5 rounded-sm font-mono font-bold text-[10px]">
              {currentObjectsList.length} Objects Installed
            </span>
          </div>

          {/* List compact elements grid */}
          <div className="flex-grow overflow-y-auto bg-white">
            <table className="w-full border-collapse text-left text-xs font-sans">
              <thead className="bg-[#eaeaea] sticky top-0 border-b border-[#c0c0c0] z-10 font-sans shadow-2xs select-none">
                <tr className="text-slate-700">
                  <th className="py-1.5 px-3 border-r border-[#d4d0c8] text-xs font-bold leading-none select-none">Name</th>
                  <th className="py-1.5 px-3 border-r border-[#d4d0c8] text-xs font-bold leading-none select-none">Type</th>
                  <th className="py-1.5 px-3 border-r border-[#d4d0c8] text-xs font-bold leading-none select-none">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentObjectsList.length > 0 ? (
                  currentObjectsList.map((obj, index) => {
                    const isSelected = selectedRowIndex === index;

                    return (
                      <tr
                        key={obj.dn}
                        onClick={() => setSelectedRowIndex(index)}
                        onDoubleClick={() => handleRowDoubleClick(obj)}
                        className={`cursor-pointer transition-all ${isSelected
                          ? 'bg-[#3b72ab] text-white font-semibold'
                          : 'hover:bg-[#e4eef6]/50'
                          }`}
                      >
                        {/* Name Column with Type-specific icon */}
                        <td className="py-2 px-3 flex items-center gap-2 select-all font-sans">
                          {obj.type === 'user' ? (
                            <div className={`p-0.5 rounded ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                              <User className="h-3.5 w-3.5 shrink-0" />
                            </div>
                          ) : obj.type === 'group' ? (
                            <div className={`p-0.5 rounded ${isSelected ? 'text-white' : 'text-emerald-600'}`}>
                              <Users className="h-3.5 w-3.5 shrink-0" />
                            </div>
                          ) : obj.type === 'computer' ? (
                            <div className={`p-0.5 rounded ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                              <Monitor className="h-3.5 w-3.5 shrink-0" />
                            </div>
                          ) : obj.type === 'ou' ? (
                            <div className="relative shrink-0 select-none p-0.5 rounded">
                              <Folder className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-amber-500 fill-amber-200'}`} />
                              <div className={`absolute top-[4px] right-[4px] w-1 h-1 rounded-xs border-[1px] ${isSelected ? 'bg-white border-[#3b72ab]' : 'bg-[#3b72ab] border-white'}`} />
                            </div>
                          ) : obj.type === 'contact' ? (
                            <div className={`p-0.5 rounded ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                              <Briefcase className="h-3.5 w-3.5 shrink-0" />
                            </div>
                          ) : obj.type === 'sharedfolder' ? (
                            <div className={`p-0.5 rounded ${isSelected ? 'text-white' : 'text-blue-500 fill-blue-100'}`}>
                              <Folder className="h-3.5 w-3.5 shrink-0" />
                            </div>
                          ) : obj.type === 'printer' ? (
                            <div className={`p-0.5 rounded ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                              <Printer className="h-3.5 w-3.5 shrink-0" />
                            </div>
                          ) : (
                            <div className="p-0.5 rounded text-amber-500">
                              <Folder className="h-3.5 w-3.5 shrink-0" />
                            </div>
                          )}
                          <span className="truncate">{obj.name}</span>
                        </td>

                        {/* Type Label */}
                        <td className="py-2 px-3 border-l border-transparent truncate uppercase tracking-wider font-mono text-[10px] select-none">
                          {obj.type}
                        </td>

                        {/* Description */}
                        <td className="py-2 px-3 border-l border-transparent truncate max-w-sm select-all">
                          {obj.description || <span className="text-slate-400 italic">Not Configure</span>}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="select-none">
                    <td colSpan={3} className="py-12 text-center text-slate-400 italic font-sans">
                      Active container is empty. Drag or Add active verified credentials inside.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Right Content Lists MMC Status bar */}
          <div className="bg-[#f0f0f0] border-t border-[#b2b2b2] p-2 flex justify-between items-center text-[10px] text-slate-500 font-mono select-none">
            <span className="font-semibold text-slate-600">
              {selectedRowIndex !== null && currentObjectsList[selectedRowIndex]
                ? `Selected: ${currentObjectsList[selectedRowIndex].name} (${currentObjectsList[selectedRowIndex].type})`
                : 'Selected: None'}
            </span>
            <span>{currentObjectsList.length} Objects inside active scope</span>
          </div>

        </section>

      </div>

      {/* FOOTER DIRECTORY LEGEND */}
      <div className="bg-[#e4eef6] p-2.5 border-t border-[#b0b0b0] text-[10px] text-slate-600 leading-normal flex items-start gap-2 select-none select-none font-sans">
        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span className="font-headline text-slate-500">
          <b>MMC Guidelines</b>: Double-click any User, Computer, or Group in the item list to pull the classic <b>Active Directory Properties UI</b>, inspect structural backend Attributes, and copy standard python script variables effortlessly.
        </span>
      </div>


      {/* ========================================================== */}
      {/* 5. POP-UP DIALOG : PROPERTIES CONFIGURATION MODAL (MMC LOOKS) */}
      {/* ========================================================== */}
      {/* Use the standalone Properties Modal component */}
      <ADPropertiesModal
        isOpen={isPropertiesOpen}
        onClose={() => setIsPropertiesOpen(false)}
        initialObject={activePropertyObject}
      />

    </div>
  );
};
