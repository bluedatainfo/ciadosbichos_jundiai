migrate(
  (app) => {
    const collection = new Collection({
      name: 'audit_logs',
      type: 'base',
      // Regras: apenas admins podem listar/visualizar; usuários autenticados podem criar logs; updates e deletes bloqueados (imutabilidade)
      listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        },
        { name: 'user_name', type: 'text', required: true },
        { name: 'user_email', type: 'text', required: false },
        { name: 'user_role', type: 'text', required: false },
        {
          name: 'action',
          type: 'select',
          required: true,
          values: ['create', 'update', 'delete', 'mark_completed', 'reopen'],
          maxSelect: 1,
        },
        {
          name: 'module',
          type: 'select',
          required: true,
          values: ['patients', 'tutors', 'clinical_records', 'returns'],
          maxSelect: 1,
        },
        { name: 'record_id', type: 'text', required: false },
        { name: 'record_label', type: 'text', required: false },
        { name: 'patient_name', type: 'text', required: false },
        { name: 'tutor_name', type: 'text', required: false },
        { name: 'changes', type: 'json', required: false },
        { name: 'details', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_user_id ON audit_logs (user_id)',
        'CREATE INDEX idx_audit_action ON audit_logs (action)',
        'CREATE INDEX idx_audit_module ON audit_logs (module)',
        'CREATE INDEX idx_audit_created ON audit_logs (created DESC)',
        'CREATE INDEX idx_audit_record_id ON audit_logs (record_id)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('audit_logs')
      app.delete(collection)
    } catch (_) {}
  },
)
