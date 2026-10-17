import { migrate, ProgressFormatError, type Progress } from './progress';

export function exportFileName(d = new Date()): string {
  return `progress-${d.toISOString().slice(0, 10)}.json`;
}

export function serializeProgress(p: Progress): string {
  return JSON.stringify({ ...p, exportedAt: new Date().toISOString() }, null, 2);
}

/** Trigger a download of progress.json in the browser. */
export function downloadProgress(p: Progress): void {
  const blob = new Blob([serializeProgress(p)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseProgressFile(text: string): Progress {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProgressFormatError("That file isn't valid JSON.");
  }
  if (raw && typeof raw === 'object') delete (raw as Record<string, unknown>).exportedAt;
  return migrate(raw);
}
