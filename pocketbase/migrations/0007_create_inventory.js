migrate(
  (app) => {
    const inventory = new Collection({
      name: 'inventory',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'category', type: 'text' },
        { name: 'quantity', type: 'number' },
        { name: 'unit', type: 'text' },
        { name: 'min_stock', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_inventory_name ON inventory (name)',
        'CREATE INDEX idx_inventory_category ON inventory (category)',
      ],
    })
    app.save(inventory)
  },
  (app) => {
    const inventory = app.findCollectionByNameOrId('inventory')
    app.delete(inventory)
  },
)
