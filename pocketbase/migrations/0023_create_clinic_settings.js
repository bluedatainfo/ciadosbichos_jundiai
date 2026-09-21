/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const clinicSettings = new Collection({
      name: 'clinic_settings',
      type: 'base',
      listRule: '', // Leitura pública para que telas de login e agendamento online possam carregar nome e logo
      viewRule: '', // Leitura pública
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'logo',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880, // 5MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        },
        {
          name: 'phone',
          type: 'text',
        },
        {
          name: 'email',
          type: 'text',
        },
        {
          name: 'address',
          type: 'text',
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
    })

    app.save(clinicSettings)

    // Semear registro inicial padrão se não existir
    try {
      const existing = app.findFirstRecordByData(
        'clinic_settings',
        'name',
        'Clínica Veterinária Central',
      )
      if (!existing) {
        throw new Error('Not found')
      }
    } catch (_) {
      const record = new Record(clinicSettings)
      record.set('name', 'Clínica Veterinária Central')
      record.set('phone', '(11) 3333-4444')
      record.set('email', 'contato@clinicaveterinaria.com.br')
      record.set('address', 'Rua das Flores, 123 - Centro')
      app.save(record)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('clinic_settings')
      app.delete(col)
    } catch (_) {}
  },
)
