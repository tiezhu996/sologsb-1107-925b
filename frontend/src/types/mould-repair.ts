export interface MouldRepair {
  id?: number
  mouldId: number
  repairer: string
  repairDate: string
  replacedLength: number
  note: string
  schemaRev?: number
}

export type MouldRepairInput = Omit<MouldRepair, 'id' | 'schemaRev'>
