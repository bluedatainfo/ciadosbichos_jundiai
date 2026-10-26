migrate(
  (app) => {
    var url = $os.getenv('PB_INSTANCE_URL')
    console.log('[Migration 0062] Verificando lista de backups...')
    if (!url) return
    try {
      var resList = $http.send({
        url: url + '/backend/v1/backups/list',
        method: 'GET',
        timeout: 30,
      })
      console.log(
        '[Migration 0062] Resposta list backups: ' + resList.statusCode + ' ' + resList.rawText,
      )
    } catch (err) {
      console.log('[Migration 0062] Erro ao listar backups:', err)
    }
  },
  (app) => {},
)
