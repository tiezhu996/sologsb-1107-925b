import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { GrainStripePreview } from '../components/common/GrainStripePreview'
import { RulerInput } from '../components/common/RulerInput'
import { useMouldFilter } from '../hooks/useMouldFilter'
import { useUnitConvert } from '../hooks/useUnitConvert'
import { useMouldRepairStore } from '../stores/mouldRepairStore'
import { useMouldStore } from '../stores/mouldStore'
import { useRunStore } from '../stores/runStore'
import { MOULD_STATES, WIRE_MATERIALS, type Mould, type MouldInput, type MouldStateValue, type WireMaterial } from '../types/mould'
import type { MouldRepairInput } from '../types/mould-repair'
import { calculateMeshDensity } from '../utils/stripe'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const emptyMouldForm: MouldInput = {
  mouldNo: '',
  frameW: 60,
  frameH: 90,
  wireMaterial: '竹丝',
  wireDiameter: 0.3,
  stripeGap: 1.1,
  meshDensity: calculateMeshDensity(0.3, 1.1),
  weaver: '周守良',
  state: '在用',
}

function makeRepairForm(mould: Mould): MouldRepairInput {
  return { mouldId: mould.id ?? -1, repairDate: todayIso(), repairer: mould.weaver, replacedLengthCm: 10, note: '' }
}

export default function MouldLedger() {
  const moulds = useMouldStore((state) => state.moulds)
  const error = useMouldStore((state) => state.error)
  const loadMoulds = useMouldStore((state) => state.loadMoulds)
  const addMould = useMouldStore((state) => state.addMould)
  const setMouldState = useMouldStore((state) => state.setMouldState)
  const runs = useRunStore((state) => state.sheetRuns)
  const loadRuns = useRunStore((state) => state.loadRuns)
  const repairs = useMouldRepairStore((state) => state.repairs)
  const repairError = useMouldRepairStore((state) => state.error)
  const loadRepairs = useMouldRepairStore((state) => state.loadRepairs)
  const addRepair = useMouldRepairStore((state) => state.addRepair)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<MouldInput>(emptyMouldForm)
  const [submitting, setSubmitting] = useState(false)
  const [repairTarget, setRepairTarget] = useState<Mould | null>(null)
  const [repairForm, setRepairForm] = useState<MouldRepairInput | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Mould | null>(null)
  const [repairSubmitting, setRepairSubmitting] = useState(false)
  const { mmPitchToThreadsPerCm } = useUnitConvert()
  const {
    mouldNo,
    state: stateFilter,
    wireMaterial,
    filteredMoulds,
    setMouldNo,
    setState,
    setWireMaterial,
    resetFilters,
  } = useMouldFilter(moulds)

  useEffect(() => {
    void loadMoulds()
    void loadRuns()
    void loadRepairs()
  }, [loadMoulds, loadRepairs, loadRuns])

  const repairGroups = useMemo(() => {
    const groups = new Map<number, { count: number; latestDate: string }>()
    for (const repair of repairs) {
      const current = groups.get(repair.mouldId)
      if (!current) {
        groups.set(repair.mouldId, { count: 1, latestDate: repair.repairDate })
      } else {
        current.count += 1
        if (repair.repairDate > current.latestDate) current.latestDate = repair.repairDate
      }
    }
    return groups
  }, [repairs])

  const historyRepairs = useMemo(
    () => (historyTarget?.id === undefined ? [] : repairs.filter((repair) => repair.mouldId === historyTarget.id)),
    [historyTarget, repairs],
  )

  const repairFormValid = repairForm !== null
    && Boolean(repairForm.repairer.trim())
    && Boolean(repairForm.repairDate)
    && repairForm.replacedLengthCm > 0
    && Boolean(repairForm.note.trim())

  const openRepairDialog = (mould: Mould) => {
    setRepairTarget(mould)
    setRepairForm(makeRepairForm(mould))
  }

  const updateRepairForm = <K extends keyof MouldRepairInput,>(key: K, value: MouldRepairInput[K]) => {
    setRepairForm((current) => (current ? { ...current, [key]: value } : current))
  }

  const handleRepairSubmit = async () => {
    if (!repairForm || !repairFormValid) return
    setRepairSubmitting(true)
    const created = await addRepair({ ...repairForm, repairer: repairForm.repairer.trim(), note: repairForm.note.trim() })
    setRepairSubmitting(false)
    if (created) {
      setRepairTarget(null)
      setRepairForm(null)
    }
  }

  const calculatedDensity = useMemo(
    () => calculateMeshDensity(form.wireDiameter, form.stripeGap),
    [form.stripeGap, form.wireDiameter],
  )

  const updateForm = <K extends keyof MouldInput,>(key: K, value: MouldInput[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value }
      next.meshDensity = calculateMeshDensity(next.wireDiameter, next.stripeGap)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!form.mouldNo.trim() || !form.weaver.trim() || form.frameW <= 0 || form.frameH <= 0 || form.wireDiameter <= 0 || form.stripeGap <= 0) return
    setSubmitting(true)
    const created = await addMould({ ...form, mouldNo: form.mouldNo.trim(), weaver: form.weaver.trim(), meshDensity: calculatedDensity })
    setSubmitting(false)
    if (created) {
      setForm(emptyMouldForm)
      setShowForm(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box>
          <Typography component="h1" variant="h3" color="#344a34">纸帘台帐</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>维护帘框尺寸、丝材与帘纹密度，每次修补都留档：修补人、日期、换丝长度与说明。</Typography>
        </Box>
        <Button variant="contained" size="large" onClick={() => setShowForm((current) => !current)} data-testid="new-mould">
          {showForm ? '收起登记' : '新建纸帘'}
        </Button>
      </Box>

      {(error || repairError) && <Alert severity="warning">{error ?? repairError}</Alert>}

      {showForm && (
        <Card data-testid="form-mould" sx={{ borderColor: '#9eb096' }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h5">登记新纸帘</Typography>
                <Typography variant="body2" color="text.secondary">丝径或间距变化时，密度会即时重算。</Typography>
              </Box>
              <Chip color="success" label={`${calculatedDensity.toFixed(1)} 根/厘米`} />
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="纸帘编号" value={form.mouldNo} onChange={(event) => updateForm('mouldNo', event.target.value)} inputProps={{ 'data-testid': 'field-mouldNo' }} />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField fullWidth type="number" label="帘框宽" value={form.frameW} onChange={(event) => updateForm('frameW', Number(event.target.value))} inputProps={{ min: 1, step: 1, 'data-testid': 'field-frameW' }} InputProps={{ endAdornment: 'cm' }} />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField fullWidth type="number" label="帘框高" value={form.frameH} onChange={(event) => updateForm('frameH', Number(event.target.value))} inputProps={{ min: 1, step: 1, 'data-testid': 'field-frameH' }} InputProps={{ endAdornment: 'cm' }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  label="帘丝材质"
                  value={form.wireMaterial}
                  onChange={(event) => updateForm('wireMaterial', event.target.value as WireMaterial)}
                  SelectProps={{ native: true, inputProps: { 'data-testid': 'field-wireMaterial' } }}
                >
                  {WIRE_MATERIALS.map((option) => <option key={option} value={option}>{option}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <RulerInput label="丝径" value={form.wireDiameter} onChange={(value) => updateForm('wireDiameter', value)} min={0.05} max={2} step={0.01} testId="field-wireDiameter" />
              </Grid>
              <Grid item xs={12} md={4}>
                <RulerInput label="帘纹间距" value={form.stripeGap} onChange={(value) => updateForm('stripeGap', value)} min={0.1} max={5} step={0.01} testId="field-stripeGap" />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="编帘匠人" value={form.weaver} onChange={(event) => updateForm('weaver', event.target.value)} inputProps={{ 'data-testid': 'field-weaver' }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  label="状态"
                  value={form.state}
                  onChange={(event) => updateForm('state', event.target.value as MouldStateValue)}
                  SelectProps={{ native: true, inputProps: { 'data-testid': 'field-state' } }}
                >
                  {MOULD_STATES.map((option) => <option key={option} value={option}>{option}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={8} sx={{ display: 'flex', alignItems: 'stretch' }}>
                <Box sx={{ width: '100%' }}>
                  <GrainStripePreview gap={form.stripeGap} wireDiameter={form.wireDiameter} density={calculatedDensity} direction={form.wireMaterial === '马尾丝' ? 'horizontal' : 'vertical'} />
                </Box>
              </Grid>
            </Grid>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2.5 }}>
              <Button onClick={() => setShowForm(false)}>取消</Button>
              <Button variant="contained" onClick={handleSubmit} disabled={submitting} data-testid="submit-mould">
                保存纸帘
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="筛选帘号" value={mouldNo} onChange={(event) => setMouldNo(event.target.value)} />
            </Grid>
            <Grid item xs={6} md={2.5}>
              <TextField select fullWidth size="small" label="状态" value={stateFilter} onChange={(event) => setState(event.target.value as MouldStateValue | '全部')} SelectProps={{ native: true }}>
                <option value="全部">全部</option>
                {MOULD_STATES.map((option) => <option key={option} value={option}>{option}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={6} md={2.5}>
              <TextField select fullWidth size="small" label="帘丝材质" value={wireMaterial} onChange={(event) => setWireMaterial(event.target.value as WireMaterial | '全部')} SelectProps={{ native: true }}>
                <option value="全部">全部</option>
                {WIRE_MATERIALS.map((option) => <option key={option} value={option}>{option}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                <Typography variant="body2" color="text.secondary">当前记录</Typography>
                <Typography variant="h5" data-testid="count-mould">{filteredMoulds.length}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="outlined" onClick={resetFilters}>重置筛选</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Card}>
        <Table sx={{ minWidth: 1080 }}>
          <TableHead>
            <TableRow>
              <TableCell>帘号 / 尺寸</TableCell>
              <TableCell>材质与丝径</TableCell>
              <TableCell>间距 / 密度</TableCell>
              <TableCell>编帘匠人</TableCell>
              <TableCell>工序引用</TableCell>
              <TableCell>修补档案</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMoulds.map((mould) => {
              const relatedRuns = runs.filter((run) => run.mouldId === mould.id)
              const latestRun = relatedRuns[0]
              const repairSummary = mould.id === undefined ? undefined : repairGroups.get(mould.id)
              return (
                <TableRow key={mould.id ?? mould.mouldNo} data-testid="row-mould" hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 750 }}>{mould.mouldNo}</Typography>
                    <Typography variant="caption" color="text.secondary">{mould.frameW} × {mould.frameH} cm · {(mould.frameW * mould.frameH / 10000).toFixed(3)} 平方米</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={mould.wireMaterial} variant="outlined" />
                    <Typography variant="body2" sx={{ mt: 0.6 }}>{mould.wireDiameter.toFixed(2)} mm</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>{mould.stripeGap.toFixed(2)} mm</Typography>
                    <Typography variant="caption" color="text.secondary">{mould.meshDensity.toFixed(1)} 根/cm · 推算 {mmPitchToThreadsPerCm(mould.wireDiameter + mould.stripeGap).toFixed(1)}</Typography>
                  </TableCell>
                  <TableCell>{mould.weaver}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{relatedRuns.length} 槽工序</Typography>
                    <Typography variant="caption" color="text.secondary">{latestRun ? `最近 ${latestRun.runDate}` : '尚无关联'}</Typography>
                  </TableCell>
                  <TableCell data-testid={`repair-summary-${mould.id ?? mould.mouldNo}`}>
                    {repairSummary ? (
                      <>
                        <Typography variant="body2" sx={{ fontWeight: 650 }}>累计 {repairSummary.count} 次</Typography>
                        <Typography variant="caption" color="text.secondary">最近 {repairSummary.latestDate}</Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">未修过</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={mould.state === '在用' ? 'success' : mould.state === '待修补' ? 'warning' : 'default'} label={mould.state} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                      {mould.state === '在用' && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={mould.id === undefined}
                          onClick={() => openRepairDialog(mould)}
                          data-testid={`open-repair-${mould.id ?? mould.mouldNo}`}
                        >
                          登记修补
                        </Button>
                      )}
                      {mould.state === '待修补' && (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={mould.id === undefined}
                          onClick={() => {
                            if (mould.id !== undefined) void setMouldState(mould.id, '在用')
                          }}
                          data-testid={`finish-repair-${mould.id ?? mould.mouldNo}`}
                        >
                          完成修补
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant={repairSummary ? 'text' : 'outlined'}
                        disabled={mould.id === undefined}
                        onClick={() => setHistoryTarget(mould)}
                        data-testid={`repair-history-${mould.id ?? mould.mouldNo}`}
                      >
                        修补记录{repairSummary ? `（${repairSummary.count}）` : ''}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              )
            })}
            {filteredMoulds.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}>没有符合筛选条件的纸帘</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={repairTarget !== null && repairForm !== null}
        onClose={() => { setRepairTarget(null); setRepairForm(null) }}
        maxWidth="sm"
        fullWidth
        data-testid="dialog-repair"
      >
        {repairTarget && repairForm && (
          <>
            <DialogTitle>
              登记修补 · {repairTarget.mouldNo}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400 }}>
                保存后纸帘标记为“待修补”，修好前不会出现在抄纸工序的纸帘下拉中；点“完成修补”后恢复可选。
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="修补日期"
                    type="date"
                    value={repairForm.repairDate}
                    onChange={(event) => updateRepairForm('repairDate', event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ 'data-testid': 'field-repairDate' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="修补人"
                    value={repairForm.repairer}
                    onChange={(event) => updateRepairForm('repairer', event.target.value)}
                    inputProps={{ 'data-testid': 'field-repairer' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="number"
                    label="换掉的丝段长度"
                    value={repairForm.replacedLengthCm}
                    onChange={(event) => updateRepairForm('replacedLengthCm', Number(event.target.value))}
                    inputProps={{ min: 1, step: 1, 'data-testid': 'field-replacedLengthCm' }}
                    InputProps={{ endAdornment: 'cm' }}
                    helperText="本次修补整段换掉的帘丝长度"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label="修补说明"
                    placeholder="例如：中段竹丝磨损跳线，换丝后复测帘纹正常"
                    value={repairForm.note}
                    onChange={(event) => updateRepairForm('note', event.target.value)}
                    inputProps={{ 'data-testid': 'field-repairNote' }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => { setRepairTarget(null); setRepairForm(null) }}>取消</Button>
              <Button
                variant="contained"
                onClick={handleRepairSubmit}
                disabled={repairSubmitting || !repairFormValid}
                data-testid="submit-repair"
              >
                保存并标记待修补
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={historyTarget !== null}
        onClose={() => setHistoryTarget(null)}
        maxWidth="sm"
        fullWidth
        data-testid="dialog-repair-history"
      >
        {historyTarget && (
          <>
            <DialogTitle>
              修补记录 · {historyTarget.mouldNo}
              <Chip size="small" sx={{ ml: 1 }} label={`累计 ${historyRepairs.length} 次`} />
            </DialogTitle>
            <DialogContent>
              {historyRepairs.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>这张帘子还没有修补记录。</Typography>
              ) : (
                <Stack spacing={1.5} divider={<Divider flexItem />} sx={{ mt: 1 }}>
                  {historyRepairs.map((repair) => (
                    <Box key={repair.id} data-testid={`repair-record-${repair.id}`}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 650 }}>{repair.repairDate} · {repair.repairer}</Typography>
                        <Chip size="small" variant="outlined" label={`换丝 ${repair.replacedLengthCm} cm`} />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{repair.note}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setHistoryTarget(null)}>关闭</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  )
}
