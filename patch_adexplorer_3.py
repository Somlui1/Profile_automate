import re

file_path = 'frontend/src/components/ADExplorerTab.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add domainRoot and isLoadingTree state if missing
state_pattern = r"const \[adObjects, setAdObjects\] = useState<ADObject\[\]>\(\[\]\);"
state_replacement = """const [adObjects, setAdObjects] = useState<ADObject[]>([]);
  const [domainRoot, setDomainRoot] = useState<TreeContainer>({
    dn: 'DC=aapico,DC=com',
    name: 'aapico.com',
    type: 'domain',
    children: [],
    has_children: true
  });
  const [isLoadingTree, setIsLoadingTree] = useState(false);"""
if "setDomainRoot" not in content:
    content = re.sub(state_pattern, state_replacement, content, count=1)

# 2. Replace static useEffect and getConsoleTree with fetchTreeNodes
tree_logic_pattern = re.compile(
    r"  // Initialize all AD objects.*?const domainRoot = getConsoleTree\(\);\n",
    re.DOTALL
)

tree_logic_replacement = """  // Dynamic Tree Loading from Backend API
  const fetchTreeNodes = async (parentDn: string, updateRightPane: boolean = false) => {
    setIsLoadingTree(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/user/ad/tree?parent_dn=${parentDn}`);
      if (res.ok) {
        const data = await res.json();
        const rawNodes = data.nodes || [];
        
        const treeChildren: TreeContainer[] = [];
        const paneObjects: ADObject[] = [];
        
        rawNodes.forEach((node: any) => {
          if (node.type === 'ou' || node.type === 'container' || node.type === 'domain') {
            treeChildren.push({
              dn: node.dn,
              name: node.name,
              type: node.type as 'ou' | 'container' | 'domain',
              children: [],
              has_children: node.has_children
            });
          }
          
          if (node.type !== 'ou' && node.type !== 'domain') {
            paneObjects.push({
              name: node.name,
              type: node.type,
              description: '',
              dn: node.dn,
              parentDn: parentDn,
              displayName: node.name,
              sAMAccountName: node.name,
              userPrincipalName: `${node.name}@aapico.com`,
            } as ADObject);
          } else if (node.type === 'ou' || node.type === 'container') {
             paneObjects.push({
              name: node.name,
              type: node.type,
              description: '',
              dn: node.dn,
              parentDn: parentDn,
            } as ADObject);
          }
        });
        
        const addChildrenToNode = (root: TreeContainer, pDn: string, newChildren: TreeContainer[]): TreeContainer => {
          if (root.dn.toLowerCase() === pDn.toLowerCase()) {
            return { ...root, children: newChildren, has_children: newChildren.length > 0 || root.has_children };
          }
          if (root.children && root.children.length > 0) {
            return {
              ...root,
              children: root.children.map(child => addChildrenToNode(child, pDn, newChildren))
            };
          }
          return root;
        };
        
        setDomainRoot(prev => {
          if (parentDn === 'DC=aapico,DC=com' && prev.dn.toLowerCase() !== parentDn.toLowerCase()) {
             if (data.base_dn) {
               return addChildrenToNode({
                  dn: data.base_dn,
                  name: data.base_dn.split(',')[0].split('=')[1] || data.base_dn,
                  type: 'domain',
                  children: treeChildren,
                  has_children: true
               }, data.base_dn, treeChildren);
             }
          }
          return addChildrenToNode(prev, parentDn, treeChildren);
        });
        
        if (updateRightPane) {
          setAdObjects(paneObjects);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingTree(false);
    }
  };

  // 1. Initial Load of Base Tree
  useEffect(() => {
    fetchTreeNodes('DC=aapico,DC=com', true);
  }, []);
\n"""

content = tree_logic_pattern.sub(tree_logic_replacement, content)

# 3. Simplify getCurrentOUObjects
get_objects_pattern = re.compile(
    r"  // Find all objects matching the selected OU/Container\n  const getCurrentOUObjects = \(\): ADObject\[\] => \{.*?\n  \};\n",
    re.DOTALL
)

get_objects_replacement = """  // Find all objects matching the selected OU/Container
  const getCurrentOUObjects = (): ADObject[] => {
    // In dynamic mode, adObjects always contains the exact list of items for the currently selected OU (fetched via API)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return adObjects.filter(obj =>
        obj.name.toLowerCase().includes(query) ||
        obj.type.toLowerCase().includes(query) ||
        (obj.description && obj.description.toLowerCase().includes(query))
      );
    }
    return adObjects;
  };\n"""

content = get_objects_pattern.sub(get_objects_replacement, content)

# 4. Ensure fetchTreeNodes is called in handleTreeClick and toggleOUExpansion and handleRowDoubleClick
tree_click_pattern = re.compile(r"  const handleTreeClick = \(dn: string\) => \{\n    setSelectedOUDn\(dn\);\n    setSelectedRowIndex\(null\);\n  \};\n")
tree_click_repl = """  const handleTreeClick = (dn: string) => {
    setSelectedOUDn(dn);
    setSelectedRowIndex(null);
    fetchTreeNodes(dn, true); // fetch real data
  };\n"""
content = tree_click_pattern.sub(tree_click_repl, content)

toggle_pattern = re.compile(r"  const toggleOUExpansion = \(e: React.MouseEvent, dn: string\) => \{\n    e.stopPropagation\(\);\n    setExpandedOUs\(prev => \(\{\n      \.\.\.prev,\n      \[dn\]: !prev\[dn\]\n    \}\)\);\n  \};\n")
toggle_repl = """  const toggleOUExpansion = (e: React.MouseEvent, dn: string) => {
    e.stopPropagation();
    
    setExpandedOUs(prev => {
      const isCurrentlyExpanded = prev[dn];
      if (!isCurrentlyExpanded) {
        fetchTreeNodes(dn, false);
      }
      return {
        ...prev,
        [dn]: !isCurrentlyExpanded
      };
    });
  };\n"""
content = toggle_pattern.sub(toggle_repl, content)

double_click_pattern = re.compile(
    r"  // Trigger double click dialog popup\n  const handleRowDoubleClick = \(obj: ADObject\) => \{.*?\n  \};\n",
    re.DOTALL
)
double_click_repl = """  // Trigger double click dialog popup
  const handleRowDoubleClick = async (obj: ADObject) => {
    if (obj.type === 'ou' || obj.type === 'container') {
      setSelectedOUDn(obj.dn);
      setSelectedRowIndex(null);
      
      // Dynamic Navigation: Calculate all parent paths up to the root
      const parts = obj.dn.split(',');
      const parentsToExpand: Record<string, boolean> = {};
      let currentPath = '';
      
      for (let i = parts.length - 1; i >= 0; i--) {
        if (currentPath === '') {
          currentPath = parts[i];
        } else {
          currentPath = `${parts[i]},${currentPath}`;
        }
        parentsToExpand[currentPath] = true;
      }

      setExpandedOUs(prev => ({
        ...prev,
        ...parentsToExpand
      }));

      // Fetch the actual sub-OU data from backend
      fetchTreeNodes(obj.dn, true);
    } else {
      // Async fetch for actual object properties
      try {
        const res = await fetch(`http://localhost:8000/api/v1/user/ad/details?dn=${encodeURIComponent(obj.dn)}`);
        if (res.ok) {
          const details = await res.json();
          const fullObj: ADObject = {
            ...obj,
            description: details.description || obj.description,
            givenName: details.name.split(' ')[0] || obj.givenName,
            sn: details.name.split(' ').slice(1).join(' ') || obj.sn,
            displayName: details.name || obj.displayName,
            sAMAccountName: details.uid || obj.sAMAccountName,
            userPrincipalName: `${details.uid}@aapico.com`,
            mail: details.email || obj.mail,
            title: details.title || obj.title,
            department: details.dept || obj.department,
            company: details.company || obj.company,
            physicalDeliveryOfficeName: details.office || obj.physicalDeliveryOfficeName,
            telephoneNumber: details.mobile || obj.telephoneNumber,
            streetAddress: details.street || obj.streetAddress,
            l: details.city || obj.l,
            st: details.state || obj.st,
            postalCode: details.zipCode || obj.postalCode,
            co: details.country || obj.co,
            manager: details.manager || obj.manager,
            employeeID: details.printCode || obj.employeeID,
            pwdNeverExpires: details.status === 'Active' ? true : false,
            acctDisabled: details.status === 'Disabled',
          };
          setActivePropertyObject(fullObj);
        } else {
          setActivePropertyObject({ ...obj });
        }
      } catch (e) {
         console.error(e);
         setActivePropertyObject({ ...obj });
      }
      setActiveModalTab('general');
      setIsPropertiesOpen(true);
    }
  };\n"""
content = double_click_pattern.sub(double_click_repl, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied.")
