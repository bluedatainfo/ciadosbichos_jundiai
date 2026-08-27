/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Criar coleção business_hours
    const businessHours = new Collection({
      name: 'business_hours',
      type: 'base',
      listRule: '', // Público para consulta de horários na página pública
      viewRule: '', // Público
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'day_of_week',
          type: 'number', // 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado
          min: 0,
          max: 6,
          onlyInt: true,
        },
        {
          name: 'day_name',
          type: 'text',
          required: true,
        },
        {
          name: 'is_open',
          type: 'bool',
        },
        {
          name: 'slot_duration_minutes',
          type: 'number',
          min: 5,
          max: 240,
          onlyInt: true,
        },
        {
          name: 'intervals',
          type: 'json', // Array of { start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_business_hours_day ON business_hours (day_of_week)'],
    })

    app.save(businessHours)

    // 2. Semear os dias da semana padrão (Segunda a Sábado abertos, Domingo fechado)
    const days = [
      {
        day_of_week: 0,
        day_name: 'Domingo',
        is_open: false,
        slot_duration_minutes: 30,
        intervals: [],
      },
      {
        day_of_week: 1,
        day_name: 'Segunda-feira',
        is_open: true,
        slot_duration_minutes: 30,
        intervals: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
      },
      {
        day_of_week: 2,
        day_name: 'Terça-feira',
        is_open: true,
        slot_duration_minutes: 30,
        intervals: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
      },
      {
        day_of_week: 3,
        day_name: 'Quarta-feira',
        is_open: true,
        slot_duration_minutes: 30,
        intervals: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
      },
      {
        day_of_week: 4,
        day_name: 'Quinta-feira',
        is_open: true,
        slot_duration_minutes: 30,
        intervals: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
      },
      {
        day_of_week: 5,
        day_name: 'Sexta-feira',
        is_open: true,
        slot_duration_minutes: 30,
        intervals: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
      },
      {
        day_of_week: 6,
        day_name: 'Sábado',
        is_open: true,
        slot_duration_minutes: 30,
        intervals: [{ start: '08:00', end: '12:00' }],
      },
    ]

    for (let i = 0; i < days.length; i++) {
      const d = days[i]
      const record = new Record(businessHours)
      record.set('day_of_week', d.day_of_week)
      record.set('day_name', d.day_name)
      record.set('is_open', d.is_open)
      record.set('slot_duration_minutes', d.slot_duration_minutes)
      record.set('intervals', d.intervals)
      app.save(record)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('business_hours')
      app.delete(col)
    } catch (_) {}
  },
)
