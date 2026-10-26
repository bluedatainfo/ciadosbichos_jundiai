migrate(
  (app) => {
    var resolvedDir = ''
    try {
      if (app && typeof app.dataDir === 'function') {
        resolvedDir = app.dataDir()
      }
    } catch (_) {}
    var backupDir = resolvedDir ? resolvedDir + '/backups_csv' : 'pb_data/backups_csv'

    var entries = []
    try {
      entries = $os.readDir(backupDir)
    } catch (err) {
      entries = []
    }

    var listSummary = []
    var firstSample = ''
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i]
      if (entry.isDir()) continue
      var name = entry.name()
      var fullP = backupDir + '/' + name
      var sz = 0
      try {
        sz = $os.stat(fullP).size()
      } catch (_) {}
      listSummary.push(name + ':' + sz)

      // Se for patients, lê os primeiros 400 bytes
      if (name.indexOf('patients') !== -1 && !firstSample) {
        try {
          var bytes = $os.readFile(fullP)
          var str = ''
          var maxLen = bytes.length < 500 ? bytes.length : 500
          for (var b = 0; b < maxLen; b++) {
            str += String.fromCharCode(bytes[b])
          }
          firstSample = str
        } catch (eRead) {
          firstSample = 'Erro readFile: ' + eRead
        }
      }
    }

    var rec = app.findFirstRecordByData('import_failures', 'ctrl', 'BACKUP_VERIFY')
    rec.set('tutor', listSummary.join(' | '))
    rec.set('animal', firstSample.substring(0, 500))
    app.save(rec)
  },
  (app) => {},
)
