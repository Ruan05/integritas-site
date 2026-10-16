const TERMINAL_INTAKE_STAGES = new Set([
  "completed",
  "cancelled",
  "failed",
  "incomplete",
  "research_limit_reached",
]);

/**
 * Return the existing case revision only when an intake is being added to the
 * case currently open in the workspace. New-case mode always creates a case.
 */
export function resolveCaseSubmissionTarget({ newCaseMode, activeCaseId, snapshot }) {
  const currentCase = snapshot?.case;
  if (newCaseMode || !activeCaseId || currentCase?.id !== activeCaseId
    || !Number.isInteger(currentCase.revision) || currentCase.revision < 0) return null;

  return { caseId: currentCase.id, caseRevision: currentCase.revision };
}

/** Matches the database intake gate: paused jobs still require confirmation. */
export function hasActiveCaseInvestigation(snapshot) {
  return (snapshot?.jobs ?? []).some((job) => !TERMINAL_INTAKE_STAGES.has(job.stage));
}
