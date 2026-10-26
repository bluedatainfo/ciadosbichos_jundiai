migrate(
  (app) => {
    var resolvedDir = ''
    try {
      if (app && typeof app.dataDir === 'function') {
        resolvedDir = app.dataDir()
      }
    } catch (_) {}
    var backupDir = resolvedDir ? resolvedDir + '/backups_csv' : 'pb_data/backups_csv'

    try {
      var entries = []
      try {
        entries = $os.readDir(backupDir)
      } catch (eDir) {
        console.log('[Migration 0059] Diretório backups_csv não existe ou não pôde ser lido:', eDir)
        return
      }

      if (!entries || entries.length === 0) {
        console.log('[Migration 0059] Nenhum arquivo encontrado em ' + backupDir)
        return
      }

      var removed = []
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i]
        if (entry.isDir()) continue
        var name = entry.name()
        if (!name.endsWith('.csv')) continue

        var fullPath = backupDir + '/' + name
        try {
          $os.remove(fullPath)
          removed.push(name)
          console.log('[Migration 0059] Arquivo inválido removido: ' + name)
        } catch (errRem) {
          console.log('[Migration 0059] Erro ao remover ' + name + ':', errRem)
        }
      }

      console.log(
        '[Migration 0059] Limpeza concluída. Removidos ' +
          removed.length +
          ' arquivos: ' +
          (removed.length > 0 ? removed.join(', ') : 'nenhum'),
      )
    } catch (err) {
      console.log('[Migration 0059] Erro geral:', err)
    }
  },
  (app) => {
    // down migration no-op
  },
)
