const SUCCESS_STATUSES = new Set(["completed", "succeeded", "success"]);
const FAILURE_STATUSES = new Set(["failed", "error", "cancelled", "canceled", "fail"]);

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function getGenerationErrorDetail(result) {
  if (typeof result?.error === "string") return result.error;
  if (typeof result?.error?.message === "string") return result.error.message;
  if (typeof result?.message === "string") return result.message;
  if (typeof result?.msg === "string") return result.msg;
  return "Unknown error";
}

function createGenerationError(result, requestId) {
  const error = new Error(`Generation failed: ${getGenerationErrorDetail(result)}`);
  error.requestId = requestId;
  error.generationResult = result;
  return error;
}

export function appendGenerationRefundNotice(message, error) {
  const cost = error?.generationResult?.cost;
  if (cost?.refunded !== true) return message;

  const credits = cost.amount_credits;
  const notice = Number.isFinite(credits)
    ? `Refunded ${credits} credit${credits === 1 ? "" : "s"}.`
    : "The generation cost was refunded.";
  return `${message} ${notice}`;
}

function parseResultUrls(resultJson) {
  if (!resultJson) return [];
  try {
    const parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
    if (Array.isArray(parsed?.resultUrls)) return parsed.resultUrls;
    if (typeof parsed?.resultUrl === 'string') return [parsed.resultUrl];
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export async function pollForGenerationResult({
  baseUrl,
  requestId,
  apiKey,
  maxAttempts = 900,
  interval = 2000,
  onAuthRequired,
  fetchImpl = fetch,
}) {
  const pollUrl = `${baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(requestId)}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await wait(interval);

    let response;
    try {
      response = await fetchImpl(pollUrl, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
      });
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      continue;
    }

    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(`Poll Failed: ${response.status} - ${detail.slice(0, 100)}`);
      error.requestId = requestId;

      if (response.status >= 500 && attempt < maxAttempts) continue;
      onAuthRequired?.(response.status, detail);
      throw error;
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      continue;
    }

    const record = data?.data || data;
    const status = (record.status || record.state || '').toLowerCase();

    if (status === 'success' || SUCCESS_STATUSES.has(status)) {
      const urls = parseResultUrls(record.resultJson);
      const outputUrl = urls[0] || record.resultUrl || record.url;
      return {
        ...record,
        status: 'completed',
        outputs: urls,
        url: outputUrl,
        output: { url: outputUrl },
        request_id: requestId,
      };
    }

    if (FAILURE_STATUSES.has(status)) {
      throw createGenerationError(record, requestId);
    }
  }

  const error = new Error(`Generation timed out after polling. Request ID: ${requestId}`);
  error.requestId = requestId;
  throw error;
}
