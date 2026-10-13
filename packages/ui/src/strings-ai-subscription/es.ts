import type { zh } from './zh'

export const es = {
  aiAssistant: 'Asistente de IA',
  cardChecking: 'Comprobando…',
  cardNotInstalled: 'No instalado',
  cardSignedOut: 'Sesión no iniciada',
  cardReady: 'Conectado',
  cardReadyPlan: 'Conectado · {plan}',
  cardMetered: 'Sesión iniciada, pero no con una suscripción',
  cardMeteredAccepted: 'En uso · se cobra por consumo',
  cardError: 'No se pudo comprobar la conexión',
  cardErrNeedsUpdate:
    'El programa {provider} de este PC es demasiado antiguo. Actualízalo y comprueba de nuevo.',
  cardErrTimeout: 'El programa {provider} no respondió a tiempo. Comprueba de nuevo en un momento.',
  cardErrFailed: 'Algo salió mal al comprobar {provider}. Comprueba de nuevo.',
  actionInstall: 'Instalar',
  actionLogin: 'Iniciar sesión',
  actionRecheck: 'Comprobar de nuevo',
  actionAcceptMetered: 'Usar de todos modos',
  actionInstallHelp: 'Guía oficial de instalación',
  actionOpenSettings: 'Abrir ajustes',
  actionDismiss: 'Cerrar',
  installNote:
    'El comando de instalación oficial de {vendor} se ejecuta en una nueva ventana de terminal.',
  loginNote: 'La página de inicio de sesión que se abre es la de {vendor}.',
  meteredWarning: 'Esto no es una suscripción: se cobra según lo que uses.',
  meteredMeaning:
    'Este inicio de sesión usa una clave de API o una cuenta de pago por consumo, o no se pudo confirmar su tipo. «Usar de todos modos» permite que la IA funcione con esta conexión, y cada solicitud se factura a esa cuenta.',
  connectTitle: 'Conecta una suscripción para usar la IA',
  connectBody:
    'La IA funciona con la suscripción de Claude o Codex que ya tienes. No hace falta ninguna clave de API.',
  connectProviderTitle: 'La conexión de {provider} no se puede usar ahora',
  connectKeyBody:
    'La configuración de {provider} no está terminada. Complétala en Ajustes o elige otra IA.',
  errNotConnected:
    'No hay ninguna IA conectada. Conecta primero una suscripción de Claude o Codex.',
  errNotInstalled: 'No se encontró el programa {provider} en este PC.',
  errSignedOut: 'La sesión de {provider} ha caducado. Vuelve a iniciar sesión para continuar.',
  errRateLimit: 'Se ha agotado el límite de la suscripción de {provider}.',
  errRateLimitReset:
    'Se ha agotado el límite de la suscripción de {provider}. Se restablece a las {time}.',
  errUnsafeTools:
    'El programa {provider} se inició con sus propias herramientas activadas, así que la ejecución se detuvo por seguridad.',
  errMeteredNotAccepted:
    'La conexión de {provider} es de pago por consumo y aún no la has permitido. Elige «Usar de todos modos» en los ajustes de conexión para usarla.',
  errNeedsUpdate:
    'El programa {provider} es demasiado antiguo para esta función. Actualízalo y vuelve a intentarlo.',
  errHeadlessLimit: 'Se alcanzó el límite por hora de solicitudes automáticas.',
  errHeadlessLimitReset:
    'Se alcanzó el límite por hora de solicitudes automáticas. Volverán a ser posibles a las {time}.',
  continueWith: 'Continuar con {provider}',
  continueMeteredNote:
    'La conexión de {provider} no es una suscripción: continuar se cobra por consumo.',
  usageLine: '{percent} % usado · se restablece a las {time}',
  usageWindowFiveHour: 'Límite de 5 horas',
  usageWindowSevenDay: 'Límite de 7 días',
  noticeTitle: 'Antes de usar la IA con tu suscripción',
  noticeSend:
    'El contenido del documento y tu conversación se envían a Anthropic u OpenAI con tu propia cuenta.',
  noticeTraining:
    'Que ese contenido se use para entrenar IA depende de los ajustes de tu propia cuenta en esa empresa.',
  noticeCodexHistory:
    'Esta aplicación desactiva el guardado del historial de conversaciones de Codex, pero Codex puede seguir guardando sus propios registros de diagnóstico en este PC.',
  noticeAck: 'Entendido',
  codexNotice:
    'Usar una suscripción de Codex dentro de una aplicación no es un método recomendado oficialmente por OpenAI.',
  truncatedNotice:
    'La entrada era demasiado larga, así que se recortó una parte antes de enviarla.',
  pickerAuto: 'Automático',
  pickerAutoUsing: 'Automático · {provider}',
  pickerDefaultModel: 'Modelo predeterminado',
  pickerSubscription: 'Suscripción',
  pickerPaid: 'De pago',
  pickerPaidTitle: 'Se cobra por consumo, no lo cubre una suscripción',
  pickerNotConnected: 'Conectar IA',
} satisfies Record<keyof typeof zh, string>
