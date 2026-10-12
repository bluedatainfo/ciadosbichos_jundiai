/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Remover com segurança tabelas de trabalho temporárias criadas pelas migrações de dedup
    try {
      app.db().newQuery('DROP TABLE IF EXISTS _dedup_pairs_work').execute()
    } catch (_) {}
    try {
      app.db().newQuery('DROP TABLE IF EXISTS _cands').execute()
    } catch (_) {}
    try {
      app.db().newQuery('DROP TABLE IF EXISTS _batch_pairs').execute()
    } catch (_) {}
    try {
      app.db().newQuery('DROP TABLE IF EXISTS _clin_existing').execute()
    } catch (_) {}
    try {
      app.db().newQuery('DROP TABLE IF EXISTS _clin_to_migrate').execute()
    } catch (_) {}
    try {
      app.db().newQuery('DROP TABLE IF EXISTS _app_existing').execute()
    } catch (_) {}
    try {
      app.db().newQuery('DROP TABLE IF EXISTS _app_to_migrate').execute()
    } catch (_) {}
    try {
      app.db().newQuery('DROP TABLE IF EXISTS _vac_existing').execute()
    } catch (_) {}
    try {
      app.db().newQuery('DROP TABLE IF EXISTS _vac_to_migrate').execute()
    } catch (_) {}
  },
  (app) => {},
)
