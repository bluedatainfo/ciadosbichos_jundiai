migrate(
  (app) => {
    var url = $os.getenv('PB_INSTANCE_URL')
    console.log('[Migration 0060] PB_INSTANCE_URL: ' + url)
    if (!url) {
      console.log('[Migration 0060] Sem URL interna para disparar via HTTP')
      return
    }
    try {
      var res = $http.send({
        url: url + '/backend/v1/backups/run',
        method: 'POST',
        timeout: 600, // 10 minutos
      })
      console.log('[Migration 0060] Resposta status: ' + res.statusCode)
      console.log('[Migration 0060] Resposta body: ' + res.rawText)
    } catch (err) {
      console.log('[Migration 0060] Erro ao chamar /run:', err)
    }
  },
  (app) => {},
)
