# 🔄 Standard Job Provisioning Sequence & Sub-sequences

This document outlines the standard for tracking, recording, and rendering the asynchronous multi-step user provisioning pipeline.

---

## 🏗️ 1. Pipeline Sequence Overview

The provisioning pipeline consists of **4 core steps** executed in order:

| Step Number | Step Key | Display Name | Sub-steps / Sub-sequences |
|--- |--- |--- |--- |
| **Step 1** | `ad_creation` | Active Directory Creation | 1. Check if user exists<br>2. Create AD account (Disabled)<br>3. Validate AD properties |
| **Step 2** | `papercut_sync` | PaperCut Synchronization | 1. Force global User/Group Sync<br>2. Wait 2 seconds<br>3. Set Printer Card/PIN code<br>4. Set initial print balance (100 credits) |
| **Step 3** | `m365_license` | Microsoft 365 Licensing | 1. Wait for Azure AD Connect Sync (5m delay)<br>2. Assign M365 licenses via Graph API |
| **Step 4** | `send_email` | Onboarding welcome email | 1. Connect to SMTP relay server<br>2. Dispatch email to supervisor & IT Support |

---

## 🖥️ 2. Frontend Rendering Guidelines

To provide a premium and responsive user experience, the frontend must dynamically parse log messages and job status fields to show granular progress.

### 2.1 Step 3 Progress & Sub-step States (M365 Licensing)

For **Step 3 (`m365_license`)**, the UI renders two sub-steps:
1. **Waiting for Azure AD Connect / Entra Cloud Sync (5m delay)**
2. **Assigning Microsoft 365 licenses via Graph API**

#### Progress State & Indicators
* **STANDBY** (Queue hasn't reached this step yet):
  * Overall Step State: `STANDBY`
  * Sub-step 1: `STANDBY` (grey dot)
  * Sub-step 2: `STANDBY` (grey dot)
  * Progress percentage: `0%`
* **WAITING FOR SYNC** (Enqueuing/delayed task):
  * Log message trigger: Contains `"delayed"` or `"Enqueuing"`
  * Overall Step State: `RUNNING`
  * Sub-step 1: `RUNNING` (blue flashing / pulsating dot)
  * Sub-step 2: `STANDBY` (grey dot)
  * Progress percentage: `35%`
* **ASSIGNING LICENSES** (Graph API call):
  * Log message trigger: Contains `"Assigning"`
  * Overall Step State: `RUNNING`
  * Sub-step 1: `SUCCESS` (green dot / checkmark)
  * Sub-step 2: `RUNNING` (blue flashing / pulsating dot)
  * Progress percentage: `70%`
* **COMPLETED**:
  * Job/Step Status: `SUCCESS` (or log message contains `"Successfully"`)
  * Overall Step State: `SUCCESS`
  * Sub-step 1: `SUCCESS` (green dot)
  * Sub-step 2: `SUCCESS` (green dot)
  * Progress percentage: `100%`

---

## ⚙️ 3. Worker Job Recording Specification

The worker tracks progress using database logs written to SQLite/Redis. 

### 3.1 Logger Function
The worker uses `add_log(job_id, step, status, message)` to record steps:
* `job_id`: Unique identifier of the job pipeline.
* `step`: The step key (`ad_creation`, `papercut_sync`, `m365_license`, `send_email`).
* `status`: The state of the log (`running`, `success`, `failed`, `skipped`).
* `message`: Human-readable descriptive text.

### 3.2 Step 2 Log Recording Pattern

For **Step 2 (`papercut_sync`)**, logs are written in this order:

1. **When triggering global sync:**
   ```python
   add_log(job_id, "papercut_sync", "running", "Triggered global PaperCut sync from Active Directory")
   ```
2. **When setting PIN code:**
   ```python
   add_log(job_id, "papercut_sync", "running", f"Successfully set printer PIN code to {print_code}")
   ```
3. **When setting initial balance (final step of this task):**
   ```python
   add_log(job_id, "papercut_sync", "success", f"Initial print balance set to 100 credits for user {username}")
   ```

### 3.3 Step 3 Log Recording Pattern
To ensure the frontend correctly parses sub-step status, the worker MUST write logs using these exact patterns:

1. **When enqueuing the delayed M365 task:**
   ```python
   add_log(job_id, "m365_license", "running", "Enqueuing Microsoft 365 License task (delayed 5m)")
   ```
2. **When starting the license assignment task:**
   ```python
   add_log(job_id, "m365_license", "running", f"Assigning Microsoft 365 licenses: {sku_ids}")
   ```
3. **When completed successfully:**
   ```python
   add_log(job_id, "m365_license", "success", f"Successfully assigned {count} M365 licenses to user {username}")
   ```

---

## 🔌 4. API Specification

The API Gateway must expose two key endpoints to support frontend polling and rendering:

### 4.1 Get Job Details
* **Endpoint**: `GET /api/v1/jobs/{job_id}`
* **Response Payload**:
  ```json
  {
    "id": "job_123456",
    "status": "processing",
    "current_step": "m365_license",
    "payload": {
      "workflow_control": {
        "enable_microsoft_365_license": true
      }
    },
    "created_at": "2026-06-15T15:35:57Z",
    "updated_at": "2026-06-15T15:36:00Z"
  }
  ```

### 4.2 Get Job Transaction Logs
* **Endpoint**: `GET /api/v1/jobs/{job_id}/logs`
* **Response Payload**:
  ```json
  {
    "logs": [
      {
        "id": 1,
        "step": "m365_license",
        "status": "running",
        "message": "Enqueuing Microsoft 365 License task (delayed 5m)",
        "timestamp": "2026-06-15T15:36:00Z"
      }
    ]
  }
  ```
