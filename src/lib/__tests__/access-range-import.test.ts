import { processAccessImport } from '@/services/access-import'

/**
 * Suite de testes unitários para a importação por faixa de linhas e preservação de índices
 */
export async function runAccessRangeImportTests(): Promise<{
  passed: boolean
  results: { name: string; ok: boolean; message?: string }[]
}> {
  const results: { name: string; ok: boolean; message?: string }[] = []

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg)
  }

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn()
      results.push({ name, ok: true })
    } catch (err: any) {
      results.push({ name, ok: false, message: err?.message || String(err) })
    }
  }

  // Criar 100 linhas simuladas de arquivo Access
  const mockRows: Record<string, string>[] = []
  for (let i = 1; i <= 100; i++) {
    mockRows.push({
      CTRL: `C${i}`,
      NOME: `Tutor ${i}`,
      ANIM: `Pet ${i}`,
      ESPE: 'CAN',
      TEXTO: i === 15 ? '' : `01/01/2020 Consulta ${i}`, // Linha 15 sem texto
    })
  }

  // 1. Testar faixa 1–10 (1-based)
  await testAsync('processAccessImport recorta exatamente a faixa solicitada (1–10)', async () => {
    // Processamento com delay 0 para teste rápido
    const report = await processAccessImport(mockRows, {
      startIndex: 1,
      endIndex: 10,
      itemDelayMs: 0,
      batchSize: 5,
    })

    assert(
      report.totalProcessed === 10,
      `Esperado 10 processados, recebido ${report.totalProcessed}`,
    )
    assert(report.rangeStart === 1, `rangeStart esperado 1, recebido ${report.rangeStart}`)
    assert(report.rangeEnd === 10, `rangeEnd esperado 10, recebido ${report.rangeEnd}`)
  })

  // 2. Testar faixa intermediária 21–30 com preservação da linha real do arquivo
  await testAsync(
    'processAccessImport preserva o número de linha real do arquivo na faixa 21–30',
    async () => {
      // Injetar uma linha com erro deliberado na posição 25 (índice 24 do mockRows)
      const rowsWithEmpty = [...mockRows]
      rowsWithEmpty[24] = { CTRL: '', NOME: '', ANIM: '' } // Linha 25 vazia deve gerar erro na linha 25

      const report = await processAccessImport(rowsWithEmpty, {
        startIndex: 21,
        endIndex: 30,
        itemDelayMs: 0,
        batchSize: 5,
      })

      assert(
        report.totalProcessed === 10,
        `Esperado 10 processados, recebido ${report.totalProcessed}`,
      )
      assert(report.rangeStart === 21, `rangeStart esperado 21, recebido ${report.rangeStart}`)
      assert(report.rangeEnd === 30, `rangeEnd esperado 30, recebido ${report.rangeEnd}`)
      assert(
        report.errors.length === 1,
        `Esperado 1 erro para linha vazia, recebido ${report.errors.length}`,
      )
      assert(
        report.errors[0].row === 25,
        `O erro deve reportar a linha REAL do arquivo (25), mas reportou ${report.errors[0]?.row}`,
      )
    },
  )

  // 3. Testar compatibilidade com modo limit (50 registros)
  await testAsync(
    'processAccessImport mantém compatibilidade retroativa com limit=50',
    async () => {
      const report = await processAccessImport(mockRows, {
        limit: 50,
        itemDelayMs: 0,
        batchSize: 20,
      })

      assert(
        report.totalProcessed === 50,
        `Esperado 50 processados, recebido ${report.totalProcessed}`,
      )
      assert(report.rangeStart === 1, `rangeStart esperado 1, recebido ${report.rangeStart}`)
      assert(report.rangeEnd === 50, `rangeEnd esperado 50, recebido ${report.rangeEnd}`)
    },
  )

  return {
    passed: results.every((r) => r.ok),
    results,
  }
}
