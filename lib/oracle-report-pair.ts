export type OracleReportPair = {report_id:string;case_id:string;case_job_id:string;case_revision:number;report_model_sha256:string;external_sha256:string;internal_sha256:string};
export function oraclePairReady(job:Record<string,unknown>|null|undefined,report:Record<string,unknown>|null|undefined,pairs:OracleReportPair[]|undefined,revision:number):boolean {
  return Boolean(job?.runtime_provider==='openclaw-oracle' && job.stage==='completed' && job.case_revision===revision
    && report?.status==='finalized' && report.based_on_revision===revision && report.case_job_id===job.id
    && report.finalization_method==='automated_independent_review'
    && pairs?.some(p=>p.report_id===report.id && p.case_id===job.case_id && p.case_job_id===job.id
      && p.case_revision===revision && p.report_model_sha256===report.report_model_sha256
      && /^[a-f0-9]{64}$/.test(p.external_sha256) && /^[a-f0-9]{64}$/.test(p.internal_sha256)
      && p.external_sha256!==p.internal_sha256));
}
