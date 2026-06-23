/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ADNode, ADObject } from '../types';
import { ADPropertiesModal } from './ADPropertiesModal';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  FolderUp, 
  RefreshCw, 
  Search,
  Lock,
  Loader2
} from 'lucide-react';

interface ADUCTreeProps {
  selectedDN: string;
  setSelectedDN: (dn: string) => void;
  onPathChange?: (dn: string, name: string) => void;
}

export const ADUCTree: React.FC<ADUCTreeProps> = ({
  selectedDN,
  setSelectedDN,
  onPathChange
}) => {
  const [rootNodes, setRootNodes] = useState<ADNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'DC=aapico,DC=com': true
  });
  const [loadedNodes, setLoadedNodes] = useState<Record<string, Record<string, any>>>({});
  const [nodeChildrenCache, setNodeChildrenCache] = useState<Record<string, ADNode[]>>({});
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({});
  const [detailsList, setDetailsList] = useState<ADNode[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedNodeName, setSelectedNodeName] = useState('aapico.com');
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [activePropertyObject, setActivePropertyObject] = useState<ADObject | null>(null);

  // History stack for Back/Forward navigation
  const [history, setHistory] = useState<string[]>([selectedDN]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  // Sync selectedDN with history
  useEffect(() => {
    if (isNavigating) {
      setIsNavigating(false);
      return;
    }
    if (selectedDN !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(selectedDN);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [selectedDN]);

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevDN = history[prevIndex];
      setIsNavigating(true);
      setHistoryIndex(prevIndex);
      setSelectedDN(prevDN);
      
      const parts = prevDN.split(',');
      const name = parts[0].split('=')[1] || prevDN;
      setSelectedNodeName(name);
      if (onPathChange) {
        onPathChange(prevDN, name);
      }
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextDN = history[nextIndex];
      setIsNavigating(true);
      setHistoryIndex(nextIndex);
      setSelectedDN(nextDN);
      
      const parts = nextDN.split(',');
      const name = parts[0].split('=')[1] || nextDN;
      setSelectedNodeName(name);
      if (onPathChange) {
        onPathChange(nextDN, name);
      }
    }
  };

  // Load root domain nodes
  useEffect(() => {
    loadRootNodes();
  }, []);

  // Fetch children whenever selectedDN changes to update details pane
  useEffect(() => {
    loadDetailsList(selectedDN);
  }, [selectedDN]);

  const loadRootNodes = async () => {
    try {
      const response = await fetch('/api/v1/user/ad/tree');
      if (response.ok) {
        const data = await response.json();
        setNodeChildrenCache((prev) => ({
          ...prev,
          'DC=aapico,DC=com': data.nodes || []
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
        setDetailsList(data.nodes || []);
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
        const children = data.nodes || [];
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
    setSelectedNodeName(node.name);
    if (onPathChange) {
      onPathChange(node.dn, node.name);
    }
  };

  const handleUpOneLevel = () => {
    if (selectedDN.toLowerCase() === 'dc=aapico,dc=com') return;
    const parts = selectedDN.split(',');
    if (parts.length > 1) {
      const parentDn = parts.slice(1).join(',');
      const parentFirstPart = parts[1].split('=');
      const parentName = parentFirstPart.length > 1 ? parentFirstPart[1] : parentDn;
      setSelectedDN(parentDn);
      setSelectedNodeName(parentName);
      if (onPathChange) {
        onPathChange(parentDn, parentName);
      }
    }
  };

  // ADUC style icon provider
  const getIconClassAndElem = (type: string) => {
    switch (type) {
      case 'domain':
        return { css: 'text-blue-700', icon: 'public' };
      case 'container':
        return { css: 'text-amber-500', icon: 'folder_open' };
      case 'ou':
        return { css: 'text-yellow-600', icon: 'folder' };
      case 'group':
        return { css: 'text-green-700 font-variation-settings-normal', icon: 'groups' };
      case 'user':
        return { css: 'text-slate-500', icon: 'person' };
      case 'computer':
        return { css: 'text-slate-500', icon: 'computer' };
      case 'contact':
        return { css: 'text-slate-500', icon: 'contact_mail' };
      case 'sharedfolder':
        return { css: 'text-blue-500', icon: 'folder_shared' };
      case 'printer':
        return { css: 'text-slate-500', icon: 'print' };
      default:
        return { css: 'text-slate-500', icon: 'folder' };
    }
  };

  const renderActiveTreeNodes = (nodes: ADNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedNodes[node.dn];
      const children = nodeChildrenCache[node.dn] || [];
      const isLoading = loadingNodes[node.dn];
      const isSelected = selectedDN === node.dn;
      const iconDetails = getIconClassAndElem(node.type);

      return (
        <div key={node.dn} className="tree-node font-sans text-xs">
          <div 
            onClick={() => handleNodeClick(node)}
            onDoubleClick={(e) => {
              if (node.has_children) {
                toggleExpand(e, node.dn);
              }
            }}
            className={`tree-item flex items-center gap-1.5 py-1 px-1 cursor-pointer select-none hover:bg-[#e8f0fe] relative min-h-[24px] ${
              isSelected ? 'tree-selected bg-[#0067c0] text-white border-l-2 border-white' : ''
            }`}
            style={{ paddingLeft: `${depth * 16 + 4}px` }}
          >
            {/* Horizontal line for tree aesthetics */}
            {depth > 0 && (
              <span 
                className="tree-connector absolute top-1/2 w-3 h-px bg-slate-300"
                style={{ left: `${(depth - 1) * 16 + 13}px` }}
              />
            )}

            {/* Expander toggle */}
            {node.has_children ? (
              <button 
                type="button"
                onClick={(e) => toggleExpand(e, node.dn)}
                className="tree-toggle text-slate-500 hover:text-slate-800 focus:outline-none flex items-center justify-center h-4 w-4 shrink-0 transition-transform cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                ) : isExpanded ? (
                  <ChevronDown className={`h-3 w-3 ${isSelected ? 'text-white' : ''}`} />
                ) : (
                  <ChevronRight className={`h-3 w-3 ${isSelected ? 'text-white' : ''}`} />
                )}
              </button>
            ) : (
              <span className="w-4 h-4 shrink-0" />
            )}

            {/* Node symbol indicator mapping to Material Icons layout */}
            <span className={`material-symbols-outlined text-[15px] shrink-0 ${iconDetails.css}`}>
              {iconDetails.icon}
            </span>

            {/* Label name */}
            <span className={`tree-label truncate ${isSelected ? 'text-white font-bold' : 'text-slate-800'}`}>
              {node.name}
            </span>

            {/* Type badge */}
            <span className={`tree-type-badge shrink-0 text-[8px] font-black uppercase px-1 py-[1.5px] rounded-sm ml-auto border ${
              isSelected 
                ? 'bg-transparent border-white/40 text-white' 
                : node.type === 'ou' 
                  ? 'bg-amber-50 border-amber-200 text-amber-800' 
                  : node.type === 'domain'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              {node.type}
            </span>
          </div>

          {/* Children container line */}
          {node.has_children && isExpanded && children.length > 0 && (
            <div 
              className="sub-nodes relative"
              style={{ '--tree-line-left': `${depth * 16 + 13}px` } as React.CSSProperties}
            >
              <div 
                className="absolute top-0 bottom-4 w-px bg-slate-300"
                style={{ left: `${depth * 16 + 11}px` }}
              />
              {renderActiveTreeNodes(children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <div className="aduc-container rounded-lg overflow-hidden border border-[#c5c6d1] flex flex-col font-sans">
      {/* Windows style toolbar header */}
      <div className="aduc-toolbar h-9 bg-[#f0f0f0] border-b border-[#d1d1d1] flex items-center px-2 gap-1.5 shrink-0 select-none">
        <button 
          type="button"
          title="Back"
          disabled={historyIndex === 0}
          onClick={handleBack}
          className={`aduc-btn w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 active:bg-slate-300 cursor-pointer ${
            historyIndex === 0 ? 'text-slate-400 disabled:opacity-40 cursor-not-allowed hover:bg-transparent active:bg-transparent' : 'text-slate-600'
          }`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <button 
          type="button"
          title="Forward"
          disabled={historyIndex === history.length - 1}
          onClick={handleForward}
          className={`aduc-btn w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 active:bg-slate-300 cursor-pointer ${
            historyIndex === history.length - 1 ? 'text-slate-400 disabled:opacity-40 cursor-not-allowed hover:bg-transparent active:bg-transparent' : 'text-slate-600'
          }`}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-slate-300 mx-0.5" />
        <button 
          type="button"
          title="Up One Level"
          onClick={handleUpOneLevel}
          className="aduc-btn w-6 h-6 flex items-center justify-center text-slate-600 rounded hover:bg-slate-200 active:bg-slate-300 cursor-pointer"
        >
          <FolderUp className="h-3.5 w-3.5 text-slate-700" />
        </button>
        <div className="h-4 w-px bg-slate-200 mx-0.5" />
        <button 
          type="button"
          title="Refresh"
          onClick={() => { loadRootNodes(); loadDetailsList(selectedDN); }}
          className="aduc-btn w-6 h-6 flex items-center justify-center text-slate-600 rounded hover:bg-slate-200 active:bg-slate-300 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-700" />
        </button>
        <div className="flex-grow" />
        <span className="text-[10px] text-slate-700 font-semibold select-none flex items-center gap-1">
          <Lock className="h-3 w-3 text-slate-500" /> Active Directory Admin View
        </span>
      </div>

      {/* Main Dual Windows view pane */}
      <div className="aduc-main flex-grow flex overflow-hidden min-h-[300px]">
        {/* Left Tree pane */}
        <div className="aduc-tree-panel w-56 border-r border-[#d1d1d1] bg-white overflow-y-auto custom-scrollbar shrink-0 select-none flex flex-col py-1">
          {renderActiveTreeNodes(rootNodes)}
        </div>

        {/* Right Details list table pane */}
        <div className="aduc-content-panel flex-grow bg-white overflow-y-auto custom-scrollbar">
          <table className="aduc-list-table w-full border-collapse text-xs select-none">
            <thead>
              <tr className="bg-[#f5f5f5] text-slate-800 text-left font-normal border-b border-[#d1d1d1]">
                <th className="p-1 px-1.5 border-r border-[#d1d1d1] font-semibold text-slate-700 select-none">Name</th>
                <th className="p-1 px-1.5 border-r border-[#d1d1d1] font-semibold text-slate-700 select-none">Type</th>
                <th className="p-1 px-1.5 border-r border-[#d1d1d1] font-semibold text-slate-700 select-none">Description</th>
                <th className="p-1 px-1.5 border-r border-[#d1d1d1] font-semibold text-slate-700 select-none">Title</th>
                <th className="p-1 px-1.5 border-r border-[#d1d1d1] font-semibold text-slate-700 select-none">Department</th>
                <th className="p-1 px-1.5 border-r border-[#d1d1d1] font-semibold text-slate-700 select-none">Email</th>
                <th className="p-1 px-1.5 border-r border-[#d1d1d1] font-semibold text-slate-700 select-none">Company</th>
                <th className="p-1 px-1.5 font-semibold text-slate-700 select-none">LDAP Path</th>
              </tr>
            </thead>
            <tbody>
              {loadingDetails ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400 italic">
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-1.5 text-primary" /> Loading directory items...
                  </td>
                </tr>
              ) : detailsList.length > 0 ? (
                detailsList.map((child) => {
                  const detailsIcon = getIconClassAndElem(child.type);
                  return (
                    <tr 
                      key={child.dn}
                      onDoubleClick={() => {
                        if (['ou', 'container', 'domain'].includes(child.type)) {
                          handleNodeClick(child);
                          setExpandedNodes(prev => ({ ...prev, [child.dn]: true }));
                        } else if (['user', 'group'].includes(child.type)) {
                          setActivePropertyObject(child as unknown as ADObject);
                          setIsPropertiesOpen(true);
                        }
                      }}
                      className="hover:bg-[#e8f0fe] cursor-pointer text-[11px] font-sans border-b border-slate-100"
                    >
                      <td className="p-1.5 text-slate-900 border-r border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-[14px] shrink-0 ${detailsIcon.css}`}>
                            {detailsIcon.icon}
                          </span>
                          <span className="truncate">{child.name}</span>
                        </div>
                      </td>
                      <td className="p-1.5 font-semibold text-slate-700 uppercase border-r border-slate-100">{child.type}</td>
                      <td className="p-1.5 text-slate-600 truncate max-w-[120px] border-r border-slate-100" title={child.description}>{child.description || '-'}</td>
                      <td className="p-1.5 text-slate-600 truncate max-w-[100px] border-r border-slate-100" title={child.title}>{child.title || '-'}</td>
                      <td className="p-1.5 text-slate-600 truncate max-w-[100px] border-r border-slate-100" title={child.department}>{child.department || '-'}</td>
                      <td className="p-1.5 text-slate-600 truncate max-w-[120px] border-r border-slate-100" title={child.mail}>{child.mail || '-'}</td>
                      <td className="p-1.5 text-slate-600 truncate max-w-[100px] border-r border-slate-100" title={child.company}>{child.company || '-'}</td>
                      <td className="p-1.5 font-mono text-slate-400 text-[10px] truncate max-w-sm" title={child.dn}>
                        {child.dn}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400 italic">
                    (ว่าง — ไม่มี Object ภายในโฟลเดอร์นี้)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Windows style bottom status bar */}
      <div className="status-bar h-6 bg-[#f0f0f0] border-t border-[#d1d1d1] flex items-center justify-between px-3 text-[10px] text-slate-500 font-sans select-none shrink-0">
        <div className="truncate pr-4">Selected: {selectedNodeName}</div>
        <div className="shrink-0">{detailsList.length} object(s) available</div>
      </div>
    </div>
      <ADPropertiesModal
        isOpen={isPropertiesOpen}
        onClose={() => setIsPropertiesOpen(false)}
        initialObject={activePropertyObject}
      />
    </>
  );
};
