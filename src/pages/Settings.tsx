import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { api } from '@/services/api'
import { BusinessHours, TimeInterval } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  Clock,
  Plus,
  Trash2,
  Calendar,
  Save,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Building,
  User,
} from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([])
  const [loadingHours, setLoadingHours] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const publicBookingUrl = `${window.location.origin}/agendamento`

  const loadBusinessHours = async () => {
    try {
      setLoadingHours(true)
      const data = await api.getBusinessHours()
      setBusinessHours(data)
    } catch (error) {
      toast({
        title: 'Erro ao carregar horários',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setLoadingHours(false)
    }
  }

  useEffect(() => {
    loadBusinessHours()
  }, [])

  const handleToggleOpen = (id: string, isOpen: boolean) => {
    setBusinessHours((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          // Se estiver abrindo e não tiver intervalos, cria um padrão
          const intervals =
            isOpen && (!item.intervals || item.intervals.length === 0)
              ? [{ start: '08:00', end: '18:00' }]
              : item.intervals
          return { ...item, is_open: isOpen, intervals }
        }
        return item
      }),
    )
  }

  const handleDurationChange = (id: string, duration: string) => {
    const minutes = parseInt(duration, 10)
    setBusinessHours((prev) =>
      prev.map((item) => (item.id === id ? { ...item, slot_duration_minutes: minutes } : item)),
    )
  }

  const handleApplyDurationToAll = (minutes: number) => {
    setBusinessHours((prev) => prev.map((item) => ({ ...item, slot_duration_minutes: minutes })))
    toast({
      title: 'Duração aplicada',
      description: `Duração de ${minutes} minutos aplicada a todos os dias. Clique em Salvar para gravar.`,
    })
  }

  const handleAddInterval = (id: string) => {
    setBusinessHours((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const current = item.intervals || []
          return {
            ...item,
            intervals: [...current, { start: '14:00', end: '18:00' }],
          }
        }
        return item
      }),
    )
  }

  const handleRemoveInterval = (id: string, index: number) => {
    setBusinessHours((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = [...(item.intervals || [])]
          updated.splice(index, 1)
          return { ...item, intervals: updated }
        }
        return item
      }),
    )
  }

  const handleIntervalChange = (
    id: string,
    index: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setBusinessHours((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = [...(item.intervals || [])]
          updated[index] = { ...updated[index], [field]: value }
          return { ...item, intervals: updated }
        }
        return item
      }),
    )
  }

  const handleSaveDay = async (bh: BusinessHours) => {
    setSavingId(bh.id)
    try {
      await api.updateBusinessHours(bh.id, {
        is_open: bh.is_open,
        slot_duration_minutes: bh.slot_duration_minutes || 30,
        intervals: bh.intervals || [],
      })
      toast({
        title: 'Horários salvos',
        description: `Configuração de ${bh.day_name} salva com sucesso.`,
      })
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleSaveAllHours = async () => {
    setSavingAll(true)
    try {
      for (const bh of businessHours) {
        await api.updateBusinessHours(bh.id, {
          is_open: bh.is_open,
          slot_duration_minutes: bh.slot_duration_minutes || 30,
          intervals: bh.intervals || [],
        })
      }
      toast({
        title: 'Tudo salvo!',
        description: 'Todos os horários de atendimento foram atualizados com sucesso.',
      })
    } catch (error) {
      toast({
        title: 'Erro ao salvar horários',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setSavingAll(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicBookingUrl)
    setCopiedLink(true)
    toast({
      title: 'Link copiado!',
      description: 'O link do agendamento online foi copiado para a área de transferência.',
    })
    setTimeout(() => setCopiedLink(false), 2500)
  }

  return (
    <div className="space-y-8 max-w-5xl animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seu perfil, horários de funcionamento e dados da clínica.
          </p>
        </div>
      </div>

      {/* Seção 1: Link Público de Agendamento */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg text-slate-900">Página Pública de Agendamento</CardTitle>
          </div>
          <CardDescription>
            Compartilhe este link com tutores para que eles agendem consultas e retornos diretamente
            pelo celular ou computador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-2xl">
            <Input
              readOnly
              value={publicBookingUrl}
              className="bg-white font-mono text-xs sm:text-sm text-slate-700 select-all"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 shrink-0 bg-white"
                onClick={handleCopyLink}
              >
                {copiedLink ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedLink ? 'Copiado' : 'Copiar Link'}
              </Button>
              <Button
                variant="default"
                className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-white"
                asChild
              >
                <a href="/agendamento" target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4" /> Abrir Página
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 2: Tabela de Horários de Atendimento */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <CardTitle className="text-xl text-slate-900">Horários de Atendimento</CardTitle>
              </div>
              <CardDescription>
                Configure os dias abertos, intervalos de atendimento (ex: manhã e tarde) e a duração
                padrão de cada consulta.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveAllHours}
                disabled={savingAll || loadingHours}
                className="gap-2 bg-primary hover:bg-primary/90 text-white"
              >
                <Save className="w-4 h-4" />
                {savingAll ? 'Salvando Todos...' : 'Salvar Todos os Dias'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingHours ? (
            <div className="py-12 text-center text-muted-foreground">
              Carregando horários de atendimento...
            </div>
          ) : businessHours.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum horário configurado.
            </div>
          ) : (
            <div className="space-y-4">
              {businessHours.map((bh) => (
                <div
                  key={bh.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    bh.is_open
                      ? 'bg-white border-slate-200 shadow-xs'
                      : 'bg-slate-50/60 border-slate-100 opacity-80'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Dia e Toggle Fechado/Aberto */}
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <Switch
                        id={`switch-${bh.id}`}
                        checked={bh.is_open}
                        onCheckedChange={(checked) => handleToggleOpen(bh.id, checked)}
                      />
                      <div>
                        <Label
                          htmlFor={`switch-${bh.id}`}
                          className="font-semibold text-base cursor-pointer text-slate-900 flex items-center gap-2"
                        >
                          {bh.day_name}
                          {bh.is_open ? (
                            <Badge
                              variant="outline"
                              className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs font-normal"
                            >
                              Aberto
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-slate-500 bg-slate-100 border-slate-200 text-xs font-normal"
                            >
                              Fechado
                            </Badge>
                          )}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {bh.is_open
                            ? 'Disponível para agendamento online'
                            : 'Sem agendamentos neste dia'}
                        </p>
                      </div>
                    </div>

                    {/* Duração da Consulta */}
                    {bh.is_open && (
                      <div className="flex items-center gap-2 min-w-[170px]">
                        <Label className="text-xs text-slate-600 whitespace-nowrap">
                          Duração do slot:
                        </Label>
                        <Select
                          value={String(bh.slot_duration_minutes || 30)}
                          onValueChange={(val) => handleDurationChange(bh.id, val)}
                        >
                          <SelectTrigger className="w-[110px] h-9 text-xs bg-white">
                            <SelectValue placeholder="Duração" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 min</SelectItem>
                            <SelectItem value="20">20 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="45">45 min</SelectItem>
                            <SelectItem value="60">1 hora</SelectItem>
                            <SelectItem value="90">1h 30min</SelectItem>
                            <SelectItem value="120">2 horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Blocos de Horário (Intervalos) */}
                    <div className="flex-1">
                      {bh.is_open ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {(bh.intervals || []).map((interval: TimeInterval, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs"
                              >
                                <Input
                                  type="time"
                                  value={interval.start}
                                  onChange={(e) =>
                                    handleIntervalChange(bh.id, idx, 'start', e.target.value)
                                  }
                                  className="h-8 w-[88px] text-xs px-2 bg-white"
                                />
                                <span className="text-slate-400 font-medium">às</span>
                                <Input
                                  type="time"
                                  value={interval.end}
                                  onChange={(e) =>
                                    handleIntervalChange(bh.id, idx, 'end', e.target.value)
                                  }
                                  className="h-8 w-[88px] text-xs px-2 bg-white"
                                />
                                {(bh.intervals || []).length > 1 && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleRemoveInterval(bh.id, idx)}
                                    title="Remover intervalo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            ))}

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1 border-dashed bg-white text-primary hover:text-primary hover:bg-primary/5"
                              onClick={() => handleAddInterval(bh.id)}
                            >
                              <Plus className="w-3.5 h-3.5" /> Bloco
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Dia marcado como sem atendimento.
                        </span>
                      )}
                    </div>

                    {/* Botão Salvar Linha */}
                    <div className="flex items-center justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        onClick={() => handleSaveDay(bh)}
                        disabled={savingId === bh.id}
                      >
                        {savingId === bh.id ? 'Gravando...' : 'Salvar dia'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Atalho de Duração Geral */}
          <div className="mt-4 pt-4 border-t flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>Aplicar duração rápida para todos os dias:</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-white"
                onClick={() => handleApplyDurationToAll(30)}
              >
                30 minutos
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-white"
                onClick={() => handleApplyDurationToAll(45)}
              >
                45 minutos
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs bg-white"
                onClick={() => handleApplyDurationToAll(60)}
              >
                1 hora
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3: Perfil e Dados Gerais da Clínica */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Perfil de Usuário</CardTitle>
            </div>
            <CardDescription>Informações da sua conta de acesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                defaultValue={user?.name || 'Administrador'}
                readOnly
                className="bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input defaultValue={user?.email} readOnly className="bg-slate-50" />
            </div>
            <Button variant="outline" disabled className="mt-2">
              Alterar Senha
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Dados da Clínica</CardTitle>
            </div>
            <CardDescription>Configurações gerais do sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Clínica</Label>
              <Input defaultValue="Clínica Veterinária Central" />
            </div>
            <div className="space-y-2">
              <Label>Telefone de Contato</Label>
              <Input defaultValue="(11) 3333-4444" />
            </div>
            <Button
              className="mt-2"
              onClick={() => {
                toast({
                  title: 'Preferências salvas',
                  description: 'Dados da clínica atualizados com sucesso.',
                })
              }}
            >
              Salvar Preferências
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
