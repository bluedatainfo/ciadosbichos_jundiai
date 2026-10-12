/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Teste simples para verificar sintaxe
    const col = app.findCollectionByNameOrId('patients')
    if (col) {
      console.log('Coleção patients encontrada com sucesso')
    }
  },
  (app) => {},
)
