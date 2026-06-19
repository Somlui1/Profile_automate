import re

file_path = 'frontend/src/components/ADExplorerTab.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace State declarations
state_pattern = r"const \[adObjects, setAdObjects\] = useState<ADObject\[\]>\(\[\]\);\n\n  // Selection / Navigation navigation state"
state_replacement = """const [adObjects, setAdObjects] = useState<ADObject[]>([]);
  const [domainRoot, setDomainRoot] = useState<TreeContainer>({
    dn: 'DC=aapico,DC=com',
    name: 'aapico.com',
    type: 'domain',
    children: [],
    has_children: true
  });
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  // Selection / Navigation navigation state"""
content = content.replace(state_pattern, state_replacement)

# Replace useEffect and tree logic (from "useEffect(() => {" to "const currentObjectsList = getCurrentOUObjects();")
tree_logic_pattern = re.compile(
    r"// Initialize all AD objects, mapping users \+ creating complete default structure\n  useEffect\(\(\) => \{.*?(?=\n  // Left click Tree folder nodes to open)",
    re.DOTALL
)

tree_logic_replacement = """// Dynamic Tree Loading from Backend API
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

  // Find all objects matching the selected OU/Container for the right pane
  const getCurrentOUObjects = (): ADObject[] => {
    return adObjects.filter(obj => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return obj.name.toLowerCase().includes(query) ||
          obj.type.toLowerCase().includes(query) ||
          (obj.description && obj.description.toLowerCase().includes(query));
      }
      return true;
    });
  };

  const currentObjectsList = getCurrentOUObjects();
"""

content = tree_logic_pattern.sub(tree_logic_replacement, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied.")
