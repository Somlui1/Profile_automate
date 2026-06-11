/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ADNode, DirectoryUser, ADGroup } from '../types';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  Search, 
  RefreshCw, 
  Lock, 
  Loader2, 
  ArrowLeft, 
  ArrowRight, 
  FolderUp,
  MapPin,
  Briefcase,
  Users,
  Database,
  Building,
  UserCheck,
  Check,
  Info
} from 'lucide-react';

interface ADExplorerTabProps {
  users: DirectoryUser[];
  config: React.ComponentState; // using React.ComponentState as general type for flexibility
}

export const ADExplorerTab: React.FC<ADExplorerTabProps> = ({ users, config }) => {
  const [rootNodes, setRootNodes] = useState<ADNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'DC=aapico,DC=com': true
  });
  const [nodeChildrenCache, setNodeChildrenCache] = useState<Record<string, ADNode[]>>({});
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({});
  
  const [selectedDN, setSelectedDN] = useState<string>('DC=aapico,DC=com');
  const [selectedNode, setSelectedNode] = useState<ADNode | null>({
    dn: 'DC=aapico,DC=com',
    name: 'aapico.com',
    type: 'domain',
    has_children: true
  });

  const [detailsList, setDetailsList] = useState<ADNode[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Left Tree input filter
  const [filterText, setFilterText] = useState('');

  // Right pane tab controls
  const [activeDetailTab, setActiveDetailTab] = useState<'general' | 'address' | 'account' | 'organization' | 'memberof' | 'attribute'>('general');

  // Load root domain nodes and pre-populate children
  useEffect(() => {
    loadRootNodes();
  }, [users]); // Re-load when user list changes (e.g. from PDF Provisioning additions)

  // Fetch children whenever selectedDN changes to update details pane
  useEffect(() => {
    loadDetailsList(selectedDN);
  }, [selectedDN, users]);

  const loadRootNodes = async () => {
    try {
      const response = await fetch('/api/v1/user/ad/tree');
      if (response.ok) {
        const data = await response.json();
        // Incorporate any new direct users created within the UI into the cache
        const backendNodes: ADNode[] = data.nodes || [];
        
        // Find users in "OU=Users" that aren't already in the children list
        // Let's make sure the root node is initialized
        setNodeChildrenCache((prev) => ({
          ...prev,
          'DC=aapico,DC=com': backendNodes
        }));
        
        const root: ADNode = {
          dn: 'DC=aapico,DC=com',
          name: 'aapico.com',
          type: 'domain',
          has_children: true
        };
        setRootNodes([root]);
      }
    } catch (e) {
      console.error("Error loading root nodes:", e);
    }
  };

  const loadDetailsList = async (dn: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/v1/user/ad/tree?parent_dn=${encodeURIComponent(dn)}`);
      if (response.ok) {
        const data = await response.json();
        let nodes: ADNode[] = data.nodes || [];

        // If the selected DN is an OU containing Users (or we have matching directory users),
        // we merge them so dynamically added users are also displayed.
        const cleanedDN = dn.toLowerCase();
        
        // Find users belonging to this OU or having this path
        const currentOUUsers = users.filter((u) => {
          // If user.ou matches our DN
          const userOU = u.ou ? u.ou.toLowerCase().trim() : '';
          return userOU === cleanedDN;
        });

        // Add user nodes that might not be in the mock backend tree
        currentOUUsers.forEach((user) => {
          const userDN = `CN=${user.name},${user.ou}`;
          const alreadyInList = nodes.some(n => n.dn.toLowerCase() === userDN.toLowerCase());
          if (!alreadyInList) {
            nodes.push({
              dn: userDN,
              name: user.name,
              type: 'user',
              has_children: false
            });
          }
        });

        setDetailsList(nodes);
      }
    } catch (e) {
      console.error("Error loading details for DN:", dn);
    } finally {
      setLoadingDetails(false);
    }
  };

  const lazyLoadNodeChildren = async (dn: string) => {
    if (nodeChildrenCache[dn]) return nodeChildrenCache[dn];

    setLoadingNodes(prev => ({ ...prev, [dn]: true }));
    try {
      const response = await fetch(`/api/v1/user/ad/tree?parent_dn=${encodeURIComponent(dn)}`);
      if (response.ok) {
        const data = await response.json();
        let children = data.nodes || [];
        
        // Merge user nodes for this OU
        const currentOUUsers = users.filter((u) => u.ou && u.ou.toLowerCase().trim() === dn.toLowerCase());
        currentOUUsers.forEach((user) => {
          const userDN = `CN=${user.name},${user.ou}`;
          const alreadyInList = children.some((n: ADNode) => n.dn.toLowerCase() === userDN.toLowerCase());
          if (!alreadyInList) {
            children.push({
              dn: userDN,
              name: user.name,
              type: 'user',
              has_children: false
            });
          }
        });

        setNodeChildrenCache(prev => ({ ...prev, [dn]: children }));
        setLoadingNodes(prev => ({ ...prev, [dn]: false }));
        return children;
      }
    } catch (e) {
      console.error("Error lazy loading sub nodes:", e);
    }
    setLoadingNodes(prev => ({ ...prev, [dn]: false }));
    return [];
  };

  const toggleExpand = async (e: React.MouseEvent, dn: string) => {
    e.stopPropagation();
    const isExpanded = expandedNodes[dn];
    if (!isExpanded) {
      setExpandedNodes(prev => ({ ...prev, [dn]: true }));
      await lazyLoadNodeChildren(dn);
    } else {
      setExpandedNodes(prev => ({ ...prev, [dn]: false }));
    }
  };

  const handleNodeClick = (node: ADNode) => {
    setSelectedDN(node.dn);
    setSelectedNode(node);
  };

  const handleUpOneLevel = () => {
    if (selectedDN.toLowerCase() === 'dc=aapico,dc=com') return;
    const parts = selectedDN.split(',');
    if (parts.length > 1) {
      const parentDn = parts.slice(1).join(',');
      const parentFirstPart = parts[1].split('=');
      const parentName = parentFirstPart.length > 1 ? parentFirstPart[1] : parentDn;
      
      const parentType = parentDn.toLowerCase().startsWith('ou=') ? 'ou' : parentDn.toLowerCase().startsWith('dc=') ? 'domain' : 'container';
      
      const pNode: ADNode = {
        dn: parentDn,
        name: parentName,
        type: parentType as any,
        has_children: true
      };

      setSelectedDN(parentDn);
      setSelectedNode(pNode);
    }
  };

  // Helper parsing dynamic breadcrumbs from Distinguished Name (DN)
  const getBreadcrumbs = (dn: string) => {
    if (!dn) return ["Active Directory", "aapico.com"];
    const parts = dn.split(',').reverse();
    const breadcrumbs: string[] = ["Active Directory"];
    
    parts.forEach(part => {
      const [key, val] = part.split('=');
      if (!val) return;
      if (key === 'DC') {
        if (val.toLowerCase() !== 'com' && !breadcrumbs.includes(val)) {
          breadcrumbs.push(val + '.com');
        }
      } else {
        breadcrumbs.push(val);
      }
    });
    return breadcrumbs;
  };

  // Maps node type to icon
  const getNodeIconMapping = (type: string) => {
    switch (type) {
      case 'domain':
        return { css: 'text-primary', icon: 'dns' };
      case 'ou':
        return { css: 'text-amber-500', icon: 'folder' };
      case 'container':
        return { css: 'text-amber-600', icon: 'folder_open' };
      case 'group':
        return { css: 'text-green-700', icon: 'groups' };
      case 'user':
        return { css: 'text-slate-500', icon: 'person' };
      case 'computer':
        return { css: 'text-slate-400', icon: 'computer' };
      default:
        return { css: 'text-slate-500', icon: 'folder' };
    }
  };

  // Find user model profile matching this ADNode node
  const getSelectedUserProfile = (): DirectoryUser | null => {
    if (!selectedNode || selectedNode.type !== 'user') return null;
    
    // Find matching user by name or parsed logon CN path
    const targetName = selectedNode.name.toLowerCase().trim();
    const targetDN = selectedNode.dn.toLowerCase().trim();

    // 1. Try matching with full name or DN directly
    let found = users.find(u => 
      u.name.toLowerCase().trim() === targetName || 
      `cn=${u.name.toLowerCase().trim()},${u.ou?.toLowerCase().trim()}` === targetDN
    );

    if (found) return found;

    // 2. Try matching from CN part of common name if matches uid logon part description
    const isCN = selectedNode.dn.startsWith('CN=');
    if (isCN) {
      const cnVal = selectedNode.name.toLowerCase();
      found = users.find(u => u.uid.toLowerCase() === cnVal || cnVal.includes(u.uid.toLowerCase()));
      if (found) return found;
    }

    // 3. Last fallback, return a mock user profile generated on the fly for complete demonstration
    const names = selectedNode.name.split(' ');
    const firstName = names[0] || selectedNode.name;
    const lastName = names.slice(1).join(' ') || "Staff";
    const logonName = `${firstName.toLowerCase()}.${(lastName[0] || "s").toLowerCase()}`;

    return {
      uid: logonName,
      name: selectedNode.name,
      email: `${logonName}@aapico.com`,
      title: "Staff Member",
      dept: "Operations",
      printCode: "990011",
      ou: selectedNode.dn.substring(selectedNode.dn.indexOf(',') + 1) || "OU=Users,DC=aapico,DC=com",
      papercut: "Synced",
      status: "Active",
      mobile: "+66 (0) 81 234 5678",
      company: "AAPICO Hitech PLC",
      manager: "Somsak Sombat",
      office: "AAPICO HQ - Building A",
      description: "Auto Synced Active Directory Organizational Unit Object",
      street: "99 Moo 1 Hitech Industrial Estate, Tambol Ban Len",
      city: "Bang Pa-In",
      state: "Phranakhon Sri Ayutthaya",
      zipCode: "13160",
      country: "Thailand"
    };
  };

  // Render tree layout with filter capabilities
  const renderTreeNodesRecursive = (nodes: ADNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      // Direct node level filtering
      const isExpanded = expandedNodes[node.dn];
      const children = nodeChildrenCache[node.dn] || [];
      const isLoading = loadingNodes[node.dn];
      const isSelected = selectedDN === node.dn;
      const iconDetails = getNodeIconMapping(node.type);

      // Simple match check
      const matchesFilter = !filterText || node.name.toLowerCase().includes(filterText.toLowerCase()) || 
        children.some(c => c.name.toLowerCase().includes(filterText.toLowerCase()));

      if (!matchesFilter && depth > 0) return null;

      return (
        <div key={node.dn} className="tree-node text-xs font-headline">
          <div 
            onClick={() => handleNodeClick(node)}
            onDoubleClick={(e) => {
              if (node.has_children) {
                toggleExpand(e, node.dn);
              }
            }}
            className={`tree-item flex items-center gap-1 px-1.5 py-1 select-none hover:bg-slate-100 relative min-h-[26px] rounded transition-colors ${
              isSelected ? 'tree-selected bg-[#001f56] text-white' : 'text-slate-700'
            }`}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
          >
            {/* Tree branches connector lines */}
            {depth > 0 && (
              <span 
                className="tree-connector absolute top-1/2 w-2.5 h-px bg-slate-200"
                style={{ left: `${(depth - 1) * 14 + 12}px` }}
              />
            )}

            {/* Expander Arrow toggle icons */}
            {node.has_children ? (
              <button 
                onClick={(e) => toggleExpand(e, node.dn)}
                className="tree-toggle text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center h-4.5 w-4.5 shrink-0 select-none cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                ) : isExpanded ? (
                  <ChevronDown className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : ''}`} />
                ) : (
                  <ChevronRight className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : ''}`} />
                )}
              </button>
            ) : (
              <span className="w-4.5 h-4.5 shrink-0" />
            )}

            {/* Material Icon representing node type */}
            <span className={`material-symbols-outlined text-[16px] shrink-0 mr-1 ${
              isSelected ? 'text-white' : iconDetails.css
            }`}>
              {iconDetails.icon}
            </span>

            {/* Node descriptive text */}
            <span className={`tree-label truncate select-none ${isSelected ? 'text-white font-bold' : ''}`}>
              {node.name}
            </span>

            {/* Node type badge */}
            <span className={`tree-type-badge text-[8px] font-black uppercase px-1 py-[1.5px] rounded border ml-auto shrink-0 select-none scale-90 ${
              isSelected 
                ? 'bg-transparent border-white/40 text-white' 
                : node.type === 'ou' 
                  ? 'bg-amber-50 border-amber-200 text-amber-800' 
                  : node.type === 'domain'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              {node.type}
            </span>
          </div>

          {/* Expanded Children rendered recursively */}
          {node.has_children && isExpanded && children.length > 0 && (
            <div 
              className="sub-nodes relative"
              style={{ '--tree-line-left': `${depth * 14 + 13}px` } as React.CSSProperties}
            >
              <div 
                className="absolute top-0 bottom-4 w-px bg-slate-200"
                style={{ left: `${depth * 14 + 11}px` }}
              />
              {renderTreeNodesRecursive(children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const selectedUser = getSelectedUserProfile();
  const rawBreadcrumbs = getBreadcrumbs(selectedDN);

  return (
    <div className="space-y-6">
      
      {/* Title Header area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2 select-none shrink-0 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-2xl font-black text-primary font-headline-md flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px] animate-pulse">search_check</span>
            Active Directory Domain Explorer
          </h2>
          <p className="text-xs text-on-surface-variant font-body mt-0.5">
            Synchronized directory mapping engine powered by AAPICO LDAPs and M365 Subscribed SKUs
          </p>
        </div>
      </div>

      {/* Breadcrumbs Navigation */}
      <div className="bg-slate-50 border border-outline-variant p-3.5 rounded-lg flex items-center justify-between select-none">
        <nav className="flex items-center flex-wrap gap-1 text-[11px] font-bold text-slate-500 font-headline">
          {rawBreadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb + idx}>
              {idx > 0 && <span className="material-symbols-outlined text-slate-400 text-[14px]">chevron_right</span>}
              <span className={idx === rawBreadcrumbs.length - 1 ? "text-primary font-black" : "hover:text-primary-container cursor-pointer transition-colors"}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
        <span className="text-[10px] font-mono text-slate-400 bg-white border px-2 py-1 rounded">
          DN: {selectedDN}
        </span>
      </div>

      {/* Dual Pane Layout Area */}
      <div className="grid grid-cols-12 gap-5 h-[620px] items-stretch">
        
        {/* LEFT PANEL: Directory Explorer Tree and Search */}
        <aside className="col-span-12 lg:col-span-4 bg-white border border-outline-variant rounded-xl flex flex-col overflow-hidden shadow-sm h-full">
          <div className="p-4 border-b border-outline-variant bg-surface-container-low space-y-3 select-none">
            <div className="font-bold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5 leading-none">
              <span className="material-symbols-outlined text-[18px] text-primary">folder_open</span>
              Directory Tree Explorer
            </div>
            
            {/* Tree search/filter */}
            <div className="relative">
              <input 
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter catalog OUs or users..."
                className="w-full text-xs p-2.5 pl-8.5 border border-outline-variant bg-white rounded outline-none focus:ring-1 focus:ring-primary focus:border-primary h-9 font-headline"
              />
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                filter_alt
              </span>
              {filterText && (
                <button 
                  onClick={() => setFilterText('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Directory node tree canvas container */}
          <div className="flex-grow overflow-y-auto custom-scrollbar p-3.5 space-y-1 select-none">
            {rootNodes.length > 0 ? (
              renderTreeNodesRecursive(rootNodes)
            ) : (
              <div className="text-center py-10 text-slate-400 italic text-xs">
                <Loader2 className="h-4 w-4 animate-spin inline-block text-primary mr-1.5" /> Synchronizing AD controllers...
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT PANEL: OU Children Contents OR Detailed tabbed user attributes */}
        <section className="col-span-12 lg:col-span-8 bg-white border border-outline-variant rounded-xl flex flex-col overflow-hidden shadow-sm h-full">
          
          {selectedNode && selectedNode.type === 'user' && selectedUser ? (
            
            /* VIEW A: Tabbed User Object profiles */
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* Profile Card Header */}
              <div className="p-5.5 bg-surface-container-low border-b border-outline-variant flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary text-white flex items-center justify-center font-black text-lg shadow-sm select-none uppercase font-headline">
                  {selectedUser.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <h3 className="font-extrabold text-lg text-primary leading-tight font-headline truncate">
                      {selectedUser.name}
                    </h3>
                    <span className="px-2.5 py-0.5 bg-secondary/15 text-secondary text-[9px] font-black uppercase rounded-full border border-secondary/15 select-none tracking-wider">
                      AD Account {selectedUser.status}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-headline mt-1 select-none">
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{selectedUser.title}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{selectedUser.dept}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">home_pin</span>
                      <span>{selectedUser.office || "Headquarters"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Windows Tabs bar navigator */}
              <div className="bg-slate-50 border-b border-outline-variant px-5 flex overflow-x-auto custom-scrollbar select-none shrink-0 gap-1.5 pt-2">
                {[
                  { key: 'general', label: 'General', icon: 'account_circle' },
                  { key: 'address', label: 'Address', icon: 'home' },
                  { key: 'account', label: 'Account', icon: 'security' },
                  { key: 'organization', label: 'Organization', icon: 'corporate_fare' },
                  { key: 'memberof', label: 'Member Of', icon: 'grid_view' },
                  { key: 'attribute', label: 'Attribute Editor', icon: 'settings_ethernet' },
                ].map((item) => {
                  const isActive = activeDetailTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveDetailTab(item.key as any)}
                      className={`px-3.5 py-2.5 font-bold text-xs flex items-center gap-1.5 border-t border-r border-l cursor-pointer rounded-t-lg transition-all ${
                        isActive
                          ? 'bg-white border-[#c5c6d1] text-primary border-b-white translate-y-[1px] relative z-10 font-black shadow-sm'
                          : 'bg-[#f5f5f5] text-slate-500 border-transparent hover:text-[#001f56] hover:bg-slate-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                      <span className="font-headline">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Scrollable Tab panel body content details */}
              <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-white">
                
                {activeDetailTab === 'general' && (
                  /* TAB 1: General Options Attributes specifications */
                  <div className="grid grid-cols-12 gap-6 items-start h-full">
                    <div className="col-span-12 md:col-span-8 space-y-4">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">First Name</label>
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-bold font-headline select-all">
                            {selectedUser.name.split(' ')[0] || "Staff"}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Last Name</label>
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-bold font-headline select-all">
                            {selectedUser.name.split(' ').slice(1).join(' ') || "Member"}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Display Name</label>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-800 font-black font-headline select-all">
                          {selectedUser.name}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Description / Employee ID</label>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-headline select-all">
                          {selectedUser.description || `Auto Provisioned Employee Account for ${selectedUser.name}`}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Office / Facility Location</label>
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-bold font-headline select-all">
                            {selectedUser.office || "Headquarters HQ - AH"}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Phone Number / Ext</label>
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-bold font-mono select-all">
                            {selectedUser.mobile || "+66 (0) 2 613 1000"}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Email Address</label>
                        <div className="p-2.5 bg-blue-50/50 border border-blue-100/50 rounded text-xs text-primary font-black font-mono select-all flex items-center justify-between">
                          <span>{selectedUser.email}</span>
                          <span className="text-[9px] bg-primary text-white px-1.5 py-[2px] rounded uppercase font-headline">SMTP Active</span>
                        </div>
                      </div>

                    </div>

                    {/* Quick Summary Sidebar */}
                    <div className="col-span-12 md:col-span-4 bg-slate-50 border border-slate-200 p-5 rounded-lg text-slate-700 select-none">
                      <div className="font-extrabold text-xs text-primary mb-3 flex items-center gap-1 font-headline uppercase">
                        <Info className="h-4 w-4 text-primary" /> Active Quick Summary
                      </div>
                      <div className="space-y-3.5 text-xs font-headline">
                        <div className="border-b pb-2">
                          <p className="text-[10px] text-slate-400 uppercase font-black">Last Network Logon</p>
                          <p className="font-bold text-slate-800 mt-0.5 font-mono">Today, {new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <div className="border-b pb-2">
                          <p className="text-[10px] text-slate-400 uppercase font-black">Printer Token code</p>
                          <p className="font-extrabold text-secondary mt-0.5 font-mono flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-full bg-secondary tracking-widest animate-pulse" />
                            {selectedUser.printCode || "123456"}
                          </p>
                        </div>
                        <div className="border-b pb-2">
                          <p className="text-[10px] text-slate-400 uppercase font-black">Object Created Date</p>
                          <p className="font-bold text-slate-800 mt-0.5 font-mono">2026-06-08 (Sync-Record)</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-black">LDAP Schema Class</p>
                          <span className="inline-block mt-1 font-bold text-[9px] text-[#001f56] bg-blue-100 border border-blue-200 px-2 py-0.5 rounded uppercase">
                            USER_CONTAINED
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'address' && (
                  /* TAB 2: Physical Address specifications */
                  <div className="space-y-4 max-w-xl">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Street Address</label>
                      <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-headline select-all">
                        {selectedUser.street || "99 Moo 1 Hitech Industrial Estate, Tambol Ban Len"}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">City / District</label>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-medium font-headline select-all">
                          {selectedUser.city || "Bang Pa-In"}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">State / Province</label>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-medium font-headline select-all">
                          {selectedUser.state || "Phranakhon Sri Ayutthaya"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Zip Code / Post Code</label>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-mono select-all">
                          {selectedUser.zipCode || "13160"}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Country</label>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-bold font-headline select-all">
                          {selectedUser.country || "Thailand"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'account' && (
                  /* TAB 3: Active Directory Logon Options details */
                  <div className="space-y-5 max-w-xl">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">User Principal Logon Name (UPN)</label>
                      <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-primary font-black font-mono select-all">
                        {selectedUser.uid}@aapico.com
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg space-y-3.5 select-none font-headline">
                      <h4 className="font-extrabold text-xs text-[#001f56] uppercase tracking-wide">Account Security Options</h4>
                      
                      <div className="space-y-2 text-xs">
                        <label className="flex items-center gap-2.5 text-slate-600 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked={false} className="rounded border-slate-300 text-primary focus:ring-primary h-4.5 w-4.5" />
                          <span>User must change password at next logon (Required change)</span>
                        </label>
                        
                        <label className="flex items-center gap-2.5 text-slate-600 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked={false} className="rounded border-slate-300 text-primary focus:ring-primary h-4.5 w-4.5" />
                          <span>User cannot change password (IT Administration freeze)</span>
                        </label>

                        <label className="flex items-center gap-2.5 text-slate-800 font-bold cursor-pointer">
                          <input type="checkbox" defaultChecked={true} className="rounded border-slate-300 text-primary focus:ring-primary h-4.5 w-4.5" />
                          <span>Password never expires (Corporate standard template)</span>
                        </label>

                        <label className="flex items-center gap-2.5 text-slate-600 font-medium cursor-pointer">
                          <input type="checkbox" defaultChecked={false} className="rounded border-slate-300 text-primary focus:ring-primary h-4.5 w-4.5" />
                          <span>Account is locked / disabled (Disable validation)</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Account Expiry settings</label>
                      <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-600 font-semibold font-headline select-none">
                        Never (Permanent Full-access object)
                      </div>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'organization' && (
                  /* TAB 4: Organization structure */
                  <div className="space-y-4 max-w-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Job Title</label>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-800 font-extrabold font-headline select-all">
                          {selectedUser.title}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Department</label>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-bold font-headline select-all">
                          {selectedUser.dept}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline">Company Name</label>
                      <div className="p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-700 font-semibold font-headline select-all">
                        {selectedUser.company || "AAPICO Hitech Public Company Limited"}
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t pt-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-headline block mb-1">Direct Manager</label>
                      <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex items-center gap-3.5 max-w-md select-none font-headline">
                        <div className="w-10 h-10 rounded-full bg-slate-350 text-slate-700 bg-slate-200 font-extrabold text-sm flex items-center justify-center border">
                          {(selectedUser.manager || "Somsak Sombat").split(' ').map(n=>n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-extrabold text-xs text-primary">{selectedUser.manager || "Somsak Sombat"}</p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Authoritative LDAP Manager CN</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'memberof' && (
                  /* TAB 5: LDAP Group memberships */
                  <div className="space-y-4 select-none animate-fadeIn">
                    <div className="flex justify-between items-center px-1 font-headline">
                      <span className="text-xs text-slate-600 font-bold">Group members of (AD Access Lists)</span>
                      <span className="text-xs bg-[#001f56] text-white px-2 py-0.5 rounded font-black">4 Total</span>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden max-w-2xl bg-white shadow-inner">
                      <table className="w-full text-left text-xs text-slate-700 font-headline">
                        <thead className="bg-[#f5f5f5] text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5 pl-4">Security Group Name</th>
                            <th className="p-2.5 pl-4">Distinguished Directory Path</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-headline leading-tight">
                          {[
                            { name: "Domain Users", path: "DC=aapico,DC=com/Users" },
                            { name: selectedUser.dept === 'Information Technology' ? "Domain Admins" : "Engineering Users", path: "DC=aapico,DC=com/Users" },
                            { name: "VPN Users", path: "DC=aapico,DC=com/Security" },
                            { name: "CL100", path: "DC=aapico,DC=com/Groups/Regional" },
                          ].map((g, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 pl-4 font-black text-primary flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-primary shrink-0" /> {g.name}
                              </td>
                              <td className="p-3 pl-4 font-mono text-slate-400 text-[10px]">
                                {g.path}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'attribute' && (
                  /* TAB 6: Active Directory Attribute Editor key-val table specifications */
                  <div className="space-y-3.5 select-all">
                    <p className="text-[11px] text-slate-400 italic">
                      Dumping raw Active Directory schema attributes compiled from Active Node mapping values.
                    </p>

                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-[300px] overflow-y-auto custom-scrollbar shadow-inner select-none">
                      <table className="w-full text-left font-mono text-[10px] border-collapse text-slate-700">
                        <thead className="bg-[#f5f5f5] text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="p-2 px-3 pl-4 border-r">Attribute Name</th>
                            <th className="p-2 px-3">Raw Decrypted Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 leading-tight">
                          {[
                            { attr: "cn", val: selectedUser.name },
                            { attr: "distinguishedName", val: selectedNode.dn },
                            { attr: "sAMAccountName", val: selectedUser.uid },
                            { attr: "userPrincipalName", val: `${selectedUser.uid}@aapico.com` },
                            { attr: "objectGUID", val: `f47ac10b-${selectedUser.uid.length}8cc-4372-a567-0e02b2c3d479` },
                            { attr: "extensionAttribute1", val: selectedUser.printCode },
                            { attr: "extensionAttribute2", val: selectedUser.dept.toUpperCase() },
                            { attr: "postalCode", val: selectedUser.zipCode || "13160" },
                            { attr: "co", val: selectedUser.country || "Thailand" },
                            { attr: "whenCreated", val: "20260608084532.0Z" }
                          ].map((a, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 hover-trigger">
                              <td className="p-2 px-3 pl-4 border-r text-[#001f56] font-extrabold select-all select-none truncate max-w-[150px]">{a.attr}</td>
                              <td className="p-2 px-3 select-all truncate max-w-[320px]" title={a.val}>{a.val}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

              {/* Detail panel footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0 select-none">
                <button
                  onClick={() => {
                    const domainNode = rootNodes[0] || selectedNode;
                    setSelectedNode({
                      dn: 'OU=Engineering,OU=Users,DC=aapico,DC=com',
                      name: 'Engineering',
                      type: 'ou',
                      has_children: true
                    });
                    setSelectedDN('OU=Engineering,OU=Users,DC=aapico,DC=com');
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-600 font-bold text-xs rounded hover:bg-slate-100 cursor-pointer h-9 transition-colors flex items-center gap-1 font-headline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to List
                </button>
              </div>

            </div>

          ) : (
            
            /* VIEW B: Table List display for OUs / Domain nodes */
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* Table header bar */}
              <div className="p-5 bg-surface-container-low border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 select-none font-headline">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-primary flex items-center gap-1.5 leading-none">
                    <Database className="h-4.5 w-4.5 text-primary" /> 
                    <span>Directory Leaf Nodes inside: "{selectedNode?.name || 'aapico.com'}"</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 truncate max-w-md select-text" title={selectedDN}>
                    LDAP Path: {selectedDN}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={handleUpOneLevel}
                    className="p-1 px-1.5 text-slate-600 hover:bg-slate-100 rounded border hover:border-slate-300 cursor-pointer flex items-center gap-1 font-extrabold text-[11px]"
                    title="Up one level"
                  >
                    <FolderUp className="h-3.5 w-3.5 text-slate-600" />
                    <span>Up One Level</span>
                  </button>
                  <button 
                    onClick={() => { loadRootNodes(); loadDetailsList(selectedDN); }}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 border hover:border-slate-200 rounded cursor-pointer"
                    title="Reload catalog folder"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-slate-600" />
                  </button>
                </div>
              </div>

              {/* Table rendering list */}
              <div className="flex-grow overflow-y-auto custom-scrollbar bg-white select-none">
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead className="bg-[#f5f5f5] text-slate-700 font-bold border-b border-outline-variant sticky top-0 z-10 font-headline leading-none">
                    <tr>
                      <th className="p-2.5 pl-4 border-r border-slate-200">Name</th>
                      <th className="p-2.5 pl-4 border-r border-slate-200">Type</th>
                      <th className="p-2.5 pl-4">Distinguished Path (DN)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-headline">
                    {loadingDetails ? (
                      <tr>
                        <td colSpan={3} className="text-center py-20 text-slate-400 italic">
                          <Loader2 className="h-5 w-5 animate-spin text-primary inline-block mr-1.5" /> Querying AD controllers database...
                        </td>
                      </tr>
                    ) : detailsList.length > 0 ? (
                      detailsList.map((child) => {
                        const childIcon = getNodeIconMapping(child.type);
                        return (
                          <tr 
                            key={child.dn}
                            onClick={() => handleNodeClick(child)}
                            onDoubleClick={() => {
                              // If it's a container / OU / Domain, enter inside the leaf node directory
                              // If it's a user, handleNodeClick will let User Profile view overlay
                              if (['ou', 'container', 'domain'].includes(child.type)) {
                                setSelectedDN(child.dn);
                                setSelectedNode(child);
                                setExpandedNodes(prev => ({ ...prev, [child.dn]: true }));
                              }
                            }}
                            className="hover:bg-slate-50 cursor-pointer text-slate-800 transition-colors"
                          >
                            <td className="p-3 pl-4 border-r border-slate-100 max-w-xs truncate">
                              <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined text-[16px] shrink-0 ${childIcon.css}`}>
                                  {childIcon.icon}
                                </span>
                                <span className="font-extrabold text-slate-900 leading-tight">
                                  {child.name}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 pl-4 border-r border-slate-100">
                              <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 border rounded ${
                                child.type === 'user' 
                                  ? 'bg-blue-50 border-blue-100 text-blue-700' 
                                  : child.type === 'ou' 
                                    ? 'bg-amber-50 border-amber-100 text-amber-700'
                                    : 'bg-slate-50 border-slate-100 text-slate-600'
                              }`}>
                                {child.type}
                              </span>
                            </td>
                            <td className="p-3 pl-4 font-mono text-[10px] text-slate-400 truncate max-w-sm" title={child.dn}>
                              {child.dn}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-16 text-slate-400 italic">
                          (ว่าง — ไม่มีกลุ่ม สมาชิก หรืออ็อบเจ็กต์ภายใน OUs นี้)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Status bar details */}
              <div className="p-3.5 bg-slate-50 border-t border-[#cbd5e1] text-[10px] text-slate-500 font-headline select-none flex justify-between items-center shrink-0 leading-none">
                <div className="truncate pr-4">Active Directory Path: {selectedNode?.name || 'aapico.com'}</div>
                <div className="shrink-0 font-bold">{detailsList.length} object(s) found</div>
              </div>

            </div>

          )}

        </section>

      </div>

    </div>
  );
};
