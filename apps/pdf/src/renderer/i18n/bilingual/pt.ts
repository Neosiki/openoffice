import type { zh } from './zh'

export const pt = {
  blToggle: 'Tradução lado a lado',
  blToggleTip:
    'Mostra a tradução salva ao lado de cada página. Ativar isto não envia nada para uma IA.',
  blLanguage: 'Idioma da tradução',
  blStoredLangs: 'Traduções salvas',
  blOtherLangs: 'Outros idiomas',
  blLoading: 'Lendo a estrutura do documento… ({done}/{total} páginas)',
  blLoadingStart: 'Lendo a estrutura do documento…',
  blFailed:
    'Não foi possível ler a estrutura do documento, por isso a coluna de tradução não pode ser exibida.',
  blUnavailable:
    'A coluna de tradução não está disponível: o arquivo não está salvo ou esta janela não consegue ler a estrutura do documento.',
  blUnsavedPages: 'Salve para alinhar a coluna de tradução com as páginas',
  blContinued: 'Continua da página anterior',
  blCollapseAsk: 'Recolher a coluna de tradução?',
  blCollapse: 'Recolher',
  blKeep: 'Manter',
  blExpand: 'Expandir a coluna de tradução',
  blFontSmaller: 'Texto da tradução menor',
  blFontLarger: 'Texto da tradução maior',
  blResize: 'Ajustar a largura da coluna de tradução',
  blClose: 'Desativar a tradução lado a lado',
  blPageHeader: 'Página {page}',
  blPageCount: 'Traduzido {translated}/{units}',
  blNoText: 'Esta página não tem texto para traduzir.',
  blPendingTip: 'Ainda não traduzido (texto original).',
  blFailedTip: 'Não foi possível traduzir este parágrafo (texto original).',
  blEditedTip: 'Tradução editada por uma pessoa.',
} satisfies Record<keyof typeof zh, string>
