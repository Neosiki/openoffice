import type { zh } from './zh'

export const ar = {
  aiAssistant: 'مساعد الذكاء الاصطناعي',
  cardChecking: 'جارٍ التحقق…',
  cardNotInstalled: 'غير مثبَّت',
  cardSignedOut: 'لم يتم تسجيل الدخول',
  cardSigningIn: 'جارٍ تسجيل الدخول…',
  cardReady: 'متصل',
  cardReadyPlan: 'متصل · {plan}',
  cardMetered: 'تم تسجيل الدخول، لكن ليس عبر اشتراك',
  cardMeteredAccepted: 'قيد الاستخدام · الرسوم حسب الاستخدام',
  cardError: 'تعذّر التحقق من الاتصال',
  cardErrNeedsUpdate: 'برنامج {provider} على هذا الحاسوب قديم جدًا. حدّثه ثم تحقق مرة أخرى.',
  cardErrNeedsUpdateVersion:
    'برنامج {provider} على هذا الحاسوب ({version}) قديم جدًا، ويلزم الإصدار {minimum} أو أحدث. شغّل {command} في الطرفية ثم تحقق مرة أخرى.',
  cardErrTimeout: 'لم يستجب برنامج {provider} في الوقت المحدد. تحقق مرة أخرى بعد قليل.',
  cardErrFailed: 'حدث خطأ أثناء التحقق من {provider}. تحقق مرة أخرى.',
  actionInstall: 'تثبيت',
  actionLogin: 'تسجيل الدخول',
  actionLoginWindow: 'لم يُفتح المتصفح، أو يعرض رمزًا؟',
  actionRecheck: 'التحقق مرة أخرى',
  actionAcceptMetered: 'استخدام على أي حال',
  actionInstallHelp: 'دليل التثبيت الرسمي',
  actionOpenSettings: 'فتح الإعدادات',
  actionDismiss: 'إغلاق',
  actionSwitchAccount: 'تسجيل الدخول بحساب آخر',
  actionLogout: 'تسجيل الخروج',
  installNote: 'سيُنفَّذ أمر التثبيت الرسمي من {vendor} في نافذة طرفية جديدة.',
  loginNote: 'صفحة تسجيل الدخول التي ستُفتح تابعة لشركة {vendor}.',
  signingInBrowserNote:
    'سجّل الدخول إلى حسابك في {vendor} في المتصفح الذي فُتح، ثم اسمح بالوصول. سيتم الاتصال تلقائيًا عند الانتهاء.',
  signingInWindowNote:
    'إذا عرض المتصفح رمزًا، فانسخه والصقه في النافذة التي فُتحت للتو، ثم اضغط Enter.',
  meteredWarning: 'هذا ليس اشتراكًا: تُحتسب الرسوم بحسب ما تستخدمه.',
  meteredMeaning:
    'يستخدم هذا التسجيل مفتاح API أو حسابًا يُدفع فيه حسب الاستخدام، أو تعذّر تأكيد نوعه. عند اختيار «استخدام على أي حال» يعمل الذكاء الاصطناعي عبر هذا الاتصال، وتُحتسب تكلفة كل طلب على ذلك الحساب.',
  connectTitle: 'اربط ذكاءً اصطناعيًا للبدء',
  connectBody:
    'يعمل الذكاء الاصطناعي باشتراك Claude أو Codex الذي لديك بالفعل. لا حاجة إلى مفتاح API.',
  connectProviderTitle: 'اتصال {provider} غير متاح للاستخدام حاليًا',
  connectKeyBody: 'لم يكتمل إعداد {provider} بعد. أكمله في الإعدادات، أو اختر ذكاءً اصطناعيًا آخر.',
  errNotConnected:
    'لا يوجد ذكاء اصطناعي متصل. اربط أولًا اشتراك Claude أو Codex، أو ذكاءً اصطناعيًا مجانيًا.',
  errNotInstalled: 'لم يُعثر على برنامج {provider} على هذا الحاسوب.',
  errSignedOut: 'انتهت صلاحية تسجيل الدخول إلى {provider}. سجّل الدخول مجددًا للمتابعة.',
  errRateLimit: 'تم استنفاد حد اشتراك {provider}.',
  errRateLimitReset: 'تم استنفاد حد اشتراك {provider}. سيُعاد تعيينه في {time}.',
  errUnsafeTools:
    'بدأ برنامج {provider} وأدواته الخاصة مفعَّلة، لذلك أُوقف التشغيل حفاظًا على الأمان.',
  errMeteredNotAccepted:
    'اتصال {provider} تُحتسب رسومه حسب الاستخدام ولم تسمح به بعد. اختر «استخدام على أي حال» في إعدادات الاتصال لاستخدامه.',
  errNeedsUpdate: 'برنامج {provider} قديم جدًا لهذه الميزة. حدّثه ثم حاول مرة أخرى.',
  errHeadlessLimit: 'تم بلوغ الحد الأقصى للطلبات التلقائية في الساعة.',
  errHeadlessLimitReset:
    'تم بلوغ الحد الأقصى للطلبات التلقائية في الساعة. يمكن إرسال الطلبات مجددًا في {time}.',
  connectFreeHint: 'ليس لديك اشتراك؟ يمكنك ربط ذكاء اصطناعي مجاني من الإعدادات في نحو دقيقة.',
  actionConnectFree: 'ربط ذكاء اصطناعي مجاني',
  errFreeLimit:
    'نفد رصيد الاستخدام المجاني لهذا اليوم. حاول مجددًا غدًا، أو اختر ذكاءً اصطناعيًا آخر في الإعدادات.',
  errFreeLimitReset: 'نفد رصيد الاستخدام المجاني لهذا اليوم. يمكنك استخدامه مجددًا في {time}.',
  continueWith: 'المتابعة باستخدام {provider}',
  continueMeteredNote: 'اتصال {provider} ليس اشتراكًا: المتابعة تُحتسب رسومها حسب الاستخدام.',
  usageLine: 'تم استخدام {percent}% · إعادة التعيين في {time}',
  usageWindowFiveHour: 'حد 5 ساعات',
  usageWindowSevenDay: 'حد 7 أيام',
  noticeTitle: 'قبل استخدام الذكاء الاصطناعي باشتراكك',
  noticeSend: 'يُرسَل محتوى المستند ومحادثتك إلى Anthropic أو OpenAI عبر حسابك الشخصي.',
  noticeTraining:
    'استخدام هذا المحتوى في تدريب الذكاء الاصطناعي تحدده إعدادات حسابك لدى تلك الشركة.',
  noticeCodexHistory:
    'يوقف هذا التطبيق حفظ سجل المحادثات في Codex، لكن Codex قد يحتفظ بسجلاته التشخيصية الخاصة على هذا الحاسوب.',
  noticePdfWholeDocument:
    'في محرر PDF، قد ترسل قراءة الصفحات بالذكاء الاصطناعي وترجمة المستندات صور الصفحات والنص الكامل للمستند.',
  noticeAck: 'فهمت',
  codexNotice: 'استخدام اشتراك Codex داخل تطبيق ليس طريقة موصى بها رسميًا من OpenAI.',
  truncatedNotice: 'كان الإدخال طويلًا جدًا، لذا اقتُطع جزء منه قبل الإرسال.',
  pickerAuto: 'تلقائي',
  pickerAutoUsing: 'تلقائي · {provider}',
  pickerAutoUsingModel: 'تلقائي · {provider} · {model}',
  pickerDefaultModel: 'النموذج الافتراضي',
  pickerDefaultModelNamed: 'النموذج الافتراضي · {model}',
  pickerSubscription: 'اشتراك',
  pickerPaid: 'مدفوع',
  pickerPaidTitle: 'الرسوم حسب الاستخدام وغير مشمولة بالاشتراك',
  pickerNotConnected: 'ربط الذكاء الاصطناعي',
} satisfies Record<keyof typeof zh, string>
