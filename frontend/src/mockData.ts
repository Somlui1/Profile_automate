/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DirectoryUser, ADNode, ADGroup, M365Sku, Job, JobLog } from './types';

export const initialUsers: DirectoryUser[] = [
  {
    uid: "anek.ph",
    name: "Anek Phromsiri",
    email: "anek.p@aapico.com",
    title: "Director of Engineering",
    dept: "Engineering",
    printCode: "112233",
    ou: "OU=Engineering,OU=Users,DC=aapico,DC=com",
    papercut: "Synced (Auto)",
    status: "Active",
    mobile: "0821112233",
    company: "AHT",
    manager: "Somsak Sombat",
    office: "AHT - Floor 3",
    description: "Engineering Department Principal Director"
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
    status: "Active",
    mobile: "0819998888",
    company: "AAPICO Hitech PLC",
    office: "HQ - Floor 4",
    description: "IT Division Leader",
    manager: "Vipha Jinda"
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
    status: "Active",
    mobile: "0815554444",
    company: "AAPICO Hitech PLC",
    office: "HQ - Floor 2",
    description: "VP of VP Human Resource administration"
  }
];

export const masterADGroups: ADGroup[] = [
  { name: "Domain Users", scope: "Global", desc: "Default domain users security group membership" },
  { name: "Domain Admins", scope: "Global", desc: "Designated administrators of the domain" },
  { name: "Enterprise Admins", scope: "Universal", desc: "Designated administrators of the enterprise" },
  { name: "Engineering Users", scope: "Global", desc: "All core staff assigned to Engineering divisions" },
  { name: "VPN Operators", scope: "Local", desc: "Members are permitted to establish corporate VPN tunnels" },
  { name: "IT Support Tier 2", scope: "Global", desc: "Advanced operational level IT support team privileges" },
  { name: "Marketing Managers", scope: "Global", desc: "Department heads for Marketing promotions group" },
  { name: "HR Coordinators", scope: "Global", desc: "Human Resources database write access delegates" },
  { name: "User_LevelC_AH", scope: "Global", desc: "Auto-assigned Internet Access Level C" },
  { name: "User_LevelB_AH", scope: "Global", desc: "Auto-assigned Internet Access Level B" },
  { name: "BW200", scope: "Global", desc: "Auto-assigned B/W Printer Access group" },
  { name: "CL100", scope: "Global", desc: "AAPICO Cost Center 100 access group" }
];

export const initialM365Skus: M365Sku[] = [
  { skuPartNumber: "STANDARDPACK", skuId: "sku-standardpack", prepaidUnits: 10, consumedUnits: 9, availableUnits: 1, status: "Available" },
  { skuPartNumber: "Microsoft_Teams_Rooms_Basic", skuId: "sku-teamsrooms", prepaidUnits: 5, consumedUnits: 2, availableUnits: 3, status: "Available" },
  { skuPartNumber: "EMS", skuId: "sku-ems", prepaidUnits: 15, consumedUnits: 9, availableUnits: 6, status: "Available" },
  { skuPartNumber: "FLOW_FREE", skuId: "sku-flowfree", prepaidUnits: 10000, consumedUnits: 427, availableUnits: 9573, status: "Available" },
  { skuPartNumber: "POWERAPPS_DEV", skuId: "sku-powerappsdev", prepaidUnits: 10000, consumedUnits: 16, availableUnits: 9984, status: "Available" },
  { skuPartNumber: "POWERAPPS_VIRAL", skuId: "sku-powerappsviral", prepaidUnits: 10000, consumedUnits: 10, availableUnits: 9990, status: "Available" },
  { skuPartNumber: "Power_Pages_vTrial_for_Makers", skuId: "sku-powerpagestrial", prepaidUnits: 10000, consumedUnits: 4, availableUnits: 9996, status: "Available" },
  { skuPartNumber: "CCIBOTS_PRIVPREV_VIRAL", skuId: "sku-copilotstudio", prepaidUnits: 10000, consumedUnits: 1, availableUnits: 9999, status: "Available" },
  { skuPartNumber: "POWER_BI_STANDARD", skuId: "sku-powerbifree", prepaidUnits: 1000000, consumedUnits: 242, availableUnits: 999758, status: "Available" },
  { skuPartNumber: "POWER_BI_PRO", skuId: "sku-powerbipro", prepaidUnits: 50, consumedUnits: 50, availableUnits: 0, status: "Out of Stock" },
  { skuPartNumber: "Microsoft_365_Copilot", skuId: "sku-copilot", prepaidUnits: 10, consumedUnits: 10, availableUnits: 0, status: "Out of Stock" },
  { skuPartNumber: "WINDOWS_STORE", skuId: "sku-windowsstore", prepaidUnits: 5, consumedUnits: 5, availableUnits: 0, status: "Out of Stock" },
  { skuPartNumber: "ENTERPRISEPACK", skuId: "sku-o365e3", prepaidUnits: 200, consumedUnits: 200, availableUnits: 0, status: "Out of Stock" },
  { skuPartNumber: "Microsoft_Intune_Endpoint_Privilege_Management", skuId: "sku-intuneepm", prepaidUnits: 20, consumedUnits: 20, availableUnits: 0, status: "Out of Stock" },
  { skuPartNumber: "O365_BUSINESS_PREMIUM", skuId: "sku-premium", prepaidUnits: 100, consumedUnits: 100, availableUnits: 0, status: "Out of Stock" },
  { skuPartNumber: "SPE_E5", skuId: "sku-m365e5", prepaidUnits: 50, consumedUnits: 50, availableUnits: 0, status: "Out of Stock" },
  { skuPartNumber: "POWERAUTOMATE_ATTENDED_RPA", skuId: "sku-rpa", prepaidUnits: 5, consumedUnits: 5, availableUnits: 0, status: "Out of Stock" },
  { skuPartNumber: "Teams_Premium_(for_Departments)", skuId: "sku-teamsrem", prepaidUnits: 15, consumedUnits: 15, availableUnits: 0, status: "Out of Stock" }
];

export const initialJobs: Job[] = [
  {
    id: "job-anupong-005",
    status: "queued",
    current_step: "ad_creation",
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), // 36 hours ago
    updated_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    payload: {
      metadata: {
        document_info: { date: "08/06/2026", doc_no: "EF-260608-01" },
        requester_info: {
          name_english: "Mr. Anupong Rakdee",
          company: "AITS (AAPICO IT)",
          employee_id: "10003099",
          position: "System Administrator",
          department: "IT Infrastructure",
          ext: "4112",
          mobile_phone: "0832223344"
        }
      },
      workflow_control: {
        high_priority: false,
        enable_ad_creation: true,
        enable_papercut_sync: true,
        enable_microsoft_365_license: true,
        enable_send_email: true
      }
    }
  },
  {
    id: "job-kittisak-003",
    status: "processing",
    current_step: "m365_license",
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    payload: {
      metadata: {
        document_info: { date: "09/06/2026", doc_no: "EF-260609-02" },
        requester_info: {
          name_english: "Mr. Kittisak Udorn",
          company: "AHT",
          employee_id: "10003112",
          position: "Production Manager",
          department: "Assembly Division",
          ext: "9218",
          mobile_phone: "0853334455"
        }
      },
      workflow_control: {
        high_priority: true,
        enable_ad_creation: true,
        enable_papercut_sync: true,
        enable_microsoft_365_license: true,
        enable_send_email: true
      }
    }
  },
  {
    id: "job-sunisa-004",
    status: "paused",
    current_step: "papercut_sync",
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hrs ago
    updated_at: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString(),
    payload: {
      metadata: {
        document_info: { date: "09/06/2026", doc_no: "EF-260609-01" },
        requester_info: {
          name_english: "Ms. Sunisa Jaiyen",
          company: "AA (AAPICO Amata)",
          employee_id: "10003104",
          position: "Accountant Specialist",
          department: "Finance & Accounting",
          ext: "3051",
          mobile_phone: "0814445566"
        }
      },
      workflow_control: {
        high_priority: false,
        enable_ad_creation: true,
        enable_papercut_sync: true,
        enable_microsoft_365_license: true,
        enable_send_email: true
      }
    }
  },
  {
    id: "job-wanida-002",
    status: "failed",
    current_step: "m365_license",
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5 hrs ago
    updated_at: new Date(Date.now() - 4.8 * 3600 * 1000).toISOString(),
    payload: {
      metadata: {
        document_info: { date: "09/06/2026", doc_no: "EF-260609-11" },
        requester_info: {
          name_english: "Ms. Wanida Srisai",
          company: "AHA",
          employee_id: "10003083",
          position: "HR Representative",
          department: "Human Resources",
          ext: "3388",
          mobile_phone: "0819998888"
        }
      },
      workflow_control: {
        high_priority: false,
        enable_ad_creation: true,
        enable_papercut_sync: true,
        enable_microsoft_365_license: true,
        enable_send_email: true
      }
    }
  },
  {
    id: "job-somchai-001",
    status: "success",
    current_step: "done",
    created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(), // 8 hrs ago
    updated_at: new Date(Date.now() - 7.9 * 3600 * 1000).toISOString(),
    payload: {
      metadata: {
        document_info: { date: "09/06/2026", doc_no: "EF-26050173-B3" },
        requester_info: {
          name_english: "Mr. Somchai Kornthong",
          company: "AHT",
          employee_id: "10003082",
          position: "Lead Developer",
          department: "Engineering",
          ext: "2256",
          mobile_phone: "0821112233"
        }
      },
      workflow_control: {
        high_priority: true,
        enable_ad_creation: true,
        enable_papercut_sync: true,
        enable_microsoft_365_license: true,
        enable_send_email: true
      }
    }
  }
];

export const mockJobLogs: Record<string, JobLog[]> = {
  "job-anupong-005": [
    { id: "l1", jobId: "job-anupong-005", step: "pipeline", status: "success", message: "Pipeline initiated in queued mode", timestamp: new Date(Date.now() - 36 * 3600 * 1000).toISOString() }
  ],
  "job-kittisak-003": [
    { id: "l2", jobId: "job-kittisak-003", step: "pipeline", status: "running", message: "High-priority pipeline boot triggered", timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
    { id: "l3", jobId: "job-kittisak-003", step: "ad_creation", status: "success", message: "LDAPS Handshake completed. Object CN=Kittisak Udorn write SUCCESS", timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString() },
    { id: "l4", jobId: "job-kittisak-003", step: "papercut_sync", status: "success", message: "Papercut server mapping succeeded. Print PIN: 334455 assigned to kittisak.u", timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString() },
    { id: "l5", jobId: "job-kittisak-003", step: "m365_license", status: "running", message: "Contacting O365 Graph API... checking STANDARDPACK", timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() }
  ],
  "job-sunisa-004": [
    { id: "l6", jobId: "job-sunisa-004", step: "pipeline", status: "running", message: "Triggered standard scheduling", timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
    { id: "l7", jobId: "job-sunisa-004", step: "ad_creation", status: "success", message: "Active Directory Account sunisa.ja successfully created", timestamp: new Date(Date.now() - 1.8 * 3600 * 1000).toISOString() },
    { id: "l8", jobId: "job-sunisa-004", step: "papercut_sync", status: "paused", message: "Job queue execution paused manually by administrator", timestamp: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString() }
  ],
  "job-wanida-002": [
    { id: "l9", jobId: "job-wanida-002", step: "pipeline", status: "running", message: "Initiating workflow and pre-validations", timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
    { id: "l10", jobId: "job-wanida-002", step: "ad_creation", status: "success", message: "LDAP Object created successfully for wanida.sr", timestamp: new Date(Date.now() - 4.9 * 3600 * 1000).toISOString() },
    { id: "l11", jobId: "job-wanida-002", step: "papercut_sync", status: "success", message: "Papercut sync complete. PIN: 998888 activated", timestamp: new Date(Date.now() - 4.88 * 3600 * 1000).toISOString() },
    { id: "l12", jobId: "job-wanida-002", step: "m365_license", status: "failed", message: "Graph Error 503: Microsoft 365 license limit exceeded for ENTERPRISEPACK", timestamp: new Date(Date.now() - 4.8 * 3600 * 1000).toISOString() }
  ],
  "job-somchai-001": [
    { id: "l13", jobId: "job-somchai-001", step: "pipeline", status: "success", message: "High-priority pipeline completed fully", timestamp: new Date(Date.now() - 8 * 3600 * 1000).toISOString() },
    { id: "l14", jobId: "job-somchai-001", step: "ad_creation", status: "success", message: "LDAPS completed. Object CN=Somchai Kornthong successfully established", timestamp: new Date(Date.now() - 7.98 * 3600 * 1000).toISOString() },
    { id: "l15", jobId: "job-somchai-001", step: "papercut_sync", status: "success", message: "Papercut synced. Printer PIN 112233 mapped to somchai.ko", timestamp: new Date(Date.now() - 7.95 * 3600 * 1000).toISOString() },
    { id: "l16", jobId: "job-somchai-001", step: "m365_license", status: "success", message: "O365 Graph License Enterprise E3 assigned", timestamp: new Date(Date.now() - 7.92 * 3600 * 1000).toISOString() },
    { id: "l17", jobId: "job-somchai-001", step: "send_email", status: "success", message: "Welcome dispatch email sent out from smtp.aapico.com to somchai.k@aapico.com", timestamp: new Date(Date.now() - 7.9 * 3600 * 1000).toISOString() }
  ]
};

export const initialADTree: ADNode = {
  dn: "DC=aapico,DC=com",
  name: "aapico.com",
  type: "domain",
  has_children: true,
  _children: [
    {
      dn: "OU=Engineering,OU=Users,DC=aapico,DC=com",
      name: "Engineering",
      type: "ou",
      has_children: true,
      _children: [
        { dn: "CN=Anek Phromsiri,OU=Engineering,OU=Users,DC=aapico,DC=com", name: "Anek Phromsiri", type: "user", has_children: false },
        { dn: "CN=Web Dev Team,OU=Engineering,OU=Users,DC=aapico,DC=com", name: "Web Dev Team", type: "group", has_children: false }
      ]
    },
    {
      dn: "OU=Human Resources,OU=Users,DC=aapico,DC=com",
      name: "Human Resources",
      type: "ou",
      has_children: true,
      _children: [
        { dn: "CN=Vipha Jinda,OU=Human Resources,OU=Users,DC=aapico,DC=com", name: "Vipha Jinda", type: "user", has_children: false }
      ]
    },
    {
      dn: "OU=Information Technology,OU=Users,DC=aapico,DC=com",
      name: "Information Technology",
      type: "ou",
      has_children: true,
      _children: [
        { dn: "CN=Somsak Sombat,OU=Information Technology,OU=Users,DC=aapico,DC=com", name: "Somsak Sombat", type: "user", has_children: false }
      ]
    },
    {
      dn: "OU=AA,DC=aapico,DC=com",
      name: "AA",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AAVE,DC=aapico,DC=com",
      name: "AAVE",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=ABC,DC=aapico,DC=com",
      name: "ABC",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AC,DC=aapico,DC=com",
      name: "AC",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AEC,DC=aapico,DC=com",
      name: "AEC",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AERP,DC=aapico,DC=com",
      name: "AERP",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AF,DC=aapico,DC=com",
      name: "AF",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AGD,DC=aapico,DC=com",
      name: "AGD",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AH,DC=aapico,DC=com",
      name: "AH",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AHA,DC=aapico,DC=com",
      name: "AHA",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AHP,DC=aapico,DC=com",
      name: "AHP",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AHR,DC=aapico,DC=com",
      name: "AHR",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AHT,DC=aapico,DC=com",
      name: "AHT",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AI,DC=aapico,DC=com",
      name: "AI",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AITS,DC=aapico,DC=com",
      name: "AITS",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AL,DC=aapico,DC=com",
      name: "AL",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AMI,DC=aapico,DC=com",
      name: "AMI",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AP,DC=aapico,DC=com",
      name: "AP",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=APR,DC=aapico,DC=com",
      name: "APR",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=AS,DC=aapico,DC=com",
      name: "AS",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=ASP,DC=aapico,DC=com",
      name: "ASP",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=ATC,DC=aapico,DC=com",
      name: "ATC",
      type: "ou",
      has_children: false
    },
    {
      dn: "CN=Computers,DC=aapico,DC=com",
      name: "Computers",
      type: "container",
      has_children: true,
      _children: [
        { dn: "CN=AAPICO-HQDC-01,CN=Computers,DC=aapico,DC=com", name: "AAPICO-HQDC-01", type: "computer", has_children: false },
        { dn: "CN=CL-ENG-SEC-01,CN=Computers,DC=aapico,DC=com", name: "CL-ENG-SEC-01", type: "computer", has_children: false }
      ]
    },
    {
      dn: "OU=Contact,DC=aapico,DC=com",
      name: "Contact",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=Domain Controllers,DC=aapico,DC=com",
      name: "Domain Controllers",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=EA,DC=aapico,DC=com",
      name: "EA",
      type: "ou",
      has_children: false
    },
    {
      dn: "CN=ForeignSecurityPrincipals,DC=aapico,DC=com",
      name: "ForeignSecurityPrincipals",
      type: "container",
      has_children: false
    },
    {
      dn: "OU=Intern Accounts,DC=aapico,DC=com",
      name: "Intern Accounts",
      type: "ou",
      has_children: false
    },
    {
      dn: "CN=Keys,DC=aapico,DC=com",
      name: "Keys",
      type: "container",
      has_children: false
    },
    {
      dn: "OU=Managed Desktop,DC=aapico,DC=com",
      name: "Managed Desktop",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=Managed Groups,DC=aapico,DC=com",
      name: "Managed Groups",
      type: "ou",
      has_children: false
    },
    {
      dn: "CN=Managed Service Accounts,DC=aapico,DC=com",
      name: "Managed Service Accounts",
      type: "container",
      has_children: false
    },
    {
      dn: "OU=Managed_Users,DC=aapico,DC=com",
      name: "Managed_Users",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=Meeting Room,DC=aapico,DC=com",
      name: "Meeting Room",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=Microsoft Exchange Security Groups,DC=aapico,DC=com",
      name: "Microsoft Exchange Security Groups",
      type: "ou",
      has_children: false
    },
    {
      dn: "CN=Microsoft Exchange System Objects,DC=aapico,DC=com",
      name: "Microsoft Exchange System Objects",
      type: "container",
      has_children: false
    },
    {
      dn: "CN=Program Data,DC=aapico,DC=com",
      name: "Program Data",
      type: "container",
      has_children: false
    },
    {
      dn: "OU=RPA,DC=aapico,DC=com",
      name: "RPA",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=Showroom,DC=aapico,DC=com",
      name: "Showroom",
      type: "ou",
      has_children: false
    },
    {
      dn: "CN=System,DC=aapico,DC=com",
      name: "System",
      type: "container",
      has_children: false
    },
    {
      dn: "OU=User Delete,DC=aapico,DC=com",
      name: "User Delete",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=User Fordward Mail,DC=aapico,DC=com",
      name: "User Fordward Mail",
      type: "ou",
      has_children: false
    },
    {
      dn: "CN=Users,DC=aapico,DC=com",
      name: "Users",
      type: "container",
      has_children: true,
      _children: [
        { dn: "CN=Domain Users,CN=Users,DC=aapico,DC=com", name: "Domain Users", type: "group", has_children: false },
        { dn: "CN=Administrator,CN=Users,DC=aapico,DC=com", name: "Administrator", type: "user", has_children: false }
      ]
    },
    {
      dn: "CN=VMMHA,DC=aapico,DC=com",
      name: "VMMHA",
      type: "container",
      has_children: false
    },
    {
      dn: "OU=VPN Group,DC=aapico,DC=com",
      name: "VPN Group",
      type: "ou",
      has_children: false
    },
    {
      dn: "OU=VROOM,DC=aapico,DC=com",
      name: "VROOM",
      type: "ou",
      has_children: false
    }
  ]
};

export const defaultEmailTemplate = `To: {supervisor_name}
Cc: {{ENV_MAIL_CC}}
Subject: New AD Account Created for {name_english} ({company})

Dear Khun {supervisor_name},

We are pleased to inform you that the IT accounts for your new team member, {name_english}, have been successfully provisioned.

The access credentials and configuration outline are detailed below:

1. Active Directory Account (Corporate Logon)
- Username Logins: {username}
- UPN Principal: {username}@{domain}
- Primary Email Address: {email}
- Initial Password Security: {passwrd}
- Status Profile: Password change is required on first logon (Active)

2. Network & Authorization Profile
- Regional Workspace: {company}
- Assigned Group Memberships: Domain Users
- Internet Proxy Security Filter: {format_PDF} (Standard Corporate Browsing)

3. Secure Hardcopy Release (Papercut Printing PIN Map)
- Personal release print Code: {Printer_code}

Please instruct the employee to sign in to their desktop computer using the corporate logon credentials listed above, after which they will be immediately prompted to set their permanent personal password.

For support, please contact the IT Helpdesk at ext. 3333 or reply directly to this mail.

Best regards,

AAPICO Enterprise Infrastructure Operations Suite
IT Support Desk & Automatons Division`;
