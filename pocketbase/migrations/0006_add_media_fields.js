migrate(
  (app) => {
    const patients = app.findCollectionByNameOrId('patients')
    patients.fields.add(
      new FileField({
        name: 'photo',
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      }),
    )
    app.save(patients)

    const records = app.findCollectionByNameOrId('clinical_records')
    records.fields.add(
      new FileField({
        name: 'files',
        maxSelect: 10,
        maxSize: 10485760,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      }),
    )
    app.save(records)
  },
  (app) => {
    const patients = app.findCollectionByNameOrId('patients')
    patients.fields.removeByName('photo')
    app.save(patients)

    const records = app.findCollectionByNameOrId('clinical_records')
    records.fields.removeByName('files')
    app.save(records)
  },
)
