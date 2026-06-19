/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  DirectoryUser,
  ADGroup,
  M365Sku,
  ToastMessage,
  SystemConfig
} from '../types';
import { ADUCTree } from './ADUCTree';
import {
  Upload,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Share2,
  CheckCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Search,
  Group,
  Plus,
  Play,
  Calendar,
  X,
  FileText,
  AlertTriangle,
  Loader2,
  Check,
  Building,
  UserCheck,
  Info,
  Folder,
  FolderOpen,
  Cloud,
  HelpCircle,
  Database,
  Hourglass,
  Printer
} from 'lucide-react';

interface PDFProvisionTabProps {
  onAddUser: (user: DirectoryUser) => void;
  addToast: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  addLog: (category: string, message: string, level?: string) => void;
  config: SystemConfig;
  onJobCreated?: () => void;
}



// License Map
const LICENSE_NAME_MAP: Record<string, string> = {
  "ENTERPRISEPACK": "Office 365 E3",
  "SPE_E3": "Microsoft 365 E3",
  "SPE_E5": "Microsoft 365 E5",
  "ENTERPRISEPREMIUM": "Microsoft 365 Business Premium",
  "O365_BUSINESS_PREMIUM": "Microsoft 365 Business Premium",
  "O365_BUSINESS_ESSENTIALS": "Microsoft 365 Business Basic",
  "STANDARDPACK": "Office 365 E1",
  "EMS": "Enterprise Mobility + Security E3",
  "Microsoft_Intune_Endpoint_Privilege_Management": "Intune Endpoint Privilege Management",
  "Teams_Premium_(for_Departments)": "Microsoft Teams Premium",
  "Microsoft_Teams_Rooms_Basic": "Teams Rooms Basic",
  "Microsoft_365_Copilot": "Microsoft 365 Copilot",
  "POWER_BI_PRO": "Power BI Pro",
  "POWER_BI_STANDARD": "Power BI Free",
  "FLOW_FREE": "Power Automate Free",
  "POWERAUTOMATE_ATTENDED_RPA": "Power Automate Premium (RPA)",
  "POWERAPPS_VIRAL": "Power Apps Exploration",
  "POWERAPPS_DEV": "Power Apps Developer Plan",
  "Power_Pages_vTrial_for_Makers": "Power Pages Trial",
  "CCIBOTS_PRIVPREV_VIRAL": "Copilot Studio Trial",
  "WINDOWS_STORE": "Windows Store for Business",
  "DEVELOPER_PACK": "Microsoft 365 Developer Pack",
  "VISIO_CLIENT": "Visio Plan 2",
  "PROJECT_CLIENT": "Project Plan 3",
  "WIN10_PRO_ENT_SUB": "Windows E3",
  "TEAMS_ESSENTIALS": "Teams Essentials",
  "OFFICE_365_E1": "Office 365 E1",
  "OFFICE_365_E3": "Office 365 E3",
  "DYN365_ENTERPRISE_CUSTOMER_SERVICE": "Dynamics 365 Enterprise Customer Service",
  "STREAM": "Microsoft Stream",
  "ENTERPRISEPREMIUM_NOPROVISION": "Microsoft 365 Business Premium (No Provision)",
  "VISIO_PRO_MOCK": "Visio Professional Mock"
};

export const PDFProvisionTab: React.FC<PDFProvisionTabProps> = ({
  onAddUser,
  addToast,
  addLog,
  config,
  onJobCreated
}) => {
  // steps configuration: 
  // 1: Upload & Extract
  // 2: Verify & Edit Fields
  // 2.5: Debug Preview
  // 3: Operation Sequence Running
  const [currentStep, setCurrentStep] = useState<1 | 2 | 2.5 | 3>(1);
  const [debugTab, setDebugTab] = useState<'visual' | 'schema' | 'json'>('visual');


  // --- STEP 1 STATE ---
  const [pdfUrl, setPdfUrl] = useState('');
  const [parsingStatus, setParsingStatus] = useState<'idle' | 'parsing' | 'success'>('idle');
  const [rawJsonOutput, setRawJsonOutput] = useState<string>('{}');
  const [mappedJsonOutput, setMappedJsonOutput] = useState<string>('{}');
  const [autoFillPrintCode, setAutoFillPrintCode] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STEP 2 FORM STATE ---
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [usernameLogon, setUsernameLogon] = useState('');
  const [userPassword, setUserPassword] = useState('P@ssw0rd$');
  const [showPassword, setShowPassword] = useState(false);
  const [office, setOffice] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [printCode, setPrintCode] = useState('');

  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('Thailand');

  const [company, setCompany] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [managerInput, setManagerInput] = useState('');

  const [selectedDN, setSelectedDN] = useState('DC=aapico,DC=com');
  const [selectedOUName, setSelectedNodeName] = useState('aapico.com');

  const [profilePath, setProfilePath] = useState('');
  const [logonScript, setLogonScript] = useState('');
  const [pwdResetOnFirstLogon, setPwdResetOnFirstLogon] = useState(true);
  const [accountEnabled, setAccountEnabled] = useState(true);
  const [sendWelcomeEmailToggle, setSendWelcomeEmailToggle] = useState(true);

  const [isLoadingLicenses, setIsLoadingLicenses] = useState(true);
  const [isFetchingLicenses, setIsFetchingLicenses] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);

  // Email Preview Editor
  const [emailTo, setEmailTo] = useState('');
  const [prevManagerInput, setPrevManagerInput] = useState('');
  const [emailCc, setEmailCc] = useState('it.support@aapico.com');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [defaultTemplate, setDefaultEmailTemplate] = useState('');

  // Selected licenses
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);
  const [licenses, setLicenses] = useState<M365Sku[]>([]);
  const [licenseSearch, setLicenseSearch] = useState('');

  // AD Groups Membership list
  const [adGroupsAssigned, setAdGroupsMembership] = useState<ADGroup[]>([
    { name: "Domain Users", scope: "Global", desc: "Default domain users security group membership" }
  ]);

  // Verification indicators
  const [logonVerification, setLogonVerification] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  const [managerVerification, setManagerVerification] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');

  // --- MODALS STATES ---
  const [isFindGroupsOpen, setIsFindGroupsOpen] = useState(false);
  const [searchGroupQuery, setSearchGroupQuery] = useState('');
  const [foundGroupsList, setFoundGroupsList] = useState<ADGroup[]>([]);
  const [searchingGroups, setSearchingGroups] = useState(false);
  const [selectedGroupFromModal, setSelectedGroupFromModal] = useState<ADGroup | null>(null);

  const [isBulkGroupsOpen, setIsBulkGroupsOpen] = useState(false);
  const [bulkGroupsText, setBulkGroupsText] = useState('');
  const [bulkGroupsList, setBulkGroupsList] = useState<Array<{ name: string; status: string; scope: string; desc: string }>>([]);
  const [verifyingBulkGroups, setVerifyingBulkGroups] = useState(false);

  // --- STEP 3 STATE (PIPELINE RUN) ---
  const [currentPipelineStep, setCurrentPipelineStep] = useState<number>(1);
  const [stepsSchema, setStepsSchema] = useState<any[]>([]);
  const [pipelineStates, setPipelineStates] = useState<Record<string, 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>>({});
  const [pipelineSubStates, setPipelineSubStates] = useState<Record<string, Record<string, 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>>>({});
  const [pipelineState, setPipelineOverallState] = useState<'PROCESSING' | 'DONE' | 'FAILED'>('PROCESSING');
  const [customTerminalLogs, setTerminalLogs] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetchLicenses();
    fetchEmailTemplate();
    fetchStepsSchema();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Update DisplayName from First and Last Name
  
  const getStepPercent = (stepKey: string) => {
    const stepSchema = stepsSchema.find(s => s.key === stepKey);
    if (!stepSchema || !stepSchema.sub_steps || stepSchema.sub_steps.length === 0) return pipelineStates[stepKey] === 'SUCCESS' ? 100 : 0;
    const subState = pipelineSubStates[stepKey] || {};
    const total = stepSchema.sub_steps.length;
    let completed = 0;
    stepSchema.sub_steps.forEach((sub: any) => {
        if (subState[sub.key] === 'SUCCESS') completed += 1;
        else if (subState[sub.key] === 'RUNNING') completed += 0.5;
    });
    return Math.round((completed / total) * 100);
  };

  const ICON_MAP: Record<string, React.ElementType> = {
    UserCheck,
    Printer,
    Cloud,
    Mail,
    Database,
    Hourglass
  };

  const renderDynamicIcon = (iconName: string, state: string) => {
    const Icon = ICON_MAP[iconName] || HelpCircle;
    if (state === 'RUNNING') return <Loader2 className="h-5 w-5 animate-spin" />;
    if (state === 'SUCCESS') return <Check className="h-5 w-5 font-bold text-secondary" />;
    if (state === 'SKIPPED') return <Check className="h-5 w-5 font-bold text-slate-500" />;
    return <Icon className="h-5 w-5" />;
  };

const handleNameTyping = (first: string, last: string) => {
    setFirstName(first);
    setLastName(last);
    setDisplayName(`${first} ${last}`.trim());
    if (usernameLogon === '') {
      setUsernameLogon(`${first.toLowerCase()}.${last.substring(0, 1).toLowerCase()}`);
    }
  };

  
  const fetchStepsSchema = async () => {
    try {
      const res = await fetch('/api/v1/jobs/steps');
      if (res.ok) {
        const data = await res.json();
        setStepsSchema(data.steps || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLicenses = async () => {
    setIsFetchingLicenses(true);
    try {
      const response = await fetch('/api/v1/m365/licenses');
      if (response.ok) {
        const data = await response.json();
        setLicenses(data.licenses || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLicenses(false);
      setIsFetchingLicenses(false);
    }
  };

  const fetchEmailTemplate = async () => {
    try {
      const response = await fetch('/static/component/mail_format.txt');
      if (response.ok) {
        const text = await response.text();
        setDefaultEmailTemplate(text);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  // Compile Dynamic Email Preview
  useEffect(() => {
    if (!defaultTemplate) return;

    let usernameInput = usernameLogon || `${firstName.toLowerCase()}.${lastName.substring(0, Math.min(2, lastName.length)).toLowerCase()}`;
    const emailParts = email.split('@');
    const domainStr = emailParts.length > 1 ? emailParts[1] : (company.toLowerCase().replace(/\s+/g, '') + ".com");

    const calculatedPin = printCode || mobile.replace(/\D/g, '').slice(-6) || "N/A";

    const fields: Record<string, string> = {
      supervisor_name: managerInput || "Supervisor",
      name_english: displayName || `${firstName} ${lastName}`.trim() || 'New Employee',
      company: company || "AAPICO",
      username: usernameInput,
      passwrd: userPassword,
      domain: domainStr,
      format_PDF: "Level C",
      Printer_code: calculatedPin,
      email: email || `${usernameInput}@${domainStr}`
    };

    let supervisorEmail = "supervisor@aapico.com";
    if (managerInput) {
      const mgrLower = managerInput.toLowerCase();
      if (mgrLower.includes("anek")) supervisorEmail = "anek.p@aapico.com";
      else if (mgrLower.includes("somsak")) supervisorEmail = "somsak.s@aapico.com";
      else if (mgrLower.includes("vipha")) supervisorEmail = "vipha.j@aapico.com";
      else {
        const mgrCleanName = managerInput.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
        supervisorEmail = `${mgrCleanName || 'supervisor'}@aapico.com`;
      }
    }

    const lines = defaultTemplate.split('\n');
    let subject = `New AD Account Created for ${fields.name_english} (${fields.company})`;
    let toField = supervisorEmail;
    let ccField = "it.support@aapico.com";

    let bodyStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("To:")) {
        const parsedTo = line.replace("To:", "").trim().split('#')[0].trim();
        if (!parsedTo.includes("supervisor.username@aapico.com")) {
          toField = parsedTo.replace(/\{supervisor_name\}/g, fields.supervisor_name);
        }
      } else if (line.startsWith("Cc:")) {
        ccField = line.replace("Cc:", "").trim().replace(/\{\{ENV_MAIL_CC\}\}/g, "it.support@aapico.com");
      } else if (line.startsWith("Subject:")) {
        subject = line.replace("Subject:", "").trim()
          .replace(/\{name_english\}/g, fields.name_english)
          .replace(/\{company\}/g, fields.company);
      } else if (line.trim().startsWith("Dear Khun")) {
        bodyStartIndex = i;
        break;
      }
    }

    let rawBodyLines = lines.slice(bodyStartIndex).join('\n');
    let dynamicBody = rawBodyLines
      .replace(/@\{\{supervisor_name\}\}/g, fields.supervisor_name)
      .replace(/\{supervisor_name\}/g, fields.supervisor_name)
      .replace(/\{name_english\}/g, fields.name_english)
      .replace(/\{company\}/g, fields.company)
      .replace(/\{username\}/g, fields.username)
      .replace(/\{passwrd\}/g, fields.passwrd)
      .replace(/\{domain\}/g, fields.domain)
      .replace(/\{format_PDF\}/g, fields.format_PDF)
      .replace(/\{Printer_code\}/g, fields.Printer_code)
      .replace(/\{email\}/g, fields.email);

    if (managerInput !== prevManagerInput) {
      setPrevManagerInput(managerInput);
      setEmailTo(toField);
    }
    setEmailCc(ccField);
    setEmailSubject(subject);
    setEmailBody(dynamicBody.trim());
  }, [
    defaultTemplate,
    firstName,
    lastName,
    displayName,
    email,
    company,
    managerInput,
    prevManagerInput,
    userPassword,
    mobile,
    printCode,
    usernameLogon
  ]);

  // Update default print code whenever mobile changes
  const handleMobileInput = (val: string) => {
    setMobile(val);
    if (autoFillPrintCode) {
      const parsedDigits = val.replace(/\D/g, '');
      if (parsedDigits.length >= 6) {
        setPrintCode(parsedDigits.slice(-6));
      } else {
        setPrintCode(parsedDigits);
      }
    }
  };

  // Run Parse endpoint
  const handleUrlParser = async () => {
    if (!pdfUrl) {
      addToast("กรุณาใส่ลิงก์ URL ของไฟล์ PDF ก่อนกดสแกน", "warning");
      return;
    }

    setParsingStatus('parsing');
    addLog("PDF", `ส่งคำขอ URL ไปยังระบบ API สแกนหลักขององค์กร...: ${pdfUrl}`, "INFO");

    try {
      const response = await fetch('/api/v1/parse/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pdfUrl })
      });

      if (!response.ok) {
        throw new Error("HTTP error parsing URL");
      }

      const rawLayout = await response.json();
      setRawJsonOutput(JSON.stringify(rawLayout, null, 4));

      // Build simulated Ad maps
      const mapped = mapLocalRawToADSchema(rawLayout);
      setMappedJsonOutput(JSON.stringify(mapped, null, 4));

      setParsingStatus('success');
      addToast("ดึงข้อมูลและจำลองวิเคราะห์โครงสร้างพารามิเตอร์สำเร็จ!", "success");
      addLog("PDF", "สกัดพารามิเตอร์โครงสร้างเรียบร้อยแล้ว", "SUCCESS");

      // Set forms ready
      populateFormFromExtractedMap(mapped);
    } catch (e) {
      console.error(e);
      addToast("ไม่สามารถเรียกสแกน PDF จาก URL ได้ จะเรียกค่าเริ่มต้นพนักงานสมชายแทน", "warning");
      loadPresetTemplate('somchai');
    }
  };

  const handlePDFFileProcess = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      addToast("กรุณาเลือกหรือวางเฉพาะไฟล์เอกสาร PDF เท่านั้น", "warning");
      return;
    }

    setParsingStatus('parsing');
    addLog("PDF", `ส่งไฟล์ PDF ไปยังระบบ API สแกนหลักขององค์กร...: ${file.name}`, "INFO");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch('/api/v1/parse/file', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errDetails = await response.json().catch(() => ({}));
        throw new Error(errDetails.detail || "HTTP error parsing PDF file");
      }

      const rawLayout = await response.json();
      setRawJsonOutput(JSON.stringify(rawLayout, null, 4));

      // Build simulated Ad maps
      const mapped = mapLocalRawToADSchema(rawLayout);
      setMappedJsonOutput(JSON.stringify(mapped, null, 4));

      setParsingStatus('success');
      addToast("ดึงข้อมูลและจำลองวิเคราะห์โครงสร้างพารามิเตอร์สำเร็จ!", "success");
      addLog("PDF", "สกัดพารามิเตอร์โครงสร้างเรียบร้อยแล้ว", "SUCCESS");

      // Set forms ready
      populateFormFromExtractedMap(mapped);
    } catch (e: any) {
      console.error(e);
      addToast(`ไม่สามารถสแกนไฟล์ PDF ได้: ${e.message || String(e)}`, "error");
      setParsingStatus('idle');
    }
  };

  const loadPresetTemplate = (name: 'somchai' | 'wanida') => {
    setParsingStatus('parsing');
    addLog("PDF", `เรียกประมวลผล Mock PDF Template: ${name}`, "INFO");

    setTimeout(() => {
      // Simulate parser payload
      const mockResult = name === 'somchai' ? {
        document_info: { date: "09/06/2026", doc_no: "EF-2506-82" },
        requester_info: {
          company: "AHT (AAPICO Hitech)",
          name_thai: "นายสมชาย กรทอง",
          name_english: "Mr. Somchai Kornthong",
          employee_id: "10003082",
          position: "Lead Developer",
          department_group: "Engineering",
          department: "Engineering",
          ext: "2256",
          mobile_phone: "0821112233",
          supervisor_name: "Anek Phromsiri",
          supervisor_position: "Director of Engineering",
          address: "99 Moo1, Hitech Industrial Estate, T. Banlane, Bang Pa-in, Ayutthaya",
          zip_code: "13160"
        },
        request_info: {
          user_id: { reason: "เข้าใช้งานระบบเครือข่ายของกลุ่มบริษัทอาปิโก" },
          email: { reason: "ใช้เพื่อติต่อสื่อสารทั้งภายในและภายนอกองค์กร" },
          internet: { level: "Level C", reason: "เข้าใช้งานอินเทอร์เน็ตได้เฉพาะเว็บไซต์งาน" },
          telephone: { type: "Domestic", reason: "ติดต่อกับบุคลภายนอกเกี่ยวข้องกับงาน" },
          printer: { model: "B/W Print", type: "Black-White", reason: "เครื่องพิมพ์ในระบบเครือข่าย" }
        }
      } : {
        document_info: { date: "09/06/2026", doc_no: "EF-2506-83" },
        requester_info: {
          company: "AHA",
          name_thai: "นางสาววนิดา ศรีใส",
          name_english: "Ms. Wanida Srisai",
          employee_id: "10003083",
          position: "HR Specialist",
          department_group: "Human Resources",
          department: "Human Resources",
          ext: "3388",
          mobile_phone: "0819998888",
          supervisor_name: "Vipha Jinda",
          supervisor_position: "VP of HR & Admin",
          address: "HQ Office - Floor 2, Hitech Industrial Estate, Ayutthaya",
          zip_code: "13160"
        },
        request_info: {
          user_id: { reason: "สิทธิเข้าทำประวัติ จัดหาและคัดกรองบุคลากร" },
          email: { reason: "ช่องทางการติดต่อหลักสำหรับฝ่ายบุคลากรสัมพันธ์" },
          internet: { level: "Level B", reason: "สแกนหาเว็บไซต์และสถิติตลาดจัดหางาน" },
          telephone: { type: "Domestic", reason: "นัดหมายสัมภาษณ์งาน" },
          printer: { model: "B/W Print", type: "Black-White", reason: "พิมพ์สัญญาจ้างและประวัติผู้สมัคร" }
        }
      };

      setRawJsonOutput(JSON.stringify(mockResult, null, 4));
      const mapped = mapLocalRawToADSchema(mockResult);
      setMappedJsonOutput(JSON.stringify(mapped, null, 4));

      setParsingStatus('success');
      populateFormFromExtractedMap(mapped);
      addToast(`ประมวลผลสแกนรูปแบบ ${name} สำเร็จ`, "success");
      addLog("PDF", `สกัดและทำแผนผังฟิลด์ template ${name} สำเร็จ`, "SUCCESS");
    }, 800);
  };

  const mapLocalRawToADSchema = (raw: any) => {
    const req = raw.requester_info || {};
    const reqInfo = raw.request_info || {};
    const print = reqInfo.printer || {};
    const web = reqInfo.internet || {};

    let cleanName = (req.name_english || "").replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s+/i, '').trim();
    let parts = cleanName.split(/\s+/);
    let first = parts[0] || '';
    let last = parts.slice(1).join(' ') || '';

    let uid = `${first.toLowerCase()}.${last.substring(0, 1).toLowerCase()}`;
    let phoneDigits = req.mobile_phone ? req.mobile_phone.replace(/\D/g, '') : '';
    let autoPin = phoneDigits.length >= 6 ? phoneDigits.slice(-6) : phoneDigits;

    let ouDN = "OU=newhire,OU=Users,DC=aapico,DC=com";
    if (req.department && req.department.toLowerCase().includes("engineering")) {
      ouDN = "OU=Engineering,OU=Users,DC=aapico,DC=com";
    } else if (req.department && req.department.toLowerCase().includes("human resources")) {
      ouDN = "OU=Human Resources,OU=Users,DC=aapico,DC=com";
    }

    let defaultGroups: ADGroup[] = [
      { name: "Domain Users", scope: "Global", desc: "Default domain users security group membership" }
    ];

    if (web.level) {
      defaultGroups.push({ name: `User_${web.level.replace(/\s+/g, '')}_AH`, scope: "Global", desc: "Auto-assigned Internet level group" });
    }
    if (print.type === "Black-White" || print.model === "B/W Print") {
      defaultGroups.push({ name: "BW200", scope: "Global", desc: "Auto-assigned secure printer mapping group" });
    }

    return {
      metadata: {
        document_info: raw.document_info,
        requester_info: req
      },
      workflow_control: {
        enable_ad_creation: true,
        enable_papercut_sync: true,
        enable_microsoft_365_license: true,
        enable_send_email: true
      },
      task_data: {
        ad_profile: {
          custom_username: uid,
          target_ou: ouDN,
          custom_attributes: {
            first_name: first,
            last_name: last,
            display_name: `${cleanName} (${req.company || 'AAPICO'})`,
            description: req.employee_id || "",
            office: req.company || "",
            email: `${uid}@aapico.com`,
            mobile: req.mobile_phone || "",
            title: req.position || "",
            department: req.department || "",
            company: req.company || "",
            manager: req.supervisor_name || "",
            street: req.address || "",
            city: req.address ? "Bang Pa-in" : "",
            state_province: req.address ? "Phranakhon Sri Ayutthaya" : "",
            zip_postal_code: req.zip_code || "13160",
            country_region: "Thailand"
          },
          ad_groups: defaultGroups
        },
        papercut_profile: {
          print_code: autoPin
        }
      }
    };
  };

  const populateFormFromExtractedMap = (mapped: any) => {
    const profile = mapped.task_data.ad_profile || {};
    const attrs = profile.custom_attributes || {};
    const pc = mapped.task_data.papercut_profile || {};
    const meta = mapped.metadata.requester_info || {};

    setFirstName(attrs.first_name || '');
    setLastName(attrs.last_name || '');
    setDisplayName(attrs.display_name || '');
    setEmail(attrs.email || '');
    setUsernameLogon(profile.custom_username || '');
    setSelectedDN(profile.target_ou || 'DC=aapico,DC=com');

    const ouNameExtMap = profile.target_ou.split(',')[0].replace('OU=', '');
    setSelectedNodeName(ouNameExtMap);

    setCompany(attrs.company || '');
    setDepartment(attrs.department || '');
    setJobTitle(attrs.title || '');
    setManagerInput(attrs.manager || '');
    setMobile(attrs.mobile || '');
    setPrintCode(pc.print_code || '');

    setStreet(attrs.street || '');
    setCity(attrs.city || 'Bang Pa-in');
    setStateName(attrs.state_province || 'Phranakhon Sri Ayutthaya');
    setZipCode(attrs.zip_postal_code || '13160');
    setCountry(attrs.country_region || 'Thailand');

    setDescription(attrs.description || '');
    setLogonScript('');
    setProfilePath('');

    // Load AD Groups
    setAdGroupsMembership(profile.ad_groups || [
      { name: "Domain Users", scope: "Global", desc: "Default domain users security group membership" }
    ]);

    // Choose standard M365 license — use real skuPartNumber values that match the API
    if (attrs.department && attrs.department.toLowerCase().includes("engineering")) {
      setSelectedSkuIds(['EMS', 'STANDARDPACK']);
    } else {
      setSelectedSkuIds(['STANDARDPACK']);
    }
  };

  // Skip to step 2 manually
  const loadIntoStep2Manual = () => {
    setFirstName('');
    setLastName('');
    setDisplayName('');
    setEmail('');
    setUsernameLogon('');
    setSelectedDN('OU=newhire,OU=Users,DC=aapico,DC=com');
    setSelectedNodeName('newhire');
    setPrintCode('');
    setMobile('');
    setManagerInput('');
    setDepartment('');
    setSelectedSkuIds([]);
    setAdGroupsMembership([
      { name: "Domain Users", scope: "Global", desc: "Default domain users security group membership" }
    ]);

    setParsingStatus('idle');
    setCurrentStep(2);
    addToast("ฟอร์มเปิดให้กรอกบัญชีด้วยแมนนวลเปล่า", "info");
  };

  const resetAndRestartPDFProvision = () => {
    setFirstName('');
    setLastName('');
    setDisplayName('');
    setEmail('');
    setUsernameLogon('');
    setSelectedDN('OU=newhire,OU=Users,DC=aapico,DC=com');
    setSelectedNodeName('newhire');
    setPrintCode('');
    setMobile('');
    setPhone('');
    setManagerInput('');
    setDepartment('');
    setSelectedSkuIds([]);
    setAdGroupsMembership([
      { name: "Domain Users", scope: "Global", desc: "Default domain users security group membership" }
    ]);
    setPdfUrl('');
    setParsingStatus('idle');
    setRawJsonOutput('{}');
    setMappedJsonOutput('{}');
    setPipelineOverallState('PROCESSING');
    setTerminalLogs([
      `[${new Date().toLocaleTimeString()}] Waiting to initialize sandbox workflow execution...`
    ]);
    setCurrentStep(1);
    addToast("รีเซ็ตคิวและฟอร์มประวัติพร้อมวิเคราะห์ชุดถัดไป", "info");
  };

  // Verify Logon Name uniquely
  const handleVerifyLogon = async () => {
    if (!usernameLogon) {
      addToast("กรุณากรอก User Logon Name ก่อนทำการตรวจสอบ", "warning");
      return;
    }
    setLogonVerification('verifying');
    try {
      const response = await fetch(`/api/v1/user/ad/check-user?query=${encodeURIComponent(usernameLogon)}&exact=true`);
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setLogonVerification('invalid');
          addToast("ชื่อใช้ล็อกอินนี้ถูกใช้งานไปแล้ว!", "error");
        } else {
          setLogonVerification('valid');
          addToast("ชื่อล็อกอินสามารถใช้งานได้", "success");
        }
      }
    } catch (e) {
      setLogonVerification('invalid');
      addToast("ล้มเหลวในการตรวจสอบ LDAP ADUC", "error");
    }
  };

  // Verify Manager existence in directory
  const handleVerifyManager = async () => {
    if (!managerInput) {
      addToast("กรุณากรอกชื่อผู้จัดการก่อนทำการตรวจสอบ", "warning");
      return;
    }
    setManagerVerification('verifying');
    try {
      const response = await fetch(`/api/v1/user/ad/check-user?query=${encodeURIComponent(managerInput)}&exact=false`);
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setManagerVerification('valid');
          addToast("พบผู้จัดการรายนี้ในระบบ AD (Verified)", "success");
          if (data.username) {
            setEmailTo(`${data.username}@aapico.com`);
          }
        } else {
          setManagerVerification('invalid');
          addToast("ไม่พบผู้จัดการรายนี้ในสารบบ LDAP", "warning");
        }
      }
    } catch (e) {
      setManagerVerification('invalid');
    }
  };

  // --- AD SECURITY GROUPS MODAL LOOKUPS ---
  const handleOpenFindGroups = () => {
    setIsFindGroupsOpen(true);
    setSearchGroupQuery('');
    setFoundGroupsList([]);
    setSelectedGroupFromModal(null);
  };

  const handleSearchGroups = async () => {
    setSearchingGroups(true);
    try {
      const response = await fetch(`/api/v1/user/groups/search?query=${encodeURIComponent(searchGroupQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setFoundGroupsList(data.groups || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingGroups(false);
    }
  };

  const handleAddGroupFromModal = () => {
    if (!selectedGroupFromModal) return;
    const exists = adGroupsAssigned.some((g) => g.name.toLowerCase() === selectedGroupFromModal.name.toLowerCase());
    if (exists) {
      addToast("กลุ่มนี้นายพนักงานได้รับการมอบหมายอยู่ก่อนแล้ว", "warning");
      return;
    }
    setAdGroupsMembership((prev) => [...prev, selectedGroupFromModal]);
    setIsFindGroupsOpen(false);
    addToast(`เพิ่มเข้าไปยังกลุ่มสมาชิก: ${selectedGroupFromModal.name}`, "success");
  };

  const handleRemoveGroup = (name: string) => {
    if (name === "Domain Users") {
      addToast("กลุ่ม Domain Users เป็นค่าเริ่มต้นไม่สามารถลบออกได้", "warning");
      return;
    }
    setAdGroupsMembership((prev) => prev.filter((g) => g.name !== name));
    addToast("ถอดกลุ่มสมาชิกเรียบร้อย", "warning");
  };

  // --- BULK GROUPS MODAL WORKFLOW ---
  const handleVerifyBulkGroups = async () => {
    const list = bulkGroupsText.split(/[,;\n]/).map(g => g.trim()).filter(g => g.length > 0);
    if (list.length === 0) {
      addToast("กรุณากรอกรายชื่อกลุ่มสิทธิ์อย่างน้อย 1 กลุ่ม", "warning");
      return;
    }

    setVerifyingBulkGroups(true);
    try {
      const response = await fetch('/api/v1/user/groups/bulk-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: list })
      });

      if (response.ok) {
        const data = await response.json();
        setBulkGroupsList(data.results || []);
      }
    } catch (e) {
      console.error(e);
      addToast("เกิดข้อผิดพลาดในการติดต่อระบบตรวจสอบ", "error");
    } finally {
      setVerifyingBulkGroups(false);
    }
  };

  const handleAddBulkGroups = () => {
    const valids = bulkGroupsList.filter((g) => g.status === 'Found');
    if (valids.length === 0) {
      addToast("ไม่มีกลุ่มที่มีสถานะถูกต้องเพื่อทำการเพิ่ม", "warning");
      return;
    }

    let added = 0;
    const currentList = [...adGroupsAssigned];
    valids.forEach((vg) => {
      const exists = currentList.some((g) => g.name.toLowerCase() === vg.name.toLowerCase());
      if (!exists) {
        currentList.push({ name: vg.name, scope: vg.scope, desc: vg.desc });
        added++;
        addLog("LDAP", `เพิ่มการจำลองสิทธิเข้ากลุ่ม AD: CN=${vg.name}`, "INFO");
      }
    });

    setAdGroupsMembership(currentList);
    setIsBulkGroupsOpen(false);
    addToast(`Import สำเร็จเพิ่มขึ้น ${added} กลุ่มที่เวอริฟายแล้ว`, "success");
  };

  // --- M365 CHIPS TRIGGERS ---
  // selectedSkuIds tracks by skuPartNumber for UI toggle simplicity.
  // The actual payload is built with full {skuId, skuPartNumber} objects via buildProvisionPayload.
  const handleToggleLicense = (sku: M365Sku) => {
    if (sku.availableUnits <= 0) return;
    const isSelected = selectedSkuIds.includes(sku.skuPartNumber);
    if (isSelected) {
      setSelectedSkuIds((prev) => prev.filter((id) => id !== sku.skuPartNumber));
    } else {
      setSelectedSkuIds((prev) => [...prev, sku.skuPartNumber]);
    }
  };

  // --- PAYLOAD CONSTRUCTION ---
  const buildProvisionPayload = () => {
    const calculatedPin = printCode || mobile.replace(/\D/g, '').slice(-6) || description || "N/A";
    const hasPrintCode = !!printCode && printCode.trim() !== "";
    const hasLicenses = selectedSkuIds.length > 0;
    const hasEmailSend = !!sendWelcomeEmailToggle;

    return {
      metadata: {
        document_info: {
          date: new Date().toLocaleDateString('en-US'),
          doc_no: "AUTO-" + Date.now().toString().slice(-6)
        },
        requester_info: {
          company: company || "AAPICO",
          name_thai: displayName || `${firstName} ${lastName}`.trim() || "New Employee",
          name_english: `${firstName} ${lastName}`.trim() || "New Employee",
          employee_id: description || "EMP" + Date.now().toString().slice(-4),
          position: jobTitle || "Staff",
          department_group: department || "Staff",
          department: department || "Staff",
          ext: "N/A",
          mobile_phone: mobile || "N/A",
          supervisor_name: managerInput || "Supervisor",
          supervisor_position: "Supervisor",
          address: street || "N/A",
          zip_code: zipCode || "13160"
        }
      },
      workflow_control: {
        enable_ad_creation: true,
        enable_papercut_sync: hasPrintCode,
        enable_microsoft_365_license: hasLicenses,
        enable_send_email: hasEmailSend
      },
      task_data: {
        ad_profile: {
          custom_username: usernameLogon,
          target_ou: selectedDN,
          custom_attributes: {
            first_name: firstName,
            last_name: lastName,
            display_name: displayName,
            description: description,
            office: company || "",
            telephone_number: phone || "{To be specified in Step 2}",
            email: email,
            mobile: mobile,
            title: jobTitle,
            department: department,
            company: company,
            manager: managerInput,
            street: street,
            city: city,
            state_province: stateName,
            zip_postal_code: zipCode,
            country_region: country,
            profile_path: profilePath || "{To be specified in Step 2}",
            logon_script: logonScript || "{To be specified in Step 2}",
            change_password_next_logon: true,
            account_disabled: false,
            password: "P@ssw0rd$",
            user_principal_name: email
          }
        },
        papercut_profile: {
          print_code: printCode
        },
        microsoft_365_licenses: {
          SkuId_id: selectedSkuIds.map((partNumber) => {
            const found = licenses.find((l) => l.skuPartNumber === partNumber);
            return {
              skuId: found?.skuId || partNumber,
              skuPartNumber: partNumber
            };
          })
        },
        email_profile: {
          emailSubject: emailSubject,
          emailTo: emailTo,
          emailCc: emailCc,
          emailBody: emailBody
        }
      }
    };
  };

  type StepState = 'STANDBY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  const getStageStyle = (state: StepState) => {
    const styles: Record<StepState, { card: string; icon: string; badge: string; badgeLabel: string }> = {
      RUNNING: { card: 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20', icon: 'bg-primary-container/10 border-primary text-primary animate-pulse shadow-sm', badge: 'bg-primary text-white animate-pulse', badgeLabel: 'RUNNING' },
      SUCCESS: { card: 'border-secondary bg-white shadow-sm', icon: 'bg-secondary/10 border-secondary text-secondary', badge: 'bg-secondary/15 text-secondary', badgeLabel: 'COMPLETED' },
      FAILED: { card: 'border-error bg-error/5 shadow-sm', icon: 'bg-error/10 border-error text-error', badge: 'bg-error text-white', badgeLabel: 'FAILED' },
      SKIPPED: { card: 'border-slate-300 opacity-60 bg-slate-50 shadow-none', icon: 'bg-slate-100 border-slate-300 text-slate-400', badge: 'bg-slate-300 text-slate-700', badgeLabel: 'SKIPPED' },
      STANDBY: { card: 'border-slate-200 opacity-60 bg-slate-50', icon: 'bg-slate-100 border-slate-300 text-slate-400', badge: 'bg-slate-200 text-slate-500', badgeLabel: 'STANDBY' },
    };
    return styles[state];
  };

  // --- RUN PIPELINE MULTI-STEP LOOPS ---
  const handleSequenceStart = async () => {
    // Collect variables
    const payload = buildProvisionPayload();
    const calculatedPin = payload.task_data.papercut_profile.print_code;

    // Initialize pipeline states
    setCurrentPipelineStep(1);
    setPipelineOverallState('PROCESSING');
    setTerminalLogs([`[${new Date().toLocaleTimeString()}] // REST API Pipeline initiated...`]);
    

    // Switch view bounds
    setCurrentStep(3);

    // Call actual job creation endpoint (REST database registration)
    try {
      addLog("JOB", `ลงทะเบียน Task Provisioning ใหม่ในคิวประมวณผล: ${payload.metadata.requester_info.name_english}`, "INFO");
      const jobResponse = await fetch('/api/v1/jobs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!jobResponse.ok) {
        throw new Error(`Failed to create sync job: ${jobResponse.statusText}`);
      }

      const jobData = await jobResponse.json();
      const jobId = jobData.job_id || jobData.job?.id;
      if (!jobId) {
        throw new Error("Job ID was not returned from the server");
      }

      setTerminalData(`[JOB QUEUED] Job registered with ID: ${jobId}`);

      if (onJobCreated) {
        onJobCreated();
      }

      // Start EventSource stream for real-time logs
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const sse = new EventSource(`/api/v1/jobs/${jobId}/stream`);
      eventSourceRef.current = sse;

      sse.addEventListener("step_update", (event) => {
        try {
          const log = JSON.parse(event.data);
          const { step, status, message, metadata } = log;

          setTerminalData(`[${step.toUpperCase()}] ${message}`);
          
          if (step === 'pipeline') return;

          setPipelineStates(prev => {
            let newStatus = status.toUpperCase();
            if (newStatus === 'PENDING') newStatus = 'RUNNING';
            return { ...prev, [step]: newStatus };
          });
          
          if (metadata && metadata.sub_step) {
             setPipelineSubStates(prev => ({
                ...prev,
                [step]: {
                    ...(prev[step] || {}),
                    [metadata.sub_step]: metadata.sub_step_status.toUpperCase()
                }
             }));
          }
        } catch (err) {
          console.error("Error parsing step_update SSE event data:", err);
        }
      });

      const handleJobEnd = (status: 'DONE' | 'FAILED') => {
        setPipelineOverallState(status);
        if (sse) sse.close();

        if (status === 'DONE') {
          const newUserObj: DirectoryUser = {
            uid: usernameLogon,
            name: displayName || `${firstName} ${lastName}`.trim(),
            email: email,
            title: jobTitle,
            dept: department,
            printCode: calculatedPin,
            ou: selectedDN,
            papercut: 'Synced (Auto)',
            status: 'Active',
            mobile: mobile,
            company: company,
            manager: managerInput,
            office: office || company,
            description: description
          };
          onAddUser(newUserObj);
          addLog("SYSTEM", `ผูกบัญชี 3-Tier และเครื่องพิมพ์อัตโนมัติสำเร็จสำหรับ: ${newUserObj.name}`, "SUCCESS");
        } else {
          addLog("SYSTEM", `การดำเนินการ 3-Tier ล้มเหลว กรุณาตรวจสอบ log`, "ERROR");
        }
      };

      sse.addEventListener("job_complete", () => {
        setTerminalData(`// IT Provisioning 3-Tier process successfully finalized!`);
        handleJobEnd('DONE');
      });

      sse.addEventListener("job_failed", (event) => {
        const data = JSON.parse(event.data);
        setTerminalData(`[JOB FAILED] Error: ${data.error || 'Unknown error'}`);
        handleJobEnd('FAILED');
      });

      sse.addEventListener("job_cancelled", () => {
        setTerminalData(`[JOB CANCELLED] Job execution cancelled.`);
        handleJobEnd('FAILED');
      });

      sse.addEventListener("job_paused", () => {
        setTerminalData(`[JOB PAUSED] Job execution paused.`);
      });

      sse.onerror = (err) => {
        console.error("SSE stream connection error:", err);
      };

    } catch (e: any) {
      console.error(e);
      setTerminalData(`[ERROR] Direct pipeline initialization failed: ${e.message}`);
      setPipelineOverallState('FAILED');
    }
  };

  const setTerminalData = (msg: string) => {
    setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    // Scroll Console terminal to bottom
    const box = scrollRef.current;
    if (box) {
      setTimeout(() => {
        box.scrollTop = box.scrollHeight;
      }, 50);
    }
  };

  // --- SORTED AND FILTERED LICENSES ---
  const sortedAndFilteredLicenses = React.useMemo(() => {
    let sorted = [...licenses].sort((a, b) => {
      // Licenses > 0
      if (a.availableUnits > 0 && b.availableUnits > 0) {
        return a.availableUnits - b.availableUnits;
      }
      if (a.availableUnits > 0) return -1;
      if (b.availableUnits > 0) return 1;
      return 0; // Both <= 0
    });

    const term = licenseSearch.toLowerCase();
    return sorted.filter((lic) => {
      const displayName = LICENSE_NAME_MAP[lic.skuPartNumber] || lic.skuPartNumber;
      return displayName.toLowerCase().includes(term) || lic.skuPartNumber.toLowerCase().includes(term);
    });
  }, [licenses, licenseSearch]);


  return (
    <div className="space-y-6">
      {/* Dynamic Header Progress Tracker */}
      <div className="w-full max-w-4xl mx-auto mb-6 select-none shrink-0 pt-2 font-sans">
        <div className="flex items-center justify-between w-full">
          {/* Step 1 */}
          <div className="flex flex-col items-center gap-1.5 flex-grow text-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 ${currentStep > 1
              ? 'bg-[#006e2c] border border-[#006e2c] text-white'
              : currentStep === 1
                ? 'bg-primary border border-primary text-white ring-4 ring-primary/20 font-black'
                : 'bg-white border-2 border-slate-300 text-slate-400'
              }`}>
              {currentStep > 1 ? <Check className="h-4.5 w-4.5 font-black" /> : <span className="font-bold text-sm">1</span>}
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${currentStep > 1 ? 'text-[#006e2c]' : currentStep === 1 ? 'text-primary font-black' : 'text-slate-400'
              }`}>
              Upload &amp; Extract
            </span>
          </div>

          <div className={`h-[2px] flex-grow mb-5 transition-all duration-300 ${currentStep > 1 ? 'bg-[#006e2c]' : 'bg-slate-200'}`} />

          {/* Step 2 */}
          <div className="flex flex-col items-center gap-1.5 flex-grow text-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 ${currentStep > 2
              ? 'bg-[#006e2c] border border-[#006e2c] text-white'
              : currentStep === 2
                ? 'bg-primary border border-primary text-white ring-4 ring-primary/20 font-black'
                : 'bg-white border-2 border-slate-300 text-slate-400'
              }`}>
              {currentStep > 2 ? <Check className="h-4.5 w-4.5 font-black" /> : <span className="font-bold text-sm">2</span>}
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${currentStep > 2 ? 'text-[#006e2c]' : currentStep === 2 ? 'text-primary font-black' : 'text-slate-400'
              }`}>
              Verify &amp; Edit
            </span>
          </div>

          <div className={`h-[2px] flex-grow mb-5 transition-all duration-300 ${currentStep > 2 ? 'bg-[#006e2c]' : 'bg-slate-200'}`} />

          {/* Step 3 */}
          <div className="flex flex-col items-center gap-1.5 flex-grow text-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${currentStep === 3
              ? 'bg-primary border border-primary text-white shadow-lg ring-4 ring-primary/30 font-black animate-pulse'
              : 'bg-white border-2 border-slate-300 text-slate-400'
              }`}>
              <span className="font-bold text-sm">3</span>
            </div>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${currentStep === 3 ? 'text-primary font-black' : 'text-slate-400'
              }`}>
              Operation Sequence
            </span>
          </div>
        </div>
      </div>

      {/* STEP 1: PARSING PLATFORM */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left parser parameters layout */}
          <div className="lg:col-span-5 bg-white border border-outline-variant p-6 rounded-lg space-y-6 shadow-sm">
            <h3 className="font-bold text-primary text-base">นำเข้าเอกสารขอใช้ไอทีพนักงานใหม่</h3>
            <p className="text-xs text-on-surface-variant font-body">
              สแกนคำขอใช้อุปกรณ์สิทธิ IT ด้วย AI Parser ในรูปแบบไฟล์ PDF เพื่อนำข้อมูลมาจัดสรรบัญชี 3-Tier (AD/M365/Printer) คล่องตัว
            </p>

            <div className="space-y-1.5 pt-2">
              <label className="font-bold text-xs uppercase text-slate-500 block">วางไฟล์ลิงก์ URL เอกสารคำขอสิทธิ PDF</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  className="flex-grow p-3 border border-outline-variant text-xs bg-surface-bright rounded outline-none h-11 focus:ring-1 focus:ring-primary focus:border-primary"
                  placeholder="https://aapico.com/forms/newhire-somchai.pdf"
                />
                <button
                  type="button"
                  onClick={handleUrlParser}
                  disabled={parsingStatus === 'parsing'}
                  className="px-4 bg-tertiary text-white text-xs font-bold rounded hover:bg-tertiary-container cursor-pointer transition-colors duration-150 h-11 shrink-0 flex items-center gap-1.5"
                >
                  {parsingStatus === 'parsing' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Parse URL</span>
                </button>
              </div>
            </div>

            {/* Real Drag & Drop card */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handlePDFFileProcess(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed p-8 rounded-lg text-center transition-all cursor-pointer select-none group ${
                isDragging 
                  ? 'border-primary bg-primary/5 scale-[1.02] shadow-md ring-1 ring-primary/20' 
                  : 'border-outline-variant bg-surface-container-lowest hover:border-primary hover:bg-slate-50/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handlePDFFileProcess(e.target.files[0]);
                  }
                }}
              />
              <Upload className={`h-10 w-10 mx-auto mb-2.5 transition-all ${
                isDragging ? 'text-primary scale-110' : 'text-outline group-hover:text-primary'
              }`} />
              <span className="text-xs font-bold text-slate-800 block mb-1">
                {isDragging ? 'วางไฟล์ที่นี่เพื่อเริ่มสแกน' : 'ลากไฟล์ PDF คำร้องมาวางที่นี่ หรือคลิกเพื่ออัปโหลด'}
              </span>
              <span className="text-[10px] text-outline">รองรับเฉพาะเอกสารไฟล์ PDF เท่านั้น</span>
            </div>

            <div className="bg-surface-container-low p-4 rounded-lg">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoFillPrintCode}
                  onChange={(e) => setAutoFillPrintCode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                <span className="ml-3 text-xs font-semibold text-slate-800">Auto-fill Print Code (6 หลักท้ายเบอร์โทร)</span>
              </label>
            </div>
          </div>

          {/* Right parser outputs pane */}
          <div className="lg:col-span-7 bg-white border border-outline-variant p-6 rounded-lg shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b pb-4 border-outline-variant mb-4 shrink-0">
                <h3 className="font-bold text-primary text-base">สกัดพารามิเตอร์โครงสร้างผู้ใช้ (JSON Result)</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider ${parsingStatus === 'parsing'
                  ? 'bg-yellow-500 text-white animate-pulse'
                  : parsingStatus === 'success'
                    ? 'bg-secondary text-white'
                    : 'bg-surface-container-high text-outline'
                  }`}>
                  {parsingStatus === 'parsing' ? 'Parsing...' : parsingStatus === 'success' ? 'Extracted (200 OK)' : 'Standby'}
                </span>
              </div>

              {parsingStatus === 'parsing' ? (
                <div className="py-24 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-xs text-outline font-mono">Dynamic PDF Parser is parsing metadata...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-on-surface-variant italic">
                    เปรียบเทียบข้อมูลจริงที่สกัดได้จาก PDF (Raw Content) ยานประมวล และการแมเปอร์ด่าน Attributes เข้า Active Directory (AD Mapper) ตามระเบียบเครือข่ายองค์กรอาปิโก
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-outline mb-1.5">1. ข้อมูลสกัดจาก PDF (Raw Output.json)</div>
                      <div className="bg-surface-container-low p-3 rounded-md font-mono text-[11px] text-on-surface border border-outline-variant h-64 overflow-y-auto custom-scrollbar">
                        <pre>{rawJsonOutput}</pre>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-outline mb-1.5">2. ผลแปลงฟิลด์จำลอง (AD Mapped Preview)</div>
                      <div className="bg-surface-container-low p-3 rounded-md font-mono text-[11px] text-on-surface border border-outline-variant h-64 overflow-y-auto custom-scrollbar">
                        <pre>{mappedJsonOutput}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-outline-variant mt-6 flex flex-wrap gap-2 justify-end shrink-0">
              <button
                type="button"
                onClick={() => loadPresetTemplate('somchai')}
                className="px-3 py-2 border border-outline text-slate-700 text-xs rounded font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ใช้แม่แบบ Somchai_Request
              </button>
              <button
                type="button"
                onClick={() => loadPresetTemplate('wanida')}
                className="px-3 py-2 border border-outline text-slate-700 text-xs rounded font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ใช้แม่แบบ Wanida_Request
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={parsingStatus !== 'success'}
                className="px-5 py-2.5 bg-secondary text-white text-xs uppercase font-black tracking-widest rounded hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
              >
                ตรวจสอบข้อมูลฟอร์ม &gt;
              </button>
              <button
                type="button"
                onClick={loadIntoStep2Manual}
                className="px-3 py-2 text-primary font-bold text-xs hover:underline cursor-pointer ml-2 self-center"
              >
                ข้ามสแกน PDF /สร้างแมนนวลเอง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: VERIFICATION & BENTO GRID VIEW */}
      {currentStep === 2 && (
        <div className="bg-white border border-outline-variant p-6 lg:p-8 rounded-lg relative shadow-sm space-y-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary" />

          <div className="flex justify-between items-center border-b pb-3 border-outline-variant shrink-0">
            <h3 className="text-subhead-sm font-bold text-primary flex items-center gap-1.5 mb-0">
              <FolderOpen className="h-5 w-5 text-primary shrink-0" /> ตรวจสอบและแก้ไขข้อมูลคำร้องขอสิทธิ (Verify &amp; Edit Fields)
            </h3>
            <span className="bg-secondary/15 text-secondary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              PDF Extracted Layout
            </span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSequenceStart(); }} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Form Panel */}
              <div className="lg:col-span-7 space-y-6">

                {/* General Information card */}
                <div className="bg-surface p-6 rounded-xl border border-outline-variant shadow-sm space-y-4 relative">
                  <h4 className="text-xs uppercase font-black text-primary tracking-wider border-b pb-2 border-outline-variant flex items-center gap-1.5">
                    <UserCheck className="h-4.5 w-4.5 shrink-0" /> ข้อมูลทั่วไปผู้ใช้งาน (General Information)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">First Name (ชื่อภาษาอังกฤษ) *</label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => handleNameTyping(e.target.value, lastName)}
                        className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm focus:ring-1 focus:ring-primary focus:border-primary font-semibold outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">Last Name (นามสกุลภาษาอังกฤษ) *</label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => handleNameTyping(firstName, e.target.value)}
                        className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm focus:ring-1 focus:ring-primary focus:border-primary font-semibold outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-xs uppercase text-slate-500 block">Display Name (ชื่อแสดงในระบบ)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="flex-grow p-2.5 border border-outline-variant bg-surface-bright rounded text-sm font-semibold outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setDisplayName(`${firstName} ${lastName}`.trim())}
                        className="px-3 bg-primary text-on-primary font-black uppercase rounded text-[10px] tracking-widest hover:bg-primary-container cursor-pointer transition-colors shrink-0 h-10"
                      >
                        Auto-generate
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">User Logon Name *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={usernameLogon}
                          onChange={(e) => { setUsernameLogon(e.target.value); setLogonVerification('idle'); }}
                          className="flex-grow p-2.5 border border-outline-variant bg-surface-bright rounded text-sm font-mono focus:ring-1 focus:ring-primary outline-none focus:border-primary font-bold text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyLogon}
                          disabled={logonVerification === 'verifying'}
                          className="px-3 bg-primary text-white font-bold rounded text-xs hover:brightness-105 transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer h-10 shrink-0 select-none"
                        >
                          {logonVerification === 'verifying' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" />
                          )}
                          <span>Verify</span>
                        </button>
                      </div>
                      {logonVerification === 'valid' && (
                        <p className="text-[10px] text-secondary font-bold">✓ ชื่อล็อกอินนี้สามารถใช้งานได้ (Availableใน LDAP)</p>
                      )}
                      {logonVerification === 'invalid' && (
                        <p className="text-[10px] text-error font-bold">✗ ชื่อใช้ล็อกอินนี้ชนกับพนักงานรายอื่นใน Active Directory</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">Primary Account Password *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={userPassword}
                          onChange={(e) => setUserPassword(e.target.value)}
                          className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm font-mono outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-slate-800"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">E-mail Address *</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="employee.name@aapico.com"
                        className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm outline-none shrink"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">Office (ระดับสถานที่/โต๊ะ)</label>
                      <input
                        type="text"
                        value={office}
                        onChange={(e) => setOffice(e.target.value)}
                        className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-xs uppercase text-slate-500 block">Task Description (เพื่อลงใน AD LDAP attributes)</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-xs outline-none min-h-[60px]"
                      placeholder="เช่น ข้อมูลรหัสพนักงาน หรือสิทธิ์ที่ต้องใช้..."
                    />
                  </div>
                </div>

                {/* Directory Store OU Placement Selector */}
                <div className="bg-surface p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
                  <h4 className="text-xs uppercase font-black text-primary tracking-wider border-b pb-2 border-outline-variant">
                    การจัดเก็บ Organizational Unit (OU)
                  </h4>
                  <p className="text-[11px] text-outline font-medium">
                    คลิกเลือกโฟลเดอร์ OU/Container บนโครงสร้างไดเรกทอรีด้านล่างเพื่อเป็นพาธปลายทางในการสร้าง Account Objectจริง
                  </p>

                  {/* Embedded ADUC Tree */}
                  <ADUCTree
                    selectedDN={selectedDN}
                    setSelectedDN={setSelectedDN}
                    onPathChange={(dn, name) => {
                      setSelectedDN(dn);
                      setSelectedNodeName(name);
                    }}
                  />

                  {/* Highlight Path strip */}
                  <div className="p-3 bg-surface-container-low border border-outline-variant rounded flex items-center gap-3">
                    <Folder className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-grow">
                      <p className="text-[9px] font-black text-outline uppercase tracking-wider leading-none">Target LDAP DN Path</p>
                      <p className="text-xs font-mono font-bold text-primary truncate mt-0.5" title={selectedDN}>
                        {selectedDN}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Country and address info */}
                <div className="bg-surface p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
                  <h4 className="text-xs uppercase font-black text-primary tracking-wider border-b pb-2 border-outline-variant">
                    Address Details (ที่อยู่ติดต่อพนักงาน)
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Street Address</label>
                      <input
                        type="text"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="w-full text-xs p-2.5 border border-outline-variant bg-surface-bright rounded outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">City / District</label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full text-xs p-2.5 border border-outline-variant bg-surface-bright rounded outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">State / Province</label>
                        <input
                          type="text"
                          value={stateName}
                          onChange={(e) => setStateName(e.target.value)}
                          className="w-full text-xs p-2.5 border border-outline-variant bg-surface-bright rounded outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Postal Code</label>
                        <input
                          type="text"
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          className="w-full text-xs p-2.5 border border-outline-variant bg-surface-bright rounded outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Country</label>
                        <input
                          type="text"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full text-xs p-2.5 border border-outline-variant bg-surface-bright rounded outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* M365 Licenses assignments */}
                <div className="bg-primary/5 p-6 rounded-xl border-2 border-primary/20 shadow-md space-y-4">
                  <div className="flex justify-between items-center border-b pb-2 border-outline-variant shrink-0">
                    <h4 className="text-xs uppercase font-black text-primary tracking-wider flex items-center gap-1">
                      Microsoft 365 License Assignment
                    </h4>
                    <span className="bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm select-none">
                      LIVE O365 API STOCK
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <input
                        type="text"
                        value={licenseSearch}
                        onChange={(e) => setLicenseSearch(e.target.value)}
                        placeholder="Search M365 SKUs (เช่น STANDARDPACK, FLOW)..."
                        className="w-full text-xs p-2.5 pl-8 border border-outline-variant rounded bg-white outline-none"
                      />
                      <Search className="h-4 w-4 text-outline absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                    {licenseSearch && (
                      <button
                        type="button"
                        onClick={() => setLicenseSearch('')}
                        className="text-xs font-bold text-outline hover:text-slate-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Licenses stocking grids */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto custom-scrollbar pr-1.5 relative">
                    {isLoadingLicenses && (
                      <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                      </div>
                    )}
                    {isFetchingLicenses && !isLoadingLicenses && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-primary bg-white px-2 py-1 rounded shadow-sm border border-primary/20 z-10">
                        <Loader2 className="h-3 w-3 animate-spin" /> Syncing
                      </div>
                    )}
                    {sortedAndFilteredLicenses.map((lic) => {
                      const isSelected = selectedSkuIds.includes(lic.skuPartNumber);
                      const isOut = lic.availableUnits <= 0;
                      const displayName = LICENSE_NAME_MAP[lic.skuPartNumber] || lic.skuPartNumber;

                      return (
                        <div
                          key={lic.skuPartNumber}
                          onClick={() => handleToggleLicense(lic)}
                          className={`p-3 rounded-lg border flex items-center justify-between transition-all select-none duration-200 ease-out active:scale-[0.98] ${isOut
                            ? 'bg-slate-100/70 border-slate-200 opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'bg-primary/10 border-primary text-primary cursor-pointer'
                              : 'bg-white border-outline-variant cursor-pointer hover:border-slate-400'
                            }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-bold truncate" title={displayName}>{displayName}</p>
                            <p className={`text-[9px] font-semibold ${isOut ? 'text-error' : 'text-secondary'} mt-0.5`}>
                              {isOut ? 'Out of Stock' : `${lic.availableUnits} Available`}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isOut}
                            onChange={() => { }} // Click handled by parent wrapper click
                            className="rounded text-primary focus:ring-primary h-4.5 w-4.5 shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Right Form Panel */}
              <div className="lg:col-span-5 space-y-6">

                {/* Organization details card */}
                <div className="bg-surface p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
                  <h4 className="text-xs uppercase font-black text-primary tracking-wider border-b pb-2 border-outline-variant">
                    ข้อมูลส่วนงาน (Organization Details)
                  </h4>

                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">Company (บริษัท)</label>
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="เช่น AAPICO Hitech PLC"
                        className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">Department (ส่วนงาน/แผนก)</label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="เช่น System Engineering"
                        className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">Job Title (ตำแหน่งงาน)</label>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="เช่น Software Architect"
                        className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">Supervisor Manager / ผู้จัดการ *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={managerInput}
                          onChange={(e) => { setManagerInput(e.target.value); setManagerVerification('idle'); }}
                          className="flex-grow p-2.5 border border-outline-variant bg-surface-bright rounded text-sm font-semibold outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyManager}
                          disabled={managerVerification === 'verifying'}
                          className="px-3 bg-primary text-white font-bold rounded text-xs hover:brightness-105 transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer h-10 shrink-0 select-none"
                        >
                          {managerVerification === 'verifying' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" />
                          )}
                          <span>Verify</span>
                        </button>
                      </div>
                      {managerVerification === 'valid' && (
                        <p className="text-[10px] text-secondary font-bold">✓ พบผู้บัญชาการรายนี้อยู่ในระบบกลุ่มสมาชิกบริษัทแล้ว</p>
                      )}
                      {managerVerification === 'invalid' && (
                        <p className="text-[10px] text-error font-bold">✗ ไม่พบข้อมูลผู้จัดการรายนี้ในระบบ AD (กรุณากลั่นกรองชื่อใหม่)</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-xs uppercase text-slate-500 block">Supervisor Manager Email (อีเมลผู้จัดการ) *</label>
                      <input
                        type="email"
                        required
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder="เช่น somchai.m@aapico.com"
                        className="w-full p-2.5 border border-outline-variant bg-surface-bright rounded text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* AD Security Group memberships card */}
                <div className="bg-surface p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-2 border-outline-variant shrink-0">
                    <h4 className="text-xs uppercase font-black text-primary tracking-wider mb-0">
                      AD Group Memberships
                    </h4>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBulkGroupsOpen(true)}
                      className="flex-1 py-2 px-3 border border-outline-variant text-[11px] font-bold rounded bg-white hover:bg-slate-50 hover:border-slate-400 select-none cursor-pointer duration-100 shrink-0 text-center"
                    >
                      Bulk verify
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenFindGroups}
                      className="flex-1 py-1.5 px-3 bg-primary text-white text-[11px] font-black uppercase tracking-wider rounded hover:brightness-105 select-none cursor-pointer duration-100 shrink-0 text-center"
                    >
                      + Add Group
                    </button>
                  </div>

                  {/* AD list Table */}
                  <div className="border border-outline-variant rounded bg-white overflow-hidden max-h-48 overflow-y-auto custom-scrollbar px-1">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f5f5f5] text-slate-700 font-semibold sticky top-0 border-b border-[#edebe9]">
                        <tr>
                          <th className="p-2.5">Group Title</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-body text-[11px]">
                        {adGroupsAssigned.map((group) => (
                          <tr key={group.name} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{group.name}</td>
                            <td className="p-2.5 text-right">
                              {group.name === "Domain Users" ? (
                                <span className="text-[10px] text-outline font-semibold italic">Default</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveGroup(group.name)}
                                  className="text-error hover:underline text-[10px] font-black uppercase"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Account & Profile Configuration details */}
                <div className="bg-surface p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-2 border-outline-variant">
                    <h4 className="text-xs uppercase font-black text-primary tracking-wider mb-0 text-center">
                      Account Parameters
                    </h4>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={accountEnabled}
                        onChange={(e) => setAccountEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-outline-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary shrink-0"></div>
                      <span className="ml-2 text-[10px] font-bold text-slate-700 uppercase pr-1 select-none">Active</span>
                    </label>
                  </div>

                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Mobile Phone *</label>
                      <input
                        type="tel"
                        required
                        value={mobile}
                        onChange={(e) => handleMobileInput(e.target.value)}
                        placeholder="เช่น 0821112233"
                        className="w-full text-xs p-2.5 border border-outline-variant bg-surface-bright rounded outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Papercut Print Code (6 หลัก)</label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={printCode}
                        onChange={(e) => setPrintCode(e.target.value)}
                        placeholder="ดึงจากการกรองมือถือ หรือกรอกเพิ่มเติม"
                        className="w-full font-mono text-xs font-bold text-primary tracking-widest p-2.5 border border-slate-200 bg-slate-50 rounded outline-none"
                      />
                      <p className="text-[9px] text-secondary font-bold">✓ รหัสพิมพ์ 6 หลักในการกด Release งานพิมพ์ที่เครื่องพิมพ์</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Roaming Profile Path</label>
                      <input
                        type="text"
                        value={profilePath}
                        onChange={(e) => setProfilePath(e.target.value)}
                        placeholder="\\server\profiles\%username%"
                        className="w-full text-xs p-2.5 border border-outline-variant bg-surface-bright rounded outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Logon Script Name</label>
                      <input
                        type="text"
                        value={logonScript}
                        onChange={(e) => setLogonScript(e.target.value)}
                        placeholder="เช่น mapping_script.bat"
                        className="w-full text-xs p-2.5 border border-outline-variant bg-surface-bright rounded outline-none"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-outline-variant">
                      <div className="flex items-center justify-between p-2.5 border border-outline-variant bg-white rounded-lg">
                        <span className="text-[11px] font-bold text-slate-800">เปลี่ยนรหัสผ่านในการล็อกอินครั้งแรก</span>
                        <input
                          type="checkbox"
                          checked={pwdResetOnFirstLogon}
                          onChange={(e) => setPwdResetOnFirstLogon(e.target.checked)}
                          className="rounded text-primary focus:ring-primary h-4 w-4 shrink-0"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 border border-outline-variant bg-primary/5 rounded-lg">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-primary uppercase">ส่ง Welcome Email แจ้งรหัสผ่าน</span>
                          <span className="text-[9px] text-outline font-semibold">ส่งแจ้งหัวหน้างานและ Support</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={sendWelcomeEmailToggle}
                          onChange={(e) => setSendWelcomeEmailToggle(e.target.checked)}
                          className="rounded text-primary focus:ring-primary h-4 w-4 shrink-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* OUTLOOK EMAIL PREVIEW EDITOR SECTION (Full Width) */}
              <div className="col-span-12 space-y-4 border-t pt-6 border-outline-variant">
                <div className="flex justify-between items-center shrink-0">
                  <div>
                    <h4 className="text-subhead-sm font-bold text-primary flex items-center gap-1.5 mb-1 text-left">
                      <Mail className="h-5 w-5 text-primary" /> Outlook SMTP Delivery Welcome Mail Preview
                    </h4>
                    <p className="text-xs text-outline font-body leading-none">
                      ตรวจสอบรูปแบบเนื้อหาจดหมายจัดส่งรหัสล็อกอินที่จะส่งเข้าระบบเมลองค์กรโดยทันทีเมื่อAD accountสร้างเสร็จ (Outlook Style)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendWelcomeEmailToggle}
                      onChange={(e) => setSendWelcomeEmailToggle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-outline-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary shrink-0"></div>
                  </label>
                </div>

                {sendWelcomeEmailToggle ? (
                  <div className="bg-[#f3f2f1] p-4 rounded-lg border border-[#edebe9] transition-all">
                    <div className="bg-white border border-[#edebe9] rounded shadow-sm overflow-hidden flex flex-col">
                      <div className="p-3 bg-white space-y-1.5 border-b border-[#edebe9]">
                        <div className="flex items-center border-b border-[#edebe9] pb-0.5">
                          <span className="w-16 text-xs text-slate-500 font-semibold px-2">To</span>
                          <input
                            type="text"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            className="flex-grow border-none focus:ring-0 text-xs py-1 px-1 font-semibold text-slate-800 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center border-b border-[#edebe9] pb-0.5">
                          <span className="w-16 text-xs text-slate-500 font-semibold px-2">Cc</span>
                          <input
                            type="text"
                            value={emailCc}
                            onChange={(e) => setEmailCc(e.target.value)}
                            className="flex-grow border-none focus:ring-0 text-xs py-1 px-1 font-semibold text-slate-800 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center">
                          <span className="w-16 text-xs text-slate-500 font-semibold px-2">Subject</span>
                          <input
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            className="flex-grow border-none focus:ring-0 text-xs py-1 px-1 font-black text-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Paper-pad layout body container text editor */}
                      <div className="p-4 bg-[#f3f2f1] shrink min-h-[300px]">
                        <div className="max-w-2xl mx-auto border border-[#edebe9] p-6 shadow-sm bg-white min-h-[290px] flex flex-col">
                          <textarea
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            className="w-full flex-grow border-none focus:ring-0 text-xs text-slate-800 leading-relaxed font-body h-64 focus:outline-none outline-none overflow-y-auto custom-scrollbar"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-xs text-outline italic border bg-slate-50 border-double border-outline-variant rounded">
                    Email Notification dispatching has been disabled. Supervisor welcome email flow will not trigger.
                  </div>
                )}
              </div>
            </div>

            {/* Form actions footer bar */}
            <div className="pt-6 border-t border-outline-variant flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-5 py-3 border border-outline text-outline font-black rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 duration-100 cursor-pointer text-xs"
              >
                <ArrowLeft className="h-4.5 w-4.5" /> BACK TO PARSER
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={loadIntoStep2Manual}
                  className="px-5 py-3 border border-primary text-primary font-black rounded-lg hover:bg-primary/5 transition-colors cursor-pointer text-xs"
                >
                  RESET FORM
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2.5)}
                  className="px-6 py-3 bg-secondary text-white font-black rounded-lg hover:brightness-105 shadow-md flex items-center gap-1.5 transition-all active:scale-98 cursor-pointer text-xs"
                >
                  DEBUG PAYLOAD PREVIEW
                </button>
                <button
                  type="button"
                  onClick={() => { setCurrentStep(3); handleSequenceStart(); }}
                  className="px-6 py-3 bg-slate-700 text-white font-black rounded-lg hover:brightness-105 shadow-md flex items-center gap-1.5 transition-all active:scale-98 cursor-pointer text-xs"
                >
                  SKIP TO OPERATION
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2.5: DEBUG PREVIEW */}
      {currentStep === 2.5 && (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm flex flex-col h-[700px]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Review Provisioning Payload</h3>
              <p className="text-xs text-slate-500">Stage 2.5: Ensure all mapped values and operational triggers are correctly configured before final deployment.</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-outline-variant px-6">
            <button type="button" className={`px-4 py-3 text-xs font-bold uppercase transition-all ${debugTab === 'visual' ? 'text-primary border-b-2 border-primary' : 'text-slate-500'}`} onClick={() => setDebugTab('visual')}>Visual Inspector</button>
            <button type="button" className={`px-4 py-3 text-xs font-bold uppercase transition-all ${debugTab === 'schema' ? 'text-primary border-b-2 border-primary' : 'text-slate-500'}`} onClick={() => setDebugTab('schema')}>Technical Schema</button>
            <button type="button" className={`px-4 py-3 text-xs font-bold uppercase transition-all ${debugTab === 'json' ? 'text-primary border-b-2 border-primary' : 'text-slate-500'}`} onClick={() => setDebugTab('json')}>Raw JSON</button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {debugTab === 'visual' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">Identity & Metadata <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded">VERIFIED</span></h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div><p className="text-slate-500 uppercase">Full Name</p><p className="font-bold">{displayName}</p></div>
                    <div><p className="text-slate-500 uppercase">Employee ID</p><p className="font-bold">{description}</p></div>
                    <div><p className="text-slate-500 uppercase">Company</p><p className="font-bold">{company}</p></div>
                    <div><p className="text-slate-500 uppercase">Document No.</p><p className="font-bold">PRV-{Date.now().toString().slice(-6)}</p></div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">Workflow Logic</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span>AD Object Creation</span><span className="font-bold">Enabled</span></div>
                    <div className="flex justify-between"><span>Papercut Sync</span><span className="font-bold">Enabled</span></div>
                    <div className="flex justify-between"><span>M365 Licensing</span><span className="font-bold">Enabled</span></div>
                    <div className="flex justify-between text-slate-400"><span>Email Dispatching</span><span className="font-bold">{sendWelcomeEmailToggle ? 'Enabled' : 'Bypassed'}</span></div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-4">Directory Placement</h4>
                  <p className="text-slate-500 text-[10px] uppercase">Target OU</p>
                  <p className="text-xs font-mono bg-slate-100 p-2 rounded mb-2">{selectedDN}</p>
                  <p className="text-slate-500 text-[10px] uppercase">Groups</p>
                  <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                    {adGroupsAssigned.map(g => <span key={g.name} className="bg-blue-50 text-blue-700 px-2 py-1 rounded">{g.name}</span>)}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-4">Asset Allocation</h4>
                  <p className="text-slate-500 text-[10px] uppercase">M365 SKUs</p>
                  <ul className="text-xs mb-4">
                    {selectedSkuIds.map(sku => <li key={sku}>{LICENSE_NAME_MAP[sku] || sku}</li>)}
                  </ul>
                  <p className="text-slate-500 text-[10px] uppercase">Print Code</p>
                  <p className="text-2xl font-bold text-primary tracking-widest">{printCode}</p>
                </div>
              </div>
            )}
            {debugTab !== 'visual' && (
              <pre className="bg-slate-900 text-slate-100 p-6 rounded-lg text-xs overflow-auto h-full font-mono leading-relaxed">
                {JSON.stringify(buildProvisionPayload(), null, 4)}
              </pre>
            )}
          </div>

          {/* Action Bar */}
          <div className="px-6 py-4 border-t border-outline-variant flex justify-between items-center bg-white">
            <div className="flex items-center gap-2 text-green-700 text-xs font-bold">
              <CheckCircle className="h-4 w-4" /> Payload Integrity Verified
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs uppercase font-bold rounded hover:bg-slate-200 transition-all cursor-pointer"
              >
                Back to Editor
              </button>
              <button
                type="button"
                onClick={() => { setCurrentStep(3); handleSequenceStart(); }}
                className="px-4 py-2 bg-primary text-white text-xs uppercase font-bold rounded hover:brightness-105 transition-all cursor-pointer shadow"
              >
                Proceed to Deploy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: RUN AUTOMATED SEQUENCE PIPE STATE */}
      {currentStep === 3 && (
        <div className="bg-white border border-outline-variant p-6 rounded-lg shadow-sm space-y-6 font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 border-outline-variant gap-3">
            <div>
              <h3 className="font-bold text-primary text-base flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                กำลังประมวลผลการจัดสรรสิทธิ์ (3-Tier Real-time Provision Pipeline)
              </h3>
              <p className="text-xs text-on-surface-variant font-body">
                ระบบบิวท์เวิร์กโหลดคิวอัตโนมัติ สั่งผูกข้อมูลเครื่องพิมพ์ อีเมล และ License จาก Active Directory
              </p>
            </div>
            <span className={`px-3 py-1 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-sm ${pipelineState === 'PROCESSING'
              ? 'bg-[#1a73e8] animate-pulse'
              : pipelineState === 'DONE'
                ? 'bg-secondary'
                : 'bg-error'
              }`}>
              {pipelineState === 'PROCESSING' ? 'RUNNING' : pipelineState}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">

            {/* Left Steps tracker panels - Active Provisioning Pipeline */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                Active Provisioning Pipeline
              </h4>

              <div className="flex flex-col gap-4 relative pb-2 pl-2">
                {/* Connector Line */}
                <div className="absolute left-[30px] top-8 bottom-8 w-[2px] bg-slate-200 z-0"></div>

                {/* Dynamic Pipeline Stages */}
                {stepsSchema.map((step) => {
                  const state = pipelineStates[step.key] || 'STANDBY';
                  const percent = getStepPercent(step.key);
                  const subStates = pipelineSubStates[step.key] || {};
                  
                  return (
                    <div key={step.key} className={`flex gap-4 p-4 rounded-xl border relative z-10 transition-all duration-300 ${getStageStyle(state).card}`}>
                      <div className="shrink-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-300 ${getStageStyle(state).icon}`}>
                          {renderDynamicIcon(step.icon, state)}
                        </div>
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-xs text-on-surface">{step.display_name}</h4>
                            <p className="text-[11px] text-on-surface-variant font-body">{step.description}</p>
                          </div>
                          <span className={`text-[10px] font-black rounded-full px-2.5 py-0.5 tracking-wider ${getStageStyle(state).badge}`}>
                            {getStageStyle(state).badgeLabel}
                          </span>
                        </div>

                        {state === 'RUNNING' && (
                          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className="bg-primary h-full transition-all duration-300 ease-out" style={{ width: `${percent}%` }} />
                          </div>
                        )}

                        {state === 'RUNNING' && step.sub_steps && (
                          <div className="mt-3 space-y-1.5 pl-3 border-l-2 border-primary/20 font-body">
                            {step.sub_steps.map((sub: any) => {
                              const sState = subStates[sub.key] || 'STANDBY';
                              const dotClass = sState === 'SUCCESS' ? 'bg-secondary' : sState === 'RUNNING' ? 'bg-primary animate-pulse' : 'bg-slate-300';
                              return (
                                <div key={sub.key} className="flex items-center gap-2 text-[11px] text-slate-700">
                                  <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                                  <span>{sub.display_name}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

            {/* Right Summary Info Panel */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-primary mb-3.5 pb-2 border-b border-outline-variant flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-primary" /> Request Summary
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100 border-dashed">
                      <span className="text-on-surface-variant font-medium">Employee Name</span>
                      <span className="font-bold text-slate-800">{firstName} {lastName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 border-dashed">
                      <span className="text-on-surface-variant font-medium">Department</span>
                      <span className="font-bold text-slate-800">{department || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 border-dashed">
                      <span className="text-on-surface-variant font-medium">sAMAccountName</span>
                      <span className="font-mono font-bold text-primary">{usernameLogon}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 border-dashed">
                      <span className="text-on-surface-variant font-medium">Temporary Password</span>
                      <span className="font-mono font-bold text-primary bg-primary/5 px-1.5 py-0.5 rounded">{userPassword}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 border-dashed">
                      <span className="text-on-surface-variant font-medium">Primary E-mail</span>
                      <span className="font-bold text-slate-800 truncate max-w-[150px]" title={email}>{email}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 border-dashed">
                      <span className="text-on-surface-variant font-medium">Licensing Part Numbers</span>
                      <span className="font-bold text-slate-800 truncate max-w-[150px]" title={selectedSkuIds.join(", ")}>
                        {selectedSkuIds.length > 0 ? selectedSkuIds.join(", ") : "None Assigned"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="flex items-center gap-1.5 text-primary mb-1.5">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold text-xs">Deployment Tip</span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed font-body">
                    Papercut synchronization usually takes 30-60 seconds depending on regional print server load. Do not refresh this page.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Inline Sandbox run logger console terminal */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 block">บันทึกความเชื่อมโยงระบบ (Sandbox Pipeline Log Console)</span>
            <div
              ref={scrollRef}
              className="bg-slate-900 text-slate-100 p-4 font-mono text-[11px] rounded-lg h-40 overflow-y-auto custom-scrollbar flex flex-col gap-1 border border-slate-800 shadow-inner animate-[fadeIn_0.2s_ease-out]"
            >
              {customTerminalLogs.map((item, idx) => (
                <div key={idx} className="leading-relaxed transition-all duration-150">
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Step 3 controls - shown ONLY when pipeline is DONE */}
          {pipelineState === 'DONE' && (
            <div className="pt-4 border-t border-outline-variant flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={resetAndRestartPDFProvision}
                className="px-6 py-2.5 bg-primary text-white text-xs uppercase font-black tracking-widest rounded hover:brightness-105 shadow transition-all cursor-pointer active:scale-98"
              >
                จัดเตรียมคนถัดไป (Provision Next)
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- SELECT GROUP MODAL (ADUC FIND STYLE) --- */}
      {isFindGroupsOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#c1c6d6] w-full max-w-xl rounded shadow-2xl relative flex flex-col font-sans">
            <div className="bg-gradient-to-r from-[#004e98] to-[#3a86c8] text-white px-3 py-2 flex justify-between items-center select-none text-xs">
              <div className="flex items-center gap-1.5 font-semibold">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span>Find Users, Contacts, and Groups</span>
              </div>
              <button
                type="button"
                onClick={() => setIsFindGroupsOpen(false)}
                className="hover:bg-red-600 px-2 py-0.5 transition-colors font-bold text-sm leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-4 bg-[#f0f0f0] border-b border-[#d1d1d1] grid grid-cols-12 gap-3 text-xs text-[#202124]">
              <div className="col-span-3 flex items-center justify-end font-medium">Name:</div>
              <div className="col-span-6 flex gap-2">
                <input
                  type="text"
                  value={searchGroupQuery}
                  onChange={(e) => setSearchGroupQuery(e.target.value)}
                  onKeyUp={(e) => { if (e.key === 'Enter') handleSearchGroups(); }}
                  className="flex-grow p-1.5 border border-[#c5c6d1] bg-white h-7 focus:border-[#0067c0] outline-none text-xs focus:ring-0"
                  placeholder="เช่น Domain, Eng, VPN..."
                />
              </div>
              <div className="col-span-3 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={handleSearchGroups}
                  className="w-full h-7 bg-[#e1e1e1] border border-[#adadad] hover:bg-[#cfe3f5] hover:border-[#0067c0] font-medium transition-all text-center cursor-pointer text-xs"
                >
                  Find Now
                </button>
                <button
                  type="button"
                  onClick={() => setSearchGroupQuery('')}
                  className="w-full h-7 bg-[#e1e1e1] border border-[#adadad] hover:bg-slate-200 font-medium transition-all text-center cursor-pointer text-xs"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="p-3 bg-white flex flex-col flex-grow select-none">
              <span className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wider">Search results:</span>
              <div className="border border-[#d1d1d1] h-48 overflow-y-auto custom-scrollbar bg-white">
                <table className="w-full border-collapse text-xs text-left">
                  <thead className="bg-[#f5f5f5] text-slate-700 sticky top-0 border-b border-[#d1d1d1]">
                    <tr>
                      <th className="p-1.5 border-r border-[#d1d1d1] select-none font-semibold">Name</th>
                      <th className="p-1.5 border-r border-[#d1d1d1] select-none font-semibold">Scope</th>
                      <th className="p-1.5 select-none font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-body text-[11px]">
                    {searchingGroups ? (
                      <tr>
                        <td colSpan={3} className="text-center py-12 text-slate-400 italic">
                          <Loader2 className="h-4 w-4 animate-spin inline-block text-primary mr-1.5" /> Searching groups in catalog...
                        </td>
                      </tr>
                    ) : foundGroupsList.length > 0 ? (
                      foundGroupsList.map((gObj) => {
                        const isChosenInModal = selectedGroupFromModal?.name === gObj.name;
                        return (
                          <tr
                            key={gObj.name}
                            onClick={() => setSelectedGroupFromModal(gObj)}
                            onDoubleClick={() => { setSelectedGroupFromModal(gObj); handleAddGroupFromModal(); }}
                            className={`hover:bg-[#e8f0fe] cursor-pointer transition-colors ${isChosenInModal ? 'bg-[#0067c0] text-white hover:bg-[#0067c0]' : ''
                              }`}
                          >
                            <td className="p-1.5 font-bold flex items-center gap-1.5">
                              <Group className={`h-4 w-4 ${isChosenInModal ? 'text-white' : 'text-green-700'}`} />
                              <span>{gObj.name}</span>
                            </td>
                            <td className={`p-1.5 ${isChosenInModal ? 'text-white/80' : 'text-slate-500'}`}>{gObj.scope}</td>
                            <td className={`p-1.5 truncate max-w-sm ${isChosenInModal ? 'text-white/85' : 'text-slate-400'}`}>{gObj.desc}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-12 text-slate-400 italic">
                          พิมพ์ชื่อกลุ่มสิทธิ์แล้วกดปุ่ม 'Find Now' เพื่อตรวจสอบข้อมูล
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#f0f0f0] border-t border-[#d1d1d1] p-3 flex justify-end gap-2 shrink-0 select-none">
              <button
                type="button"
                onClick={() => setIsFindGroupsOpen(false)}
                className="px-5 py-1 bg-[#e1e1e1] border border-[#adadad] hover:bg-slate-200 text-xs text-black transition-all cursor-pointer rounded-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddGroupFromModal}
                disabled={!selectedGroupFromModal}
                className="px-6 py-1 bg-[#0067c0] text-white border border-[#004e98] text-xs font-semibold rounded-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- BULK SECURITY GROUPS MODAL DIALOGS --- */}
      {isBulkGroupsOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#c1c6d6] w-full max-w-2xl rounded shadow-2xl relative flex flex-col font-sans">
            <div className="bg-gradient-to-r from-[#004e98] to-[#3a86c8] text-white px-3 py-2 flex justify-between items-center select-none text-xs">
              <div className="flex items-center gap-1.5 font-semibold">
                <FileText className="h-4 w-4 shrink-0" />
                <span>Bulk Import &amp; Verify Active Directory Groups</span>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkGroupsOpen(false)}
                className="hover:bg-red-600 px-2 py-0.5 transition-colors font-bold text-sm leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-4 bg-[#f0f0f0] border-b border-[#d1d1d1] flex flex-col gap-2 text-xs text-[#202124]">
              <div className="font-semibold text-slate-700 flex justify-between items-center">
                <span>วางรายชื่อกลุ่มสิทธิ์ด้านล่างเพื่อตรวจสอบกับฐานข้อมูล AD (Exact Match):</span>
                <span className="text-[10px] text-slate-500 font-normal">แยกด้วยเครื่องหมายจุลภาค (,), อัฒภาค (;) หรือขึ้นบรรทัดใหม่</span>
              </div>
              <textarea
                value={bulkGroupsText}
                onChange={(e) => setBulkGroupsText(e.target.value)}
                className="w-full p-2 border border-[#c5c6d1] bg-white text-xs h-24 font-mono focus:border-[#0067c0] focus:ring-0 outline-none resize-none"
                placeholder="เช่น: VPN Operators, Domain Admins, CL100"
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-[10px] text-primary font-bold flex items-center gap-1">
                  <Info className="h-3 w-3 inline text-primary" /> ระบบจะแอนาไลซ์ แสวงหาเฉพาะกลุ่มสิทธิมีอยู่จริงใน LDAP สารบบ เท่านั้น
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setBulkGroupsText(''); setBulkGroupsList([]); }}
                    className="px-4 py-1.5 bg-[#e1e1e1] border border-[#adadad] hover:bg-slate-200 text-xs font-semibold cursor-pointer rounded-sm"
                  >
                    Clear All
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyBulkGroups}
                    disabled={verifyingBulkGroups}
                    className="px-4 py-1.5 bg-[#0067c0] text-white border border-[#004e98] hover:bg-[#005bb2] text-xs font-black uppercase tracking-wider cursor-pointer rounded-sm flex items-center gap-1 transition-all"
                  >
                    {verifyingBulkGroups && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>Verify Groups</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white flex flex-col flex-grow select-none">
              <span className="text-[10px] text-[#5f6368] mb-1 font-bold uppercase tracking-wider">สถานะการตรวจสอบความถูกต้อง (Validation Status):</span>
              <div className="border border-[#d1d1d1] h-44 overflow-y-auto custom-scrollbar bg-white">
                <table className="w-full border-collapse text-xs text-left">
                  <thead className="bg-[#f5f5f5] text-slate-700 sticky top-0 border-b border-[#d1d1d1] font-semibold">
                    <tr>
                      <th className="p-1.5 border-r border-[#d1d1d1]">GroupName</th>
                      <th className="p-1.5 border-r border-[#d1d1d1]">AD Status</th>
                      <th className="p-1.5 border-r border-[#d1d1d1]">Scope</th>
                      <th className="p-1.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-body text-[11px]">
                    {verifyingBulkGroups ? (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-400 italic">
                          <Loader2 className="h-4 w-4 animate-spin text-primary inline-block mr-1.5" /> เวอริฟายตรวจสอบความปลอดภัย LDAP...
                        </td>
                      </tr>
                    ) : bulkGroupsList.length > 0 ? (
                      bulkGroupsList.map((gCheck, idx) => {
                        const isValid = gCheck.status === 'Found';
                        return (
                          <tr key={idx} className="hover:bg-slate-50 border-b border-slate-100">
                            <td className="p-1.5 font-bold text-slate-800 flex items-center gap-1.5">
                              <Group className={`h-4 w-4 ${isValid ? 'text-green-700' : 'text-slate-400'}`} />
                              <span>{gCheck.name}</span>
                            </td>
                            <td className="p-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                {isValid ? '✓ Valid' : '✗ Invalid'}
                              </span>
                            </td>
                            <td className="p-1.5 text-slate-500 uppercase">{gCheck.scope}</td>
                            <td className="p-1.5 text-slate-400 truncate max-w-[150px]">{gCheck.desc}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-400 italic">
                          กรอกรายชื่อกลุ่มสิทธิ์ด้านบนแล้วกดปุ่ม 'Verify Groups' เพื่อจับคู่สารบบ LDAP AD
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#f0f0f0] border-t border-[#d1d1d1] p-3 flex justify-end gap-2 shrink-0 select-none">
              <button
                type="button"
                onClick={() => setIsBulkGroupsOpen(false)}
                className="px-5 py-1 bg-[#e1e1e1] border border-[#adadad] hover:bg-slate-200 text-xs text-black rounded-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBulkGroups}
                disabled={bulkGroupsList.filter(g => g.status === 'Found').length === 0}
                className="px-6 py-1 bg-[#0067c0] text-white border border-[#004e98] text-xs font-semibold rounded-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Add Valid Groups
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
