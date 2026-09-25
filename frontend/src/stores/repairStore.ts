import { create } from 'zustand'
import type { MouldRepair, MouldRepairInput } from '../types/mould-repair'
import { db, plain } from '../utils/db'

interface RepairStore {
  repairs: MouldRepair[]
  isLoading: boolean
  loaded: boolean
  error: string | null
  loadRepairs: () => Promise<void>
  addRepair: (input: MouldRepairInput) => Promise<MouldRepair | null>
}

export const useRepairStore = create<RepairStore>((set, get) => ({
  repairs: [],
  isLoading: false,
  loaded: false,
  error: null,
  loadRepairs: async () => {
    if (get().loaded) return
    set({ isLoading: true, error: null })
    try {
      const repairs = await db.mouldRepairs.orderBy('repairDate').reverse().toArray()
      set({ repairs, isLoading: false, loaded: true })
    } catch {
      set({ isLoading: false, error: '修补记录读取失败，请检查浏览器存储权限' })
    }
  },
  addRepair: async (input) => {
    set({ error: null })
    try {
      const payload = plain(input)
      const id = Number(await db.mouldRepairs.add(payload))
      const created: MouldRepair = { ...payload, id, schemaRev: 3 }
      set((state) => ({ repairs: [created, ...state.repairs] }))
      return created
    } catch {
      set({ error: '修补登记失败，请稍后重试' })
      return null
    }
  },
}))
