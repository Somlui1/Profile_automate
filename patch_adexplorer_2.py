import re

file_path = 'frontend/src/components/ADExplorerTab.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace handleTreeClick and toggleOUExpansion
tree_actions_pattern = re.compile(r"  // Left click Tree folder nodes to open\n  const handleTreeClick.*?toggleOUExpansion =.*?\}\)\);\n  \};\n", re.DOTALL)
tree_actions_replacement = """  // Left click Tree folder nodes to open
  const handleTreeClick = (dn: string) => {
    setSelectedOUDn(dn);
    setSelectedRowIndex(null);
    fetchTreeNodes(dn, true); // Fetch children and update right panel
  };

  const toggleOUExpansion = (e: React.MouseEvent, dn: string) => {
    e.stopPropagation();
    
    setExpandedOUs(prev => {
      const isCurrentlyExpanded = prev[dn];
      if (!isCurrentlyExpanded) {
        // Fetch children lazily when expanding (don't update right pane)
        fetchTreeNodes(dn, false);
      }
      return {
        ...prev,
        [dn]: !isCurrentlyExpanded
      };
    });
  };
"""
content = tree_actions_pattern.sub(tree_actions_replacement, content)

# Replace handleRowDoubleClick
double_click_pattern = re.compile(r"  // Trigger double click dialog popup\n  const handleRowDoubleClick.*?\}\n", re.DOTALL)
double_click_replacement = """  // Trigger double click dialog popup (Async fetch from AD)
  const handleRowDoubleClick = async (obj: ADObject) => {
    try {
      // Show loading or just wait
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
        setActiveModalTab('general');
        setIsPropertiesOpen(true);
      } else {
        // Fallback to basic obj if fetch fails
        setActivePropertyObject({ ...obj });
        setActiveModalTab('general');
        setIsPropertiesOpen(true);
      }
    } catch (e) {
       console.error("Failed to fetch AD details", e);
       setActivePropertyObject({ ...obj });
       setActiveModalTab('general');
       setIsPropertiesOpen(true);
    }
  };
"""
content = double_click_pattern.sub(double_click_replacement, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch 2 applied.")
