import clsx from 'clsx';
import { Play, Pause, Square, Trash2, LogIn, RefreshCw, Pencil } from 'lucide-react';
import type { TaskInfo } from '../api/client';
import { cityLabel } from '../constants/cities';
import { StatusBadge } from './StatusBadge';

interface Props {
  task: TaskInfo;
  active: boolean;
  onSelect: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onLogin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskCard(props: Props) {
  const { task, active } = props;
  const loggingIn = task.status === 'launching' || task.status === 'awaiting_login';
  const running = task.status === 'running';
  const paused = task.status === 'paused';
  const idle = !loggingIn && !running && !paused;

  return (
    <div
      onClick={props.onSelect}
      className={clsx(
        'cursor-pointer rounded-lg border p-3 transition-colors',
        active ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{task.name}</span>
          <StatusBadge status={task.status} />
          {!task.has_login && idle && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300">未登录</span>
          )}
        </div>
        <div className="text-xs text-slate-400 shrink-0">{task.sent_today}/{task.daily_limit}</div>
      </div>

      {/* 子任务进度：每个子任务一行 关键词 · 城市名 · 已发/目标 */}
      {task.sub_tasks && task.sub_tasks.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {task.sub_tasks.map((sub, i) => {
            const sent = task.sub_sent_today?.[i] ?? 0;
            const isCurrent = running && task.current_sub_index === i;
            return (
              <div
                key={i}
                className={clsx(
                  'text-xs truncate flex items-center gap-1',
                  isCurrent ? 'text-brand-300' : 'text-slate-400'
                )}
              >
                <span className="opacity-60">#{i + 1}</span>
                <span className="truncate">{sub.filter.keyword || '(空)'}</span>
                <span className="opacity-60">· {cityLabel(sub.filter.city)}</span>
                <span className="ml-auto shrink-0">
                  {sent}/{sub.limit}
                </span>
              </div>
            );
          })}
        </div>
      ) : task.filter ? (
        <div className="mt-1 text-xs text-slate-400 truncate">
          {task.filter.keyword} · {cityLabel(task.filter.city)}
        </div>
      ) : null}
      <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        {/* 未登录、空闲：登录 + 开始 并排（开始会自动处理登录流程） */}
        {idle && !task.has_login && (
          <>
            <button
              onClick={props.onLogin}
              className="px-3 py-1 text-xs rounded bg-cyan-600 hover:bg-cyan-500 flex items-center gap-1 font-medium"
              title="仅登录账号，登录完成自动关闭浏览器"
            >
              <LogIn size={12} /> 登录
            </button>
            <button
              onClick={props.onStart}
              className="px-3 py-1 text-xs rounded bg-brand-600 hover:bg-brand-500 flex items-center gap-1 font-medium"
              title="开始任务（未登录时会先打开浏览器登录，再自动招呼）"
            >
              <Play size={12} /> 开始
            </button>
          </>
        )}

        {/* 已登录、空闲：开始 + 重新登录（小图标） */}
        {idle && task.has_login && (
          <>
            <button
              onClick={props.onStart}
              className="px-3 py-1 text-xs rounded bg-brand-600 hover:bg-brand-500 flex items-center gap-1 font-medium"
            >
              <Play size={12} /> 开始
            </button>
            <button
              onClick={props.onLogin}
              className="px-2 py-1 text-xs rounded text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-1"
              title="重新登录（cookie 过期或换号时使用）"
            >
              <RefreshCw size={12} />
            </button>
          </>
        )}

        {/* 登录中：只能停止 */}
        {loggingIn && (
          <button onClick={props.onStop} className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 flex items-center gap-1">
            <Square size={12} /> 停止登录
          </button>
        )}

        {/* 运行中：暂停 + 停止 */}
        {running && (
          <>
            <button onClick={props.onPause} className="px-2 py-1 text-xs rounded bg-amber-600 hover:bg-amber-500 flex items-center gap-1">
              <Pause size={12} /> 暂停
            </button>
            <button onClick={props.onStop} className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 flex items-center gap-1">
              <Square size={12} /> 停止
            </button>
          </>
        )}

        {/* 暂停：继续 + 停止 */}
        {paused && (
          <>
            <button onClick={props.onResume} className="px-2 py-1 text-xs rounded bg-brand-600 hover:bg-brand-500 flex items-center gap-1">
              <Play size={12} /> 继续
            </button>
            <button onClick={props.onStop} className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 flex items-center gap-1">
              <Square size={12} /> 停止
            </button>
          </>
        )}

        <button
          onClick={props.onEdit}
          className="ml-auto px-2 py-1 text-xs rounded text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-1"
          title="编辑任务（运行中会先停止）"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={props.onDelete}
          className="px-2 py-1 text-xs rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 flex items-center gap-1"
          title="删除任务"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
