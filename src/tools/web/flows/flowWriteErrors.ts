import { McpToolError } from '../../../errors/mcpToolError.js';
import { isAxiosError } from '../../../utils/axios.js';
import { getExceptionMessage } from '../../../utils/getExceptionMessage.js';
import { getHttpStatus } from '../../../utils/getHttpStatus.js';

/**
 * Tableau's structured REST error body: `{ error: { code, summary, detail } }`.
 * Surfacing `code`/`summary`/`detail` verbatim (rather than a generic axios
 * message) follows the existing convention in `viewsMethods` and lets callers
 * recover from a specific Tableau condition without parsing axios internals.
 */
function extractTableauError(
  error: unknown,
): { code?: string; summary?: string; detail?: string } | null {
  if (!isAxiosError(error)) {
    return null;
  }
  const tableauError = (error.response?.data as { error?: unknown } | undefined)?.error as
    | { code?: string; summary?: string; detail?: string }
    | undefined;
  if (tableauError && (tableauError.summary || tableauError.code)) {
    return tableauError;
  }
  return null;
}

/** Format `{ code, summary, detail }` as `Tableau [code]: summary: detail`. */
function formatTableauError(t: { code?: string; summary?: string; detail?: string }): string {
  const head = `Tableau${t.code ? ` [${t.code}]` : ''}`;
  const body = t.detail && t.summary ? `${t.summary}: ${t.detail}` : t.summary || t.detail || '';
  return body ? `${head}: ${body}` : head;
}

/**
 * Maps an error from a content-MUTATING flow run REST call (Run Flow Now or Run
 * Flow Task) into a clear, non-retryable {@link McpToolError}.
 *
 * These endpoints share a small set of failure conditions an LLM would
 * otherwise loop on (re-trying a licensing/permission failure forever). Each
 * message keeps the actionable hint AND, when Tableau returned a structured
 * error body, surfaces Tableau's own `code`/`summary`/`detail` verbatim (the
 * `viewsMethods` convention) so the specific cause is never lost.
 *
 * `verb` is the human phrase for what was attempted, e.g. "run this flow".
 */
export function mapFlowWriteError(error: unknown, verb: string): McpToolError {
  if (error instanceof McpToolError) {
    return error;
  }

  const status = error instanceof Error ? getHttpStatus(error) : '';
  const tableauError = extractTableauError(error);
  // The verbatim Tableau error when present, else the raw exception message.
  const cause = tableauError ? formatTableauError(tableauError) : getExceptionMessage(error);

  // 403: conflates (a) the caller lacking owner/Execute permission, (b) the
  // site missing Data Management / Tableau Prep Conductor, and (c) an admin
  // having disabled the site-wide "Run Now" setting. Name all three.
  if (status === '403') {
    return new McpToolError({
      type: 'flow-write-forbidden',
      statusCode: 403,
      message: [
        `Not permitted to ${verb}.`,
        'This usually means one of:',
        '(1) you are not the flow owner and lack Run Flow / Execute permission;',
        '(2) the site does not have Data Management with Tableau Prep Conductor enabled (required to run or schedule flows);',
        '(3) a site administrator has disabled the "Run Now" setting.',
        cause,
      ].join(' '),
    });
  }

  // 404: flow or task id does not exist (or is not visible to the caller).
  if (status === '404') {
    return new McpToolError({
      type: 'flow-write-not-found',
      statusCode: 404,
      message: [
        `Could not ${verb}: the specified flow or task was not found, or you do not have access to it.`,
        'Verify the id with list-flows / list-flow-tasks.',
        cause,
      ].join(' '),
    });
  }

  // 400 / 409: malformed or rejected request — typically an invalid run mode,
  // missing/invalid required flow parameter override, or a conflicting run.
  if (status === '400' || status === '409') {
    return new McpToolError({
      type: 'flow-write-bad-request',
      statusCode: Number(status),
      message: [
        `Could not ${verb}: the request was rejected as invalid.`,
        'Common causes: an invalid runMode, a missing or invalid required flow parameter override, or a conflicting flow run.',
        cause,
      ].join(' '),
    });
  }

  return new McpToolError({
    type: 'flow-write-failed',
    statusCode: Number(status) || 500,
    message: `Could not ${verb}: ${cause}`,
  });
}
