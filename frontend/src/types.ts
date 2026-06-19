/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DirectoryUser {
  uid: string;
  name: string;
  email: string;
  title: string;
  dept: string;
  printCode: string;
  ou: string;
  papercut: string;
  status: string;
  mobile?: string;
  company?: string;
  manager?: string;
  office?: string;
  description?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface ADNode {
  dn: string;
  name: string;
  type: 'domain' | 'ou' | 'container' | 'user' | 'group' | 'computer' | 'contact' | 'sharedfolder' | 'printer';
  has_children: boolean;
  _children?: ADNode[];
  description?: string;
  title?: string;
  department?: string;
  mail?: string;
  company?: string;
  groupScope?: string;
  groupCategory?: string;
  members?: Array<{dn: string, name: string, type: string}>;
}

export interface ADGroup {
  name: string;
  scope: string;
  desc: string;
}

export interface M365Sku {
  skuPartNumber: string;
  skuId?: string;
  prepaidUnits: number;
  consumedUnits: number;
  availableUnits: number;
  status: 'Available' | 'Out of Stock';
}

export interface JobLog {
  id: string;
  jobId: string;
  step: string;
  status: 'running' | 'success' | 'failed' | 'skipped' | 'paused' | 'pending';
  message: string;
  metadata?: Record<string, any>;
  timestamp: string; // ISO string
}

export interface StepSchema {
  key: string;
  display_name: string;
  description?: string;
  icon: string;
  sub_steps?: any[];
}

export interface Job {
  id: string;
  status: 'queued' | 'processing' | 'success' | 'failed' | 'paused' | 'cancelled';
  current_step: string;
  created_at: string; // ISO string
  updated_at: string; // ISO string
  payload: {
    metadata?: {
      document_info?: {
        date: string;
        doc_no: string;
      };
      requester_info?: {
        name_english?: string;
        company?: string;
        employee_id?: string;
        position?: string;
        department?: string;
        ext?: string;
        mobile_phone?: string;
        supervisor_name?: string;
        supervisor_position?: string;
        address?: string;
        zip_code?: string;
      };
    };
    workflow_control?: {
      high_priority?: boolean;
      enable_ad_creation?: boolean;
      enable_papercut_sync?: boolean;
      enable_microsoft_365_license?: boolean;
      enable_send_email?: boolean;
    };
    task_data?: {
      ad_profile?: {
        custom_username: string;
        target_ou: string;
        custom_attributes?: Record<string, any>;
        ad_groups?: ADGroup[];
      };
      papercut_profile?: {
        print_code: string;
        papercutCardId?: string;
        papercutBalance?: number;
      };
      email_profile?: {
        emailSubject: string;
        emailTo: string;
        emailCc: string;
        emailBody: string;
      };
    };
  };
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface SystemConfig {
  ldapServer: string;
  ldapUser: string;
  ldapBase: string;
  papercutUrl: string;
  papercutToken: string;
  mockMode: 'mock' | 'live';
}

export interface ADObject {
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
