/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = "id = @request.auth.id || @request.auth.role = 'admin'"
    users.viewRule = "id = @request.auth.id || @request.auth.role = 'admin'"
    users.updateRule = "id = @request.auth.id || @request.auth.role = 'admin'"
    users.deleteRule = "id = @request.auth.id || @request.auth.role = 'admin'"
    app.save(users)

    const records = app.findCollectionByNameOrId('clinical_records')
    records.createRule = "@request.auth.id != '' && @request.auth.role != 'attendant'"
    records.updateRule = "@request.auth.id != '' && @request.auth.role != 'attendant'"
    records.deleteRule = "@request.auth.id != '' && @request.auth.role != 'attendant'"
    app.save(records)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)

    const records = app.findCollectionByNameOrId('clinical_records')
    records.createRule = "@request.auth.id != ''"
    records.updateRule = "@request.auth.id != ''"
    records.deleteRule = "@request.auth.id != ''"
    app.save(records)
  },
)
