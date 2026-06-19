import React, { useState, useEffect } from 'react';
import { ADObject } from '../types';
import { User, Users, Monitor, FileText, Check, Copy } from 'lucide-react';

interface ADPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialObject: ADObject | null;
}

export const ADPropertiesModal: React.FC<ADPropertiesModalProps> = ({
  isOpen,
  onClose,
  initialObject
}) => {
  const [activePropertyObject, setActivePropertyObject] = useState<ADObject | null>(initialObject);
  const [activeModalTab, setActiveModalTab] = useState<string>('general');
  const [propertyCache, setPropertyCache] = useState<Record<string, ADObject>>({});
  const [isFetchingDetails, setIsFetchingDetails] = useState<boolean>(false);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);

  // Sync initialObject prop to state and handle fetching details
  useEffect(() => {
    if (isOpen && initialObject) {
      setActiveModalTab('general');
      
      if (propertyCache[initialObject.dn]) {
        setActivePropertyObject(propertyCache[initialObject.dn]);
        return;
      }

      setActivePropertyObject(initialObject);
      setIsFetchingDetails(true);

      const fetchDetails = async () => {
        try {
          const isGroup = initialObject.type === 'group';
          const url = isGroup
            ? `/api/v1/user/ad/group-details?dn=${encodeURIComponent(initialObject.dn)}`
            : `/api/v1/user/ad/details?dn=${encodeURIComponent(initialObject.dn)}`;
            
          const res = await fetch(url);
          if (res.ok) {
            const details = await res.json();
            const fullObj: ADObject = {
              ...initialObject,
              description: details.description || initialObject.description,
              givenName: details.givenName || details.name?.split(' ')[0] || initialObject.givenName,
              initials: details.initials || initialObject.initials,
              sn: details.sn || details.name?.split(' ').slice(1).join(' ') || initialObject.sn,
              displayName: details.displayName || details.name || initialObject.displayName,
              sAMAccountName: details.sAMAccountName || details.uid || initialObject.sAMAccountName,
              userPrincipalName: details.userPrincipalName || `${details.uid}@aapico.com`,
              mail: details.email || initialObject.mail,
              title: details.title || initialObject.title,
              department: details.dept || initialObject.department,
              company: details.company || initialObject.company,
              physicalDeliveryOfficeName: details.office || initialObject.physicalDeliveryOfficeName,
              telephoneNumber: details.telephoneNumber || details.mobile || initialObject.telephoneNumber,
              otherTelephone: details.otherTelephone || initialObject.otherTelephone,
              wWWHomePage: details.wWWHomePage || initialObject.wWWHomePage,
              streetAddress: details.street || initialObject.streetAddress,
              postOfficeBox: details.postOfficeBox || initialObject.postOfficeBox,
              l: details.city || initialObject.l,
              st: details.state || initialObject.st,
              postalCode: details.zipCode || initialObject.postalCode,
              co: details.country || initialObject.co,
              manager: details.manager || initialObject.manager,
              employeeID: details.employeeID || details.printCode || initialObject.employeeID,
              employeeType: details.employeeType || initialObject.employeeType,
              mailNickname: details.mailNickname || initialObject.mailNickname,
              userAccountControl: details.userAccountControl || initialObject.userAccountControl,
              pwdNeverExpires: details.pwdNeverExpires ?? (details.status === 'Active' ? true : false),
              acctDisabled: details.acctDisabled ?? (details.status === 'Disabled'),
              mustChangePwd: details.mustChangePwd ?? initialObject.mustChangePwd,
              accountExpires: details.accountExpires || initialObject.accountExpires,
              pwdLastSet: details.pwdLastSet || initialObject.pwdLastSet,
              logonHours: details.logonHours || initialObject.logonHours,
              profilePath: details.profilePath || initialObject.profilePath,
              scriptPath: details.scriptPath || initialObject.scriptPath,
              homeDirectory: details.homeDirectory || initialObject.homeDirectory,
              homeDrive: details.homeDrive || initialObject.homeDrive,
              homePhone: details.homePhone || initialObject.homePhone,
              pager: details.pager || initialObject.pager,
              mobile: details.mobile || initialObject.mobile,
              facsimileTelephoneNumber: details.facsimileTelephoneNumber || initialObject.facsimileTelephoneNumber,
              ipPhone: details.ipPhone || initialObject.ipPhone,
              comment: details.comment || initialObject.comment,
              memberOf: details.memberOf || initialObject.memberOf,
              extensionAttributes: details.extensionAttributes || initialObject.extensionAttributes,
              groupScope: details.groupScope || initialObject.groupScope,
              groupCategory: details.groupCategory || initialObject.groupCategory,
              members: details.members || initialObject.members,
            };
            setActivePropertyObject(fullObj);
            setPropertyCache(prev => ({ ...prev, [initialObject.dn]: fullObj }));
          } else {
            console.error("Failed to fetch object details:", res.statusText);
          }
        } catch (error) {
          console.error("Error fetching AD details:", error);
        } finally {
          setIsFetchingDetails(false);
        }
      };

      fetchDetails();
    }
  }, [isOpen, initialObject]);

  // Convert current state into a perfect copyable python dictionary block
  const generatePythonPropString = (obj: ADObject): string => {
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

  if (!isOpen || !activePropertyObject) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto select-none select-none">

      <div className="bg-[#f0f0ee] border-2 border-[#d4d0c8] rounded shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden text-[#000] text-xs">

        {/* Dialog Blue Title Bar */}
        <div className="bg-gradient-to-r from-[#0a246a] to-[#a6c8f0] text-white px-3 py-1.5 flex justify-between items-center select-none shrink-0 font-medium">
          <span className="font-bold font-sans flex items-center gap-2">
            {activePropertyObject.name} Properties
            {isFetchingDetails && (
              <span className="text-[10px] font-normal italic text-white/80 animate-pulse">(Loading details...)</span>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
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
          {(activePropertyObject.type === 'group' ? [
            { key: 'general', label: 'General' },
            { key: 'members', label: 'Members' },
            { key: 'memberof', label: 'Member Of' },
            { key: 'attribute', label: 'Attribute Editor' },
            { key: 'python', label: 'Python Payload Code (Direct Copy)' }
          ] : [
            { key: 'general', label: 'General' },
            { key: 'address', label: 'Address' },
            { key: 'account', label: 'Account' },
            { key: 'profile', label: 'Profile' },
            { key: 'telephones', label: 'Telephones' },
            { key: 'organization', label: 'Organization' },
            { key: 'memberof', label: 'Member Of' },
            { key: 'attribute', label: 'Attribute Editor' },
            { key: 'python', label: 'Python Payload Code (Direct Copy)' }
          ]).map(tab => {
            const isActive = activeModalTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
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

          {/* TAB 1: General (User) */}
          {activeModalTab === 'general' && activePropertyObject.type !== 'group' && (
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
                <span className="font-bold text-slate-600 text-right pr-2">User Logon Name (sAMAccountName)</span>
                <input
                  type="text"
                  value={activePropertyObject.sAMAccountName || ''}
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

          {/* TAB 1: General (Group) */}
          {activeModalTab === 'general' && activePropertyObject.type === 'group' && (
            <div className="space-y-4 font-sans">
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="font-bold text-slate-600 text-right pr-2">Group name (pre-Windows 2000)</span>
                <input
                  type="text"
                  value={activePropertyObject.sAMAccountName || ''}
                  readOnly
                  className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  title="Click to copy attribute"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="font-bold text-slate-600 text-right pr-2">Description</span>
                <input
                  type="text"
                  value={activePropertyObject.description || ''}
                  readOnly
                  className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  title="Click to copy attribute"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 items-center mt-2">
                <span className="font-bold text-slate-600 text-right pr-2">Canonical Name (cn)</span>
                <input
                  type="text"
                  value={activePropertyObject.cn || activePropertyObject.name || ''}
                  readOnly
                  className="col-span-2 p-1.5 border border-slate-200 bg-slate-50 text-slate-700 outline-none rounded select-all font-mono text-xs cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  title="Click to copy attribute"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#b5b2ad]">
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">Group scope</h4>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-slate-600 cursor-not-allowed">
                      <input type="radio" checked={activePropertyObject.groupScope === 'Domain Local'} readOnly disabled className="w-3 h-3" />
                      Domain local
                    </label>
                    <label className="flex items-center gap-2 text-slate-600 cursor-not-allowed">
                      <input type="radio" checked={activePropertyObject.groupScope === 'Global'} readOnly disabled className="w-3 h-3" />
                      Global
                    </label>
                    <label className="flex items-center gap-2 text-slate-600 cursor-not-allowed">
                      <input type="radio" checked={activePropertyObject.groupScope === 'Universal'} readOnly disabled className="w-3 h-3" />
                      Universal
                    </label>
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">Group type</h4>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-slate-600 cursor-not-allowed">
                      <input type="radio" checked={activePropertyObject.groupCategory === 'Security'} readOnly disabled className="w-3 h-3" />
                      Security
                    </label>
                    <label className="flex items-center gap-2 text-slate-600 cursor-not-allowed">
                      <input type="radio" checked={activePropertyObject.groupCategory === 'Distribution'} readOnly disabled className="w-3 h-3" />
                      Distribution
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Members */}
          {activeModalTab === 'members' && (
            <div className="space-y-3 font-sans h-full flex flex-col">
              <h4 className="font-bold text-slate-700 mb-1">Members:</h4>
              <div className="border border-[#b5b2ad] bg-white h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f0f0f0] sticky top-0 border-b border-[#b5b2ad] z-10">
                    <tr>
                      <th className="font-normal px-2 py-1 border-r border-[#d4d0c8] text-xs text-slate-700 w-8"></th>
                      <th className="font-normal px-2 py-1 border-r border-[#d4d0c8] text-xs text-slate-700 w-1/3">Name</th>
                      <th className="font-normal px-2 py-1 text-xs text-slate-700">Active Directory Folder (DN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePropertyObject.members && activePropertyObject.members.length > 0 ? (
                      activePropertyObject.members.map((m, idx) => (
                        <tr key={idx} className="hover:bg-[#e4eef6] border-b border-slate-100">
                          <td className="px-2 py-1">
                            {m.type === 'user' ? (
                              <Users className="w-3.5 h-3.5 text-[#3b72ab]" />
                            ) : m.type === 'group' ? (
                              <Users className="w-3.5 h-3.5 text-[#001f56]" />
                            ) : (
                              <Monitor className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </td>
                          <td className="px-2 py-1 text-xs truncate max-w-[150px]" title={m.name}>{m.name}</td>
                          <td className="px-2 py-1 text-xs font-mono text-slate-500 truncate max-w-[200px]" title={m.dn}>{m.dn}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-2 py-4 text-center text-slate-400 italic text-xs">No members found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                <span className="font-bold text-slate-600 text-right pr-2">Company (company)</span>
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
                    className="p-2.5 border border-slate-200 bg-slate-50 rounded-md flex justify-between items-center"
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
            onClick={onClose}
            className="px-5 py-1 bg-white hover:bg-slate-100 border-2 border-slate-400 text-xs font-bold font-sans rounded-md text-[#000] cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
