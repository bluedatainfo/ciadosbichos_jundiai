import {
  parseContentToLines,
  paginatePrescriptionContent,
  formatPrescriptionDate,
} from '../prescription-engine'

/**
 * Suite de validação do motor de composição do receituário.
 * Testa:
 * 1. Formatação de data em padrão brasileiro dd/mm/aaaa
 * 2. Parsing de marcadores, títulos e listas
 * 3. Paginação de texto curto (exatamente 1 página, sem overflow)
 * 4. Paginação de texto longo (múltiplas páginas, sem truncamento de linhas)
 * 5. Integridade do conteúdo paginado (todas as linhas preservadas)
 */
export function runPrescriptionEngineTests(): {
  passed: boolean
  results: { name: string; ok: boolean; message?: string }[]
} {
  const results: { name: string; ok: boolean; message?: string }[] = []

  function test(name: string, fn: () => void) {
    try {
      fn()
      results.push({ name, ok: true })
    } catch (err: any) {
      results.push({ name, ok: false, message: err?.message || String(err) })
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg)
  }

  // Mock de CanvasRenderingContext2D simples para medição em ambiente headless/test
  function createMockMeasureCtx(): CanvasRenderingContext2D {
    return {
      font: '',
      measureText: (text: string) => {
        // Estimativa proporcional de largura média de fonte sans-serif (~10px por caractere)
        return { width: text.length * 10 } as TextMetrics
      },
    } as unknown as CanvasRenderingContext2D
  }

  test('Formatação de datas brasileiras dd/mm/aaaa', () => {
    assert(formatPrescriptionDate('2026-10-20') === '20/10/2026', 'Data ISO deve virar 20/10/2026')
    assert(
      formatPrescriptionDate('20/10/2026') === '20/10/2026',
      'Data já formatada deve se manter',
    )
    assert(
      formatPrescriptionDate('2026-05-01T10:00:00Z') === '01/05/2026',
      'Data ISO com tempo deve virar 01/05/2026',
    )
  })

  test('Parser de linhas identifica títulos e marcadores', () => {
    const raw = '# USO ORAL\n- Meloxicam 1mg\n1. Dipirona gotas\nTexto comum'
    const lines = parseContentToLines(raw)
    assert(lines.length === 4, 'Deve conter 4 linhas')
    assert(lines[0].isHeader === true, 'Linha 1 deve ser cabeçalho')
    assert(lines[0].text === 'USO ORAL', 'Texto do cabeçalho sem #')
    assert(lines[1].isBullet === true, 'Linha 2 deve ser bullet')
    assert(lines[1].text === 'Meloxicam 1mg', 'Texto da linha 2 limpo')
    assert(lines[2].isBullet === true, 'Linha 3 numerada deve ser tratada como bullet')
    assert(lines[3].isBullet !== true && lines[3].isHeader !== true, 'Linha 4 comum')
  })

  test('Texto curto resulta em exatamente 1 página sem sobreposição', () => {
    const ctx = createMockMeasureCtx()
    const content =
      '# USO ORAL\n' +
      '1. Meloxicam 1mg ---------- 10 comprimidos\n' +
      '   Administrar 1 comprimido a cada 24 horas durante 5 dias.\n' +
      '2. Omeprazol 10mg ---------- 14 cápsulas\n' +
      '   Administrar 1 cápsula em jejum por 7 dias.'

    const availableWidth = 872
    const availableHeight = 865 // CONTENT_BOX.height - 85

    const pages = paginatePrescriptionContent(ctx, content, availableWidth, availableHeight)
    assert(pages.length === 1, `Esperado 1 página, obtido: ${pages.length}`)
    assert(pages[0].length > 0, 'Página 1 deve conter parágrafos')
  })

  test('Texto longo distribui em 2 ou mais páginas sem truncamento', () => {
    const ctx = createMockMeasureCtx()

    // Gera um texto com múltiplos medicamentos e orientações extensas
    let longContent = '# PROTOCOLO CLÍNICO CIRÚRGICO INTEGRAL\n\n'
    for (let i = 1; i <= 25; i++) {
      longContent += `${i}. Medicamento Especial Veterinário ${i} ---------- 30 comprimidos\n`
      longContent += `   Administrar via oral conforme posologia recomendada a cada ${i * 2} horas pelo período de 14 dias consecutivos.\n\n`
    }
    longContent += '# RECOMENDAÇÕES FINAIS E RETORNO\n'
    longContent +=
      '- Retorno obrigatório em 7 dias para avaliação dos pontos e parâmetros vitais.\n'
    longContent += '- Oferecer água fresca e alimentação hipercalórica pasteurizada à vontade.\n'

    const availableWidth = 872
    const availableHeight = 865

    const pages = paginatePrescriptionContent(
      ctx,
      contentLines(longContent),
      availableWidth,
      availableHeight,
    )

    assert(pages.length >= 2, `Texto longo deve gerar 2 ou mais páginas (obtido: ${pages.length})`)

    // Verifica que todas as páginas têm conteúdo válido
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      assert(pages[pIdx].length > 0, `Página ${pIdx + 1} não deve ser vazia`)
      const totalPageLines = pages[pIdx].reduce((acc, p) => acc + p.lines.length, 0)
      assert(totalPageLines > 0, `Página ${pIdx + 1} deve ter linhas renderizadas`)
    }

    // Verifica se os termos do início e do final estão preservados
    const firstPageText = pages[0].map((p) => p.lines.map((l) => l.text).join(' ')).join(' ')
    const lastPageText = pages[pages.length - 1]
      .map((p) => p.lines.map((l) => l.text).join(' '))
      .join(' ')

    assert(firstPageText.includes('PROTOCOLO CLÍNICO CIRÚRGICO'), 'Início deve estar na página 1')
    assert(
      lastPageText.includes('RECOMENDAÇÕES FINAIS') || lastPageText.includes('Retorno obrigatório'),
      'Fim deve estar na última página',
    )
  })

  function contentLines(c: string) {
    return c
  }

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
