import { useEffect, useState } from 'react';
import { X, Plus, Save, Trash2, Pencil } from 'lucide-react';
import { api, type SubTask, type TaskCreatePayload, type TaskInfo } from '../api/client';
import { CITY_OPTIONS } from '../constants/cities';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (taskId: string) => Promise<void> | void;
  /** 编辑模式：传入要编辑的任务，标题/按钮文案会切换；保存走 PUT 而非 POST */
  editing?: TaskInfo | null;
}

const SALARY_OPTIONS = [
  { v: '', label: '不限' },
  { v: '402', label: '3K 以下' },
  { v: '403', label: '3-5K' },
  { v: '404', label: '5-10K' },
  { v: '405', label: '10-20K' },
  { v: '406', label: '20-50K' },
  { v: '407', label: '50K 以上' },
];

const EXP_OPTIONS = [
  { v: '', label: '不限' },
  { v: '102', label: '在校生' },
  { v: '108', label: '应届' },
  { v: '101', label: '经验不限' },
  { v: '103', label: '1 年以内' },
  { v: '104', label: '1-3 年' },
  { v: '105', label: '3-5 年' },
  { v: '106', label: '5-10 年' },
  { v: '107', label: '10 年以上' },
];

const DEGREE_OPTIONS = [
  { v: '', label: '不限' },
  { v: '209', label: '初中及以下' },
  { v: '208', label: '中专/中技' },
  { v: '206', label: '高中' },
  { v: '202', label: '大专' },
  { v: '203', label: '本科' },
  { v: '204', label: '硕士' },
  { v: '205', label: '博士' },
];

const SCALE_OPTIONS = [
  { v: '', label: '不限' },
  { v: '301', label: '0-20 人' },
  { v: '302', label: '20-99 人' },
  { v: '303', label: '100-499 人' },
  { v: '304', label: '500-999 人' },
  { v: '305', label: '1000-9999 人' },
  { v: '306', label: '10000+ 人' },
];

interface SubFormState {
  keyword: string;
  city: string;
  salary: string;
  experience: string;
  degree: string;
  scale: string;
  exclude: string;
  limit: number;
}

const newSub = (): SubFormState => ({
  keyword: '',
  city: '100010000',
  salary: '',
  experience: '',
  degree: '',
  scale: '',
  exclude: '',
  limit: 10,
});

export function NewTaskModal({ open, onClose, onCreated, editing }: Props) {
  const [name, setName] = useState('');
  const [subs, setSubs] = useState<SubFormState[]>([newSub()]);
  const [greetings, setGreetings] = useState('');
  const [interval, setInterval] = useState(10);
  const [dailyTotal, setDailyTotal] = useState(150);
  const [clickDelay, setClickDelay] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setSubs([newSub()]);
    setGreetings('');
    setInterval(10);
    setDailyTotal(150);
    setClickDelay(5);
    setSubmitting(false);
    setError(null);
  };

  // 进入编辑模式时把 task 的字段灌入表单
  const loadFromTask = (t: TaskInfo) => {
    setName(t.name);
    setGreetings((t.greetings || []).join('\n'));
    setInterval(t.interval_seconds);
    setDailyTotal(t.daily_limit);
    setClickDelay(t.click_delay_seconds ?? 5);
    const list = (t.sub_tasks && t.sub_tasks.length > 0)
      ? t.sub_tasks
      : (t.filter ? [{ filter: t.filter, limit: t.daily_limit }] : []);
    setSubs(
      list.length > 0
        ? list.map((s) => ({
            keyword: s.filter.keyword || '',
            city: s.filter.city || '100010000',
            salary: s.filter.salary || '',
            experience: s.filter.experience || '',
            degree: s.filter.degree || '',
            scale: s.filter.scale || '',
            exclude: (s.filter.exclude_keywords || []).join(', '),
            limit: s.limit,
          }))
        : [newSub()]
    );
    setSubmitting(false);
    setError(null);
  };

  useEffect(() => {
    if (!open) { reset(); return; }
    if (editing) loadFromTask(editing);
    else reset();
  }, [open, editing]);

  if (!open) return null;

  const updateSub = (idx: number, patch: Partial<SubFormState>) => {
    setSubs((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const addSub = () => setSubs((prev) => [...prev, newSub()]);
  const removeSub = (idx: number) => setSubs((prev) => prev.filter((_, i) => i !== idx));

  const buildPayload = (): TaskCreatePayload => {
    const sub_tasks: SubTask[] = subs.map((s) => ({
      filter: {
        keyword: s.keyword.trim(),
        city: s.city.trim() || undefined,
        salary: s.salary || undefined,
        experience: s.experience || undefined,
        degree: s.degree || undefined,
        scale: s.scale || undefined,
        exclude_keywords: s.exclude.split(/[,，\n]/).map((x) => x.trim()).filter(Boolean),
      },
      limit: Math.max(1, Math.min(200, s.limit)),
    }));
    return {
      name: name.trim(),
      sub_tasks,
      greetings: greetings.split('\n').map((s) => s.trim()).filter(Boolean),
      interval_seconds: Math.max(10, Math.min(600, interval)),
      daily_limit: Math.max(1, Math.min(2000, dailyTotal)),
      click_delay_seconds: Math.max(0, Math.min(30, clickDelay)),
    };
  };

  const canSave =
    name.trim() && subs.length > 0 && subs.every((s) => s.keyword.trim());

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    try {
      const info = editing
        ? await api.update(editing.id, buildPayload())
        : await api.create(buildPayload());
      await onCreated(info.id);
      onClose();
    } catch (e: any) {
      setError(`${editing ? '保存' : '创建'}失败：${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[720px] max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <h2 className="font-semibold text-slate-100 flex items-center gap-2">
            {editing ? <Pencil size={16} /> : <Plus size={16} />}
            {editing ? `编辑任务：${editing.name}` : '新建账号任务'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <Field label="任务/账号别名 *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：账号A"
              className="input"
            />
          </Field>

          {/* 子任务列表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 font-medium">
                搜索子任务（按顺序执行，每个独立次数）
              </span>
              <button
                type="button"
                onClick={addSub}
                className="text-xs px-2 py-1 rounded bg-brand-600 hover:bg-brand-500 flex items-center gap-1"
              >
                <Plus size={12} /> 添加子任务
              </button>
            </div>

            {subs.map((s, idx) => (
              <div
                key={idx}
                className="border border-slate-700 rounded-lg p-3 bg-slate-800/40 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 rounded bg-brand-600/30 border border-brand-500/40 text-brand-200">
                    子任务 {idx + 1}
                  </span>
                  {subs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSub(idx)}
                      className="text-slate-400 hover:text-red-400"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <Field label="搜索关键词 *">
                  <input
                    value={s.keyword}
                    onChange={(e) => updateSub(idx, { keyword: e.target.value })}
                    placeholder="如：web 前端 / Java 后端"
                    className="input"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="城市 *">
                    <Select
                      value={s.city}
                      onChange={(v) => updateSub(idx, { city: v })}
                      options={CITY_OPTIONS}
                    />
                  </Field>
                  <Field label="薪资">
                    <Select
                      value={s.salary}
                      onChange={(v) => updateSub(idx, { salary: v })}
                      options={SALARY_OPTIONS}
                    />
                  </Field>
                  <Field label="经验">
                    <Select
                      value={s.experience}
                      onChange={(v) => updateSub(idx, { experience: v })}
                      options={EXP_OPTIONS}
                    />
                  </Field>
                  <Field label="学历">
                    <Select
                      value={s.degree}
                      onChange={(v) => updateSub(idx, { degree: v })}
                      options={DEGREE_OPTIONS}
                    />
                  </Field>
                  <Field label="公司规模">
                    <Select
                      value={s.scale}
                      onChange={(v) => updateSub(idx, { scale: v })}
                      options={SCALE_OPTIONS}
                    />
                  </Field>
                  <Field label="本子任务次数（1-200）">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={s.limit}
                      onChange={(e) => updateSub(idx, { limit: Number(e.target.value) })}
                      className="input"
                    />
                  </Field>
                </div>

                <Field label="黑名单关键词（命中跳过，可与其他子任务不同）">
                  <textarea
                    value={s.exclude}
                    onChange={(e) => updateSub(idx, { exclude: e.target.value })}
                    rows={2}
                    className="input"
                    placeholder="外包, 外派, 实习"
                  />
                </Field>
              </div>
            ))}
          </div>

          <Field label="自定义招呼语（每行一条，所有子任务共享；留空使用 BOSS 默认）">
            <textarea
              value={greetings}
              onChange={(e) => setGreetings(e.target.value)}
              rows={3}
              className="input"
              placeholder="您好，我对贵司这个岗位很感兴趣，希望能进一步沟通。"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="间隔秒数（10-600）">
              <input
                type="number"
                min={10}
                max={600}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="每日总上限兜底">
              <input
                type="number"
                min={1}
                max={2000}
                value={dailyTotal}
                onChange={(e) => setDailyTotal(Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="点开详情后等几秒（0-30）">
              <input
                type="number"
                min={0}
                max={30}
                value={clickDelay}
                onChange={(e) => setClickDelay(Number(e.target.value))}
                className="input"
              />
            </Field>
          </div>

          <div className="text-xs text-slate-500 px-1">
            提示：子任务按顺序执行，跑完第一个再跑第二个；每个子任务有独立次数；总上限是所有子任务合计的兜底。
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-700 bg-slate-900/80 sticky bottom-0">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || !canSave}
            className="px-3 py-1.5 text-sm rounded bg-brand-600 hover:bg-brand-500 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Save size={14} /> {submitting ? '保存中...' : editing ? '保存修改' : '保存任务'}
          </button>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 6px 10px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 6px;
          font-size: 13px;
          color: #e2e8f0;
          outline: none;
        }
        .input:focus { border-color: #0ea5e9; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
