/**
 * Minimal zero-dependency PDF generator that creates valid PDF-1.4 binary files.
 * Supports embedding JPEG images (via /DCTDecode pass-through) and multiple A4 pages.
 */

interface PDFObject {
  id: number
  dict: Record<string, any>
  stream: Uint8Array | null
}

class Ref {
  id: number
  constructor(id: number) {
    this.id = id
  }
}

function serialize(val: any): string {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') {
    return Number.isInteger(val) ? String(val) : val.toFixed(4).replace(/\.?0+$/, '')
  }
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return '[' + val.map(serialize).join(' ') + ']'
  if (val instanceof Ref) return `${val.id} 0 R`
  if (typeof val === 'object') {
    const pairs = Object.entries(val)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `/${k} ${serialize(v)}`)
    return '<<\n' + pairs.join('\n') + '\n>>'
  }
  return String(val)
}

function parseJpegDimensions(bytes: Uint8Array): {
  width: number
  height: number
  colorSpace: string
} {
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('Formato JPEG inválido (SOI não encontrado)')
  }
  let i = 2
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) {
      i++
      continue
    }
    const marker = bytes[i + 1]
    if (marker === 0xda) break // SOS — início dos dados comprimidos
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (isSof) {
      if (i + 9 >= bytes.length) break
      const height = (bytes[i + 5] << 8) | bytes[i + 6]
      const width = (bytes[i + 7] << 8) | bytes[i + 8]
      const c = bytes[i + 9]
      if (width && height) {
        return {
          width,
          height,
          colorSpace: c === 1 ? '/DeviceGray' : c === 4 ? '/DeviceCMYK' : '/DeviceRGB',
        }
      }
    }
    if (i + 3 >= bytes.length) break
    const len = (bytes[i + 2] << 8) | bytes[i + 3]
    i += 2 + len
  }
  throw new Error('Dimensões do JPEG não encontradas')
}

/**
 * Cria um arquivo PDF binário contendo 1 ou mais páginas A4,
 * cada página sendo uma imagem JPEG de página inteira.
 * A4 em pontos (pt): 595.28 x 841.89
 */
export function buildPdfFromJpegImages(
  jpegBytesArray: Uint8Array[],
  pageWidthPt = 595.28,
  pageHeightPt = 841.89,
): Uint8Array {
  if (!jpegBytesArray || jpegBytesArray.length === 0) {
    throw new Error('Nenhuma imagem fornecida para compor o PDF')
  }

  const objects: PDFObject[] = []
  const pagesRefs: Ref[] = []
  let nextId = 1

  function addObject(dict: Record<string, any>, streamBytes: Uint8Array | null = null): Ref {
    const id = nextId++
    objects.push({ id, dict, stream: streamBytes })
    return new Ref(id)
  }

  for (let idx = 0; idx < jpegBytesArray.length; idx++) {
    const jpegBytes = jpegBytesArray[idx]
    const { width: imgW, height: imgH, colorSpace } = parseJpegDimensions(jpegBytes)

    // Adiciona o XObject da imagem JPEG
    const imgRef = addObject(
      {
        Type: '/XObject',
        Subtype: '/Image',
        Width: imgW,
        Height: imgH,
        ColorSpace: colorSpace,
        BitsPerComponent: 8,
        Filter: '/DCTDecode',
        Length: jpegBytes.length,
      },
      jpegBytes,
    )

    // Stream de desenho da imagem ocupando a página A4 inteira
    // PDF coordinates: (0,0) is bottom-left, (pageWidthPt, pageHeightPt) is top-right
    const contentOps = [
      'q',
      `${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(2)} 0 0 cm`,
      `/Im0 Do`,
      'Q',
    ].join('\n')

    const contentBytes = new TextEncoder().encode(contentOps)
    const contentRef = addObject({ Length: contentBytes.length }, contentBytes)

    const pageRef = addObject({
      Type: '/Page',
      Parent: null, // será preenchido
      MediaBox: [0, 0, pageWidthPt, pageHeightPt],
      Contents: contentRef,
      Resources: {
        XObject: {
          Im0: imgRef,
        },
      },
    })
    pagesRefs.push(pageRef)
  }

  const pagesParentRef = addObject({
    Type: '/Pages',
    Kids: pagesRefs,
    Count: pagesRefs.length,
  })

  for (const obj of objects) {
    if (obj.dict.Type === '/Page') {
      obj.dict.Parent = pagesParentRef
    }
  }

  const catalogRef = addObject({
    Type: '/Catalog',
    Pages: pagesParentRef,
  })

  // Montagem do arquivo binário e tabela XREF
  const enc = new TextEncoder()
  const offsets: number[] = []
  const chunks: Uint8Array[] = []
  let byteOffset = 0

  function emit(data: Uint8Array) {
    chunks.push(data)
    byteOffset += data.length
  }

  const header = enc.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')
  emit(header)

  for (const obj of objects) {
    offsets[obj.id] = byteOffset
    const head = `${obj.id} 0 obj\n${serialize(obj.dict)}\n`
    if (obj.stream) {
      const a = enc.encode(head + 'stream\n')
      const b = obj.stream
      const c = enc.encode('\nendstream\nendobj\n')
      emit(a)
      emit(b)
      emit(c)
    } else {
      const bytes = enc.encode(head + 'endobj\n')
      emit(bytes)
    }
  }

  const xrefOffset = byteOffset
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
  }
  xref += `trailer\n${serialize({ Size: objects.length + 1, Root: catalogRef })}\n`
  xref += `startxref\n${xrefOffset}\n%%EOF\n`
  emit(enc.encode(xref))

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const result = new Uint8Array(totalLength)
  let pos = 0
  for (const chunk of chunks) {
    result.set(chunk, pos)
    pos += chunk.length
  }
  return result
}
