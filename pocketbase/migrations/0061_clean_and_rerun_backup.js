migrate(
  (app) => {
    var url = $os.getenv('PB_INSTANCE_URL')
    console.log('[Migration 0061] Limpando histórico e re-executando backup...')
    if (!url) {
      console.log('[Migration 0061] Sem PB_INSTANCE_URL')
      return
    }
    try {
      // 1. Limpa histórico anterior
      var resClean = $http.send({
        url: url + '/backend/v1/backups/clean-history',
        method: 'POST',
        timeout: 60,
      })
      console.log(
        '[Migration 0061] Resposta clean-history: ' + resClean.statusCode + ' ' + resClean.rawText,
      )

      // 2. Dispara backup completo
      var resRun = $http.send({
        url: url + '/backend/v1/backups/run',
        method: 'POST',
        timeout: 600, // 10 min
      })
      console.log(
        '[Migration 0061] Resposta run backup: ' + resRun.statusCode + ' ' + resRun.rawText,
      )
    } catch (err) {
      console.log('[Migration 0061] Erro na migração de disparo:', err)
    }
  },
  (app) => {},
)
