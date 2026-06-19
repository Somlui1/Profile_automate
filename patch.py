import re

with open('frontend/src/components/ADExplorerTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove TreeContainer interface
content = re.sub(r'interface TreeContainer \{.*?\}\n+', '', content, flags=re.DOTALL)

# Add nodesCache and loadingNodes to ADExplorerTab
state_injections = """
  const [nodesCache, setNodesCache] = useState<Record<string, ADNode[]>>({});
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({});

  const fetchTreeNodes = async (dn: string) => {
    if (nodesCache[dn]) return; // Already fetched
    setLoadingNodes(prev => ({ ...prev, [dn]: true }));
    try {
      const res = await fetch(`/api/v1/user/ad/tree?parent_dn=${encodeURIComponent(dn)}`);
      if (res.ok) {
        const data = await res.json();
        setNodesCache(prev => ({ ...prev, [dn]: data }));
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
"""

content = re.sub(r'// Initialize all AD objects.*?const currentObjectsList = getCurrentOUObjects\(\);', state_injections.strip(), content, flags=re.DOTALL)

# Now fix renderConsoleTreeNode signature
content = content.replace("const renderConsoleTreeNode = (node: TreeContainer, depth = 0): React.ReactNode => {", "const renderConsoleTreeNode = (node: ADNode, depth = 0): React.ReactNode => {")

# And fix children recursive rendering
children_render_fix = """
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
"""

content = re.sub(r'\{\/\* Child level recursive nodes \*\/\}[\s\S]*?\{\/\* END CHILD \*\/\}', children_render_fix.strip(), content)
# Wait, let's just use regex to replace the children render block
content = re.sub(r'\{\/\* Child level recursive nodes \*\/\}[\s\S]*?</div>\s*\)\}\s*</div>', children_render_fix.strip() + '\n      </div>', content)


# Now fix the initial tree root rendering
content = content.replace("{/* Hierarchical folder branches entry point */}\n            {renderConsoleTreeNode(domainRoot)}", 
"""{/* Hierarchical folder branches entry point */}
            {renderConsoleTreeNode({
              dn: 'DC=aapico,DC=com',
              name: 'aapico.com',
              type: 'domain',
              has_children: true
            } as ADNode)}""")


# Replace adObjects with empty array just to satisfy any leftover references temporarily
content = content.replace("const [adObjects, setAdObjects] = useState<ADObject[]>([]);", "")
content = content.replace("import { ADObject } from '../types';", "import { ADObject, ADNode } from '../types';")

# Fix ADPropertiesModal initialObject type
# activePropertyObject is still ADObject but ADNode doesn't have everything
# we can just cast it as unknown as ADObject
content = content.replace("setActivePropertyObject({ ...obj });", "setActivePropertyObject({ ...obj } as unknown as ADObject);")
content = content.replace("const handleRowDoubleClick = (obj: ADObject) => {", "const handleRowDoubleClick = (obj: ADNode) => {")


with open('frontend/src/components/ADExplorerTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch complete")
