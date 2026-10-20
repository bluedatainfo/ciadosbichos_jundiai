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
