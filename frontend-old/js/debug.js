document.addEventListener("DOMContentLoaded", () => {
    const debugPanel = document.getElementById("debugPanel");
    if (!debugPanel) return;

    const btnToggleDebug = document.getElementById("btnToggleDebug");
    const debugContent = document.getElementById("debugContent");
    const btnRefreshDebug = document.getElementById("btnRefreshDebug");
    const btnTestEnqueue = document.getElementById("btnTestEnqueue");
    const btnFlushQueue = document.getElementById("btnFlushQueue");

    let isOpen = false;
    let refreshInterval = null;

    // Check if debug mode is enabled
    fetch(`${API_BASE}/debug/queue/status`)
        .then(res => {
            if (res.status === 403) {
                btnToggleDebug.style.display = 'none'; // Hide if not in debug mode
            }
        })
        .catch(() => {});

    btnToggleDebug.addEventListener("click", () => {
        isOpen = !isOpen;
        if (isOpen) {
            debugContent.classList.remove("hidden");
            btnToggleDebug.classList.add("active");
            refreshData();
            refreshInterval = setInterval(refreshData, 2000);
        } else {
            debugContent.classList.add("hidden");
            btnToggleDebug.classList.remove("active");
            if (refreshInterval) clearInterval(refreshInterval);
        }
    });

    btnRefreshDebug.addEventListener("click", refreshData);

    btnTestEnqueue.addEventListener("click", async () => {
        try {
            const res = await fetch(`${API_BASE}/debug/queue/test-enqueue`, { method: "POST" });
            const data = await res.json();
            alert(`Test Job Enqueued: ${data.job_id}`);
            refreshData();
        } catch (e) {
            alert("Error enqueuing test job");
        }
    });

    btnFlushQueue.addEventListener("click", async () => {
        if (confirm("Are you sure you want to clear all pending jobs?")) {
            try {
                const res = await fetch(`${API_BASE}/debug/queue/flush`, { method: "DELETE" });
                const data = await res.json();
                alert(`Cleared ${data.cleared_jobs} jobs`);
                refreshData();
            } catch (e) {
                alert("Error flushing queue");
            }
        }
    });

    async function refreshData() {
        try {
            const statusRes = await fetch(`${API_BASE}/debug/queue/status`);
            if (statusRes.ok) {
                const statusData = await statusRes.json();
                renderQueueStatus(statusData);
            }

            const keysRes = await fetch(`${API_BASE}/debug/redis/keys`);
            if (keysRes.ok) {
                const keysData = await keysRes.json();
                renderRedisKeys(keysData);
            }
            
            // If there's an active job in the main UI, fetch its payload
            if (window.currentJobId) {
                const jobRes = await fetch(`${API_BASE}/debug/queue/jobs/${window.currentJobId}`);
                if (jobRes.ok) {
                    const jobData = await jobRes.json();
                    document.getElementById("debugJobPayload").textContent = JSON.stringify(jobData, null, 2);
                }
            }
        } catch (e) {
            console.error("Debug panel refresh error:", e);
        }
    }

    function renderQueueStatus(data) {
        const container = document.getElementById("debugQueueStatus");
        container.innerHTML = `
            <div><strong>Queued:</strong> ${data.queued}</div>
            <div><strong>Active:</strong> ${data.started}</div>
            <div><strong>Failed:</strong> ${data.failed}</div>
            <div><strong>Workers:</strong> ${data.workers.length}</div>
        `;
    }

    function renderRedisKeys(data) {
        const container = document.getElementById("debugRedisKeys");
        let html = '<ul style="list-style:none; padding:0; margin:0; font-family:monospace; font-size:12px;">';
        data.keys.forEach(k => {
            html += `<li><span style="color:#888;">[${k.type}]</span> <strong>${k.key}</strong> (TTL: ${k.ttl})</li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
    }
});
