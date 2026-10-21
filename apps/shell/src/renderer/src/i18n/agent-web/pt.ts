import type { zh } from './zh'

export const pt = {
  actWebSearch: 'Pesquisa na web',
  actWebFetch: 'Ler página web',
  permWebSearch: 'Pesquisar na web',
  permWebFetch: 'Ler esta página web',
  permAllowSearchSession: 'Permitir pesquisas nesta sessão',
  permAllowSiteSession: 'Permitir este site nesta sessão',
  codexWebLabel: 'Pesquisa na web',
  codexWebCached: 'Resultados guardados',
  codexWebLive: 'Em tempo real',
  codexWebDisabled: 'Desligada',
  codexWebNote:
    'Os resultados guardados vêm de conteúdo web recolhido previamente; «Em tempo real» pesquisa a web tal como está agora.',
  codexNetworkLabel: 'Acesso à internet dos comandos',
  codexNetworkOff: 'Desligado',
  codexNetworkOn: 'Ligado',
  codexNetworkWarning:
    'Quando ligado, os comandos que o Codex executa podem aceder à internet. Com «Confiar neste projeto», acedem sem perguntar. Instruções ocultas num documento recebido podem levá-los a enviar os seus dados para fora.',
  codexFolderNote: 'Estas duas definições são memorizadas para cada pasta de projeto.',
  providerCodexNoteWeb:
    'Os comandos são executados no espaço isolado do Codex: só a pasta do projeto pode ser alterada, e não há acesso à internet a menos que o ligue.',
} satisfies Record<keyof typeof zh, string>
