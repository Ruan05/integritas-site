export function nativeReportReady(job: Record<string, unknown>, report: Record<string, unknown>, revision: number, draft: boolean) {
  return !draft && Number.isSafeInteger(revision) && job.runtime_provider === 'ruan-native'
    && job.stage === 'completed' && report.status === 'finalized'
    && job.id === report.case_job_id && job.case_revision === revision && report.based_on_revision === revision;
}

export function reportAudience(edition: string | null): 'external' | 'internal' {
  if (edition !== null && !['external', 'internal'].includes(edition)) throw Object.assign(new Error('Unsupported report edition.'), {status:400});
  return edition === 'internal' ? 'internal' : 'external';
}
