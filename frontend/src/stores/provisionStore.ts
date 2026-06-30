import { create } from 'zustand';
import { ADGroup, M365Sku } from '../types';

interface ProvisionState {
  // --- CONTROL STATES ---
  currentStep: 1 | 2 | 2.5 | 3;
  setCurrentStep: (step: 1 | 2 | 2.5 | 3) => void;

  // --- STEP 1 STATE ---
  pdfUrl: string;
  setPdfUrl: (url: string) => void;
  parsingStatus: 'idle' | 'parsing' | 'success';
  setParsingStatus: (status: 'idle' | 'parsing' | 'success') => void;
  rawJsonOutput: string;
  setRawJsonOutput: (val: string) => void;
  mappedJsonOutput: string;
  setMappedJsonOutput: (val: string) => void;
  autoFillPrintCode: boolean;
  setAutoFillPrintCode: (val: boolean) => void;
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;

  // --- STEP 2 FORM STATE ---
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  displayName: string;
  setDisplayName: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  usernameLogon: string;
  setUsernameLogon: (val: string) => void;
  userPassword: string;
  setUserPassword: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean) => void;
  office: string;
  setOffice: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  mobile: string;
  setMobile: (val: string) => void;
  printCode: string;
  setPrintCode: (val: string) => void;

  street: string;
  setStreet: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  stateName: string;
  setStateName: (val: string) => void;
  zipCode: string;
  setZipCode: (val: string) => void;
  country: string;
  setCountry: (val: string) => void;

  company: string;
  setCompany: (val: string) => void;
  department: string;
  setDepartment: (val: string) => void;
  jobTitle: string;
  setJobTitle: (val: string) => void;
  managerInput: string;
  setManagerInput: (val: string) => void;

  selectedDN: string;
  setSelectedDN: (val: string) => void;
  selectedOUName: string;
  setSelectedNodeName: (val: string) => void;

  profilePath: string;
  setProfilePath: (val: string) => void;
  logonScript: string;
  setLogonScript: (val: string) => void;
  pwdResetOnFirstLogon: boolean;
  setPwdResetOnFirstLogon: (val: boolean) => void;
  accountEnabled: boolean;
  setAccountEnabled: (val: boolean) => void;
  sendWelcomeEmailToggle: boolean;
  setSendWelcomeEmailToggle: (val: boolean) => void;

  isLoadingLicenses: boolean;
  setIsLoadingLicenses: (val: boolean) => void;
  isFetchingLicenses: boolean;
  setIsFetchingLicenses: (val: boolean) => void;
  isLoadingTemplate: boolean;
  setIsLoadingTemplate: (val: boolean) => void;

  // Email Preview Editor
  emailTo: string;
  setEmailTo: (val: string) => void;
  prevManagerInput: string;
  setPrevManagerInput: (val: string) => void;
  emailCc: string;
  setEmailCc: (val: string) => void;
  emailSubject: string;
  setEmailSubject: (val: string) => void;
  emailBody: string;
  setEmailBody: (val: string) => void;
  defaultTemplate: string;
  setDefaultEmailTemplate: (val: string) => void;

  // Selected licenses
  selectedSkuIds: string[];
  setSelectedSkuIds: (val: string[] | ((prev: string[]) => string[])) => void;
  licenses: M365Sku[];
  setLicenses: (val: M365Sku[]) => void;
  licenseSearch: string;
  setLicenseSearch: (val: string) => void;

  // AD Groups Membership list
  adGroupsAssigned: ADGroup[];
  setAdGroupsMembership: (val: ADGroup[] | ((prev: ADGroup[]) => ADGroup[])) => void;

  // Verification indicators
  logonVerification: 'idle' | 'verifying' | 'valid' | 'invalid';
  setLogonVerification: (val: 'idle' | 'verifying' | 'valid' | 'invalid') => void;
  managerVerification: 'idle' | 'verifying' | 'valid' | 'invalid';
  setManagerVerification: (val: 'idle' | 'verifying' | 'valid' | 'invalid') => void;

  // --- MODALS STATES ---
  isFindGroupsOpen: boolean;
  setIsFindGroupsOpen: (val: boolean) => void;
  searchGroupQuery: string;
  setSearchGroupQuery: (val: string) => void;
  foundGroupsList: ADGroup[];
  setFoundGroupsList: (val: ADGroup[]) => void;
  searchingGroups: boolean;
  setSearchingGroups: (val: boolean) => void;
  selectedGroupFromModal: ADGroup | null;
  setSelectedGroupFromModal: (val: ADGroup | null) => void;

  isBulkGroupsOpen: boolean;
  setIsBulkGroupsOpen: (val: boolean) => void;
  bulkGroupsText: string;
  setBulkGroupsText: (val: string) => void;
  bulkGroupsList: Array<{ name: string; status: string; scope: string; desc: string }>;
  setBulkGroupsList: (val: Array<{ name: string; status: string; scope: string; desc: string }>) => void;
  verifyingBulkGroups: boolean;
  setVerifyingBulkGroups: (val: boolean) => void;
  showAdGroups: boolean;
  setShowAdGroups: (val: boolean) => void;

  // --- STEP 3 STATE (PIPELINE RUN) ---
  currentPipelineStep: number;
  setCurrentPipelineStep: (val: number | ((prev: number) => number)) => void;
  stepsSchema: any[];
  setStepsSchema: (val: any[]) => void;
  pipelineStates: Record<string, 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>;
  setPipelineStates: (val: Record<string, 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'> | ((prev: Record<string, 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>) => Record<string, 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>)) => void;
  pipelineSubStates: Record<string, Record<string, 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>>;
  setPipelineSubStates: (val: Record<string, Record<string, 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>> | ((prev: Record<string, Record<string, 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>>) => Record<string, Record<string, 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>>)) => void;
  pipelineState: 'PROCESSING' | 'DONE' | 'FAILED';
  setPipelineOverallState: (val: 'PROCESSING' | 'DONE' | 'FAILED') => void;
  customTerminalLogs: string[];
  setTerminalLogs: (val: string[] | ((prev: string[]) => string[])) => void;

  resetForm: () => void;
}

// Initial state for resetting
const defaultOU = import.meta.env.VITE_TARGET_OU || 'OU=New_employee,DC=aapico,DC=com';
const defaultOUName = defaultOU.split(',')[0].replace('OU=', '').replace('DC=', '');
const defaultShowAdGroups = import.meta.env.VITE_ENABLE_AD_GROUP_ASSIGNMENT === 'true';

export const useProvisionStore = create<ProvisionState>((set) => ({
  currentStep: 1,
  setCurrentStep: (step) => set({ currentStep: step }),

  pdfUrl: '',
  setPdfUrl: (val) => set({ pdfUrl: val }),
  parsingStatus: 'idle',
  setParsingStatus: (val) => set({ parsingStatus: val }),
  rawJsonOutput: '{}',
  setRawJsonOutput: (val) => set({ rawJsonOutput: val }),
  mappedJsonOutput: '{}',
  setMappedJsonOutput: (val) => set({ mappedJsonOutput: val }),
  autoFillPrintCode: true,
  setAutoFillPrintCode: (val) => set({ autoFillPrintCode: val }),
  isDragging: false,
  setIsDragging: (val) => set({ isDragging: val }),

  firstName: '',
  setFirstName: (val) => set({ firstName: val }),
  lastName: '',
  setLastName: (val) => set({ lastName: val }),
  displayName: '',
  setDisplayName: (val) => set({ displayName: val }),
  description: '',
  setDescription: (val) => set({ description: val }),
  email: '',
  setEmail: (val) => set({ email: val }),
  usernameLogon: '',
  setUsernameLogon: (val) => set({ usernameLogon: val }),
  userPassword: 'P@ssw0rd$',
  setUserPassword: (val) => set({ userPassword: val }),
  showPassword: false,
  setShowPassword: (val) => set({ showPassword: val }),
  office: '',
  setOffice: (val) => set({ office: val }),
  phone: '',
  setPhone: (val) => set({ phone: val }),
  mobile: '',
  setMobile: (val) => set({ mobile: val }),
  printCode: '',
  setPrintCode: (val) => set({ printCode: val }),

  street: '',
  setStreet: (val) => set({ street: val }),
  city: '',
  setCity: (val) => set({ city: val }),
  stateName: '',
  setStateName: (val) => set({ stateName: val }),
  zipCode: '',
  setZipCode: (val) => set({ zipCode: val }),
  country: 'Thailand',
  setCountry: (val) => set({ country: val }),

  company: '',
  setCompany: (val) => set({ company: val }),
  department: '',
  setDepartment: (val) => set({ department: val }),
  jobTitle: '',
  setJobTitle: (val) => set({ jobTitle: val }),
  managerInput: '',
  setManagerInput: (val) => set({ managerInput: val }),

  selectedDN: defaultOU,
  setSelectedDN: (val) => set({ selectedDN: val }),
  selectedOUName: defaultOUName,
  setSelectedNodeName: (val) => set({ selectedOUName: val }),

  profilePath: '',
  setProfilePath: (val) => set({ profilePath: val }),
  logonScript: '',
  setLogonScript: (val) => set({ logonScript: val }),
  pwdResetOnFirstLogon: true,
  setPwdResetOnFirstLogon: (val) => set({ pwdResetOnFirstLogon: val }),
  accountEnabled: true,
  setAccountEnabled: (val) => set({ accountEnabled: val }),
  sendWelcomeEmailToggle: true,
  setSendWelcomeEmailToggle: (val) => set({ sendWelcomeEmailToggle: val }),

  isLoadingLicenses: true,
  setIsLoadingLicenses: (val) => set({ isLoadingLicenses: val }),
  isFetchingLicenses: false,
  setIsFetchingLicenses: (val) => set({ isFetchingLicenses: val }),
  isLoadingTemplate: true,
  setIsLoadingTemplate: (val) => set({ isLoadingTemplate: val }),

  emailTo: '',
  setEmailTo: (val) => set({ emailTo: val }),
  prevManagerInput: '',
  setPrevManagerInput: (val) => set({ prevManagerInput: val }),
  emailCc: 'it.support@aapico.com',
  setEmailCc: (val) => set({ emailCc: val }),
  emailSubject: '',
  setEmailSubject: (val) => set({ emailSubject: val }),
  emailBody: '',
  setEmailBody: (val) => set({ emailBody: val }),
  defaultTemplate: '',
  setDefaultEmailTemplate: (val) => set({ defaultTemplate: val }),

  selectedSkuIds: [],
  setSelectedSkuIds: (val) => set((state) => ({ selectedSkuIds: typeof val === 'function' ? val(state.selectedSkuIds) : val })),
  licenses: [],
  setLicenses: (val) => set({ licenses: val }),
  licenseSearch: '',
  setLicenseSearch: (val) => set({ licenseSearch: val }),

  adGroupsAssigned: [
    { name: "Domain Users", scope: "Global", desc: "Default domain users security group membership" }
  ],
  setAdGroupsMembership: (val) => set((state) => ({ adGroupsAssigned: typeof val === 'function' ? val(state.adGroupsAssigned) : val })),

  logonVerification: 'idle',
  setLogonVerification: (val) => set({ logonVerification: val }),
  managerVerification: 'idle',
  setManagerVerification: (val) => set({ managerVerification: val }),

  isFindGroupsOpen: false,
  setIsFindGroupsOpen: (val) => set({ isFindGroupsOpen: val }),
  searchGroupQuery: '',
  setSearchGroupQuery: (val) => set({ searchGroupQuery: val }),
  foundGroupsList: [],
  setFoundGroupsList: (val) => set({ foundGroupsList: val }),
  searchingGroups: false,
  setSearchingGroups: (val) => set({ searchingGroups: val }),
  selectedGroupFromModal: null,
  setSelectedGroupFromModal: (val) => set({ selectedGroupFromModal: val }),

  isBulkGroupsOpen: false,
  setIsBulkGroupsOpen: (val) => set({ isBulkGroupsOpen: val }),
  bulkGroupsText: '',
  setBulkGroupsText: (val) => set({ bulkGroupsText: val }),
  bulkGroupsList: [],
  setBulkGroupsList: (val) => set({ bulkGroupsList: val }),
  verifyingBulkGroups: false,
  setVerifyingBulkGroups: (val) => set({ verifyingBulkGroups: val }),
  showAdGroups: defaultShowAdGroups,
  setShowAdGroups: (val) => set({ showAdGroups: val }),

  currentPipelineStep: 1,
  setCurrentPipelineStep: (val) => set((state) => ({ currentPipelineStep: typeof val === 'function' ? val(state.currentPipelineStep) : val })),
  stepsSchema: [],
  setStepsSchema: (val) => set({ stepsSchema: val }),
  pipelineStates: {},
  setPipelineStates: (val) => set((state) => ({ pipelineStates: typeof val === 'function' ? val(state.pipelineStates) : val })),
  pipelineSubStates: {},
  setPipelineSubStates: (val) => set((state) => ({ pipelineSubStates: typeof val === 'function' ? val(state.pipelineSubStates) : val })),
  pipelineState: 'PROCESSING',
  setPipelineOverallState: (val) => set({ pipelineState: val }),
  customTerminalLogs: [],
  setTerminalLogs: (val) => set((state) => ({ customTerminalLogs: typeof val === 'function' ? val(state.customTerminalLogs) : val })),

  resetForm: () => set({
    currentStep: 1,
    pdfUrl: '',
    parsingStatus: 'idle',
    rawJsonOutput: '{}',
    mappedJsonOutput: '{}',
    autoFillPrintCode: true,
    firstName: '',
    lastName: '',
    displayName: '',
    description: '',
    email: '',
    usernameLogon: '',
    userPassword: 'P@ssw0rd$',
    showPassword: false,
    office: '',
    phone: '',
    mobile: '',
    printCode: '',
    street: '',
    city: '',
    stateName: '',
    zipCode: '',
    country: 'Thailand',
    company: '',
    department: '',
    jobTitle: '',
    managerInput: '',
    selectedDN: defaultOU,
    selectedOUName: defaultOUName,
    profilePath: '',
    logonScript: '',
    pwdResetOnFirstLogon: true,
    accountEnabled: true,
    sendWelcomeEmailToggle: true,
    emailTo: '',
    prevManagerInput: '',
    emailCc: 'it.support@aapico.com',
    emailSubject: '',
    emailBody: '',
    selectedSkuIds: [],
    licenseSearch: '',
    adGroupsAssigned: [
      { name: "Domain Users", scope: "Global", desc: "Default domain users security group membership" }
    ],
    logonVerification: 'idle',
    managerVerification: 'idle',
    isFindGroupsOpen: false,
    searchGroupQuery: '',
    foundGroupsList: [],
    searchingGroups: false,
    selectedGroupFromModal: null,
    isBulkGroupsOpen: false,
    bulkGroupsText: '',
    bulkGroupsList: [],
    verifyingBulkGroups: false,
    showAdGroups: defaultShowAdGroups,
    currentPipelineStep: 1,
    pipelineStates: {},
    pipelineSubStates: {},
    pipelineState: 'PROCESSING',
    customTerminalLogs: []
  })
}));
