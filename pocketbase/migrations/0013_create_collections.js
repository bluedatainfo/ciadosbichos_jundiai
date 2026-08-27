/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const appointments = app.findCollectionByNameOrId('appointments')
    appointments.listRule = ''
    appointments.viewRule = ''
    app.save(appointments)
  },
  (app) => {
    try {
      const appointments = app.findCollectionByNameOrId('appointments')
      appointments.listRule = "@request.auth.id != ''"
      appointments.viewRule = "@request.auth.id != ''"
      app.save(appointments)
    } catch (_) {}
  },
)
