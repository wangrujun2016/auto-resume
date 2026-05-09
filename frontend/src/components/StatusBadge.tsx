import clsx from 'clsx';
import type { TaskStatus } from '../api/client';

const MAP: Record<TaskStatus, { label: string; cls: string }> = {
  idle: { label: '未登录', cls: 'bg-slate-600/40 text-slate-200' },
  launching: { label: '启动中', cls: 'bg-amber-500/20 text-amber-300' },
  awaiting_login: { label: '待登录', cls: 'bg-blue-500/20 text-blue-300 animate-pulse' },
  logged_in: { label: '已登录', cls: 'bg-cyan-500/20 text-cyan-300' },
  running: { label: '运行中', cls: 'bg-emerald-500/20 text-emerald-300' },
  paused: { label: '已暂停', cls: 'bg-orange-500/20 text-orange-300' },
  stopped: { label: '已停止', cls: 'bg-slate-500/30 text-slate-300' },
  finished: { label: '已完成', cls: 'bg-cyan-500/20 text-cyan-300' },
  error: { label: '出错', cls: 'bg-red-500/30 text-red-300' },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const m = MAP[status] ?? MAP.idle;
  return <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', m.cls)}>{m.label}</span>;
}
