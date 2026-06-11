/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { DirectoryUser, ADNode, ADGroup, M365Sku, Job, JobLog, SystemConfig } from "./src/types";
import { initialUsers, masterADGroups, initialM365Skus, initialJobs, mockJobLogs, initialADTree, defaultEmailTemplate } from "./src/mockData";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Server-side Storage in Memory ---
let directoryUsers: DirectoryUser[] = [...initialUsers];
let adGroups: ADGroup[] = [...masterADGroups];
let m365Licenses: M365Sku[] = [...initialM365Skus];
let jobs: Job[] = [...initialJobs];
let jobLogs: Record<string, JobLog[]> = { ...mockJobLogs };
let adTreeRoot: ADNode = { ...initialADTree };

let systemSettings: SystemConfig = {
  ldapServer: "ldap://192.168.10.2",
  ldapUser: "CN=Admin,CN=Users,DC=aapico,DC=com",
  ldapBase: "DC=aapico,DC=com",
  papercutUrl: "http://192.168.20.5:9191/api",
  papercutToken: "••••••••••••••••",
  mockMode: "mock"
};

// --- Recursive AD Tree query helper ---
function findNodeByDN(node: ADNode, dn: string): ADNode | null {
  if (node.dn.toLowerCase() === dn.toLowerCase()) {
    return node;
  }
  if (node._children) {
    for (const child of node._children) {
      const found = findNodeByDN(child, dn);
      if (found) return found;
    }
  }
  return null;
}

function collectOUs(node: ADNode, list: string[] = []): string[] {
  if (node.type === "ou") {
    list.push(node.dn);
  }
  if (node._children) {
    node._children.forEach((c) => collectOUs(c, list));
  }
  return list;
}

// --- Dynamic Background Pipeline Simulation Worker ---
// Every 4 seconds, we find any processing jobs and advance them by one step.
setInterval(() => {
  jobs.forEach((job) => {
    if (job.status !== "processing") return;

    const currentStep = job.current_step;
    const workflow = job.payload?.workflow_control || {};

    if (currentStep === "ad_creation") {
      // Complete ad_creation -> advance to papercut_sync
      job.current_step = "papercut_sync";
      job.updated_at = new Date().toISOString();
      const logs = jobLogs[job.id] || [];
      logs.push({
        id: "l_gen_" + Date.now() + "_1",
        jobId: job.id,
        step: "ad_creation",
        status: "success",
        message: `LDAPS successfully finalized creation of object CN=${job.payload?.metadata?.requester_info?.name_english},${job.payload?.task_data?.ad_profile?.target_ou || "OU=Users,DC=aapico,DC=com"}.`,
        timestamp: new Date().toISOString()
      });
      logs.push({
        id: "l_gen_" + Date.now() + "_2",
        jobId: job.id,
        step: "papercut_sync",
        status: "running",
        message: "Triggered XML-RPC printer database synchronization...",
        timestamp: new Date().toISOString()
      });
      jobLogs[job.id] = logs;

    } else if (currentStep === "papercut_sync") {
      // Complete papercut_sync -> advance to m365_license
      job.current_step = "m365_license";
      job.updated_at = new Date().toISOString();
      const logs = jobLogs[job.id] || [];
      const calculatedPin = job.payload?.task_data?.papercut_profile?.print_code || "123456";
      logs.push({
        id: "l_gen_" + Date.now() + "_3",
        jobId: job.id,
        step: "papercut_sync",
        status: "success",
        message: `Registered print PIN control ${calculatedPin} for synchronized AD account.`,
        timestamp: new Date().toISOString()
      });
      logs.push({
        id: "l_gen_" + Date.now() + "_4",
        jobId: job.id,
        step: "m365_license",
        status: "running",
        message: "Requesting Microsoft Graph API for automated O365 subscription mappings...",
        timestamp: new Date().toISOString()
      });
      jobLogs[job.id] = logs;

    } else if (currentStep === "m365_license") {
      // Complete m365_license -> advance to send_email
      job.current_step = "send_email";
      job.updated_at = new Date().toISOString();
      const logs = jobLogs[job.id] || [];
      
      const mappedLicenses = job.payload?.task_data?.ad_profile?.custom_attributes?.licenses || [];
      const licenseStr = mappedLicenses.length > 0 ? mappedLicenses.join(", ") : "STANDARDPACK (O365 E1)";
      
      logs.push({
        id: "l_gen_" + Date.now() + "_5",
        jobId: job.id,
        step: "m365_license",
        status: "success",
        message: `Successfully mapped M365 Subscriptions: ${licenseStr} via tenant Graph.`,
        timestamp: new Date().toISOString()
      });
      logs.push({
        id: "l_gen_" + Date.now() + "_6",
        jobId: job.id,
        step: "send_email",
        status: "running",
        message: "Rendering custom HTML notification and negotiating SMTP transmission...",
        timestamp: new Date().toISOString()
      });
      jobLogs[job.id] = logs;

    } else if (currentStep === "send_email") {
      // Complete job -> set status to success, current_step to done
      job.current_step = "done";
      job.status = "success";
      job.updated_at = new Date().toISOString();
      const logs = jobLogs[job.id] || [];
      const emailRecipient = job.payload?.task_data?.email_profile?.emailTo || job.payload?.metadata?.requester_info?.mobile_phone || "user@aapico.com";
      
      logs.push({
        id: "l_gen_" + Date.now() + "_7",
        jobId: job.id,
        step: "send_email",
        status: "success",
        message: `Dispatched IT confirmation notification package successfully to ${emailRecipient}.`,
        timestamp: new Date().toISOString()
      });
      logs.push({
        id: "l_gen_" + Date.now() + "_8",
        jobId: job.id,
        step: "pipeline",
        status: "success",
        message: "Automated core database pipelines fully finished.",
        timestamp: new Date().toISOString()
      });
      jobLogs[job.id] = logs;

      // Add actual user to Directory Users array upon successful pipeline completion
      const meta = (job.payload?.metadata?.requester_info || {}) as any;
      const adProfile = (job.payload?.task_data?.ad_profile || {}) as any;
      const customAttrs = (adProfile.custom_attributes || {}) as any;
      const papercutProfile = (job.payload?.task_data?.papercut_profile || {}) as any;

      const alreadyExists = directoryUsers.some((u) => u.uid === adProfile.custom_username);
      if (!alreadyExists) {
        directoryUsers.push({
          uid: adProfile.custom_username || "auto-user",
          name: meta.name_english || "New Employee",
          email: customAttrs.email || `${adProfile.custom_username}@aapico.com`,
          title: meta.position || "Staff Associate",
          dept: meta.department || "Administration",
          printCode: papercutProfile.print_code || "112233",
          ou: adProfile.target_ou || "OU=Users,DC=aapico,DC=com",
          papercut: "Synced (Auto)",
          status: "Active",
          mobile: meta.mobile_phone,
          company: meta.company,
          manager: customAttrs.manager,
          office: customAttrs.office || meta.company,
          description: customAttrs.description || "Auto Provisioned User object via Job Queue pipeline"
        });
      }
    }
  });
}, 9000); // Progress steps at a steady interval to allow previewers to watch execution

// --- REST API Server Endpoints ---

// 1. AD Tree traversals
app.get("/api/v1/user/ad/tree", (req, res) => {
  const { parent_dn } = req.query;
  if (!parent_dn) {
    return res.json({ nodes: adTreeRoot._children || [] });
  }

  const foundNode = findNodeByDN(adTreeRoot, parent_dn.toString());
  if (foundNode) {
    res.json({ nodes: foundNode._children || [] });
  } else {
    res.json({ nodes: [] });
  }
});

// 2. AD individual account check
app.get("/api/v1/user/ad/check-user", (req, res) => {
  const { query, exact } = req.query;
  if (!query) {
    return res.json({ exists: false });
  }

  const cleanQuery = query.toString().toLowerCase().trim();
  const isExact = exact === "true";

  const match = directoryUsers.some((user) => {
    if (isExact) {
      return user.uid.toLowerCase() === cleanQuery || user.email.toLowerCase() === cleanQuery;
    } else {
      return (
        user.uid.toLowerCase().includes(cleanQuery) ||
        user.name.toLowerCase().includes(cleanQuery) ||
        user.email.toLowerCase().includes(cleanQuery)
      );
    }
  });

  res.json({ exists: match });
});

// 3. Security Groups search
app.get("/api/v1/user/groups/search", (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.json({ groups: adGroups });
  }

  const cleanQuery = query.toString().toLowerCase();
  const filtered = adGroups.filter(
    (g) => g.name.toLowerCase().includes(cleanQuery) || g.desc.toLowerCase().includes(cleanQuery)
  );

  res.json({ groups: filtered });
});

// 4. Verification tool for security groups list (Bulk tool)
app.post("/api/v1/user/groups/bulk-check", (req, res) => {
  const { groups } = req.body;
  if (!groups || !Array.isArray(groups)) {
    return res.status(400).json({ error: "Invalid groups list" });
  }

  const results = groups.map((gName) => {
    const found = adGroups.find((g) => g.name.toLowerCase() === gName.toLowerCase().trim());
    if (found) {
      return { name: found.name, status: "Found", scope: found.scope, desc: found.desc };
    } else {
      return { name: gName, status: "NotFound", scope: "Unknown", desc: "No group matching this name was found in Ad directory" };
    }
  });

  res.json({ results });
});

// 5. OU selection list exporter
app.get("/api/v1/user/ou/search", (req, res) => {
  const ous = collectOUs(adTreeRoot);
  res.json({ ous });
});

// 6. Microsoft 365 License stocks and available units query
app.get("/api/v1/m365/licenses", (req, res) => {
  res.json({
    licenses: m365Licenses,
    summary: {
      total_product_types: m365Licenses.length,
      in_stock: m365Licenses.filter((l) => l.availableUnits > 0).length,
      out_of_stock: m365Licenses.filter((l) => l.availableUnits <= 0).length
    },
    is_mock: systemSettings.mockMode === "mock"
  });
});

// 7. Dynamic mock document parser for PDF URLs
app.post("/api/v1/parse/url", (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "No URL supplied" });
  }

  const cleanUrl = url.toLowerCase();
  const mockTemplates = {
    somchai: {
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
    },
    wanida: {
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
    }
  };

  if (cleanUrl.includes("wanida")) {
    res.json(mockTemplates.wanida);
  } else {
    res.json(mockTemplates.somchai);
  }
});

// 8. Mail Format Template fetcher
app.get("/static/component/mail_format.txt", (req, res) => {
  res.send(defaultEmailTemplate);
});

// 9. Active Directory Sync Endpoint (Direct provision block)
app.post("/api/v1/user/sync", (req, res) => {
  const body = req.body;
  const customUsername = body.custom_username || "sync.user";
  const customPrintCode = body.custom_print_code || "990011";

  // Simulate creation
  res.json({
    username: customUsername,
    print_code: customPrintCode,
    active_directory: {
      status: "Created",
      distinguished_name: `CN=${body.requester_info?.name_english || customUsername},${body.target_ou || "OU=Users,DC=aapico,DC=com"}`
    },
    papercut: {
      status: "Success"
    }
  });
});

// 10. Job Queue status and list retrieval
app.get("/api/v1/jobs", (req, res) => {
  res.json({ jobs });
});

app.get("/api/v1/debug/queue/status", (req, res) => {
  res.json({
    status: "ok",
    queued: jobs.filter((j) => j.status === "queued" || j.status === "paused").length,
    active: jobs.filter((j) => j.status === "processing").length,
    workers: 4
  });
});

// 11. Retrieve logs for a specific Job ID
app.get("/api/v1/jobs/:jobId/logs", (req, res) => {
  const { jobId } = req.params;
  res.json({ logs: jobLogs[jobId] || [] });
});

// 12. Control Job state (cancel, pause, resume)
app.patch("/api/v1/jobs/:jobId", (req, res) => {
  const { jobId } = req.params;
  const { action } = req.body;

  const jobIndex = jobs.findIndex((j) => j.id === jobId);
  if (jobIndex === -1) {
    return res.status(404).json({ detail: "Job queue item not found" });
  }

  const job = jobs[jobIndex];
  const logs = jobLogs[jobId] || [];

  if (action === "cancel") {
    job.status = "cancelled";
    logs.push({
      id: "log_action_" + Date.now(),
      jobId,
      step: "pipeline",
      status: "failed",
      message: "Job execution cancelled manually by supervisor.",
      timestamp: new Date().toISOString()
    });
  } else if (action === "pause") {
    job.status = "paused";
    logs.push({
      id: "log_action_" + Date.now(),
      jobId,
      step: "pipeline",
      status: "paused",
      message: "Job process paused by administrator delegation request.",
      timestamp: new Date().toISOString()
    });
  } else if (action === "resume") {
    job.status = "processing";
    logs.push({
      id: "log_action_" + Date.now(),
      jobId,
      step: "pipeline",
      status: "running",
      message: "Resuming pipeline sequencing from paused state.",
      timestamp: new Date().toISOString()
    });
  }

  job.updated_at = new Date().toISOString();
  jobLogs[jobId] = logs;

  res.json({ job });
});

// 13. Create a Job in Queue (triggers upon automated Provision execution submit)
app.post("/api/v1/jobs", (req, res) => {
  const body = req.body;
  const rawMeta = body.metadata?.requester_info || {};
  const isHighPriority = body.payload?.workflow_control?.high_priority || body.workflow_control?.high_priority || false;

  const newJob: Job = {
    id: "job-" + (rawMeta.name_english || "emp").toLowerCase().split(" ")[1] + "-" + Math.floor(100 + Math.random() * 900),
    status: "processing",
    current_step: "ad_creation",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    payload: body
  };

  const initialLogList: JobLog[] = [
    {
      id: "l_init_" + Date.now(),
      jobId: newJob.id,
      step: "pipeline",
      status: "running",
      message: `Enqueued provisioning job in background queue processor. priority: ${isHighPriority ? "HIGH" : "NORMAL"}.`,
      timestamp: new Date().toISOString()
    },
    {
      id: "l_step1_" + Date.now(),
      jobId: newJob.id,
      step: "ad_creation",
      status: "running",
      message: "Connecting to secure LDAP Active Directory (LDAPS) workspace...",
      timestamp: new Date().toISOString()
    }
  ];

  jobs.unshift(newJob);
  jobLogs[newJob.id] = initialLogList;

  res.status(201).json({ job: newJob });
});

// 14. Reset Queue and Database to original state
app.post("/api/v1/debug/reset", (req, res) => {
  directoryUsers = [...initialUsers];
  adGroups = [...masterADGroups];
  m365Licenses = [...initialM365Skus];
  jobs = [...initialJobs];
  jobLogs = { ...mockJobLogs };
  adTreeRoot = { ...initialADTree };
  res.json({ status: "reset success" });
});

// Vite / Static files middleware integrations
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Node Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

startServer();
