export interface EnvEntry {
  key: string
  value: string
  annotations: Annotations
  comment: string
}

export interface Annotations {
  type?: string // @type: url | enum(a,b,c) | number[] ...
  optional?: boolean // @optional
  default?: string // @default: foo
  description?: string // @desc: some description
}

const ANNOTATION_RE = /^#\s*@(\w+)(?::\s*(.+))?$/

function parseAnnotations(lines: string[]): Annotations {
  const ann: Annotations = {}
  for (const line of lines) {
    const m = line.match(ANNOTATION_RE)
    if (!m) continue
    const [, key, value] = m
    if (key === 'optional') ann.optional = true
    else if (key === 'type' && value) ann.type = value.trim()
    else if (key === 'default' && value) ann.default = value.trim()
    else if (key === 'desc' && value) ann.description = value.trim()
  }
  return ann
}

export function parseEnvFile(content: string): EnvEntry[] {
  const lines = content.split('\n')
  const entries: EnvEntry[] = []
  const pendingComments: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim()

    if (raw === '') {
      pendingComments.length = 0
      continue
    }

    if (raw.startsWith('#')) {
      pendingComments.push(raw)
      continue
    }

    const eqIdx = raw.indexOf('=')
    if (eqIdx === -1) continue

    const key = raw.slice(0, eqIdx).trim()
    let value = raw.slice(eqIdx + 1).trim()

    // 去除引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    const annotations = parseAnnotations(pendingComments)
    const description = pendingComments
      .filter((l) => !ANNOTATION_RE.test(l))
      .map((l) => l.replace(/^#\s*/, ''))
      .join(' ')
      .trim()

    entries.push({ key, value, annotations: { ...annotations, description: description || undefined }, comment: '' })
    pendingComments.length = 0
  }

  return entries
}
