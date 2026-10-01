migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('phone')) {
      users.fields.add(
        new TextField({
          name: 'phone',
        }),
      )
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (users.fields.getByName('phone')) {
      users.fields.removeByName('phone')
      app.save(users)
    }
  },
)
