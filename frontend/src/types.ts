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
  type: 'domain' | 'ou' | 'container' | 'user' | 'group' | 'computer';
  has_children: boolean;
  _children?: ADNode[];
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
