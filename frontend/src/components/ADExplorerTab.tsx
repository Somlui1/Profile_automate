/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DirectoryUser } from '../types';
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
  Compass
} from 'lucide-react';

interface ADExplorerTabProps {
  users: DirectoryUser[];
  config: React.ComponentState;
}

// Full directory AD Object interface modeling real LDAP / ADUC schemas
interface ADObject {
  name: string;
  type: 'user' | 'group' | 'computer' | 'ou';
  description: string;
  dn: string;
  parentDn: string; // The parent OU path

  // Tab 1: General
  givenName?: string;
  initials?: string;
  sn?: string;
  displayName?: string;
  physicalDeliveryOfficeName?: string;
  telephoneNumber?: string;
  otherTelephone?: string;
  mail?: string;
  wWWHomePage?: string;

  // Tab 2: Address
  streetAddress?: string;
  postOfficeBox?: string;
  l?: string; // City
  st?: string; // State/Province
  postalCode?: string;
  co?: string; // Country

  // Tab 3: Account
  userPrincipalName?: string;
  sAMAccountName?: string;
  userWorkstations?: string;
  userAccountControl?: number; // 512, 66048, etc
  accountExpires?: string; // date or "Never"
  pwdLastSet?: string;
  logonHours?: string;
  pwdNeverExpires?: boolean;
  acctDisabled?: boolean;
  mustChangePwd?: boolean;
  cannotChangePwd?: boolean;

  // Tab 4: Profile
  profilePath?: string;
  scriptPath?: string;
  homeDirectory?: string;
  homeDrive?: string;

  // Tab 5: Telephones & Notes
  homePhone?: string;
  pager?: string;
  mobile?: string;
  facsimileTelephoneNumber?: string;
  ipPhone?: string;
  comment?: string; // Personal Notes

  // Tab 6: Organization
  title?: string;
  department?: string;
  company?: string;
  manager?: string;

  // Tab 7: Member Of
  memberOf?: string[];

  // Tab 8: Built-in schema custom extensions attributes 1-15
  employeeID?: string;
  employeeType?: string;
  mailNickname?: string;
  extensionAttributes?: Record<string, string>;
}

// Tree structure model for Left Console Tree Sidebar representation
interface TreeContainer {
  dn: string;
  name: string;
  type: 'domain' | 'ou' | 'container';
  children: TreeContainer[];
  has_children: boolean;
}

export const ADExplorerTab: React.FC<ADExplorerTabProps> = ({ users = [], config }) => {
  // State for all domain objects (Dynamic array syncing users list with customized Computers/Groups mock nodes)
  const [adObjects, setAdObjects] = useState<ADObject[]>([]);

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
  const [activeModalTab, setActiveModalTab] = useState<string>('general');

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
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Initialize all AD objects, mapping users + creating complete default structure
  useEffect(() => {
    // 1. Build list from DirectoryUsers
    const mappedUsers: ADObject[] = users.map(user => {
      // Clean target OU fallback
      let rawOu = user.ou || "OU=IT,OU=AH,DC=aapico,DC=com";
      const names = user.name.split(' ');
      const givenName = names[0] || user.name;
      const sn = names.slice(1).join(' ') || '';

      const sam = user.uid;
      const attributes: Record<string, string> = {};
      for (let i = 1; i <= 15; i++) {
        if (i === 1) attributes[`extensionAttribute${i}`] = user.printCode || '99999999';
        else if (i === 2) attributes[`extensionAttribute${i}`] = user.dept || '';
        else if (i === 3) attributes[`extensionAttribute${i}`] = user.company || 'AH';
        else attributes[`extensionAttribute${i}`] = '';
      }

      return {
        name: user.name,
        type: 'user',
        description: user.description || `${user.printCode || '99999999'} (AH Active Session)`,
        dn: `CN=${user.name},${rawOu}`,
        parentDn: rawOu,

        givenName,
        initials: givenName[0] + (sn ? sn[0] : ''),
        sn,
        displayName: user.name,
        physicalDeliveryOfficeName: user.office || "AH_Test_Lab",
        telephoneNumber: user.mobile || "035-350880 ext.9999",
        otherTelephone: "02-123-4567 ext.1",
        mail: user.email,
        wWWHomePage: "https://www.aapico.com",

        streetAddress: user.street || "99/9 Active Directory Validation Road",
        postOfficeBox: "BOX-999",
        l: user.city || "Bang pa-in",
        st: user.state || "Phranakhon Sri Ayutthaya",
        postalCode: user.zipCode || "13160",
        co: user.country || "Thailand",

        userPrincipalName: `${sam}@aapico.com`,
        sAMAccountName: sam,
        userWorkstations: "All Computers",
        userAccountControl: user.status === 'Active' ? 66048 : 66050,
        accountExpires: "Never",
        pwdLastSet: "2026-06-18 08:32:15",
        logonHours: "Permitted (All Hours)",
        pwdNeverExpires: true,
        acctDisabled: user.status !== 'Active',
        mustChangePwd: sam === 'aduc.test',
        cannotChangePwd: false,

        profilePath: user.street ? "" : `\\\\aapico-srv\\profiles\\${sam}`,
        scriptPath: "IT_AH_TEST.bat",
        homeDirectory: user.street ? "" : `\\\\aapico-srv\\home\\${sam}`,
        homeDrive: user.street ? "" : "H:",

        homePhone: "02-000-0000",
        pager: "",
        mobile: user.mobile || "089-999-9999",
        facsimileTelephoneNumber: "",
        ipPhone: "9999",
        comment: "SYSTEM REAL-TIME PROFILE: Synced verified mapping with Python ADUC configurations.",

        title: user.title || "Staff Member",
        department: user.dept || "Automation Control Department",
        company: user.company || "AH",
        manager: user.manager || "Witthaya Treeklee",

        memberOf: sam === 'aduc.test' ? [
          'AH IT',
          'CL200',
          'AAPICO Group VPN',
          'AH IT Infrastructure',
          'AAPICO Social App',
          'AAPICO Allow USB',
          'User_LevelB (AH)'
        ] : [
          'Domain Users',
          'AAPICO Group VPN',
          user.dept === 'Information Technology' ? 'AH IT Infrastructure' : 'Regional Users_LevelB'
        ],

        employeeID: user.printCode || "99999999",
        employeeType: sam === 'aduc.test' ? 'Test-Account' : 'Regular-Staff',
        mailNickname: sam,
        extensionAttributes: attributes
      };
    });

    // 2. Insert standard AD builtin, system computers, and security group items to form standard complete schemas
    const systemObjects: ADObject[] = [
      // Domain Controllers & computers
      {
        name: 'SRV-AD01',
        type: 'computer',
        description: 'Primary Active Directory Domain Controller (aapico.com)',
        dn: 'CN=SRV-AD01,CN=Computers,DC=aapico,DC=com',
        parentDn: 'CN=Computers,DC=aapico,DC=com',
        comment: 'Handles Kerberos token validation and LDAPS security mappings.',
        title: 'Primary Domain Controller',
        company: 'AH',
        memberOf: ['Domain Controllers']
      },
      {
        name: 'SRV-APP-PAPER',
        type: 'computer',
        description: 'AAPICO PaperCut Print Allocation Server',
        dn: 'CN=SRV-APP-PAPER,CN=Computers,DC=aapico,DC=com',
        parentDn: 'CN=Computers,DC=aapico,DC=com',
        comment: 'Runs PaperCut dynamic sync pipelines.',
        title: 'Print Server Host',
        company: 'AH',
        memberOf: ['Print Servers']
      },
      {
        name: 'AH-BKK-LPT-101',
        type: 'computer',
        description: 'QA Automation Lab Host Computer',
        dn: 'CN=AH-BKK-LPT-101,CN=Computers,DC=aapico,DC=com',
        parentDn: 'CN=Computers,DC=aapico,DC=com',
        comment: 'Validation testing laptop workstation client.',
        title: 'Workstation Account',
        company: 'AH'
      },

      // Security Groups
      {
        name: 'Domain Admins',
        type: 'group',
        description: 'Designated administrative staff of the domain',
        dn: 'CN=Domain Admins,CN=Users,DC=aapico,DC=com',
        parentDn: 'CN=Users,DC=aapico,DC=com',
        comment: 'Built-in active global directory control.',
        memberOf: ['Administrators']
      },
      {
        name: 'Domain Users',
        type: 'group',
        description: 'All system and corporate enterprise personnel',
        dn: 'CN=Domain Users,CN=Users,DC=aapico,DC=com',
        parentDn: 'CN=Users,DC=aapico,DC=com',
        comment: 'Default group container rules standard.',
        memberOf: ['Users']
      },
      {
        name: 'AAPICO Allow USB',
        type: 'group',
        description: 'Security Group permitting local storage access via USB drivers',
        dn: 'CN=AAPICO Allow USB,OU=Security Groups,DC=aapico,DC=com',
        parentDn: 'OU=Security Groups,DC=aapico,DC=com',
        comment: 'Active Group Policy target list filter.',
        memberOf: ['Domain Users']
      },
      {
        name: 'AH IT Infrastructure',
        type: 'group',
        description: 'IT Systems administration and verification support staff',
        dn: 'CN=AH IT Infrastructure,OU=Security Groups,DC=aapico,DC=com',
        parentDn: 'OU=Security Groups,DC=aapico,DC=com',
        comment: 'Access to infrastructure management consoles.',
        memberOf: ['Domain Users']
      },
      {
        name: 'Administrator',
        type: 'user',
        description: 'Built-in administrator account for the computer/domain',
        dn: 'CN=Administrator,CN=Users,DC=aapico,DC=com',
        parentDn: 'CN=Users,DC=aapico,DC=com',
        givenName: 'Built-in',
        sn: 'Admin',
        displayName: 'Administrator (System)',
        sAMAccountName: 'Administrator',
        userPrincipalName: 'administrator@aapico.com',
        userAccountControl: 512,
        pwdNeverExpires: true,
        memberOf: ['Administrators', 'Domain Admins'],
        comment: 'Emergency domain-level access bypass account.'
      },
      {
        name: 'Guest',
        type: 'user',
        description: 'Built-in guest account for temporary guest clients (Disabled)',
        dn: 'CN=Guest,CN=Users,DC=aapico,DC=com',
        parentDn: 'CN=Users,DC=aapico,DC=com',
        givenName: 'Guest',
        sn: 'User',
        displayName: 'Guest System Client',
        sAMAccountName: 'Guest',
        userPrincipalName: 'guest@aapico.com',
        userAccountControl: 514, // Disabled
        pwdNeverExpires: true,
        acctDisabled: true,
        memberOf: ['Guests'],
        comment: 'Standard guest system profile.'
      }
    ];

    setAdObjects([...mappedUsers, ...systemObjects]);
  }, [users]);

  // Recursively reconstruct OU Tree based on parsed OUs of users in user objects list
  const getConsoleTree = (): TreeContainer => {
    // 1. Core Base map
    const nodes: Record<string, TreeContainer> = {
      'DC=aapico,DC=com': {
        dn: 'DC=aapico,DC=com',
        name: 'aapico.com',
        type: 'domain',
        children: [],
        has_children: true
      },
      'CN=Builtin,DC=aapico,DC=com': {
        dn: 'CN=Builtin,DC=aapico,DC=com',
        name: 'Builtin',
        type: 'container',
        children: [],
        has_children: false
      },
      'CN=Computers,DC=aapico,DC=com': {
        dn: 'CN=Computers,DC=aapico,DC=com',
        name: 'Computers',
        type: 'container',
        children: [],
        has_children: false
      },
      'CN=Users,DC=aapico,DC=com': {
        dn: 'CN=Users,DC=aapico,DC=com',
        name: 'Users',
        type: 'container',
        children: [],
        has_children: false
      },
      'OU=Security Groups,DC=aapico,DC=com': {
        dn: 'OU=Security Groups,DC=aapico,DC=com',
        name: 'Security Groups',
        type: 'ou',
        children: [],
        has_children: false
      }
    };

    // Build hierarchical branches based on standard OUs mapped dynamically
    adObjects.forEach(obj => {
      if (!obj.parentDn) return;
      const parts = obj.parentDn.split(',');

      let activeParent = 'DC=aapico,DC=com';
      const ouParts = parts.filter(p => !p.startsWith('DC=')).reverse();

      ouParts.forEach(part => {
        const fullPath = `${part},${activeParent}`;
        const cleanName = part.split('=')[1] || part;

        if (!nodes[fullPath]) {
          nodes[fullPath] = {
            dn: fullPath,
            name: cleanName,
            type: part.startsWith('OU=') ? 'ou' : 'container',
            children: [],
            has_children: false
          };

          if (nodes[activeParent]) {
            nodes[activeParent].children.push(nodes[fullPath]);
            nodes[activeParent].has_children = true;
          }
        }
        activeParent = fullPath;
      });
    });

    // Make sure default domains direct sub-OUs are placed if missing
    const root = nodes['DC=aapico,DC=com'];
    ['CN=Builtin,DC=aapico,DC=com', 'CN=Computers,DC=aapico,DC=com', 'CN=Users,DC=aapico,DC=com', 'OU=Security Groups,DC=aapico,DC=com'].forEach(defPath => {
      const child = nodes[defPath];
      if (child && !root.children.some(c => c.dn === defPath)) {
        root.children.push(child);
      }
    });

    return root;
  };

  const domainRoot = getConsoleTree();

  // Find all objects matching the selected OU/Container
  const getCurrentOUObjects = (): ADObject[] => {
    return adObjects.filter(obj => {
      const matchOU = obj.parentDn.toLowerCase().trim() === selectedOUDn.toLowerCase().trim();

      if (!matchOU) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return obj.name.toLowerCase().includes(query) ||
          obj.type.toLowerCase().includes(query) ||
          obj.description.toLowerCase().includes(query);
      }
      return true;
    });
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
  const handleRowDoubleClick = (obj: ADObject) => {
    setActivePropertyObject({ ...obj });
    setActiveModalTab('general');
    setIsPropertiesOpen(true);
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
        setAdObjects(prev => prev.filter(o => o.dn !== target.dn));
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
    setAdObjects(prev => prev.map(o => {
      if (o.dn.toLowerCase() === activePropertyObject.dn.toLowerCase()) {
        return { ...activePropertyObject };
      }
      return o;
    }));
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

      setAdObjects(prev => [created, ...prev]);
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

  // Convert current state into a perfect copyable python dictionary block
  const generatePythonPropString = (obj: ADObject): string => {
    const isAducTest = obj.sAMAccountName === 'aduc.test';

    // Model exactly the python schema as in user files
    return `properties = {
    # 1. General Tab (หน้าแรกของ ADUC)
    'first_name': '${obj.givenName || ''}',
    'last_name': '${obj.sn || ''}',
    'display_name': '${obj.displayName || ''}',
    'description': '${obj.description || ''}',
    'office': '${obj.physicalDeliveryOfficeName || 'AH_Test_Lab'}',
    'telephone_number': '${obj.telephoneNumber || '035-350880 ext.9999'}',
    'other_telephone': [],  
    'email': '${obj.mail || ''}',
    'web_page': '${obj.wWWHomePage || 'https://www.aapico.com'}',

    # 2. Address Tab (หน้าต่างที่อยู่)
    'street': '${obj.streetAddress || '99/9 Active Directory Validation Road'}',
    'post_office_box': '${obj.postOfficeBox || 'BOX-999'}',
    'city': '${obj.l || 'Bang pa-in'}',
    'state_province': '${obj.st || 'Phranakhon Sri Ayutthaya'}',
    'zip_postal_code': '${obj.postalCode || '13160'}',
    'country_region': '${obj.co || 'Thailand'}',

    # 3. Account Tab (หน้าตั้งค่าบัญชีและ User Account Control)
    'user_principal_name': '${obj.userPrincipalName || ''}',
    'user_workstations': ${obj.userWorkstations === "All Computers" ? 'None' : `'${obj.userWorkstations}'`},  
    'password_never_expires': ${obj.pwdNeverExpires ? 'True' : 'False'},
    'account_disabled': ${obj.acctDisabled ? 'True' : 'False'},
    'smartcard_required': False,
    'change_password_next_logon': ${obj.mustChangePwd ? 'True' : 'False'},

    # 4. Profile Tab (หน้าต่างกำหนดสคริปต์และโฮมไดรฟ์)
    'profile_path': '${obj.profilePath || ''}',
    'logon_script': '${obj.scriptPath || 'IT_AH_TEST.bat'}',
    'home_directory': '${obj.homeDirectory || ''}',
    'home_drive': '${obj.homeDrive || ''}',

    # 5. Telephones Tab (หน้าต่างเบอร์โทรศัพท์เสริมและโน้ตภายใน)
    'home_phone': '${obj.homePhone || '02-000-0000'}',
    'pager': '${obj.pager || ''}',
    'mobile': '${obj.mobile || '089-999-9999'}',
    'fax': '${obj.facsimileTelephoneNumber || ''}',
    'ip_phone': '${obj.ipPhone || '9999'}',
    'notes': '${obj.comment || ''}',

    # 6. Organization Tab (หน้าต่างโครงสร้างองค์กรและหัวหน้างาน)
    'title': '${obj.title || ''}',  
    'department': '${obj.department || ''}',
    'company': '${obj.company || 'AH'}',
    'manager': '${obj.manager || 'Witthaya Treeklee'}', 

    # 7. Member Of (หน้าต่างกลุ่มความปลอดภัย)
    'groups': [
        ${(obj.memberOf || []).map(g => `'${g}'`).join(',\n        ')}
    ],

    # 8. Attribute Editor Tab (ตรวจสอบฟิลด์ระดับ Schema หลังบ้าน)
    'employee_id': '${obj.employeeID || ''}',
    'employee_type': '${obj.employeeType || ''}',
    'mail_nickname': '${obj.mailNickname || ''}'
}`;
  };

  // Helper copy block
  const handleCopyPythonBlock = (obj: ADObject) => {
    const code = generatePythonPropString(obj);
    navigator.clipboard.writeText(code);
    setCopyCodeSuccess(true);
    setTimeout(() => setCopyCodeSuccess(false), 2000);
  };

  // Recursive tree view rendering for left sidebar (OUs/Containers)
  const renderConsoleTreeNode = (node: TreeContainer, depth = 0): React.ReactNode => {
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
        {node.has_children && isExpanded && node.children.length > 0 && (
          <div className="relative mt-0.5">
            {/* Retro classic dotted line representation */}
            <div
              className="absolute top-0 bottom-2.5 w-px border-l border-dashed border-slate-300 left-[15px]"
              style={{ paddingLeft: `${depth * 14}px` }}
            />
            {node.children.map(child => renderConsoleTreeNode(child, depth + 1))}
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
            disabled={selectedRowIndex === null}
            className={`px-2 py-1 border rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${selectedRowIndex !== null
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
            {renderConsoleTreeNode(domainRoot)}
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
      {isPropertiesOpen && activePropertyObject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto select-none select-none">

          <div className="bg-[#f0f0ee] border-2 border-[#d4d0c8] rounded shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden text-[#000] text-xs">

            {/* Dialog Blue Title Bar */}
            <div className="bg-gradient-to-r from-[#0a246a] to-[#a6c8f0] text-white px-3 py-1.5 flex justify-between items-center select-none shrink-0 font-medium">
              <span className="font-bold font-sans">
                {activePropertyObject.name} Properties
              </span>
              <button
                onClick={() => setIsPropertiesOpen(false)}
                className="w-4 h-4 rounded-sm bg-red-600 border border-red-500 flex items-center justify-center text-[10px] font-bold text-white hover:bg-red-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* General selected object profile summary card */}
            <div className="bg-white p-3 border-b border-[#cbcbcb] flex gap-3.5 items-center select-none font-sans">
              <div className="w-10 h-10 rounded bg-[#e3ecf5] text-[#3b72ab] border border-[#a2c2e0] flex items-center justify-center font-bold text-lg font-mono">
                {activePropertyObject.type === 'user' ? 'U' : activePropertyObject.type === 'group' ? 'G' : 'C'}
              </div>
              <div>
                <h3 className="font-extrabold text-[#000] text-xs leading-none">{activePropertyObject.name}</h3>
                <p className="text-[10px] text-slate-500 mt-1.5 font-mono select-all break-all">
                  DN: {activePropertyObject.dn}
                </p>
              </div>
            </div>

            {/* ADUC Tabs Selector Row */}
            <div className="bg-[#f0f0ee] border-b border-[#b5b2ad] flex flex-wrap gap-0.5 px-3 pt-2.5 overflow-x-auto select-none">
              {[
                { key: 'general', label: 'General' },
                { key: 'address', label: 'Address' },
                { key: 'account', label: 'Account' },
                { key: 'profile', label: 'Profile' },
                { key: 'telephones', label: 'Telephones' },
                { key: 'organization', label: 'Organization' },
                { key: 'memberof', label: 'Member Of' },
                { key: 'attribute', label: 'Attribute Editor' },
                { key: 'python', label: 'Python Payload Code (Direct Copy)' }
              ].map(tab => {
                const isActive = activeModalTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveModalTab(tab.key)}
                    className={`px-3 py-1.5 text-xs border rounded-t transition-all cursor-pointer font-sans font-bold select-none ${isActive
                      ? 'bg-white border-[#b5b2ad] border-b-transparent text-[#001f56] translate-y-[1px] relative z-10'
                      : 'bg-[#e4e4e4] border-transparent text-slate-600 hover:text-black hover:bg-[#e8e8e8]'
                      }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tabs content Canvas with Compact Forms */}
            <div className="bg-white p-5 m-2.5 border border-[#b5b2ad] shadow-inner flex-grow overflow-y-auto max-h-[420px] text-slate-800 font-sans select-all">

              {/* TAB 1: General */}
              {activeModalTab === 'general' && (
                <div className="space-y-3 font-sans">
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">First Name (givenName)</span>
                    <input
                      type="text"
                      value={activePropertyObject.givenName || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Initials (initials)</span>
                    <input
                      type="text"
                      value={activePropertyObject.initials || ''}
                      readOnly
                      className="p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors max-w-[80px]"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Last Name (sn)</span>
                    <input
                      type="text"
                      value={activePropertyObject.sn || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Display Name (displayName)</span>
                    <input
                      type="text"
                      value={activePropertyObject.displayName || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Description (description)</span>
                    <input
                      type="text"
                      value={activePropertyObject.description || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Office Location (physicalDeliveryOfficeName)</span>
                    <input
                      type="text"
                      value={activePropertyObject.physicalDeliveryOfficeName || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Telephone Number (telephoneNumber)</span>
                    <input
                      type="text"
                      value={activePropertyObject.telephoneNumber || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Email Address (mail)</span>
                    <input
                      type="text"
                      value={activePropertyObject.mail || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Address */}
              {activeModalTab === 'address' && (
                <div className="space-y-3 font-sans">
                  <div className="grid grid-cols-3 gap-2 items-start mt-1">
                    <span className="font-bold text-slate-600 text-right pr-2 pt-1">Street (streetAddress)</span>
                    <textarea
                      rows={2}
                      value={activePropertyObject.streetAddress || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors resize-none"
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">P.O. Box (postOfficeBox)</span>
                    <input
                      type="text"
                      value={activePropertyObject.postOfficeBox || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">City (l)</span>
                    <input
                      type="text"
                      value={activePropertyObject.l || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">State/Province (st)</span>
                    <input
                      type="text"
                      value={activePropertyObject.st || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Zip/Postal Code (postalCode)</span>
                    <input
                      type="text"
                      value={activePropertyObject.postalCode || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Country/Region (co)</span>
                    <input
                      type="text"
                      value={activePropertyObject.co || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: Account */}
              {activeModalTab === 'account' && (
                <div className="space-y-4 font-sans select-none">

                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">User logon name (UPN)</span>
                    <div className="col-span-2 flex items-center">
                      <input
                        type="text"
                        value={activePropertyObject.sAMAccountName || ''}
                        readOnly
                        className="p-1.5 border border-slate-200 bg-slate-50 text-slate-700 rounded-l outline-none select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors max-w-sm flex-grow"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <span className="bg-slate-100 border border-l-0 border-slate-200 p-1.5 text-xs rounded-r select-none font-semibold text-slate-500 font-mono">
                        @aapico.com
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Logon name (pre-Win2000)</span>
                    <input
                      type="text"
                      value={`AAPICO\\${activePropertyObject.sAMAccountName || ''}`}
                      readOnly
                      className="p-1.5 border border-slate-200 bg-slate-50 text-slate-700 rounded outline-none select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                  </div>

                  <div className="border border-slate-200 bg-slate-50/60 p-3 rounded-lg space-y-2.5">
                    <span className="text-[10px] uppercase font-black tracking-widest text-[#3b72ab] block border-b pb-1">
                      Account Operations Options
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">

                      <label className="flex items-center gap-2 cursor-pointer opacity-75">
                        <input
                          type="checkbox"
                          checked={activePropertyObject.mustChangePwd === true}
                          disabled
                          className="h-4 w-4 border-slate-300 rounded text-[#3b72ab] cursor-not-allowed"
                        />
                        <span className={activePropertyObject.mustChangePwd ? "font-bold text-[#0a246a]" : "text-slate-600"}>
                          User must change password
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer opacity-75">
                        <input
                          type="checkbox"
                          checked={activePropertyObject.cannotChangePwd === true}
                          disabled
                          className="h-4 w-4 border-slate-300 rounded text-[#3b72ab] cursor-not-allowed"
                        />
                        <span className="text-slate-600">User cannot change password</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer opacity-75">
                        <input
                          type="checkbox"
                          checked={activePropertyObject.pwdNeverExpires === true}
                          disabled
                          className="h-4 w-4 border-slate-300 rounded text-[#3b72ab] cursor-not-allowed"
                        />
                        <span className={activePropertyObject.pwdNeverExpires ? "font-bold text-[#0a246a]" : "text-slate-600"}>
                          Password never expires
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer opacity-75">
                        <input
                          type="checkbox"
                          checked={activePropertyObject.acctDisabled === true}
                          disabled
                          className="h-4 w-4 border-slate-300 rounded text-[#3b72ab] cursor-not-allowed"
                        />
                        <span className={activePropertyObject.acctDisabled ? "font-bold text-red-700" : "text-slate-600"}>
                          Account is disabled
                        </span>
                      </label>

                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-center mt-3">
                    <span className="font-bold text-slate-600 text-right pr-2">Account expires:</span>
                    <input
                      type="text"
                      value={activePropertyObject.accountExpires || 'Never'}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                  </div>

                </div>
              )}

              {/* TAB 4: Profile */}
              {activeModalTab === 'profile' && (
                <div className="space-y-4 font-sans focus:ring-1">
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Profile path:</span>
                    <input
                      type="text"
                      value={activePropertyObject.profilePath || 'Not Set'}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 rounded bg-slate-50 font-mono text-xs select-all text-[#001f56] outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Logon script:</span>
                    <input
                      type="text"
                      value={activePropertyObject.scriptPath || 'Not Set'}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 rounded bg-slate-50 font-mono text-xs select-all text-[#001f56] outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>

                  <div className="border border-slate-200 p-4 rounded-lg bg-slate-50/50 space-y-4">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block border-b pb-1 select-none">
                      Home Folder Mapping
                    </span>
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <span className="font-bold text-slate-600 text-right pr-2 select-none">Connect Drive:</span>
                      <div className="col-span-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={activePropertyObject.homeDrive || 'None'}
                          readOnly
                          className="p-1 border border-slate-200 rounded bg-slate-100 text-xs w-16 text-center select-all font-mono outline-none"
                        />
                        <span className="text-slate-500 font-semibold select-none">To :</span>
                        <input
                          type="text"
                          value={activePropertyObject.homeDirectory || 'Not Set'}
                          readOnly
                          className="p-1 border border-slate-200 rounded bg-slate-50 font-mono text-xs max-w-sm flex-grow text-[#001f56] outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          title="Click to copy attribute"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Telephones */}
              {activeModalTab === 'telephones' && (
                <div className="space-y-3 font-sans">
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Home (homePhone)</span>
                    <input
                      type="text"
                      value={activePropertyObject.homePhone || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Pager (pager)</span>
                    <input
                      type="text"
                      value={activePropertyObject.pager || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Mobile (mobile)</span>
                    <input
                      type="text"
                      value={activePropertyObject.mobile || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Fax (facsimileTelephoneNumber)</span>
                    <input
                      type="text"
                      value={activePropertyObject.facsimileTelephoneNumber || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">IP Phone (ipPhone)</span>
                    <input
                      type="text"
                      value={activePropertyObject.ipPhone || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-start">
                    <span className="font-bold text-slate-600 text-right pr-2 pt-1">Notes (comment)</span>
                    <textarea
                      rows={3}
                      value={activePropertyObject.comment || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors resize-none"
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                </div>
              )}

              {/* TAB 6: Organization */}
              {activeModalTab === 'organization' && (
                <div className="space-y-3 font-sans">
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Job Title (title)</span>
                    <input
                      type="text"
                      value={activePropertyObject.title || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Department (department)</span>
                    <input
                      type="text"
                      value={activePropertyObject.department || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-650 text-right pr-2">Company (company)</span>
                    <input
                      type="text"
                      value={activePropertyObject.company || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="font-bold text-slate-600 text-right pr-2">Direct Manager DN (manager)</span>
                    <input
                      type="text"
                      value={activePropertyObject.manager || ''}
                      readOnly
                      className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to copy attribute"
                    />
                  </div>
                </div>
              )}

              {/* TAB 7: Member Of */}
              {activeModalTab === 'memberof' && (
                <div className="space-y-4 font-sans select-none">
                  <h4 className="text-xs font-bold text-slate-600 border-b pb-2">
                    Security Group Memberships Checklists:
                  </h4>
                  <div className="space-y-1.5">
                    {(activePropertyObject.memberOf || []).map((grp, sIdx) => (
                      <div
                        key={sIdx}
                        className="p-2.5 border border-slate-250 bg-slate-50 rounded-md flex justify-between items-center"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="font-bold text-[#001f56] select-all">{grp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 8: Attribute Editor */}
              {activeModalTab === 'attribute' && (
                <div className="space-y-3 font-sans">

                  <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-[11px] text-slate-500 font-medium">
                    Raw database columns / Schema dictionary mapping for backend queries (Including extensionAttribute 1-15):
                  </div>

                  <div className="border border-slate-200 rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#f0f0ee] border-b border-[#cbcbcb] text-slate-600 sticky top-0">
                        <tr>
                          <th className="p-2 border-r border-slate-200">Attribute Name</th>
                          <th className="p-2 border-r border-slate-200">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {/* Map common variables */}
                        {[
                          { key: 'employeeID', val: activePropertyObject.employeeID || 'Not Set' },
                          { key: 'employeeType', val: activePropertyObject.employeeType || 'Not Set' },
                          { key: 'mailNickname', val: activePropertyObject.mailNickname || 'Not Set' },
                          { key: 'sAMAccountName', val: activePropertyObject.sAMAccountName || 'Not Set' },
                          { key: 'userPrincipalName', val: activePropertyObject.userPrincipalName || 'Not Set' },
                          { key: 'givenName', val: activePropertyObject.givenName || 'Not Set' },
                          { key: 'sn', val: activePropertyObject.sn || 'Not Set' },
                          { key: 'displayName', val: activePropertyObject.displayName || 'Not Set' },
                          { key: 'mail', val: activePropertyObject.mail || 'Not Set' },
                          { key: 'telephoneNumber', val: activePropertyObject.telephoneNumber || 'Not Set' },
                          { key: 'physicalDeliveryOfficeName', val: activePropertyObject.physicalDeliveryOfficeName || 'Not Set' }
                        ].map((ea, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 font-mono text-[11px]">
                            <td className="p-2 font-bold text-slate-500 border-r">{ea.key}</td>
                            <td className="p-2 text-slate-800 select-all pr-5 truncate max-w-xs" title={ea.val}>{ea.val}</td>
                          </tr>
                        ))}

                        {/* extensions mappings */}
                        {Array.from({ length: 15 }, (_, i) => {
                          const attrName = `extensionAttribute${i + 1}`;
                          let val = "Not Set";
                          if (activePropertyObject.extensionAttributes && activePropertyObject.extensionAttributes[attrName]) {
                            val = activePropertyObject.extensionAttributes[attrName];
                          } else if (i === 0 && activePropertyObject.employeeID) {
                            val = activePropertyObject.employeeID;
                          } else if (i === 1 && activePropertyObject.department) {
                            val = activePropertyObject.department;
                          } else if (i === 2 && activePropertyObject.company) {
                            val = activePropertyObject.company;
                          }

                          return (
                            <tr key={attrName} className="hover:bg-slate-50 font-mono text-[11px]">
                              <td className="p-2 font-bold text-slate-500 border-r">{attrName}</td>
                              <td className="p-2 text-[#0a246a] font-bold select-all pr-5">{val}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

              {/* TAB 9: PYTHON PYLOAD GENERATOR */}
              {activeModalTab === 'python' && (
                <div className="space-y-4 font-sans select-all">
                  <div className="flex justify-between items-center bg-slate-100 p-2 border rounded-md">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      Python LDAP ldap3 Object attributes payload mapping
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyPythonBlock(activePropertyObject)}
                      className={`px-3 py-1 text-xs font-bold rounded shadow-3xs cursor-pointer select-none transition-all flex items-center gap-1 ${copyCodeSuccess
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700'
                        }`}
                    >
                      {copyCodeSuccess ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copyCodeSuccess ? "Copied python dictionary!" : "Copy Payload Block"}</span>
                    </button>
                  </div>

                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed select-all">
                    {generatePythonPropString(activePropertyObject)}
                  </pre>

                </div>
              )}

            </div>

            {/* Dialog Action Buttons */}
            <div className="bg-[#f0f0ee] p-3 border-t border-[#d4d0c8] flex justify-end gap-2 shrink-0 select-none">
              <button
                type="button"
                onClick={() => setIsPropertiesOpen(false)}
                className="px-5 py-1 bg-white hover:bg-slate-100 border-2 border-slate-400 text-xs font-bold font-sans rounded-md text-[#000] cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
