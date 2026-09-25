import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useMouldStore } from '../../stores/mouldStore'
import { useRepairStore } from '../../stores/repairStore'
import type { MouldRepairInput } from '../../types/mould-repair'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface RepairRecordsDialogProps {
  open: boolean
  mouldId: number | null
  onClose: () => void
}

export function RepairRecordsDialog({ open, mouldId, onClose }: RepairRecordsDialogProps) {
  const moulds = useMouldStore((state) => state.moulds)
  const mouldError = useMouldStore((state) => state.error)
  const setMouldState = useMouldStore((state) => state.setMouldState)
  const repairs = useRepairStore((state) => state.repairs)
  const repairError = useRepairStore((state) => state.error)
  const addRepair = useRepairStore((state) => state.addRepair)

  const mould = useMemo(() => moulds.find((item) => item.id === mouldId) ?? null, [mouldId, moulds])
  const mouldRepairs = useMemo(
    () => repairs.filter((repair) => repair.mouldId === mouldId).sort((a, b) => b.repairDate.localeCompare(a.repairDate)),
    [mouldId, repairs],
  )
  const totalReplaced = mouldRepairs.reduce((sum, repair) => sum + repair.replacedLength, 0)

  const [repairer, setRepairer] = useState('')
  const [repairDate, setRepairDate] = useState(todayIso())
  const [replacedLength, setReplacedLength] = useState(10)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && mould) {
      setRepairer(mould.weaver)
      setRepairDate(todayIso())
      setReplacedLength(10)
      setNote('')
    }
  }, [mould, open])

  if (!mould) return null

  const formValid = repairer.trim().length > 0 && repairDate.length > 0 && replacedLength > 0 && note.trim().length > 0
  const retired = mould.state === '退役'
  const pending = mould.state === '待修补'

  const handleSubmit = async () => {
    if (!formValid || mould.id === undefined || submitting) return
    const input: MouldRepairInput = {
      mouldId: mould.id,
      repairer: repairer.trim(),
      repairDate,
      replacedLength,
      note: note.trim(),
    }
    setSubmitting(true)
    const created = await addRepair(input)
    if (created) {
      await setMouldState(mould.id, '待修补')
      setNote('')
      setReplacedLength(10)
      setRepairDate(todayIso())
    }
    setSubmitting(false)
  }

  const handleComplete = async () => {
    if (mould.id !== undefined) await setMouldState(mould.id, '在用')
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth data-testid="repair-dialog">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {mould.mouldNo} 修补记录
        <Chip size="small" color={pending ? 'warning' : mould.state === '在用' ? 'success' : 'default'} label={mould.state} />
      </DialogTitle>
      <DialogContent>
        {(repairError ?? mouldError) && <Alert severity="warning" sx={{ mb: 2 }}>{repairError ?? mouldError}</Alert>}

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Chip variant="outlined" label={`累计修补 ${mouldRepairs.length} 次`} data-testid="repair-total-count" />
          <Chip variant="outlined" label={`累计换丝 ${totalReplaced} cm`} />
          <Chip variant="outlined" label={mouldRepairs[0] ? `最近修补 ${mouldRepairs[0].repairDate}` : '尚无修补'} data-testid="repair-latest-date" />
        </Box>

        <TableContainer sx={{ mb: retired ? 0 : 2.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>修补日期</TableCell>
                <TableCell>修补人</TableCell>
                <TableCell align="right">换丝长度</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mouldRepairs.map((repair, index) => (
                <TableRow key={repair.id ?? `${repair.repairDate}-${index}`} data-testid="repair-row" hover>
                  <TableCell>
                    <Typography variant="body2">{repair.repairDate}</Typography>
                    {pending && index === 0 && <Chip size="small" color="warning" label="本次待完成" sx={{ mt: 0.5 }} />}
                  </TableCell>
                  <TableCell>{repair.repairer}</TableCell>
                  <TableCell align="right">{repair.replacedLength} cm</TableCell>
                  <TableCell>{repair.note}</TableCell>
                </TableRow>
              ))}
              {mouldRepairs.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>这张帘子还没有修补记录</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {!retired && (
          <>
            <Divider sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">登记新修补（保存后帘子自动转为待修补，修复完成前不可用于抄纸）</Typography>
            </Divider>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField fullWidth size="small" label="修补人" value={repairer} onChange={(event) => setRepairer(event.target.value)} inputProps={{ 'data-testid': 'field-repairer' }} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField fullWidth size="small" type="date" label="修补日期" value={repairDate} onChange={(event) => setRepairDate(event.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ 'data-testid': 'field-repairDate' }} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField fullWidth size="small" type="number" label="换掉的丝段长度" value={replacedLength} onChange={(event) => setReplacedLength(Number(event.target.value))} inputProps={{ min: 1, step: 1, 'data-testid': 'field-replacedLength' }} InputProps={{ endAdornment: 'cm' }} />
              </Grid>
              <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
                <Button fullWidth variant="contained" color="primary" onClick={handleSubmit} disabled={!formValid || submitting} data-testid="submit-repair">
                  保存修补登记
                </Button>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="修补说明" placeholder="换了哪一段丝、什么毛病，一句话交代清楚" value={note} onChange={(event) => setNote(event.target.value)} inputProps={{ 'data-testid': 'field-repairNote' }} />
              </Grid>
            </Grid>
          </>
        )}
        {retired && (
          <Alert severity="info">帘子已退役，旧修补记录仍然保留，仅供翻阅。</Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {pending && (
          <Button variant="contained" color="success" onClick={handleComplete} data-testid="complete-repair">
            完成修补，恢复在用
          </Button>
        )}
        <Stack direction="row" spacing={1.5} sx={{ ml: 'auto' }}>
          <Button onClick={onClose}>关闭</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
