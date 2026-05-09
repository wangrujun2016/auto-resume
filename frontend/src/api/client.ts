/** 后端 REST/WebSocket 客户端封装。 */
const API_BASE =
  (window as any).autoresume?.apiBase || 'http://127.0.0.1:8765';

export type TaskStatus =
  | 'idle' | 'launching' | 'awaiting_login' | 'logged_in' | 'running'
  | 'paused' | 'stopped' | 'finished' | 'error';

export interface JobFilter {
  keyword: string;
  city?: string;
  salary?: string;
  experience?: string;
  degree?: string;
  scale?: string;
  exclude_keywords: string[];
}

export interface SubTask {
  filter: JobFilter;
  limit: number;
}

export interface TaskInfo {
  id: string;
  name: string;
  status: TaskStatus;
  sub_tasks: SubTask[];
  /** 兼容老字段：单子任务情况下等价于 sub_tasks[0].filter */
  filter?: JobFilter | null;
  greetings: string[];
  interval_seconds: number;
  daily_limit: number;
  click_delay_seconds: number;
  sent_today: number;
  /** 各子任务今日已发数（与 sub_tasks 同序） */
  sub_sent_today: number[];
  current_sub_index: number;
  has_login: boolean;
  last_msg?: string | null;
  created_at: string;
}

export interface TaskCreatePayload {
  name: string;
  sub_tasks: SubTask[];
  greetings: string[];
  interval_seconds: number;
  daily_limit: number;
  click_delay_seconds: number;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const api = {
  list: () => http<{ items: TaskInfo[] }>('/api/tasks'),
  create: (p: TaskCreatePayload) =>
    http<TaskInfo>('/api/tasks', { method: 'POST', body: JSON.stringify(p) }),
  update: (id: string, p: TaskCreatePayload) =>
    http<TaskInfo>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  remove: (id: string) =>
    http<{ ok: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  start: (id: string) => http<TaskInfo>(`/api/tasks/${id}/start`, { method: 'POST' }),
  login: (id: string) => http<TaskInfo>(`/api/tasks/${id}/login`, { method: 'POST' }),
  pause: (id: string) => http<{ ok: boolean }>(`/api/tasks/${id}/pause`, { method: 'POST' }),
  resume: (id: string) => http<{ ok: boolean }>(`/api/tasks/${id}/resume`, { method: 'POST' }),
  stop: (id: string) => http<{ ok: boolean }>(`/api/tasks/${id}/stop`, { method: 'POST' }),
  logs: (id: string, n = 200) =>
    http<{ items: { ts: string; level: string; msg: string }[] }>(
      `/api/tasks/${id}/logs?n=${n}`
    ),
  greeted: (id: string, limit = 100) =>
    http<{ items: { job_key: string; greeted_at: string; title: string; company: string }[] }>(
      `/api/tasks/${id}/greeted?limit=${limit}`
    ),
};

export function openTaskWS(taskId: string, onMessage: (m: any) => void): WebSocket {
  const wsUrl = API_BASE.replace(/^http/, 'ws') + `/api/tasks/ws/${taskId}`;
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (ev) => {
    try { onMessage(JSON.parse(ev.data)); } catch { /* ignore */ }
  };
  return ws;
}
