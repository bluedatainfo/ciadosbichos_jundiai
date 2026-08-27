/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.manageRule = "@request.auth.role = 'admin'"
    app.save(users)

    // Ensure all existing users have emailVisibility set to true so admin/client can view emails
    app.db().newQuery('UPDATE users SET emailVisibility = 1').execute()
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.manageRule = null
    app.save(users)
  },
)
