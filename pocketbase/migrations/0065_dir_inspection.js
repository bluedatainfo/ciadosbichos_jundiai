migrate(
  (app) => {
    var rec = app.findFirstRecordByData('import_failures', 'ctrl', 'BACKUP_VERIFY')
    var hasApp = Boolean(app)
    var hasDataDir = app && typeof app.dataDir === 'function'
    var dataDirVal = hasDataDir ? app.dataDir() : 'none'

    var pbDataEntries = []
    try {
      var raw = $os.readDir(dataDirVal)
      for (var i = 0; i < raw.length; i++) {
        pbDataEntries.push(raw[i].name())
      }
    } catch (e1) {
      pbDataEntries.push('err:' + e1)
    }

    var relEntries = []
    try {
      var rawRel = $os.readDir('.')
      for (var j = 0; j < rawRel.length; j++) {
        relEntries.push(rawRel[j].name())
      }
    } catch (e2) {
      relEntries.push('err:' + e2)
    }

    rec.set('tutor', 'dataDir: ' + dataDirVal + ' | inDataDir: ' + pbDataEntries.join(', '))
    rec.set('animal', 'inDot: ' + relEntries.join(', '))
    app.save(rec)
  },
  (app) => {},
)
