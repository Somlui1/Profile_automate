const API_BASE = "/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const uploadZone = document.getElementById("uploadZone");
    const fileInput = document.getElementById("fileInput");
    const urlInput = document.getElementById("urlInput");
    const btnSubmitUrl = document.getElementById("btnSubmitUrl");
    
    const panelPreview = document.getElementById("panelPreview");
    const panelStatus = document.getElementById("panelStatus");
    const formPreview = document.getElementById("formPreview");
    
    // Status Timeline Elements
    const stepADCheck = document.getElementById("stepADCheck");
    const stepADCreate = document.getElementById("stepADCreate");
    const stepPapercutSync = document.getElementById("stepPapercutSync");
    const stepPapercutCode = document.getElementById("stepPapercutCode");
    
    // State
    let currentParsedData = null;
    let currentJobId = null;
    let evtSource = null;

    // Toast Notification System
    function showToast(message, type = "success") {
        const container = document.getElementById("toastContainer");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        const iconSvg = type === "success" 
            ? `<svg class="toast-icon success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
            : `<svg class="toast-icon error" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
            
        toast.innerHTML = `
            ${iconSvg}
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Remove toast after 4s
        setTimeout(() => {
            toast.style.animation = "slideOut 0.3s forwards";
            toast.addEventListener("animationend", () => toast.remove());
        }, 4000);
    }

    // Drag and Drop Handlers
    uploadZone.addEventListener("click", () => fileInput.click());
    
    uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("dragover");
    });

    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("dragover");
    });

    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Submit via URL
    btnSubmitUrl.addEventListener("click", () => {
        const urlValue = urlInput.value.trim();
        if (!urlValue) {
            showToast("Please enter a valid PDF URL.", "error");
            return;
        }
        handleUrlUpload(urlValue);
    });

    // File parsing call
    async function handleFileUpload(file) {
        if (!file.name.toLowerCase().endswith(".pdf")) {
            showToast("Only PDF files are supported.", "error");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        
        setUploadLoading(true, "Uploading and parsing file...");
        panelPreview.classList.add("hidden");
        panelStatus.classList.add("hidden");
        
        try {
            const response = await fetch(`${API_BASE}/parse/file`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json();
                const errMsg = errData.detail?.message || errData.detail || "Verification failed.";
                const errDetails = errData.detail?.errors ? `: ${errData.detail.errors.join(", ")}` : "";
                throw new Error(`${errMsg}${errDetails}`);
            }

            const data = await response.json();
            showToast("PDF parsed successfully!");
            displayPreview(data);
        } catch (error) {
            showToast(error.message, "error");
            console.error(error);
        } finally {
            setUploadLoading(false);
        }
    }

    // URL parsing call
    async function handleUrlUpload(url) {
        setUploadLoading(true, "Downloading and parsing URL...");
        panelPreview.classList.add("hidden");
        panelStatus.classList.add("hidden");

        try {
            const response = await fetch(`${API_BASE}/parse/url`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const errData = await response.json();
                const errMsg = errData.detail?.message || errData.detail || "Verification failed.";
                const errDetails = errData.detail?.errors ? `: ${errData.detail.errors.join(", ")}` : "";
                throw new Error(`${errMsg}${errDetails}`);
            }

            const data = await response.json();
            showToast("Remote PDF parsed successfully!");
            displayPreview(data);
        } catch (error) {
            showToast(error.message, "error");
            console.error(error);
        } finally {
            setUploadLoading(false);
        }
    }

    function setUploadLoading(isLoading, text = "") {
        const textEl = uploadZone.querySelector("p");
        const iconEl = uploadZone.querySelector(".upload-icon");
        
        if (isLoading) {
            uploadZone.style.pointerEvents = "none";
            iconEl.innerHTML = `<div class="spinner"></div>`;
            textEl.innerHTML = `<span>${text}</span>`;
        } else {
            uploadZone.style.pointerEvents = "auto";
            iconEl.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
            `;
            textEl.innerHTML = `Drag & drop IT Request PDF here or <span>browse files</span>`;
        }
    }

    // Populate data in form fields
    function displayPreview(data) {
        currentParsedData = data;
        panelPreview.classList.remove("hidden");
        
        // Populate inputs
        document.getElementById("inputThaiName").value = data.requester_info.name_thai || "";
        document.getElementById("inputEngName").value = data.requester_info.name_english || "";
        document.getElementById("inputEmpId").value = data.requester_info.employee_id || "";
        document.getElementById("inputPosition").value = data.requester_info.position || "";
        document.getElementById("inputDept").value = data.requester_info.department || "";
        document.getElementById("inputExt").value = data.requester_info.ext || "";
        document.getElementById("inputMobile").value = data.requester_info.mobile_phone || "";
        document.getElementById("inputAddress").value = data.requester_info.address || "";
        document.getElementById("inputZip").value = data.requester_info.zip_code || "";
        
        // Print option (default to Employee ID or custom)
        document.getElementById("inputPrintCode").value = data.requester_info.employee_id || "";
        
        // Estimate contractor based on Employee ID starts with 'C'
        const isContractor = (data.requester_info.employee_id || "").toLowerCase().startsWith("c");
        document.getElementById("selectOU").value = isContractor ? "contractor" : "newhire";
        
        // Scroll to preview
        panelPreview.scrollIntoView({ behavior: "smooth" });
    }

    // Submit Sync Request
    formPreview.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentParsedData) return;

        // Collect updated fields
        const requesterInfo = {
            company: currentParsedData.requester_info.company,
            name_thai: document.getElementById("inputThaiName").value,
            name_english: document.getElementById("inputEngName").value,
            employee_id: document.getElementById("inputEmpId").value,
            position: document.getElementById("inputPosition").value,
            department_group: currentParsedData.requester_info.department_group,
            department: document.getElementById("inputDept").value,
            ext: document.getElementById("inputExt").value,
            mobile_phone: document.getElementById("inputMobile").value,
            supervisor_name: currentParsedData.requester_info.supervisor_name,
            supervisor_position: currentParsedData.requester_info.supervisor_position,
            address: document.getElementById("inputAddress").value,
            zip_code: document.getElementById("inputZip").value
        };

        const isContractor = document.getElementById("selectOU").value === "contractor";
        const printCode = document.getElementById("inputPrintCode").value;

        const payload = {
            document_info: currentParsedData.document_info,
            requester_info: requesterInfo,
            custom_print_code: printCode,
            is_contractor: isContractor
        };

        // Reveal timeline, set all steps to pending
        panelStatus.classList.remove("hidden");
        panelStatus.scrollIntoView({ behavior: "smooth" });
        
        updateStep(stepADCheck, "pending", "Waiting...");
        updateStep(stepADCreate, "pending", "Waiting...");
        updateStep(stepPapercutSync, "pending", "Waiting...");
        updateStep(stepPapercutCode, "pending", "Waiting...");
        
        // Show job control buttons
        document.getElementById("btnPauseJob").classList.remove("hidden");
        document.getElementById("btnCancelJob").classList.remove("hidden");
        document.getElementById("btnResumeJob").classList.add("hidden");

        try {
            // Step 1: Create Job
            const response = await fetch(`${API_BASE}/jobs/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Failed to submit job.");
            }

            const result = await response.json();
            currentJobId = result.job_id;
            
            showToast(`Job ${currentJobId.substring(0,8)} started...`);
            
            // Step 2: Open SSE stream
            if (evtSource) {
                evtSource.close();
            }
            evtSource = new EventSource(`${API_BASE}/jobs/${currentJobId}/stream`);
            
            const stepMap = {
                "ad_check": stepADCheck,
                "ad_create": stepADCreate,
                "pc_sync": stepPapercutSync,
                "pc_pin": stepPapercutCode
            };
            
            evtSource.addEventListener("step_update", (e) => {
                const data = JSON.parse(e.data);
                const el = stepMap[data.step];
                if (el) {
                    updateStep(el, data.status === "running" ? "running" : data.status, data.message);
                }
            });
            
            evtSource.addEventListener("job_complete", (e) => {
                evtSource.close();
                document.getElementById("btnPauseJob").classList.add("hidden");
                document.getElementById("btnCancelJob").classList.add("hidden");
                document.getElementById("btnResumeJob").classList.add("hidden");
                
                const data = JSON.parse(e.data);
                showToast("User synchronized successfully!");
            });
            
            evtSource.addEventListener("job_failed", (e) => {
                evtSource.close();
                const data = JSON.parse(e.data);
                showToast(`Job failed: ${data.error}`, "error");
            });
            
            evtSource.addEventListener("job_paused", (e) => {
                document.getElementById("btnPauseJob").classList.add("hidden");
                document.getElementById("btnResumeJob").classList.remove("hidden");
                showToast("Job paused");
            });
            
            evtSource.addEventListener("job_cancelled", (e) => {
                evtSource.close();
                document.getElementById("btnPauseJob").classList.add("hidden");
                document.getElementById("btnCancelJob").classList.add("hidden");
                document.getElementById("btnResumeJob").classList.add("hidden");
                showToast("Job cancelled", "error");
            });

        } catch (error) {
            showToast(error.message, "error");
        }
    });

    // Job Control Buttons
    const btnPauseJob = document.getElementById("btnPauseJob");
    if (btnPauseJob) {
        btnPauseJob.addEventListener("click", async () => {
            if (!currentJobId) return;
            await fetch(`${API_BASE}/jobs/${currentJobId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "pause" })
            });
        });
    }
    
    const btnResumeJob = document.getElementById("btnResumeJob");
    if (btnResumeJob) {
        btnResumeJob.addEventListener("click", async () => {
            if (!currentJobId) return;
            await fetch(`${API_BASE}/jobs/${currentJobId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "resume" })
            });
            document.getElementById("btnResumeJob").classList.add("hidden");
            document.getElementById("btnPauseJob").classList.remove("hidden");
        });
    }
    
    const btnCancelJob = document.getElementById("btnCancelJob");
    if (btnCancelJob) {
        btnCancelJob.addEventListener("click", async () => {
            if (!currentJobId) return;
            if (confirm("Are you sure you want to cancel this job?")) {
                await fetch(`${API_BASE}/jobs/${currentJobId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "cancel" })
                });
            }
        });
    }

    function updateStep(element, status, text) {
        element.className = `timeline-item ${status}`;
        element.querySelector(".timeline-desc").textContent = text;
        
        const badge = element.querySelector(".timeline-badge");
        if (status === "success") {
            badge.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
            `;
        } else if (status === "error") {
            badge.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            `;
        } else if (status === "running") {
            badge.innerHTML = `<div class="spinner" style="width: 14px; height: 14px; border-width: 1px;"></div>`;
        } else {
            badge.innerHTML = `
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
            `;
        }
    }
    
    // Polyfill for endswith in string
    if (!String.prototype.endswith) {
        String.prototype.endswith = function(searchString, position) {
            var subjectString = this.toString();
            if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
                position = subjectString.length;
            }
            position -= searchString.length;
            var lastIndex = subjectString.indexOf(searchString, position);
            return lastIndex !== -1 && lastIndex === position;
        };
    }
});
