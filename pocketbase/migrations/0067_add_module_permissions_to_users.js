migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('module_permissions')) {
      users.fields.add(
        new JSONField({
          name: 'module_permissions',
        }),
      )
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (users.fields.getByName('module_permissions')) {
      users.fields.removeByName('module_permissions')
      app.save(users)
    }
  },
)
