import { ApiClientError, isExpiredResponse, refreshSession, sessionEnded, toApiError } from "@/lib/api-client";

/** Fast client-side checks for UX only; the server re-validates type (by content) and size. */
export function checkFileBeforeUpload(file: { name: string; size: number }, maxMb: number): string | null {
  if (!/\.(pdf|docx)$/i.test(file.name)) return "Only PDF or DOCX files can be submitted.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > maxMb * 1024 * 1024) return `Files must be ${maxMb} MB or smaller.`;
  return null;
}

function send(url: string, body: FormData, onProgress: (fraction: number) => void): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        /* not JSON */
      }
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => reject(new ApiClientError("Could not reach the server. Check your connection and try again.", 0, "NETWORK_ERROR"));
    xhr.send(body);
  });
}

/**
 * Multipart upload with progress (fetch can't report upload progress). Same
 * contract as apiFetch: standard error body → ApiClientError, and an expired
 * access token is refreshed once before retrying.
 */
export async function uploadWithProgress<T = unknown>(url: string, body: FormData, onProgress: (fraction: number) => void): Promise<T> {
  let r = await send(url, body, onProgress);
  if (isExpiredResponse(r.status, r.data)) {
    if (!(await refreshSession())) throw sessionEnded();
    r = await send(url, body, onProgress);
  }
  if (r.status < 200 || r.status >= 300) throw toApiError(r.status, r.data);
  return r.data as T;
}
