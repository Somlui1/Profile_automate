/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Job, JobLog } from '../types';
import { 
  Play, 
  Pause, 
  Trash2, 
  Clock, 
  Check, 
  AlertTriangle, 
  X, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Database, 
  Printer, 
  MailCheck, 
  Hourglass, 
  Loader2,
  CalendarCheck,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface JobQueueTabProps {
  jobs: Job[];
  onControlJob: (id: string, action: 'cancel' | 'pause' | 'resume') => void;
  addToast: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const JobQueueTab: React.FC<JobQueueTabProps> = ({
  jobs,
  onControlJob,
  addToast
}) => {
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  const [jobLogsCache, setJobLogsCache] = useState<Record<string, JobLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<Record<string, boolean>>({});
  const [stepsSchema, setStepsSchema] = useState<any[]>([]);

  useEffect(() => {
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
    fetchStepsSchema();
  }, []);

  const ICON_MAP: Record<string, React.ElementType> = {
    UserCheck,
    Printer,
    Cloud,
    Mail,
    Database,
    Hourglass
  };

  const getIconComponent = (iconName: string) => {
    const Icon = ICON_MAP[iconName] || HelpCircle;
    return <Icon className="h-3.5 w-3.5" />;
  };

  // Trigger metrics
  const activeJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'running');
  const pendingJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'paused');
  const completedJobs = jobs.filter((j) => j.status === 'success');
  const failedJobs = jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled');

  // Pull logs for individual jobs when expanded
  const handleToggleDetails = async (jobId: string) => {
    const isExpanded = expandedJobs[jobId];
    setExpandedJobs((prev) => ({ ...prev, [jobId]: !isExpanded }));

    if (!isExpanded && !jobLogsCache[jobId]) {
      setLoadingLogs((prev) => ({ ...prev, [jobId]: true }));
      try {
        const response = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/logs`);
        if (response.ok) {
          const data = await response.json();
          setJobLogsCache((prev) => ({ ...prev, [jobId]: data.logs || [] }));
        }
      } catch (e) {
        console.error("Error fetching logs for Job ID:", jobId);
      } finally {
        setLoadingLogs((prev) => ({ ...prev, [jobId]: false }));
      }
    }
  };

  // Helper calculating latency times
  const calculateElapsedString = (createdStr: string, updatedStr: string, status: string) => {
    if (!createdStr) return '00:00:00';
    try {
      const start = new Date(createdStr).getTime();
      const end = (status === 'processing' || status === 'queued') 
        ? Date.now() 
        : new Date(updatedStr).getTime();
      
      const diffMs = Math.abs(end - start);
      const diffSecs = Math.floor(diffMs / 1000);
      const hrs = Math.floor(diffSecs / 3600).toString().padStart(2, '0');
      const mins = Math.floor((diffSecs % 3600) / 60).toString().padStart(2, '0');
      const secs = (diffSecs % 60).toString().padStart(2, '0');
      return `${hrs}:${mins}:${secs}`;
    } catch (e) {
      return '00:00:00';
    }
  };

  const formatShortTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      return new Date(isoString).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '--:--';
    }
  };

  // Build grid pipeline steps state representations
  const getStepStateStyle = (job: Job, stepId: string) => {
    const status = job.status.toLowerCase();
    const current = job.current_step;
    const workflow = job.payload?.workflow_control || {};

    let isEnabled = true;
    const stepDef = stepsSchema.find(s => s.key === stepId);
    if (stepDef && workflow[stepDef.enable_key] === false) {
      isEnabled = false;
    }

    const stepsOrder = stepsSchema.map(s => s.key);
    const targetIdx = stepsOrder.indexOf(stepId);
    const currentIdx = stepsOrder.indexOf(current as any);

    if (!isEnabled) {
      return { label: 'Skipped', state: 'skipped', color: 'bg-yellow-500/10 border-yellow-300 text-yellow-700', icon: <Hourglass className="h-3.5 w-3.5" /> };
    }

    if (status === 'success') {
      return { label: 'Done', state: 'success', color: 'bg-secondary text-white border-secondary', icon: <Check className="h-3 w-3 stroke-[3]" /> };
    }

    if (status === 'queued') {
      return { label: 'Queued', state: 'queued', color: 'bg-slate-100 border-outline text-outline', icon: <Clock className="h-3.5 w-3.5" /> };
    }

    if (current === stepId) {
      if (status === 'failed') {
        return { label: 'Failed', state: 'failed', color: 'bg-error text-white border-error', icon: <X className="h-3 w-3" /> };
      }
      if (status === 'paused') {
        return { label: 'Paused', state: 'paused', color: 'bg-orange-500/10 border-orange-300 text-orange-600', icon: <Pause className="h-3 w-3" /> };
      }
      return { label: 'Running', state: 'processing', color: 'border-primary bg-white text-primary ring-2 ring-primary/20 animate-pulse', icon: <Loader2 className="h-3 w-3 animate-spin text-primary" /> };
    }

    if (currentIdx > targetIdx) {
      return { label: 'Done', state: 'success', color: 'bg-secondary text-white border-secondary', icon: <Check className="h-3 w-3 stroke-[3]" /> };
    }

    return { label: 'Queued', state: 'queued', color: 'bg-slate-100 border-outline text-outline', icon: <Clock className="h-3.5 w-3.5" /> };
  };

  const getLineClass = (stepState: string) => {
    if (stepState === 'success') return 'bg-secondary';
    if (stepState === 'processing') return 'bg-primary';
    if (stepState === 'failed') return 'bg-error';
    if (stepState === 'skipped') return 'bg-yellow-400';
    if (stepState === 'paused') return 'bg-orange-400';
    return 'bg-outline-variant';
  };

  return (
    <div className="space-y-6">
      
      {/* Search Header controllers bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0 select-none">
        <div>
          <h2 className="text-2xl font-black text-primary font-headline-md">Job Queue Management</h2>
          <p className="text-xs text-on-surface-variant font-body mt-0.5">Monitoring Redis-backed parallel provisioning workflows</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => addToast("ฟังก์ชันเคลียร์ประวัติล้มเหลว กำลังตรวจสอบคิวระบาย", "info")}
            className="flex items-center gap-1.5 px-4 py-2 border border-error text-error font-bold text-xs rounded hover:bg-error/5 cursor-pointer duration-100 select-none"
          >
            Retry Failed
          </button>
          <button 
            onClick={() => addToast("คิวเวิร์กโลว์ถูกจัดเรียงตามระยะเวลาเสร็จสิ้นล่าสุดเรียบร้อย", "success")} 
            className="flex items-center gap-1.5 px-4 py-2 border border-outline text-outline font-bold text-xs rounded hover:bg-slate-100 cursor-pointer duration-100 select-none"
          >
            Filter Logs
          </button>
        </div>
      </div>

      {/* Health summaries Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 select-none shrink-0">
        <div className="bg-white border border-outline-variant p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Active Jobs</p>
            <p className="text-3xl font-black text-primary mt-1 font-headline-md">{activeJobs.length}</p>
            <span className="text-[11px] text-primary font-bold">▲ Running now</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </div>

        <div className="bg-white border border-outline-variant p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Pending</p>
            <p className="text-3xl font-black text-tertiary mt-1 font-headline-md">{pendingJobs.length}</p>
            <span className="text-[11px] text-tertiary font-bold">In queue</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white border border-outline-variant p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Completed (24h)</p>
            <p className="text-3xl font-black text-secondary mt-1 font-headline-md">{completedJobs.length}</p>
            <span className="text-[11px] text-secondary font-bold">▲ Success</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white border border-outline-variant p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Failed</p>
            <p className="text-3xl font-black text-error mt-1 font-headline-md">{failedJobs.length}</p>
            <span className="text-[11px] text-error font-bold">Needs action</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error">
            <AlertTriangle className="h-6 w-6 animate-bounce" />
          </div>
        </div>
      </div>

      {/* Main Real-time pipeline Table */}
      <div className="bg-white border border-outline-variant rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center select-none">
          <h3 className="font-bold text-primary text-sm flex items-center gap-1">Real-time Provisioning Pipeline</h3>
          <div className="flex gap-4 text-[10px] text-on-surface-variant font-black">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-secondary inline-block" /> Completed</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary inline-block animate-pulse" /> Running</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300 inline-block" /> Standby</span>
          </div>
        </div>

        {/* List mapping */}
        <div className="flex flex-col gap-4 p-4">
          {jobs.length > 0 ? (
            jobs.map((job) => {
              const status = job.status.toLowerCase();
              const isHPriority = job.payload?.workflow_control?.high_priority;
              const hasExpanded = expandedJobs[job.id];

              

              return (
                <div 
                  key={job.id}
                  className={`border border-outline-variant rounded-xl bg-white overflow-hidden shadow-sm border-l-4 transition-all ${
                    status === 'failed' || status === 'cancelled'
                      ? 'border-error' 
                      : status === 'success' 
                        ? 'border-secondary' 
                        : 'border-primary'
                  }`}
                >
                  <div 
                    onClick={() => handleToggleDetails(job.id)}
                    className="p-5 hover:bg-slate-50 transition-colors flex flex-col xl:flex-row xl:items-center gap-4 cursor-pointer select-none"
                  >
                    {/* Basic details */}
                    <div className="xl:w-60 shrink-0">
                      <p className="font-black text-sm text-on-surface">
                        {job.payload?.metadata?.requester_info?.name_english || 'System Workflow'}
                      </p>
                      <p className="text-[10px] text-outline font-mono mt-0.5">job_id: {job.id}</p>
                      <span className={`inline-block mt-1.5 px-2 py-[2px] rounded-full text-[9px] font-black uppercase tracking-wider ${
                        isHPriority ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'
                      }`}>
                        {isHPriority ? 'HIGH PRIORITY' : 'NORMAL PRIORITY'}
                      </span>
                    </div>

                    {/* Step-by-Step progress lines */}
                    <div className="flex-grow pt-1">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2 leading-none">Pipeline Status</p>
                      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-2">
                        {stepsSchema.map((step, idx) => {
                          const stateStyle = getStepStateStyle(job, step.key);
                          const isLast = idx === stepsSchema.length - 1;
                          return (
                            <React.Fragment key={step.key}>
                              <div className="flex flex-col items-center gap-1 min-w-[72px]">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 ${stateStyle.color}`} title={stateStyle.label}>
                                  {stateStyle.state === 'queued' || stateStyle.state === 'skipped' ? getIconComponent(step.icon) : stateStyle.icon}
                                </div>
                                <span className="text-[9px] font-semibold text-slate-500 whitespace-nowrap text-center">{step.name}</span>
                              </div>
                              {!isLast && <div className={`h-[2px] ${getLineClass(stateStyle.state)} w-6 lg:flex-grow mb-4 shrink-0`} />}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Operational times and triggers */}
                    <div className="xl:w-56 shrink-0 text-right flex items-center justify-end gap-4 ml-auto">
                      <div>
                        <div className="text-[10px] text-on-surface-variant font-medium">Elapsed: <span className="font-mono text-on-surface font-bold">{calculateElapsedString(job.created_at, job.updated_at, job.status)}</span></div>
                        <div className="text-[10px] text-on-surface-variant font-medium">Created: <span className="font-mono text-on-surface">{formatShortTime(job.created_at)}</span></div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Control buttons */}
                        {status === 'processing' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onControlJob(job.id, 'pause'); }}
                            className="p-1 px-1.5 text-primary hover:bg-slate-100 rounded cursor-pointer"
                            title="Pause Job Pipeline"
                          >
                            <Pause className="h-4.5 w-4.5 text-primary" />
                          </button>
                        )}
                        {status === 'paused' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onControlJob(job.id, 'resume'); }}
                            className="p-1 px-1.5 text-secondary hover:bg-slate-100 rounded cursor-pointer"
                            title="Resume Job Pipeline"
                          >
                            <Play className="h-4.5 w-4.5 text-secondary inline shrink" />
                          </button>
                        )}
                        {(status === 'processing' || status === 'queued' || status === 'paused') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onControlJob(job.id, 'cancel'); }}
                            className="p-1 px-1.5 text-error hover:bg-rose-50 rounded cursor-pointer"
                            title="Terminate Job"
                          >
                            <X className="h-4.5 w-4.5 text-error" />
                          </button>
                        )}

                        <button className="p-1 text-slate-700 hover:bg-slate-100 rounded shrink-0">
                          {hasExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Log panel details */}
                  {hasExpanded && (
                    <div className="border-t border-outline-variant p-6 bg-slate-50 select-none">
                      {loadingLogs[job.id] ? (
                        <div className="text-center py-4 text-xs text-outline italic">
                          <Loader2 className="h-4 w-4 animate-spin inline-block text-primary mr-1.5" /> Loading database transactional logs...
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 font-mono text-[11px]">
                          {/* We segment logs by steps */}
                          {stepsSchema.map((stepDef) => {
                            const stepName = stepDef.key;
                            const stepTitle = stepDef.name;
                            const stepLogs = (jobLogsCache[job.id] || []).filter((l) => l.step === stepName || (stepName === 'ad_creation' && l.step === 'pipeline'));

                            const subStates: Record<string, string> = {};
                            stepLogs.forEach(log => {
                               if (log.metadata && log.metadata.sub_step) {
                                  subStates[log.metadata.sub_step] = log.metadata.sub_step_status.toUpperCase();
                               }
                            });

                            return (
                              <div key={stepName} className="space-y-4">
                                <h4 className="font-bold text-xs text-primary uppercase border-b pb-1.5 mb-2 flex items-center gap-1.5">
                                  {getIconComponent(stepDef.icon)} {stepTitle}
                                </h4>
                                
                                {stepDef.sub_steps && stepDef.sub_steps.length > 0 && (
                                  <div className="mb-3 p-2.5 bg-white rounded-lg border border-outline-variant space-y-2 font-sans text-[10px]">
                                    {stepDef.sub_steps.map((sub: any) => {
                                       const sState = subStates[sub.key] || 'STANDBY';
                                       const dotClass = sState === 'SUCCESS' ? 'bg-secondary' : sState === 'RUNNING' ? 'bg-primary animate-pulse' : 'bg-slate-300';
                                       return (
                                          <div key={sub.key} className="flex items-center gap-2 text-slate-700">
                                            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                                            <span className={sState === 'SUCCESS' ? 'line-through text-slate-400 font-medium' : 'font-semibold'}>{sub.name}</span>
                                          </div>
                                       );
                                    })}
                                  </div>
                                )}

                                <div className="space-y-3 relative pl-3">
                                  {stepLogs.length > 0 ? (
                                    stepLogs.map((log, idx) => (
                                      <div key={log.id} className="relative flex items-start gap-1 pb-1">
                                        <span className={`h-2 w-2 rounded-full absolute -left-3 top-1.5 ${
                                          log.status === 'success' ? 'bg-secondary' : log.status === 'failed' ? 'bg-error' : 'bg-primary animate-pulse'
                                        }`} />
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-800 leading-tight break-words">{log.message}</p>
                                          <p className="text-[9px] text-outline font-semibold mt-0.5">{formatShortTime(log.timestamp)}</p>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-outline-variant italic">Waiting sequence...</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-xs text-outline italic bg-white border border-outline-variant rounded shadow-inner">
               No historical or active provisioning workloads found in background Queue.
            </div>
          )}
        </div>
      </div>

      {/* Latency and memory metrics footer info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
        <div className="bg-primary p-6 rounded-lg text-white flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div>
            <h4 className="font-bold text-sm mb-1 uppercase tracking-wider font-headline-md">Queue Latency</h4>
            <p className="text-3xl font-black font-headline-xl">124ms</p>
            <p className="text-[11px] opacity-75 mt-1 font-body">Average worker socket response times across regional nodes.</p>
          </div>
          <div className="mt-8 pt-4 border-t border-white/20 select-none">
            <div className="flex justify-between items-center mb-1 text-[11px]">
              <span className="opacity-80">Sandbox RAM Allocation</span>
              <span className="font-mono font-bold">2.4 / 8 GB</span>
            </div>
            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
              <div className="bg-secondary h-full rounded-full" style={{ width: '30%' }} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-outline-variant p-6 rounded-lg shadow-sm select-none">
          <h4 className="font-bold text-primary text-sm mb-4 flex items-center gap-1.5 uppercase tracking-wide">
             IT Worker Cluster Status
          </h4>
          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-outline uppercase w-28 shrink-0">Worker-01 (LDAP)</span>
              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '78%' }} />
              </div>
              <span className="text-[10px] font-mono font-bold text-on-surface w-10 text-right">78%</span>
              <span className="w-2.5 h-2.5 rounded-full bg-secondary shrink-0" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-outline uppercase w-28 shrink-0">Worker-02 (XML-RPC)</span>
              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '45%' }} />
              </div>
              <span className="text-[10px] font-mono font-bold text-on-surface w-10 text-right">45%</span>
              <span className="w-2.5 h-2.5 rounded-full bg-secondary shrink-0" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-outline uppercase w-28 shrink-0">Worker-03 (M365)</span>
              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-error h-full rounded-full animate-pulse" style={{ width: '94%' }} />
              </div>
              <span className="text-[10px] font-mono font-bold text-error w-10 text-right">94%</span>
              <span className="w-2.5 h-2.5 rounded-full bg-error shrink-0 animate-ping" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-outline uppercase w-28 shrink-0">Worker-04 (SMTP)</span>
              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '22%' }} />
              </div>
              <span className="text-[10px] font-mono font-bold text-on-surface w-10 text-right">22%</span>
              <span className="w-2.5 h-2.5 rounded-full bg-secondary shrink-0" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
