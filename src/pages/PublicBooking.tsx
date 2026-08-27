import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/services/api'
import { AvailableSlot, PublicBookingResult, BusinessHours } from '@/lib/types'
import { format, addDays, isBefore, startOfDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Heart,
  Phone,
  Mail,
  CheckCircle2,
  CalendarCheck2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  CalendarDays,
  Sparkles,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PublicBooking() {
  const [step, setStep] = useState<'datetime' | 'form' | 'success'>('datetime')

  // Estado da configuração de horários e datas disponíveis
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([])
  const [loadingConfig, setLoadingConfig] = useState(true)

  // Data selecionada (começando por amanhã ou hoje)
  const [selectedDate, setSelectedDate] = useState<Date>(() => addDays(new Date(), 1))
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [dayMessage, setDayMessage] = useState<string | null>(null)

  // Formulário do Tutor e Animal
  const [formData, setFormData] = useState({
    tutorName: '',
    tutorPhone: '',
    tutorEmail: '',
    petName: '',
    petSpecies: 'Cão',
    petBreed: '',
    notes: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [bookingResult, setBookingResult] = useState<PublicBookingResult | null>(null)

  // 1. Carregar configurações de atendimento
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoadingConfig(true)
        const bhList = await api.getBusinessHours()
        setBusinessHours(bhList)
      } catch (err) {
        console.error('Erro ao buscar configuração de horários:', err)
      } finally {
        setLoadingConfig(false)
      }
    }
    fetchConfig()
  }, [])

  // 2. Carregar horários disponíveis para a data selecionada (com fallback direto caso o endpoint customizado falhe)
  const calculateSlotsLocally = async (
    date: Date,
    dateStr: string,
    currentBhList: BusinessHours[],
  ) => {
    const dow = date.getDay()
    const bhRecord = currentBhList.find((b) => b.day_of_week === dow)

    if (!bhRecord || !bhRecord.is_open) {
      setAvailableSlots([])
      setDayMessage('Clínica fechada para atendimentos nesta data.')
      return
    }

    const slotDuration = bhRecord.slot_duration_minutes || 30
    let intervals: { start: string; end: string }[] = []
    if (Array.isArray(bhRecord.intervals)) {
      intervals = bhRecord.intervals
    } else if (typeof bhRecord.intervals === 'string') {
      try {
        intervals = JSON.parse(bhRecord.intervals)
      } catch {
        intervals = []
      }
    }

    if (intervals.length === 0) {
      setAvailableSlots([])
      setDayMessage('Nenhum horário de atendimento configurado para este dia.')
      return
    }

    // Buscar agendamentos existentes no dia via PocketBase SDK
    const startDay = `${dateStr} 00:00:00.000Z`
    const endDay = `${dateStr} 23:59:59.999Z`

    let occupiedTimes = new Set<string>()
    try {
      const existingApps = await api.getAppointments({
        startDate: new Date(dateStr + 'T00:00:00'),
        endDate: new Date(dateStr + 'T23:59:59'),
      })
      for (const app of existingApps) {
        if (app.status !== 'cancelled' && app.date) {
          const appDate = new Date(app.date)
          const h = String(appDate.getUTCHours()).padStart(2, '0')
          const m = String(appDate.getUTCMinutes()).padStart(2, '0')
          occupiedTimes.add(`${h}:${m}`)
        }
      }
    } catch (e) {
      console.warn('Erro ao consultar agendamentos locais:', e)
    }

    const localSlots: AvailableSlot[] = []
    for (const interval of intervals) {
      if (!interval.start || !interval.end) continue
      const [startH, startM] = interval.start.split(':').map((p) => parseInt(p, 10))
      const [endH, endM] = interval.end.split(':').map((p) => parseInt(p, 10))
      if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) continue

      let currentMin = startH * 60 + startM
      const endMin = endH * 60 + endM

      while (currentMin + slotDuration <= endMin) {
        const h = Math.floor(currentMin / 60)
        const m = currentMin % 60
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        const isOccupied = occupiedTimes.has(timeStr)

        localSlots.push({
          time: timeStr,
          available: !isOccupied,
        })
        currentMin += slotDuration
      }
    }

    setAvailableSlots(localSlots)
    if (localSlots.length === 0) {
      setDayMessage('Nenhum horário de atendimento configurado para este dia.')
    } else if (localSlots.every((s) => !s.available)) {
      setDayMessage('Todos os horários para este dia já foram preenchidos.')
    }
  }

  const fetchSlotsForDate = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    setLoadingSlots(true)
    setErrorMsg(null)
    setDayMessage(null)
    setSelectedTime(null)

    try {
      const res = await api.getAvailableSlots(dateStr)
      if (res && res.slots) {
        setAvailableSlots(res.slots)
        if (!res.is_open) {
          setDayMessage(res.message || 'Clínica fechada para atendimentos nesta data.')
        } else if (res.slots.length === 0) {
          setDayMessage('Nenhum horário de atendimento configurado para este dia.')
        } else if (res.slots.every((s) => !s.available)) {
          setDayMessage('Todos os horários para este dia já foram preenchidos.')
        }
      } else {
        await calculateSlotsLocally(date, dateStr, businessHours)
      }
    } catch (err: any) {
      console.warn('Erro ao chamar hook de slots, executando cálculo direto:', err)
      try {
        let currentBh = businessHours
        if (currentBh.length === 0) {
          currentBh = await api.getBusinessHours()
          setBusinessHours(currentBh)
        }
        await calculateSlotsLocally(date, dateStr, currentBh)
      } catch (fallbackErr) {
        console.error('Falha no fallback de cálculo de slots:', fallbackErr)
        setAvailableSlots([])
        setDayMessage('Não foi possível carregar os horários. Tente novamente.')
      }
    } finally {
      setLoadingSlots(false)
    }
  }

  useEffect(() => {
    if (selectedDate) {
      fetchSlotsForDate(selectedDate)
    }
  }, [selectedDate])

  // Gerar os próximos 14 dias a partir de hoje
  const nextDays = Array.from({ length: 14 }).map((_, i) => addDays(new Date(), i + 1))

  // Verificar se o dia da semana está aberto nas configurações
  const isDayOpenInConfig = (d: Date) => {
    const dow = d.getDay()
    const config = businessHours.find((b) => b.day_of_week === dow)
    return config ? config.is_open : dow !== 0 // Domingo fechado por padrão
  }

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date)
  }

  const handleSelectTime = (time: string) => {
    setSelectedTime(time)
    setErrorMsg(null)
  }

  const handleProceedToForm = () => {
    if (!selectedTime) {
      setErrorMsg('Por favor, selecione um horário disponível.')
      return
    }
    setErrorMsg(null)
    setStep('form')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.tutorName.trim()) {
      setErrorMsg('Por favor, informe seu nome completo.')
      return
    }
    if (!formData.tutorPhone.trim()) {
      setErrorMsg('Por favor, informe seu telefone / WhatsApp de contato.')
      return
    }
    if (!formData.petName.trim()) {
      setErrorMsg('Por favor, informe o nome do seu pet.')
      return
    }
    if (!selectedTime) {
      setErrorMsg('Horário não selecionado.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      const payload = {
        tutor_name: formData.tutorName.trim(),
        tutor_phone: formData.tutorPhone.trim(),
        tutor_email: formData.tutorEmail.trim() || undefined,
        pet_name: formData.petName.trim(),
        pet_species: formData.petSpecies || 'Cão',
        pet_breed: formData.petBreed.trim() || undefined,
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedTime,
        notes: formData.notes.trim() || undefined,
      }

      const result = await api.createPublicBooking(payload)

      if (result && result.success) {
        setBookingResult(result)
        setStep('success')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setErrorMsg(result?.error || 'Erro ao processar o agendamento. Tente novamente.')
      }
    } catch (err: any) {
      console.error('Erro na submissão:', err)
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Não foi possível concluir o agendamento. Verifique se o horário ainda está disponível.'
      setErrorMsg(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNewBooking = () => {
    setBookingResult(null)
    setFormData({
      tutorName: '',
      tutorPhone: '',
      tutorEmail: '',
      petName: '',
      petSpecies: 'Cão',
      petBreed: '',
      notes: '',
    })
    setSelectedTime(null)
    setStep('datetime')
    fetchSlotsForDate(selectedDate)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-primary/20">
      {/* Header Público da Clínica */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-xs">
              <span className="text-white font-extrabold text-xl">V</span>
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">
                Clínica Veterinária Central
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3 text-primary" /> Atendimento Presencial & Agendamento
                Online
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="hidden sm:inline-flex bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs py-1"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Agenda Aberta
          </Badge>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {/* Banner de Boas-vindas */}
        <div className="mb-6 text-center sm:text-left bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/15 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-primary text-xs font-semibold shadow-xs mb-3 border border-primary/20">
              <Sparkles className="w-3.5 h-3.5" /> Agendamento Fácil & Rápido
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Solicite a consulta do seu pet
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-1.5">
              Escolha a melhor data e horário para o atendimento. Nossa equipe confirmará seu
              horário imediatamente.
            </p>
          </div>
        </div>

        {/* Indicador de Passos */}
        {step !== 'success' && (
          <div className="flex items-center justify-center gap-2 mb-6">
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                step === 'datetime'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 cursor-pointer',
              )}
              onClick={() => step === 'form' && setStep('datetime')}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>1. Data & Horário</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                step === 'form' ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-400',
              )}
            >
              <User className="w-3.5 h-3.5" />
              <span>2. Seus Dados & Pet</span>
            </div>
          </div>
        )}

        {/* Mensagem de Erro Geral */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* ETAPA 1: SELEÇÃO DE DATA E HORÁRIO */}
        {step === 'datetime' && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  Selecione o Dia da Consulta
                </CardTitle>
                <CardDescription>
                  Selecione um dos próximos dias disponíveis para atendimento.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Carrossel / Grid de Dias */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                  {nextDays.map((d) => {
                    const isSelected =
                      format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                    const isOpen = isDayOpenInConfig(d)

                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        onClick={() => isOpen && handleSelectDate(d)}
                        disabled={!isOpen}
                        className={cn(
                          'p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center',
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-sm scale-[1.02]'
                            : isOpen
                              ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 hover:border-primary/40 cursor-pointer'
                              : 'bg-slate-50/80 border-slate-100 text-slate-300 opacity-60 cursor-not-allowed',
                        )}
                      >
                        <span
                          className={cn(
                            'text-[11px] font-medium uppercase',
                            isSelected ? 'text-white/90' : 'text-muted-foreground',
                          )}
                        >
                          {format(d, 'EEE', { locale: ptBR })}
                        </span>
                        <span
                          className={cn(
                            'text-xl font-extrabold',
                            isSelected ? 'text-white' : 'text-slate-900',
                          )}
                        >
                          {format(d, 'dd')}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] capitalize',
                            isSelected ? 'text-white/90' : 'text-slate-500',
                          )}
                        >
                          {format(d, 'MMM', { locale: ptBR })}
                        </span>
                        {!isOpen && (
                          <span className="text-[9px] text-slate-400 mt-0.5">Fechado</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Seleção de Horário */}
            <Card className="border-none shadow-sm">
              <CardHeader className="bg-white border-b pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                      <Clock className="w-5 h-5 text-primary" />
                      Horários Disponíveis em{' '}
                      <span className="text-primary capitalize">
                        {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Toque em um horário verde para prosseguir com o agendamento.
                    </CardDescription>
                  </div>
                  {selectedTime && (
                    <Badge className="bg-primary text-white text-xs px-3 py-1">
                      Selecionado: {selectedTime}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {loadingSlots ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm">Consultando horários livres na agenda...</span>
                  </div>
                ) : dayMessage ? (
                  <div className="py-10 text-center space-y-2">
                    <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
                    <p className="text-slate-700 font-medium">{dayMessage}</p>
                    <p className="text-xs text-muted-foreground">
                      Por favor, selecione outra data no calendário acima.
                    </p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    Nenhum horário disponível para esta data.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedTime === slot.time
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => slot.available && handleSelectTime(slot.time)}
                          className={cn(
                            'py-3 px-2 rounded-xl text-center font-medium transition-all text-sm flex flex-col items-center justify-center gap-0.5 border',
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-sm ring-2 ring-primary/30 ring-offset-1'
                              : slot.available
                                ? 'bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 border-slate-200 cursor-pointer'
                                : 'bg-slate-100 border-slate-100 text-slate-400 opacity-50 cursor-not-allowed line-through',
                          )}
                        >
                          <span className="font-semibold">{slot.time}</span>
                          <span
                            className={cn(
                              'text-[10px]',
                              isSelected
                                ? 'text-white/90'
                                : slot.available
                                  ? 'text-emerald-600'
                                  : 'text-slate-400',
                            )}
                          >
                            {isSelected ? 'Escolhido' : slot.available ? 'Livre' : 'Ocupado'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>

              <CardFooter className="bg-slate-50/70 border-t p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-white border border-slate-300" />
                    <span>Disponível</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-primary" />
                    <span>Selecionado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-200" />
                    <span>Ocupado</span>
                  </div>
                </div>

                <Button
                  onClick={handleProceedToForm}
                  disabled={!selectedTime || loadingSlots}
                  className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-white px-6"
                >
                  Continuar com {selectedTime || 'Horário'}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* ETAPA 2: FORMULÁRIO DO TUTOR E ANIMAL */}
        {step === 'form' && (
          <form onSubmit={handleSubmitBooking} className="space-y-6">
            {/* Resumo da Escolha */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <CalendarCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase font-semibold">
                    Horário Escolhido
                  </span>
                  <p className="font-bold text-slate-900 capitalize">
                    {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} às{' '}
                    <span className="text-primary">{selectedTime}</span>
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep('datetime')}
                className="gap-1.5 text-xs text-slate-700 bg-slate-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Alterar Data/Hora
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Dados do Tutor */}
              <Card className="border-none shadow-sm">
                <CardHeader className="bg-white border-b pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                    <User className="w-5 h-5 text-primary" />
                    Dados do Tutor (Responsável)
                  </CardTitle>
                  <CardDescription>
                    Informações para contato e confirmação do atendimento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="tutorName" className="text-slate-700">
                      Nome Completo <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="tutorName"
                      required
                      placeholder="Ex: Maria Silva"
                      value={formData.tutorName}
                      onChange={(e) => setFormData({ ...formData, tutorName: e.target.value })}
                      className="bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="tutorPhone"
                      className="text-slate-700 flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      Telefone / WhatsApp <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="tutorPhone"
                      required
                      type="tel"
                      placeholder="Ex: (11) 98888-7777"
                      value={formData.tutorPhone}
                      onChange={(e) => setFormData({ ...formData, tutorPhone: e.target.value })}
                      className="bg-slate-50/50"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Usaremos este número para enviar a confirmação da consulta.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="tutorEmail"
                      className="text-slate-700 flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      E-mail (opcional)
                    </Label>
                    <Input
                      id="tutorEmail"
                      type="email"
                      placeholder="Ex: maria@exemplo.com"
                      value={formData.tutorEmail}
                      onChange={(e) => setFormData({ ...formData, tutorEmail: e.target.value })}
                      className="bg-slate-50/50"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Dados do Paciente (Pet) */}
              <Card className="border-none shadow-sm">
                <CardHeader className="bg-white border-b pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                    <Heart className="w-5 h-5 text-primary" />
                    Dados do Pet (Animal)
                  </CardTitle>
                  <CardDescription>Informações sobre quem receberá o atendimento.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="petName" className="text-slate-700">
                      Nome do Animal <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="petName"
                      required
                      placeholder="Ex: Thor, Luna, Bob..."
                      value={formData.petName}
                      onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                      className="bg-slate-50/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="petSpecies" className="text-slate-700">
                        Espécie <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.petSpecies}
                        onValueChange={(val) => setFormData({ ...formData, petSpecies: val })}
                      >
                        <SelectTrigger id="petSpecies" className="bg-slate-50/50">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cão">Cão (Canino)</SelectItem>
                          <SelectItem value="Gato">Gato (Felino)</SelectItem>
                          <SelectItem value="Ave">Ave</SelectItem>
                          <SelectItem value="Roedor">Roedor</SelectItem>
                          <SelectItem value="Réptil">Réptil</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="petBreed" className="text-slate-700">
                        Raça (opcional)
                      </Label>
                      <Input
                        id="petBreed"
                        placeholder="Ex: SRD, Poodle..."
                        value={formData.petBreed}
                        onChange={(e) => setFormData({ ...formData, petBreed: e.target.value })}
                        className="bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-slate-700">
                      Motivo da Consulta / Sintomas
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder="Descreva brevemente o que o animal está sentindo, se é vacina, rotina ou revisão..."
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="bg-slate-50/50 resize-none text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Ações do Formulário */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('datetime')}
                disabled={submitting}
                className="w-full sm:w-auto gap-2 bg-white"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold shadow-md"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Confirmando seu Agendamento...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Confirmar Solicitação de Agendamento
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* ETAPA 3: TELA DE CONFIRMAÇÃO / SUCESSO */}
        {step === 'success' && bookingResult && (
          <Card className="border-none shadow-md overflow-hidden max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
            <div className="bg-emerald-600 text-white p-8 text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mx-auto mb-4 border border-white/30">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Agendamento Confirmado!
              </h3>
              <p className="text-emerald-100 text-sm sm:text-base mt-2 max-w-md mx-auto">
                Sua consulta foi registrada com sucesso no sistema da clínica. Aguardamos você e seu
                pet!
              </p>
            </div>

            <CardContent className="p-6 sm:p-8 space-y-6 bg-white">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 space-y-3">
                <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider">
                  Detalhes do Atendimento
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Data e Horário</span>
                    <strong className="text-slate-900 font-semibold capitalize">
                      {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} às{' '}
                      {bookingResult.time}
                    </strong>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block">Animal (Paciente)</span>
                    <strong className="text-slate-900 font-semibold">
                      {bookingResult.pet_name} ({bookingResult.species})
                    </strong>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block">Tutor Responsável</span>
                    <strong className="text-slate-900 font-semibold">
                      {bookingResult.tutor_name}
                    </strong>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block">Telefone de Contato</span>
                    <strong className="text-slate-900 font-semibold">
                      {bookingResult.tutor_phone}
                    </strong>
                  </div>
                </div>

                {bookingResult.notes && (
                  <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                    <span className="font-semibold block text-slate-700">Observações:</span>
                    {bookingResult.notes}
                  </div>
                )}
              </div>

              {/* Informações adicionais da clínica */}
              <div className="space-y-3 text-xs text-slate-600 bg-amber-50/60 p-4 rounded-xl border border-amber-200/60">
                <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  Recomendações importantes:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>Chegue com 10 minutos de antecedência ao horário marcado.</li>
                  <li>Traga a carteira de vacinação do seu pet, se possuir.</li>
                  <li>Cães devem estar na guia/coleira e gatos em caixa de transporte.</li>
                  <li>Caso precise desmarcar, entre em contato com antecedência.</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button onClick={handleNewBooking} variant="outline" className="flex-1 bg-white">
                  Fazer Novo Agendamento
                </Button>
                <Button
                  onClick={() => window.print()}
                  variant="default"
                  className="flex-1 bg-primary hover:bg-primary/90 text-white"
                >
                  Imprimir Comprovante
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer Público */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} Clínica Veterinária Central. Todos os direitos reservados.
          </span>
          <span className="text-slate-400">Sistema VetSaaS • Atendimento Online</span>
        </div>
      </footer>
    </div>
  )
}
