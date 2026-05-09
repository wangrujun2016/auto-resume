import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { NewTaskModal } from './components/NewTaskModal';
import { TaskCard } from './components/TaskCard';
import { TaskDetail } from './components/TaskDetail';
import { api, type TaskInfo } from './api/client';
import { useTasks } from './store/useTasks';

export default function App() {
  const { tasks, loading, refresh, selectedId, select, upsert } = useTasks();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<TaskInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh().catch((e) => setError(`后端连接失败：${e.message}`));
    const t = setInterval(() => { refresh().catch(() => {}); }, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const handleAction = async (id: string, fn: () => Promise<unknown>) => {
    try { await fn(); await refresh(); }
    catch (e: any) { alert(`操作失败：${e.message}`); }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="h-12 flex items-center px-4 border-b border-slate-800 bg-slate-900/60">
        <div className="font-semibold text-slate-100">BOSS 直聘 自动招呼助手</div>
        <div className="ml-2 text-xs text-slate-500">每个账号一个独立浏览器窗口，cookie 互不污染</div>
        <button
          onClick={() => refresh()}
          className="ml-auto p-1.5 rounded hover:bg-slate-800 text-slate-400"
          title="刷新"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {error && (
        <div className="px-4 py-2 bg-red-500/20 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 shrink-0 border-r border-slate-800 flex flex-col">
          <div className="p-3">
            <button
              onClick={() => setShowNew(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium"
            >
              <Plus size={16} /> 新建账号任务
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3 space-y-2">
            {tasks.length === 0 && (
              <div className="text-center text-sm text-slate-500 mt-12">
                暂无任务<br />
                <span className="text-xs">点击上方按钮创建</span>
              </div>
            )}
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                active={t.id === selectedId}
                onSelect={() => select(t.id)}
                onStart={() => handleAction(t.id, () => api.start(t.id))}
                onPause={() => handleAction(t.id, () => api.pause(t.id))}
                onResume={() => handleAction(t.id, () => api.resume(t.id))}
                onStop={() => handleAction(t.id, () => api.stop(t.id))}
                onLogin={() => handleAction(t.id, () => api.login(t.id))}
                onEdit={() => { setEditing(t); setShowNew(true); }}
                onDelete={() => {
                  if (confirm(`确认删除任务「${t.name}」？该账号的浏览器 profile 将保留，可重新创建任务复用登录态。`))
                    handleAction(t.id, () => api.remove(t.id));
                }}
              />
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          {selected ? (
            <TaskDetail task={selected} onUpdate={(info) => upsert(info)} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
              <div className="text-lg">从左侧选择一个任务查看详情</div>
              <div className="text-xs">或点击「新建账号任务」开始</div>
            </div>
          )}
        </main>
      </div>

      <NewTaskModal
        open={showNew}
        editing={editing}
        onClose={() => { setShowNew(false); setEditing(null); }}
        onCreated={async (taskId) => {
          await refresh();
          select(taskId);
        }}
      />
    </div>
  );
}
