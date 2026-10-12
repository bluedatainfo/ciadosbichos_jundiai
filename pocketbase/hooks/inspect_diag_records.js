routerAdd('GET', '/backend/v1/inspect-diag-records', (e) => {
  try {
    const records = $app.findRecordsByFilter('_diag_results', '', '-created', 10, 0)
    const list = records.map((r) => ({
      id: r.id,
      category: r.getString('category'),
      payload: JSON.parse(r.getString('payload') || '{}'),
      created: r.getString('created'),
    }))
    return e.json(200, { items: list })
  } catch (err) {
    return e.json(500, { error: err.message })
  }
})
