export interface MouldRepair {
  id?: number
  mouldId: number
  repairDate: string
  repairer: string
  replacedLengthCm: number
  note: string
  schemaRev?: number
}

export type MouldRepairInput = Omit<MouldRepair, 'id' | 'schemaRev'>
