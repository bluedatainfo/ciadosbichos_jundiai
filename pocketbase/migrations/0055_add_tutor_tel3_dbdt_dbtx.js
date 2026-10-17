/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tutors = app.findCollectionByNameOrId('tutors')

    if (!tutors.fields.getByName('tel3')) {
      tutors.fields.add(new TextField({ name: 'tel3' }))
    }

    if (!tutors.fields.getByName('dbdt_flag')) {
      // PocketBase boolean fields must NOT be required
      tutors.fields.add(new BoolField({ name: 'dbdt_flag' }))
    }

    if (!tutors.fields.getByName('dbtx')) {
      tutors.fields.add(new TextField({ name: 'dbtx' }))
    }

    app.save(tutors)
  },
  (app) => {
    try {
      const tutors = app.findCollectionByNameOrId('tutors')
      tutors.fields.removeByName('tel3')
      tutors.fields.removeByName('dbdt_flag')
      tutors.fields.removeByName('dbtx')
      app.save(tutors)
    } catch (_) {}
  },
)
