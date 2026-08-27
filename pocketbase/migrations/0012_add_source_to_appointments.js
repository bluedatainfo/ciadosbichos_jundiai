/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const appointments = app.findCollectionByNameOrId('appointments')

    if (!appointments.fields.getByName('source')) {
      appointments.fields.add(
        new SelectField({
          name: 'source',
          values: ['internal', 'public'],
          maxSelect: 1,
        }),
      )
      app.save(appointments)
    }

    // Definir default 'internal' para agendamentos existentes que estiverem vazios
    app
      .db()
      .newQuery("UPDATE appointments SET source = 'internal' WHERE source IS NULL OR source = ''")
      .execute()
  },
  (app) => {
    try {
      const appointments = app.findCollectionByNameOrId('appointments')
      const sourceField = appointments.fields.getByName('source')
      if (sourceField) {
        appointments.fields.removeByName('source')
        app.save(appointments)
      }
    } catch (_) {}
  },
)
