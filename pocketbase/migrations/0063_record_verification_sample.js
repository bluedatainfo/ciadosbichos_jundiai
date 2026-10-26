migrate(
  (app) => {
    var url = $os.getenv('PB_INSTANCE_URL')
    if (!url) return
    var resList = $http.send({
      url: url + '/backend/v1/backups/list',
      method: 'GET',
      timeout: 30,
    })

    var rawList = String(resList.rawText || '')

    var rec = new Record(app.findCollectionByNameOrId('import_failures'))
    rec.set('linha', 999999)
    rec.set('ctrl', 'BACKUP_VERIFY')
    rec.set('tutor', rawList.substring(0, 500))
    rec.set('animal', String(resList.statusCode))
    rec.set('tipo', 'geral')
    rec.set('erro', 'OK')
    rec.set('trecho', 'VERIFICACAO')
    rec.set('status', 'ignored')
    app.save(rec)
  },
  (app) => {},
)
