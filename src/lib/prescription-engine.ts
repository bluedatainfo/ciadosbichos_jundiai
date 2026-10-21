import officialTemplateBg from '@/assets/receituariooriginal-41b76.png'
import { buildPdfFromJpegImages } from './pdf-generator'

export interface PrescriptionDocData {
  patientName: string
  tutorName: string
  date: string // e.g. "2025-05-18" or "18/05/2025"
  content: string
}

export interface FormattedLine {
  text: string
  isBold?: boolean
  isItalic?: boolean
  isBullet?: boolean
  isHeader?: boolean
  indent?: number
}

// Largura e altura da arte original do talão oficial (receituariooriginal-41b76.png)
// Arte oficial em alta definição (1024 x 1536, proporção 2:3 próxima ao A4 1:1.4142)
const ART_WIDTH = 1024
const ART_HEIGHT = 1536

// Coordenadas da área interna da receita calibradas contra o print do modelo oficial:
// - Borda do retângulo arredondado verde: x ~ 40px a ~ 984px, y ~ 316px a ~ 1324px
// - Cabeçalho acima do retângulo: logotipo, título "VETERINÁRIA COMPANHIA DOS BICHOS", CRMVs até ~300px
// - Rodapé abaixo do retângulo: Endereço à esquerda, Telefones e Retorno 30 dias à direita a partir de ~1340px
// - Margens internas seguras dentro do retângulo arredondado verde:
//   left: 76px, top: 340px, width: 872px (até 948px), bottom: 1290px (altura útil: 950px)
const CONTENT_BOX = {
  left: 76,
  top: 340,
  width: 872,
  height: 950, // 340 + 950 = 1290px (folga interna confortável antes da borda inferior em 1324px e do rodapé em 1340px)
}

/**
 * Converte data ISO ou padrão para formato brasileiro dd/mm/aaaa
 */
export function formatPrescriptionDate(dateStr: string): string {
  if (!dateStr) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

/**
 * Converte o texto digitado na área de texto em linhas com suporte a formatação simples:
 * - Linhas com marcadores: "- ", "* ", "• " ou "1. "
 * - Marcações de negrito inline: **texto** ou *texto*
 * - Títulos: "# " ou "## "
 */
export function parseContentToLines(content: string): FormattedLine[] {
  const rawLines = content.split(/\r?\n/)
  const lines: FormattedLine[] = []

  for (const raw of rawLines) {
    const trimmed = raw.trim()
    if (!trimmed) {
      lines.push({ text: '' })
      continue
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      lines.push({
        text: trimmed.replace(/^#{1,3}\s+/, ''),
        isHeader: true,
        isBold: true,
      })
    } else if (/^[-*•]\s+/.test(trimmed)) {
      lines.push({
        text: trimmed.replace(/^[-*•]\s+/, ''),
        isBullet: true,
      })
    } else if (/^\d+[.)]\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+[.)])\s+(.*)/)
      if (match) {
        lines.push({
          text: `${match[1]} ${match[2]}`,
          isBullet: true,
        })
      } else {
        lines.push({ text: trimmed })
      }
    } else {
      lines.push({ text: trimmed })
    }
  }

  return lines
}

/**
 * Envolve e quebra texto em linhas que cabem na largura máxima especificada,
 * respeitando palavras inteiras.
 */
function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return ['']
  const words = text.split(' ')
  const wrapped: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const metrics = ctx.measureText(test)
    if (metrics.width <= maxWidth) {
      current = test
    } else {
      if (current) {
        wrapped.push(current)
      }
      // Se a palavra sozinha for maior que a largura, quebra por caractere
      if (ctx.measureText(word).width > maxWidth) {
        let chunk = ''
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            wrapped.push(chunk)
            chunk = ''
          }
          chunk += ch
        }
        current = chunk
      } else {
        current = word
      }
    }
  }
  if (current) wrapped.push(current)
  return wrapped.length > 0 ? wrapped : ['']
}

export interface RenderedParagraph {
  lines: Array<{
    text: string
    isBold?: boolean
    isItalic?: boolean
    isBullet?: boolean
    isHeader?: boolean
  }>
  lineHeight: number
  spaceAfter: number
}

/**
 * Divide o conteúdo em páginas que respeitam fielmente a altura útil da área interna,
 * garantindo que nunca quebre uma linha ao meio.
 */
export function paginatePrescriptionContent(
  ctx: CanvasRenderingContext2D,
  content: string,
  availableWidth: number,
  availableHeight: number,
): RenderedParagraph[][] {
  const parsed = parseContentToLines(content)
  const paragraphs: RenderedParagraph[] = []

  for (const p of parsed) {
    if (!p.text) {
      // Linha em branco
      paragraphs.push({
        lines: [{ text: '' }],
        lineHeight: 18,
        spaceAfter: 8,
      })
      continue
    }

    const isHeader = !!p.isHeader
    const fontSize = isHeader ? 22 : 18
    const fontFamily =
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.font = `${p.isBold || isHeader ? 'bold ' : ''}${p.isItalic ? 'italic ' : ''}${fontSize}px ${fontFamily}`

    const indentWidth = p.isBullet ? 28 : 0
    const textMaxWidth = availableWidth - indentWidth
    const wrappedStrings = wrapLine(ctx, p.text, textMaxWidth)

    const renderedLines = wrappedStrings.map((str, idx) => ({
      text: str,
      isBold: p.isBold,
      isItalic: p.isItalic,
      isBullet: p.isBullet && idx === 0,
      isHeader: p.isHeader,
    }))

    paragraphs.push({
      lines: renderedLines,
      lineHeight: isHeader ? 30 : 26,
      spaceAfter: isHeader ? 14 : 8,
    })
  }

  // Distribuição em páginas respeitando estritamente a altura disponível
  // Regra crítica: NUNCA truncar texto, NUNCA cortar linha ao meio.
  // Quando uma página enche, abre uma nova página e continua.
  const pages: RenderedParagraph[][] = []
  let currentPage: RenderedParagraph[] = []
  let currentY = 0

  for (const para of paragraphs) {
    const paraTotalHeight = para.lines.length * para.lineHeight + para.spaceAfter

    // Se o parágrafo inteiro cabe na página atual (e ainda cabe pelo menos 1 linha)
    if (currentY + paraTotalHeight <= availableHeight) {
      currentPage.push(para)
      currentY += paraTotalHeight
      continue
    }

    // O parágrafo inteiro não cabe na página atual.
    // Verifica quantas linhas cabem no espaço restante da página atual
    let remainingLines = [...para.lines]
    const spaceLeft = availableHeight - currentY
    const linesFit = Math.floor(spaceLeft / para.lineHeight)

    // Se couber pelo menos 1 linha inteira na página atual e houver mais linhas para virar
    if (linesFit >= 1 && currentPage.length > 0) {
      const chunk = remainingLines.slice(0, linesFit)
      remainingLines = remainingLines.slice(linesFit)
      currentPage.push({
        lines: chunk,
        lineHeight: para.lineHeight,
        spaceAfter: 0,
      })
      pages.push(currentPage)
      currentPage = []
      currentY = 0
    } else if (currentPage.length > 0) {
      // Nem 1 linha cabe no espaço restante: fecha a página atual e vira para nova página
      pages.push(currentPage)
      currentPage = []
      currentY = 0
    }

    // Agora processa as linhas restantes em páginas novas
    while (remainingLines.length > 0) {
      const spaceInNewPage = availableHeight - currentY
      const maxLines = Math.floor(spaceInNewPage / para.lineHeight)
      const count = Math.max(1, Math.min(maxLines, remainingLines.length))
      const chunk = remainingLines.slice(0, count)
      remainingLines = remainingLines.slice(count)

      const isLastChunk = remainingLines.length === 0
      const chunkHeight = chunk.length * para.lineHeight + (isLastChunk ? para.spaceAfter : 0)

      currentPage.push({
        lines: chunk,
        lineHeight: para.lineHeight,
        spaceAfter: isLastChunk ? para.spaceAfter : 0,
      })
      currentY += chunkHeight

      // Se ainda restam linhas do parágrafo, precisa virar a página
      if (!isLastChunk) {
        pages.push(currentPage)
        currentPage = []
        currentY = 0
      }
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage)
  }

  return pages.length > 0 ? pages : [[]]
}

/**
 * Carrega a imagem timbrada de fundo oficial
 */
let cachedTemplateImg: HTMLImageElement | null = null

export async function loadTemplateImage(): Promise<HTMLImageElement> {
  if (cachedTemplateImg && cachedTemplateImg.complete && cachedTemplateImg.naturalWidth > 0) {
    return cachedTemplateImg
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      cachedTemplateImg = img
      resolve(img)
    }
    img.onerror = (e) => reject(e)
    img.src = officialTemplateBg
  })
}

/**
 * Renderiza uma página completa em um Canvas de alta definição (1000 x 1481)
 */
export async function renderPrescriptionPageToCanvas(
  data: PrescriptionDocData,
  paragraphs: RenderedParagraph[],
  pageNumber: number,
  totalPages: number,
): Promise<HTMLCanvasElement> {
  const bgImg = await loadTemplateImage()

  const canvas = document.createElement('canvas')
  canvas.width = ART_WIDTH
  canvas.height = ART_HEIGHT
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do Canvas')

  // Fundo branco base
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT)

  // Desenha a arte timbrada oficial em alta fidelidade
  ctx.drawImage(bgImg, 0, 0, ART_WIDTH, ART_HEIGHT)

  // 1. Cabeçalho de Identificação do Paciente / Tutor / Data dentro do topo da área útil
  // Renderizamos uma faixa elegante na parte superior da área interna (y: 340 a 395)
  const headerY = CONTENT_BOX.top + 22
  ctx.save()

  // Linha de dados: Paciente, Tutor e Data
  ctx.fillStyle = '#065f46' // verde escuro combinando com a identidade visual
  ctx.font = 'bold 18px system-ui, sans-serif'
  ctx.fillText('PACIENTE:', CONTENT_BOX.left, headerY)

  ctx.font = 'bold 18px system-ui, sans-serif'
  ctx.fillStyle = '#0f172a'
  const patientText = (data.patientName || 'Não informado').toUpperCase()
  ctx.fillText(patientText, CONTENT_BOX.left + 100, headerY)

  // Tutor ao lado (calcula dinamicamente a posição x para evitar sobreposições)
  const patientWidth = ctx.measureText(patientText).width
  const tutorX = Math.max(CONTENT_BOX.left + 400, CONTENT_BOX.left + 115 + patientWidth)

  if (data.tutorName && tutorX < CONTENT_BOX.left + CONTENT_BOX.width - 240) {
    ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.fillStyle = '#065f46'
    ctx.fillText('TUTOR:', tutorX, headerY)

    ctx.font = '600 16px system-ui, sans-serif'
    ctx.fillStyle = '#0f172a'
    const maxTutorWidth = CONTENT_BOX.left + CONTENT_BOX.width - 160 - (tutorX + 70)
    let tutorText = data.tutorName
    if (ctx.measureText(tutorText).width > maxTutorWidth && maxTutorWidth > 50) {
      while (ctx.measureText(tutorText + '...').width > maxTutorWidth && tutorText.length > 3) {
        tutorText = tutorText.slice(0, -1)
      }
      tutorText += '...'
    }
    ctx.fillText(tutorText, tutorX + 70, headerY)
  }

  // Data à direita
  const dateFormatted = formatPrescriptionDate(data.date)
  if (dateFormatted) {
    const dateStr = `Data: ${dateFormatted}`
    ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.fillStyle = '#1e293b'
    const dateWidth = ctx.measureText(dateStr).width
    ctx.fillText(dateStr, CONTENT_BOX.left + CONTENT_BOX.width - dateWidth, headerY)
  }

  // Linha divisória sutil em verde suave
  ctx.strokeStyle = '#a7f3d0' // emerald-200
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(CONTENT_BOX.left, headerY + 14)
  ctx.lineTo(CONTENT_BOX.left + CONTENT_BOX.width, headerY + 14)
  ctx.stroke()

  // Indicador oficial de página "Página X de Y" obrigatório
  // Posicionado com clareza no canto direito, logo abaixo da linha divisória do topo
  const pageIndicatorText = `Página ${pageNumber} de ${totalPages}`
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.fillStyle = '#047857' // emerald-700
  const pageIndWidth = ctx.measureText(pageIndicatorText).width
  ctx.fillText(pageIndicatorText, CONTENT_BOX.left + CONTENT_BOX.width - pageIndWidth, headerY + 34)

  ctx.restore()

  // 2. Renderização do conteúdo da prescrição
  // Inicia logo abaixo da identificação e indicador
  let currentY = headerY + 46
  const fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  for (const para of paragraphs) {
    for (let lIdx = 0; lIdx < para.lines.length; lIdx++) {
      const line = para.lines[lIdx]
      if (!line.text) {
        currentY += para.lineHeight
        continue
      }

      ctx.save()
      const isHeader = !!line.isHeader
      const isBold = line.isBold || isHeader
      const isItalic = line.isItalic

      const fontSize = isHeader ? 22 : 18
      ctx.font = `${isBold ? 'bold ' : ''}${isItalic ? 'italic ' : ''}${fontSize}px ${fontFamily}`

      if (isHeader) {
        ctx.fillStyle = '#065f46' // emerald-800 elegante
      } else {
        ctx.fillStyle = '#0f172a' // slate-900 legível
      }

      let textX = CONTENT_BOX.left

      if (line.isBullet) {
        // Marcador verde discreto
        ctx.fillStyle = '#059669'
        ctx.beginPath()
        ctx.arc(textX + 8, currentY - 5, 3.5, 0, Math.PI * 2)
        ctx.fill()
        textX += 24
        ctx.fillStyle = '#0f172a'
      } else if (lIdx > 0 && para.lines[0].isBullet) {
        // Continuação indentada do bullet
        textX += 24
      }

      ctx.fillText(line.text, textX, currentY)
      ctx.restore()

      currentY += para.lineHeight
    }
    currentY += para.spaceAfter
  }

  return canvas
}

/**
 * Converte um Canvas em bytes de imagem JPEG com compressão de alta qualidade
 */
export async function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality = 0.92,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error('Falha ao exportar canvas para Blob'))
        const arrayBuffer = await blob.arrayBuffer()
        resolve(new Uint8Array(arrayBuffer))
      },
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Gera o documento completo (PDF com 1 ou mais páginas)
 * Retorna os bytes binários do PDF, o Blob e os canvases das páginas para prévia
 */
export async function generatePrescriptionDocument(data: PrescriptionDocData): Promise<{
  pdfBytes: Uint8Array
  pdfBlob: Blob
  pageCanvases: HTMLCanvasElement[]
  totalPages: number
}> {
  // 1. Cria canvas temporário para medir fontes e calcular paginação precisa
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('Não foi possível inicializar contexto de medição')

  // Altura útil da área interna subtraindo cabeçalho da receita (header + divisória + margem + indicador = ~85px)
  const usableHeight = CONTENT_BOX.height - 85
  const pagesParagraphs = paginatePrescriptionContent(
    measureCtx,
    data.content || 'Sem prescrição informada.',
    CONTENT_BOX.width - 10,
    usableHeight,
  )

  const totalPages = pagesParagraphs.length
  const pageCanvases: HTMLCanvasElement[] = []
  const jpegBytesList: Uint8Array[] = []

  // 2. Renderiza cada página no modelo timbrado
  for (let i = 0; i < totalPages; i++) {
    const canvas = await renderPrescriptionPageToCanvas(data, pagesParagraphs[i], i + 1, totalPages)
    pageCanvases.push(canvas)
    const jpegBytes = await canvasToJpegBytes(canvas)
    jpegBytesList.push(jpegBytes)
  }

  // 3. Monta o PDF binário multi-página A4
  const pdfBytes = buildPdfFromJpegImages(jpegBytesList)
  const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })

  return {
    pdfBytes,
    pdfBlob,
    pageCanvases,
    totalPages,
  }
}

/**
 * Abre a janela/iframe de impressão isolada com alta fidelidade sem cabeçalhos do navegador
 */
export async function printPrescriptionDocument(pageCanvases: HTMLCanvasElement[]): Promise<void> {
  const printIframe = document.createElement('iframe')
  printIframe.style.position = 'fixed'
  printIframe.style.right = '0'
  printIframe.style.bottom = '0'
  printIframe.style.width = '0'
  printIframe.style.height = '0'
  printIframe.style.border = '0'
  printIframe.style.visibility = 'hidden'

  document.body.appendChild(printIframe)

  const iframeDoc = printIframe.contentWindow?.document
  if (!iframeDoc || !printIframe.contentWindow) {
    document.body.removeChild(printIframe)
    throw new Error('Não foi possível inicializar ambiente isolado de impressão')
  }

  const imagesHtml = pageCanvases
    .map(
      (c, idx) =>
        `<div class="page-container ${idx > 0 ? 'page-break' : ''}">
          <img src="${c.toDataURL('image/jpeg', 0.95)}" class="page-img" alt="Página ${idx + 1}" />
        </div>`,
    )
    .join('\n')

  iframeDoc.open()
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Imprimir Receituário</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 100%;
            height: 100%;
            background: #ffffff;
          }
          .page-container {
            width: 100vw;
            height: 100vh;
            page-break-inside: avoid;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .page-break {
            page-break-before: always;
          }
          @media print {
            html, body {
              width: 210mm;
              height: 297mm;
            }
            .page-container {
              width: 210mm;
              height: 297mm;
            }
          }
          .page-img {
            width: 100%;
            height: 100%;
            object-fit: fill;
            display: block;
          }
        </style>
      </head>
      <body>
        ${imagesHtml}
      </body>
    </html>
  `)
  iframeDoc.close()

  // Aguarda carregamento das imagens no iframe antes de chamar print()
  await new Promise((res) => setTimeout(res, 350))

  try {
    printIframe.contentWindow.focus()
    printIframe.contentWindow.print()
  } finally {
    // Remove o iframe após o diálogo de impressão fechar
    setTimeout(() => {
      if (document.body.contains(printIframe)) {
        document.body.removeChild(printIframe)
      }
    }, 2000)
  }
}

/**
 * Medidas físicas do talão timbrado fornecidas pela clínica:
 * Folha de 20cm (200mm) de largura x 28,5cm (285mm) de altura (retrato).
 * Área útil: começa a 6cm (60mm) da borda superior e vai até 22cm (220mm) -> 16cm (160mm) de altura útil.
 * Horizontal: margem esquerda de 1,5cm (15mm) até 18,5cm -> 17cm (170mm) de largura útil.
 */
export const PRE_PRINTED_SHEET = {
  widthMm: 200,
  heightMm: 285,
  marginTopMm: 60,
  marginLeftMm: 15,
  contentWidthMm: 170,
  contentHeightMm: 160,
}

/**
 * Imprime APENAS o texto da receita sobre o papel timbrado já carregado na impressora.
 * - Tamanho da folha: 20cm x 28,5cm (@page { size: 200mm 285mm; margin: 0; })
 * - Margem superior: 6cm (60mm)
 * - Margem esquerda: 1,5cm (15mm)
 * - Largura útil: 17cm (170mm)
 * - Altura útil: 16cm (160mm)
 * - Sem fundo, sem cabeçalho/rodapé da arte
 * - Paginação idêntica ao motor existente (quando encher os 16cm, quebra para próxima folha sem cortar linha)
 */
export async function printPrescriptionOnlyText(
  data: PrescriptionDocData,
): Promise<{ totalPages: number }> {
  // Conversão de medidas: 1mm = ~3.7795px a 96 DPI
  // Largura útil: 170mm * 3.7795 = ~642.5px
  // Altura útil: 160mm * 3.7795 = ~604.7px
  const MM_TO_PX = 3.7795275591
  const availableWidthPx = PRE_PRINTED_SHEET.contentWidthMm * MM_TO_PX
  const usableHeightPx = PRE_PRINTED_SHEET.contentHeightMm * MM_TO_PX

  // Altura estimada para o bloco de identificação do paciente/tutor/data (~40px)
  const headerHeightPx = 40
  const contentUsableHeightPx = usableHeightPx - headerHeightPx

  // Medição no canvas
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('Não foi possível inicializar contexto de medição')

  const pagesParagraphs = paginatePrescriptionContent(
    measureCtx,
    data.content || 'Sem prescrição informada.',
    availableWidthPx,
    contentUsableHeightPx,
  )

  const totalPages = pagesParagraphs.length

  // Montagem do HTML das páginas
  const dateFormatted = formatPrescriptionDate(data.date)

  const pagesHtml = pagesParagraphs
    .map((paragraphs, pageIdx) => {
      const isMultiPage = totalPages > 1
      const patientUpper = (data.patientName || 'Não informado').toUpperCase()
      const tutorText = data.tutorName || ''

      const paragraphsHtml = paragraphs
        .map((para) => {
          return para.lines
            .map((line, lIdx) => {
              if (!line.text) {
                return '<div class="line blank-line">&nbsp;</div>'
              }

              const isHeader = !!line.isHeader
              const isBold = line.isBold || isHeader
              const isItalic = !!line.isItalic
              const isBullet = !!line.isBullet
              const isBulletContinuation = lIdx > 0 && !!para.lines[0]?.isBullet

              const classes = [
                'line',
                isHeader ? 'header-line' : 'body-line',
                isBold ? 'bold' : '',
                isItalic ? 'italic' : '',
                isBullet ? 'bullet-line' : '',
                isBulletContinuation ? 'bullet-continuation' : '',
              ]
                .filter(Boolean)
                .join(' ')

              const bulletDot = isBullet ? '<span class="bullet-dot">•</span>' : ''
              const textEscaped = escapeHtml(line.text)

              return `<div class="${classes}">${bulletDot}<span class="line-text">${textEscaped}</span></div>`
            })
            .join('\n')
        })
        .join('\n<div class="paragraph-spacer"></div>\n')

      return `
        <div class="sheet ${pageIdx > 0 ? 'page-break' : ''}">
          <div class="useful-area">
            <!-- Cabeçalho de Identificação (Paciente, Tutor, Data) -->
            <div class="patient-header">
              <div class="patient-info">
                <span class="patient-label">PACIENTE:</span>
                <span class="patient-name">${escapeHtml(patientUpper)}</span>
                ${
                  tutorText
                    ? `<span class="tutor-label">TUTOR:</span>
                       <span class="tutor-name">${escapeHtml(tutorText)}</span>`
                    : ''
                }
              </div>
              <div class="date-info">
                ${dateFormatted ? `<span>Data: ${escapeHtml(dateFormatted)}</span>` : ''}
                ${isMultiPage ? `<span class="page-num">Pág. ${pageIdx + 1}/${totalPages}</span>` : ''}
              </div>
            </div>
            <div class="header-divider"></div>

            <!-- Conteúdo da prescrição formatado -->
            <div class="prescription-body">
              ${paragraphsHtml}
            </div>
          </div>
        </div>
      `
    })
    .join('\n')

  const printIframe = document.createElement('iframe')
  printIframe.style.position = 'fixed'
  printIframe.style.right = '0'
  printIframe.style.bottom = '0'
  printIframe.style.width = '0'
  printIframe.style.height = '0'
  printIframe.style.border = '0'
  printIframe.style.visibility = 'hidden'

  document.body.appendChild(printIframe)

  const iframeDoc = printIframe.contentWindow?.document
  if (!iframeDoc || !printIframe.contentWindow) {
    document.body.removeChild(printIframe)
    throw new Error('Não foi possível inicializar ambiente isolado de impressão')
  }

  iframeDoc.open()
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Imprimir no Timbrado</title>
        <style>
          @page {
            size: 200mm 285mm portrait;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html, body {
            width: 200mm;
            height: 285mm;
            background: #ffffff;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #0f172a;
          }
          .sheet {
            position: relative;
            width: 200mm;
            height: 285mm;
            page-break-inside: avoid;
            background: transparent;
            overflow: hidden;
          }
          .page-break {
            page-break-before: always;
          }
          /* Área útil calibrada estritamente com as medidas do talão:
             - Topo: 6cm (60mm)
             - Esquerda: 1,5cm (15mm)
             - Largura: 17cm (170mm)
             - Altura útil: 16cm (160mm) -> termina em 22cm (220mm)
          */
          .useful-area {
            position: absolute;
            top: 60mm;
            left: 15mm;
            width: 170mm;
            height: 160mm;
            box-sizing: border-box;
            overflow: hidden;
          }
          .patient-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: 13px;
            line-height: 1.3;
            padding-bottom: 3px;
          }
          .patient-info {
            display: flex;
            gap: 6px;
            align-items: baseline;
            overflow: hidden;
          }
          .patient-label {
            font-weight: 700;
            color: #065f46;
            font-size: 12px;
          }
          .patient-name {
            font-weight: 700;
            color: #0f172a;
          }
          .tutor-label {
            font-weight: 700;
            color: #065f46;
            font-size: 11px;
            margin-left: 8px;
          }
          .tutor-name {
            color: #334155;
            font-size: 12px;
          }
          .date-info {
            display: flex;
            gap: 10px;
            font-size: 11px;
            color: #334155;
            white-space: nowrap;
          }
          .page-num {
            font-weight: 600;
            color: #047857;
          }
          .header-divider {
            height: 1px;
            background-color: #cbd5e1;
            margin-bottom: 8px;
          }
          .prescription-body {
            font-size: 13px;
            line-height: 19px;
            color: #0f172a;
          }
          .line {
            min-height: 19px;
          }
          .blank-line {
            height: 10px;
          }
          .header-line {
            font-size: 14px;
            font-weight: 700;
            color: #065f46;
            margin-top: 4px;
            margin-bottom: 2px;
          }
          .body-line {
            font-size: 13px;
          }
          .bold {
            font-weight: 700;
          }
          .italic {
            font-style: italic;
          }
          .bullet-line {
            display: flex;
            align-items: flex-start;
          }
          .bullet-dot {
            color: #059669;
            font-size: 14px;
            line-height: 19px;
            width: 14px;
            flex-shrink: 0;
            text-align: center;
          }
          .bullet-continuation {
            padding-left: 14px;
          }
          .paragraph-spacer {
            height: 5px;
          }
          @media screen {
            /* Visualização amigável de teste/inspeção caso aberto fora de print */
            body {
              background: #e2e8f0;
              padding: 20px;
            }
            .sheet {
              background: #ffffff;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              margin-bottom: 20px;
            }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `)
  iframeDoc.close()

  await new Promise((res) => setTimeout(res, 250))

  try {
    printIframe.contentWindow.focus()
    printIframe.contentWindow.print()
  } finally {
    setTimeout(() => {
      if (document.body.contains(printIframe)) {
        document.body.removeChild(printIframe)
      }
    }, 2000)
  }

  return { totalPages }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
