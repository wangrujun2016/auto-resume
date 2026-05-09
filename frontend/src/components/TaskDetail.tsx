import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { api, openTaskWS, type TaskInfo } from '../api/client';
import { cityLabel } from '../constants/cities';
import { StatusBadge } from './StatusBadge';

interface LogEntry { ts: string; level: string; msg: string; }

interface Props {
  task: TaskInfo;
  onUpdate: (info: TaskInfo) => void;
}

export function TaskDetail({ task, onUpdate }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<'logs' | 'greeted'>('logs');
  const [greeted, setGreeted] = useState<{ title: string; company: string; greeted_at: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs([]);
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

    const ws = openTaskWS(task.id, (m) => {
      if (m.type === 'snapshot') {
        setLogs(m.logs || []);
        if (m.info) onUpdate(m.info);
      } else if (m.type === 'log') {
        setLogs((s) => [...s.slice(-499), m.entry]);
      } else if (m.type === 'status') {
        if (m.info) onUpdate(m.info);
      }
    });
    wsRef.current = ws;

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 25_000);

    return () => {
      clearInterval(ping);
      ws.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs.length]);

  useEffect(() => {
    if (tab === 'greeted') {
      api.greeted(task.id).then((r) => setGreeted(r.items as any));
    }
  }, [tab, task.id, task.sent_today]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{task.name}</h1>
          <StatusBadge status={task.status} />
          <span className="text-sm text-slate-400">今日已招呼 {task.sent_today} / {task.daily_limit}</span>
        </div>
        {/* 子任务列表（多个子任务时分行展示）；老任务（filter）回退兼容 */}
        {task.sub_tasks && task.sub_tasks.length > 0 ? (
          <div className="mt-1 space-y-0.5">
            {task.sub_tasks.map((sub, i) => {
              const sent = task.sub_sent_today?.[i] ?? 0;
              const isCurrent = task.status === 'running' && task.current_sub_index === i;
              return (
                <div key={i} className={clsx('text-xs', isCurrent ? 'text-brand-300' : 'text-slate-400')}>
                  <span className="opacity-60">#{i + 1}</span>
                  <span className="ml-1">关键词 <span className="text-slate-200">{sub.filter.keyword}</span></span>
                  <span className="ml-2">城市 <span className="text-slate-200">{cityLabel(sub.filter.city)}</span></span>
                  <span className="ml-2">{sent}/{sub.limit}</span>
                  {sub.filter.exclude_keywords.length > 0 && (
                    <span className="ml-2">黑名单：{sub.filter.exclude_keywords.join('、')}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : task.filter ? (
          <div className="mt-1 text-xs text-slate-400">
            关键词：<span className="text-slate-200">{task.filter.keyword}</span>
            {task.filter.city && <> · 城市：<span className="text-slate-200">{cityLabel(task.filter.city)}</span></>}
            {task.filter.exclude_keywords.length > 0 && <> · 黑名单：{task.filter.exclude_keywords.join('、')}</>}
          </div>
        ) : null}
      </div>

      <div className="flex border-b border-slate-800 px-5">
        {(['logs', 'greeted'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-3 py-2 text-sm border-b-2 -mb-px',
              tab === t ? 'border-brand-500 text-brand-500' : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            {t === 'logs' ? '运行日志' : '今日已招呼'}
          </button>
        ))}
      </div>

      {tab === 'logs' ? (
        <div ref={logRef} className="flex-1 overflow-y-auto scrollbar-thin px-5 py-3 font-mono text-xs space-y-0.5">
          {logs.length === 0 && <div className="text-slate-500">暂无日志</div>}
          {logs.map((l, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-slate-500">{l.ts.slice(11, 19)}</span>
              <span className={clsx(
                'w-16 shrink-0',
                l.level === 'ERROR' && 'text-red-400',
                l.level === 'WARN' && 'text-amber-300',
                l.level === 'SUCCESS' && 'text-emerald-300',
                l.level === 'INFO' && 'text-slate-300',
              )}>{l.level}</span>
              <span className="text-slate-200 break-all">{l.msg}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-3">
          {greeted.length === 0 && <div className="text-slate-500 text-sm">今日还没有已招呼记录</div>}
          <ul className="divide-y divide-slate-800">
            {greeted.map((g, i) => (
              <li key={i} className="py-2 flex justify-between text-sm">
                <div>
                  <div className="text-slate-100">{g.title}</div>
                  <div className="text-xs text-slate-400">{g.company}</div>
                </div>
                <div className="text-xs text-slate-500">{g.greeted_at?.slice(11, 19)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
