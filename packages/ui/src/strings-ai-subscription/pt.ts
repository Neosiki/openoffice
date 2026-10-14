import type { zh } from './zh'

export const pt = {
  aiAssistant: 'Assistente de IA',
  cardChecking: 'Verificando…',
  cardNotInstalled: 'Não instalado',
  cardSignedOut: 'Sem login',
  cardReady: 'Conectado',
  cardReadyPlan: 'Conectado · {plan}',
  cardMetered: 'Login feito, mas não com uma assinatura',
  cardMeteredAccepted: 'Em uso · cobrado por consumo',
  cardError: 'Não foi possível verificar a conexão',
  cardErrNeedsUpdate:
    'O programa {provider} neste PC é antigo demais. Atualize-o e verifique novamente.',
  cardErrTimeout: 'O programa {provider} não respondeu a tempo. Verifique novamente em instantes.',
  cardErrFailed: 'Algo deu errado ao verificar {provider}. Verifique novamente.',
  actionInstall: 'Instalar',
  actionLogin: 'Entrar',
  actionRecheck: 'Verificar novamente',
  actionAcceptMetered: 'Usar mesmo assim',
  actionInstallHelp: 'Guia oficial de instalação',
  actionOpenSettings: 'Abrir configurações',
  actionDismiss: 'Fechar',
  actionSwitchAccount: 'Entrar com outra conta',
  actionLogout: 'Sair',
  installNote:
    'O comando oficial de instalação da {vendor} é executado em uma nova janela de terminal.',
  loginNote: 'A página de login que se abre é da própria {vendor}.',
  meteredWarning: 'Isto não é uma assinatura: você paga pelo que usar.',
  meteredMeaning:
    'Este login usa uma chave de API ou uma conta de pagamento por consumo, ou não foi possível confirmar o tipo. “Usar mesmo assim” permite que a IA funcione com esta conexão, e cada solicitação é cobrada dessa conta.',
  connectTitle: 'Conecte uma IA para começar',
  connectBody:
    'A IA funciona com a assinatura do Claude ou do Codex que você já tem. Nenhuma chave de API é necessária.',
  connectProviderTitle: 'A conexão {provider} não pode ser usada agora',
  connectKeyBody:
    'A configuração de {provider} não foi concluída. Conclua-a nas Configurações ou escolha outra IA.',
  errNotConnected:
    'Nenhuma IA está conectada. Conecte primeiro uma assinatura do Claude ou do Codex, ou uma IA gratuita.',
  errNotInstalled: 'O programa {provider} não foi encontrado neste PC.',
  errSignedOut: 'O login em {provider} expirou. Entre novamente para continuar.',
  errRateLimit: 'O limite da assinatura {provider} foi atingido.',
  errRateLimitReset:
    'O limite da assinatura {provider} foi atingido. Ele será redefinido às {time}.',
  errUnsafeTools:
    'O programa {provider} foi iniciado com as próprias ferramentas ativadas, então a execução foi interrompida por segurança.',
  errMeteredNotAccepted:
    'A conexão {provider} é cobrada por consumo e você ainda não a permitiu. Escolha “Usar mesmo assim” nas configurações de conexão para usá-la.',
  errNeedsUpdate:
    'O programa {provider} é antigo demais para este recurso. Atualize-o e tente novamente.',
  errHeadlessLimit: 'O limite por hora de solicitações automáticas foi atingido.',
  errHeadlessLimitReset:
    'O limite por hora de solicitações automáticas foi atingido. Elas voltam a ser possíveis às {time}.',
  connectFreeHint:
    'Não tem assinatura? Você pode conectar uma IA gratuita nas Configurações em cerca de um minuto.',
  actionConnectFree: 'Conectar uma IA gratuita',
  errFreeLimit:
    'O uso gratuito de hoje acabou. Tente novamente amanhã ou escolha outra IA nas Configurações.',
  errFreeLimitReset: 'O uso gratuito de hoje acabou. Você poderá usá-lo novamente às {time}.',
  continueWith: 'Continuar com {provider}',
  continueMeteredNote:
    'A conexão {provider} não é uma assinatura: continuar é cobrado por consumo.',
  usageLine: '{percent}% usado · redefine às {time}',
  usageWindowFiveHour: 'Limite de 5 horas',
  usageWindowSevenDay: 'Limite de 7 dias',
  noticeTitle: 'Antes de usar a IA com a sua assinatura',
  noticeSend:
    'O conteúdo do documento e a sua conversa são enviados à Anthropic ou à OpenAI pela sua própria conta.',
  noticeTraining:
    'Se esse conteúdo é usado para treinar IA depende das configurações da sua própria conta nessa empresa.',
  noticeCodexHistory:
    'Este aplicativo desativa o salvamento do histórico de conversas do Codex, mas o Codex ainda pode manter seus próprios registros de diagnóstico neste PC.',
  noticeAck: 'Entendi',
  codexNotice:
    'Usar uma assinatura do Codex dentro de um aplicativo não é um método oficialmente recomendado pela OpenAI.',
  truncatedNotice: 'A entrada era longa demais, então parte dela foi cortada antes do envio.',
  pickerAuto: 'Automático',
  pickerAutoUsing: 'Automático · {provider}',
  pickerAutoUsingModel: 'Automático · {provider} · {model}',
  pickerDefaultModel: 'Modelo padrão',
  pickerDefaultModelNamed: 'Modelo padrão · {model}',
  pickerSubscription: 'Assinatura',
  pickerPaid: 'Pago',
  pickerPaidTitle: 'Cobrado por consumo, não coberto por assinatura',
  pickerNotConnected: 'Conectar IA',
} satisfies Record<keyof typeof zh, string>
