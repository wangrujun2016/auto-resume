import { create } from 'zustand';
import { api, TaskInfo } from '../api/client';

interface TasksState {
  tasks: TaskInfo[];
  loading: boolean;
  selectedId: string | null;
  refresh: () => Promise<void>;
  select: (id: string | null) => void;
  upsert: (t: TaskInfo) => void;
}

export const useTasks = create<TasksState>((set) => ({
  tasks: [],
  loading: false,
  selectedId: null,
  refresh: async () => {
    set({ loading: true });
    try {
      const { items } = await api.list();
      set({ tasks: items });
    } finally {
      set({ loading: false });
    }
  },
  select: (id) => set({ selectedId: id }),
  upsert: (t) =>
    set((s) => {
      const idx = s.tasks.findIndex((x) => x.id === t.id);
      if (idx === -1) return { tasks: [t, ...s.tasks] };
      const next = [...s.tasks];
      next[idx] = { ...next[idx], ...t };
      return { tasks: next };
    }),
}));
