routerAdd('GET', '/api/public-booking/available-slots', (e) => {
  const dateStr = e.requestInfo().query.date // expected YYYY-MM-DD
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return e.json(400, { error: 'Parâmetro date é obrigatório no formato YYYY-MM-DD' })
  }

  // Obter o dia da semana considerando timezone local
  const parts = dateStr.split('-').map((p) => parseInt(p, 10))
  const targetDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0))
  const dayOfWeek = targetDate.getUTCDay() // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

  let bhRecord = null
  try {
    const bhRecords = $app.findRecordsByFilter('business_hours', 'day_of_week = {:dow}', '', 1, 0, {
      dow: dayOfWeek,
    })
    if (bhRecords && bhRecords.length > 0) {
      bhRecord = bhRecords[0]
    }
  } catch (err) {
    console.log('Error fetching business hours:', err.message)
  }

  if (!bhRecord) {
    return e.json(200, {
      date: dateStr,
      day_of_week: dayOfWeek,
      is_open: false,
      slot_duration_minutes: 30,
      slots: [],
      message: 'Não há atendimento cadastrado para este dia da semana.',
    })
  }

  const isOpen = bhRecord.getBool('is_open')
  const slotDuration = bhRecord.getInt('slot_duration_minutes') || 30
  let rawIntervals = bhRecord.get('intervals')
  let intervals = []

  if (typeof rawIntervals === 'string') {
    try {
      intervals = JSON.parse(rawIntervals)
    } catch (_) {
      intervals = []
    }
  } else if (Array.isArray(rawIntervals)) {
    intervals = rawIntervals
  }

  if (!isOpen || intervals.length === 0) {
    return e.json(200, {
      date: dateStr,
      day_of_week: dayOfWeek,
      day_name: bhRecord.getString('day_name'),
      is_open: false,
      slot_duration_minutes: slotDuration,
      slots: [],
      message: 'Clínica fechada para este dia.',
    })
  }

  // Buscar agendamentos existentes no dia
  const startDay = dateStr + ' 00:00:00.000Z'
  const endDay = dateStr + ' 23:59:59.999Z'

  let existingAppointments = []
  try {
    existingAppointments = $app.findRecordsByFilter(
      'appointments',
      'date >= {:startDay} && date <= {:endDay} && status != "cancelled"',
      'date',
      200,
      0,
      { startDay: startDay, endDay: endDay },
    )
  } catch (err) {
    console.log('Error fetching appointments for day:', err.message)
  }

  // Mapear horários ocupados (HH:mm)
  const occupiedTimes = new Set()
  for (let i = 0; i < existingAppointments.length; i++) {
    const appDateStr = existingAppointments[i].getString('date')
    if (appDateStr) {
      const appDate = new Date(appDateStr)
      const hours = String(appDate.getUTCHours()).padStart(2, '0')
      const minutes = String(appDate.getUTCMinutes()).padStart(2, '0')
      occupiedTimes.add(hours + ':' + minutes)
    }
  }

  // Gerar todos os slots possíveis baseados nos intervalos
  const allSlots = []
  for (let idx = 0; idx < intervals.length; idx++) {
    const interval = intervals[idx]
    if (!interval.start || !interval.end) continue

    const startParts = interval.start.split(':').map((p) => parseInt(p, 10))
    const endParts = interval.end.split(':').map((p) => parseInt(p, 10))

    let currentMinutes = startParts[0] * 60 + startParts[1]
    const endMinutes = endParts[0] * 60 + endParts[1]

    while (currentMinutes + slotDuration <= endMinutes) {
      const h = Math.floor(currentMinutes / 60)
      const m = currentMinutes % 60
      const timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')

      const isOccupied = occupiedTimes.has(timeStr)

      allSlots.push({
        time: timeStr,
        available: !isOccupied,
      })

      currentMinutes += slotDuration
    }
  }

  return e.json(200, {
    date: dateStr,
    day_of_week: dayOfWeek,
    day_name: bhRecord.getString('day_name'),
    is_open: true,
    slot_duration_minutes: slotDuration,
    slots: allSlots,
  })
})
