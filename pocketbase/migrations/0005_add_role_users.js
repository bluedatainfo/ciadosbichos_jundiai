migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.add(
      new SelectField({
        name: 'role',
        values: ['admin', 'veterinarian', 'attendant'],
        maxSelect: 1,
      }),
    )
    app.save(users)

    try {
      const admin = app.findAuthRecordByEmail('users', 'bluedata@bluedatainfo.com.br')
      admin.set('role', 'admin')
      app.save(admin)
    } catch (_) {}
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.removeByName('role')
    app.save(users)
  },
)
