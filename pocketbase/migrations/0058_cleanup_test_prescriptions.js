migrate(
  (app) => {
    // Tarefa 4: Excluir os 3 registros de teste específicos da coleção prescriptions:
    // THOR / DANIELE INAZIO (id 'wn0cci4ntzwilkr')
    // BONGÔ / ANA PAULA MAYA DA SILVA (ids 'vu7go2rjdrv1cfd' e '1vmn546uerasnu9')
    const targetIds = ['wn0cci4ntzwilkr', 'vu7go2rjdrv1cfd', '1vmn546uerasnu9']
    for (const id of targetIds) {
      try {
        const record = app.findRecordById('prescriptions', id)
        if (record) {
          app.delete(record)
        }
      } catch (_) {
        // Idempotente caso o registro já tenha sido removido
      }
    }
  },
  () => {},
)
