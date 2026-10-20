import { createI18n, defineStrings, type Lang } from '@genoffice/i18n'

/**
 * Names of the skills shipped with the app (apps/shell/resources/builtin-skills).
 * Must match the "name" entries of builtin-skills.json there.
 */
export const BUILTIN_SKILL_NAMES = [
  'meeting-minutes',
  'internal-comms',
  'humanizer',
  'copy-editing',
  'find-skills',
] as const

export type BuiltinSkillName = (typeof BUILTIN_SKILL_NAMES)[number]

const zh = {
  'builtinSkillTitle.meeting-minutes': '整理会议纪要',
  'builtinSkillDesc.meeting-minutes': '把会议记录整理成列明决定事项和待办事项的会议纪要。',
  'builtinSkillTitle.internal-comms': '撰写公告、简报和常见问题',
  'builtinSkillDesc.internal-comms': '撰写公告、内部简报、进展汇报、常见问题解答等组织内部的文字。',
  'builtinSkillTitle.humanizer': '去除 AI 痕迹（以英文文本为准）',
  'builtinSkillDesc.humanizer':
    '找出英文文本中带有 AI 痕迹的表达，在不改变内容的前提下改得更自然。',
  'builtinSkillTitle.copy-editing': '润色文字（以英文文本为准）',
  'builtinSkillDesc.copy-editing': '把已经写好的英文文本逐遍检查，改得更清楚、更简洁。',
  'builtinSkillTitle.find-skills': '查找技能',
  'builtinSkillDesc.find-skills': '仅在智能体窗口中可用，需要联网，用来查找所需技能并建议安装。',
}

/**
 * Display title and one-line description of each built-in skill, shared by the
 * shell (Settings → Skills) and the editors' AI panel skill list. Keys are
 * `builtinSkillTitle.<name>` and `builtinSkillDesc.<name>`; `zh` defines the key set.
 */
export const BUILTIN_SKILL_STRINGS = defineStrings({
  zh,
  en: {
    'builtinSkillTitle.meeting-minutes': 'Meeting minutes',
    'builtinSkillDesc.meeting-minutes':
      'Turns meeting notes into minutes that show the decisions and action items.',
    'builtinSkillTitle.internal-comms': 'Announcements, newsletters and FAQs',
    'builtinSkillDesc.internal-comms':
      'Writes announcements, newsletters, progress updates, FAQs and other internal messages.',
    'builtinSkillTitle.humanizer': 'Remove the AI feel (English text)',
    'builtinSkillDesc.humanizer':
      'Finds phrasing that sounds AI-written in English text and makes it natural without changing what it says.',
    'builtinSkillTitle.copy-editing': 'Copy editing (English text)',
    'builtinSkillDesc.copy-editing':
      'Goes over English text you have already written and makes it clearer and tighter.',
    'builtinSkillTitle.find-skills': 'Find skills',
    'builtinSkillDesc.find-skills':
      'Works only in the agent window and needs internet access to find skills and suggest installing them.',
  },
  ja: {
    'builtinSkillTitle.meeting-minutes': '議事録をまとめる',
    'builtinSkillDesc.meeting-minutes':
      '会議のメモを、決定事項とやることが分かる議事録にまとめます。',
    'builtinSkillTitle.internal-comms': 'お知らせ・社内報・FAQ を書く',
    'builtinSkillDesc.internal-comms':
      'お知らせ、社内報、進捗報告、よくある質問など、組織内の文章を書きます。',
    'builtinSkillTitle.humanizer': 'AI っぽさを消す（英語の文章向け）',
    'builtinSkillDesc.humanizer':
      '英語の文章から AI が書いたように見える表現を探し、内容を変えずに自然に直します。',
    'builtinSkillTitle.copy-editing': '文章を磨く（英語の文章向け）',
    'builtinSkillDesc.copy-editing': '書き上げた英語の文章を何度か見直し、より明確で簡潔にします。',
    'builtinSkillTitle.find-skills': 'スキルを探す',
    'builtinSkillDesc.find-skills':
      'エージェントのウィンドウでのみ使え、インターネットにつないで必要なスキルを探し、インストールを提案します。',
  },
  ko: {
    'builtinSkillTitle.meeting-minutes': '회의록 정리',
    'builtinSkillDesc.meeting-minutes':
      '회의 메모를 결정 사항과 할 일이 보이는 회의록으로 정리합니다.',
    'builtinSkillTitle.internal-comms': '공지·소식지·FAQ 쓰기',
    'builtinSkillDesc.internal-comms':
      '공지, 소식지, 진행 보고, 자주 묻는 질문 같은 조직 안의 글을 씁니다.',
    'builtinSkillTitle.humanizer': 'AI 티 없애기(영어 글 기준)',
    'builtinSkillDesc.humanizer':
      '영어 글에서 AI가 쓴 티가 나는 표현을 찾아 내용은 그대로 두고 자연스럽게 고칩니다.',
    'builtinSkillTitle.copy-editing': '문장 다듬기(영어 글 기준)',
    'builtinSkillDesc.copy-editing':
      '이미 쓴 영어 글을 여러 번 훑으며 더 분명하고 간결하게 다듬습니다.',
    'builtinSkillTitle.find-skills': '스킬 찾기',
    'builtinSkillDesc.find-skills':
      '에이전트 창에서만 쓸 수 있으며, 인터넷에 연결해 필요한 스킬을 찾고 설치를 제안합니다.',
  },
  fr: {
    'builtinSkillTitle.meeting-minutes': 'Comptes rendus de réunion',
    'builtinSkillDesc.meeting-minutes':
      'Transforme les notes de réunion en compte rendu qui fait ressortir les décisions et les actions.',
    'builtinSkillTitle.internal-comms': 'Annonces, lettres d’info et FAQ',
    'builtinSkillDesc.internal-comms':
      'Rédige annonces, lettres d’information, points d’avancement, FAQ et autres messages internes.',
    'builtinSkillTitle.humanizer': 'Effacer l’effet IA (texte en anglais)',
    'builtinSkillDesc.humanizer':
      'Repère dans un texte anglais les tournures qui sonnent écrites par une IA et les rend naturelles sans changer le sens.',
    'builtinSkillTitle.copy-editing': 'Relecture du style (texte en anglais)',
    'builtinSkillDesc.copy-editing':
      'Relit en plusieurs passes un texte anglais déjà écrit pour le rendre plus clair et plus concis.',
    'builtinSkillTitle.find-skills': 'Trouver des compétences',
    'builtinSkillDesc.find-skills':
      'Fonctionne uniquement dans la fenêtre Agent et demande une connexion Internet pour trouver des compétences et proposer de les installer.',
  },
  de: {
    'builtinSkillTitle.meeting-minutes': 'Besprechungsprotokoll',
    'builtinSkillDesc.meeting-minutes':
      'Macht aus Besprechungsnotizen ein Protokoll, das Beschlüsse und Aufgaben zeigt.',
    'builtinSkillTitle.internal-comms': 'Mitteilungen, Newsletter und FAQs',
    'builtinSkillDesc.internal-comms':
      'Schreibt Mitteilungen, Newsletter, Statusberichte, FAQs und andere interne Texte.',
    'builtinSkillTitle.humanizer': 'KI-Klang entfernen (englische Texte)',
    'builtinSkillDesc.humanizer':
      'Findet in englischen Texten Formulierungen, die nach KI klingen, und macht sie natürlich, ohne den Inhalt zu ändern.',
    'builtinSkillTitle.copy-editing': 'Texte überarbeiten (englische Texte)',
    'builtinSkillDesc.copy-editing':
      'Geht einen fertigen englischen Text in mehreren Durchgängen durch und macht ihn klarer und knapper.',
    'builtinSkillTitle.find-skills': 'Skills finden',
    'builtinSkillDesc.find-skills':
      'Funktioniert nur im Agent-Fenster und braucht Internet, um Skills zu finden und ihre Installation vorzuschlagen.',
  },
  es: {
    'builtinSkillTitle.meeting-minutes': 'Actas de reunión',
    'builtinSkillDesc.meeting-minutes':
      'Convierte las notas de una reunión en un acta que muestra las decisiones y las tareas.',
    'builtinSkillTitle.internal-comms': 'Avisos, boletines y preguntas frecuentes',
    'builtinSkillDesc.internal-comms':
      'Redacta avisos, boletines, informes de avance, preguntas frecuentes y otros textos internos.',
    'builtinSkillTitle.humanizer': 'Quitar el tono de IA (texto en inglés)',
    'builtinSkillDesc.humanizer':
      'Busca en textos en inglés las expresiones que suenan escritas por una IA y las vuelve naturales sin cambiar lo que dicen.',
    'builtinSkillTitle.copy-editing': 'Pulir el texto (texto en inglés)',
    'builtinSkillDesc.copy-editing':
      'Repasa varias veces un texto en inglés ya escrito para hacerlo más claro y conciso.',
    'builtinSkillTitle.find-skills': 'Buscar habilidades',
    'builtinSkillDesc.find-skills':
      'Solo funciona en la ventana del agente y necesita internet para buscar habilidades y proponer su instalación.',
  },
  th: {
    'builtinSkillTitle.meeting-minutes': 'สรุปบันทึกการประชุม',
    'builtinSkillDesc.meeting-minutes':
      'เรียบเรียงโน้ตการประชุมเป็นบันทึกการประชุมที่เห็นข้อตัดสินใจและงานที่ต้องทำ',
    'builtinSkillTitle.internal-comms': 'เขียนประกาศ จดหมายข่าว และคำถามที่พบบ่อย',
    'builtinSkillDesc.internal-comms':
      'เขียนประกาศ จดหมายข่าว รายงานความคืบหน้า คำถามที่พบบ่อย และข้อความภายในองค์กรอื่น ๆ',
    'builtinSkillTitle.humanizer': 'ลบความรู้สึกแบบ AI (สำหรับข้อความภาษาอังกฤษ)',
    'builtinSkillDesc.humanizer':
      'หาสำนวนที่ฟังเหมือน AI เขียนในข้อความภาษาอังกฤษ แล้วปรับให้เป็นธรรมชาติโดยไม่เปลี่ยนเนื้อหา',
    'builtinSkillTitle.copy-editing': 'ขัดเกลาข้อความ (สำหรับข้อความภาษาอังกฤษ)',
    'builtinSkillDesc.copy-editing':
      'อ่านทวนข้อความภาษาอังกฤษที่เขียนไว้แล้วหลายรอบ ให้ชัดเจนและกระชับขึ้น',
    'builtinSkillTitle.find-skills': 'ค้นหาสกิล',
    'builtinSkillDesc.find-skills':
      'ใช้ได้เฉพาะในหน้าต่างเอเจนต์และต้องต่ออินเทอร์เน็ต เพื่อค้นหาสกิลและเสนอให้ติดตั้ง',
  },
  id: {
    'builtinSkillTitle.meeting-minutes': 'Notulen rapat',
    'builtinSkillDesc.meeting-minutes':
      'Mengubah catatan rapat menjadi notulen yang menampilkan keputusan dan tugas tindak lanjut.',
    'builtinSkillTitle.internal-comms': 'Pengumuman, buletin, dan FAQ',
    'builtinSkillDesc.internal-comms':
      'Menulis pengumuman, buletin, laporan kemajuan, FAQ, dan pesan internal lainnya.',
    'builtinSkillTitle.humanizer': 'Hilangkan kesan AI (teks bahasa Inggris)',
    'builtinSkillDesc.humanizer':
      'Mencari ungkapan yang terdengar ditulis AI dalam teks bahasa Inggris dan membuatnya wajar tanpa mengubah isinya.',
    'builtinSkillTitle.copy-editing': 'Merapikan tulisan (teks bahasa Inggris)',
    'builtinSkillDesc.copy-editing':
      'Memeriksa ulang teks bahasa Inggris yang sudah ditulis beberapa kali agar lebih jelas dan ringkas.',
    'builtinSkillTitle.find-skills': 'Cari skill',
    'builtinSkillDesc.find-skills':
      'Hanya berfungsi di jendela agen dan memerlukan internet untuk mencari skill serta mengusulkan pemasangannya.',
  },
  ru: {
    'builtinSkillTitle.meeting-minutes': 'Протокол встречи',
    'builtinSkillDesc.meeting-minutes':
      'Превращает заметки со встречи в протокол, где видны решения и задачи.',
    'builtinSkillTitle.internal-comms': 'Объявления, рассылки и ответы на вопросы',
    'builtinSkillDesc.internal-comms':
      'Пишет объявления, рассылки, отчёты о ходе работ, ответы на частые вопросы и другие внутренние тексты.',
    'builtinSkillTitle.humanizer': 'Убрать «почерк» ИИ (текст на английском)',
    'builtinSkillDesc.humanizer':
      'Находит в английском тексте обороты, похожие на написанные ИИ, и делает их естественными, не меняя смысла.',
    'builtinSkillTitle.copy-editing': 'Редактура текста (текст на английском)',
    'builtinSkillDesc.copy-editing':
      'Несколько раз проходит по готовому английскому тексту и делает его яснее и короче.',
    'builtinSkillTitle.find-skills': 'Поиск навыков',
    'builtinSkillDesc.find-skills':
      'Работает только в окне агента и требует интернета, чтобы найти навыки и предложить их установить.',
  },
  ar: {
    'builtinSkillTitle.meeting-minutes': 'محضر الاجتماع',
    'builtinSkillDesc.meeting-minutes':
      'يحوّل ملاحظات الاجتماع إلى محضر يبيّن القرارات والمهام المطلوبة.',
    'builtinSkillTitle.internal-comms': 'الإعلانات والنشرات والأسئلة الشائعة',
    'builtinSkillDesc.internal-comms':
      'يكتب الإعلانات والنشرات وتقارير التقدّم والأسئلة الشائعة وغيرها من الرسائل الداخلية.',
    'builtinSkillTitle.humanizer': 'إزالة طابع الذكاء الاصطناعي (للنصوص الإنجليزية)',
    'builtinSkillDesc.humanizer':
      'يبحث في النص الإنجليزي عن العبارات التي تبدو مكتوبة بالذكاء الاصطناعي ويجعلها طبيعية دون تغيير معناها.',
    'builtinSkillTitle.copy-editing': 'تحرير الأسلوب (للنصوص الإنجليزية)',
    'builtinSkillDesc.copy-editing': 'يراجع نصًا إنجليزيًا مكتوبًا عدة مرات ليجعله أوضح وأوجز.',
    'builtinSkillTitle.find-skills': 'البحث عن المهارات',
    'builtinSkillDesc.find-skills':
      'يعمل في نافذة الوكيل فقط ويحتاج إلى الإنترنت للبحث عن المهارات واقتراح تثبيتها.',
  },
  pt: {
    'builtinSkillTitle.meeting-minutes': 'Atas de reunião',
    'builtinSkillDesc.meeting-minutes':
      'Transforma anotações de reunião em uma ata que mostra as decisões e as tarefas.',
    'builtinSkillTitle.internal-comms': 'Avisos, boletins e perguntas frequentes',
    'builtinSkillDesc.internal-comms':
      'Escreve avisos, boletins, relatórios de andamento, perguntas frequentes e outros textos internos.',
    'builtinSkillTitle.humanizer': 'Tirar o tom de IA (texto em inglês)',
    'builtinSkillDesc.humanizer':
      'Encontra em textos em inglês as expressões que parecem escritas por IA e as deixa naturais sem mudar o que dizem.',
    'builtinSkillTitle.copy-editing': 'Revisar o texto (texto em inglês)',
    'builtinSkillDesc.copy-editing':
      'Revê em várias passadas um texto em inglês já escrito para deixá-lo mais claro e conciso.',
    'builtinSkillTitle.find-skills': 'Encontrar habilidades',
    'builtinSkillDesc.find-skills':
      'Funciona só na janela do agente e precisa de internet para encontrar habilidades e sugerir a instalação.',
  },
  it: {
    'builtinSkillTitle.meeting-minutes': 'Verbali di riunione',
    'builtinSkillDesc.meeting-minutes':
      'Trasforma gli appunti di una riunione in un verbale che mostra decisioni e attività.',
    'builtinSkillTitle.internal-comms': 'Avvisi, newsletter e FAQ',
    'builtinSkillDesc.internal-comms':
      'Scrive avvisi, newsletter, aggiornamenti sull’avanzamento, FAQ e altri testi interni.',
    'builtinSkillTitle.humanizer': 'Togliere l’effetto IA (testi in inglese)',
    'builtinSkillDesc.humanizer':
      'Trova nei testi in inglese le espressioni che sembrano scritte da un’IA e le rende naturali senza cambiarne il senso.',
    'builtinSkillTitle.copy-editing': 'Rifinire il testo (testi in inglese)',
    'builtinSkillDesc.copy-editing':
      'Rilegge più volte un testo in inglese già scritto per renderlo più chiaro e conciso.',
    'builtinSkillTitle.find-skills': 'Trova skill',
    'builtinSkillDesc.find-skills':
      'Funziona solo nella finestra dell’agente e richiede internet per trovare skill e proporne l’installazione.',
  },
  pl: {
    'builtinSkillTitle.meeting-minutes': 'Protokół ze spotkania',
    'builtinSkillDesc.meeting-minutes':
      'Zamienia notatki ze spotkania w protokół, w którym widać decyzje i zadania.',
    'builtinSkillTitle.internal-comms': 'Ogłoszenia, biuletyny i FAQ',
    'builtinSkillDesc.internal-comms':
      'Pisze ogłoszenia, biuletyny, raporty z postępów, FAQ i inne teksty wewnętrzne.',
    'builtinSkillTitle.humanizer': 'Usuń styl AI (tekst angielski)',
    'builtinSkillDesc.humanizer':
      'Wyszukuje w tekście angielskim sformułowania brzmiące jak pisane przez AI i czyni je naturalnymi bez zmiany treści.',
    'builtinSkillTitle.copy-editing': 'Redakcja tekstu (tekst angielski)',
    'builtinSkillDesc.copy-editing':
      'Kilka razy przechodzi przez gotowy tekst angielski, by był jaśniejszy i zwięźlejszy.',
    'builtinSkillTitle.find-skills': 'Znajdź umiejętności',
    'builtinSkillDesc.find-skills':
      'Działa tylko w oknie agenta i wymaga internetu, aby znaleźć umiejętności i zaproponować ich instalację.',
  },
  cs: {
    'builtinSkillTitle.meeting-minutes': 'Zápis z porady',
    'builtinSkillDesc.meeting-minutes':
      'Udělá z poznámek z porady zápis, ve kterém jsou vidět rozhodnutí a úkoly.',
    'builtinSkillTitle.internal-comms': 'Oznámení, zpravodaje a časté dotazy',
    'builtinSkillDesc.internal-comms':
      'Píše oznámení, zpravodaje, zprávy o postupu, časté dotazy a další interní texty.',
    'builtinSkillTitle.humanizer': 'Odstranit dojem AI (anglický text)',
    'builtinSkillDesc.humanizer':
      'Najde v anglickém textu obraty, které působí jako psané AI, a upraví je přirozeně bez změny obsahu.',
    'builtinSkillTitle.copy-editing': 'Úprava textu (anglický text)',
    'builtinSkillDesc.copy-editing':
      'Projde hotový anglický text v několika krocích a udělá ho jasnějším a stručnějším.',
    'builtinSkillTitle.find-skills': 'Najít dovednosti',
    'builtinSkillDesc.find-skills':
      'Funguje jen v okně agenta a potřebuje internet, aby našel dovednosti a navrhl jejich instalaci.',
  },
  nl: {
    'builtinSkillTitle.meeting-minutes': 'Notulen van vergaderingen',
    'builtinSkillDesc.meeting-minutes':
      'Maakt van vergaderaantekeningen notulen waarin besluiten en actiepunten zichtbaar zijn.',
    'builtinSkillTitle.internal-comms': 'Mededelingen, nieuwsbrieven en veelgestelde vragen',
    'builtinSkillDesc.internal-comms':
      'Schrijft mededelingen, nieuwsbrieven, voortgangsrapporten, veelgestelde vragen en andere interne berichten.',
    'builtinSkillTitle.humanizer': 'AI-toon verwijderen (Engelse tekst)',
    'builtinSkillDesc.humanizer':
      'Zoekt in Engelse tekst formuleringen die naar AI klinken en maakt ze natuurlijk zonder de inhoud te veranderen.',
    'builtinSkillTitle.copy-editing': 'Tekst redigeren (Engelse tekst)',
    'builtinSkillDesc.copy-editing':
      'Loopt een geschreven Engelse tekst een paar keer na en maakt hem duidelijker en bondiger.',
    'builtinSkillTitle.find-skills': 'Skills zoeken',
    'builtinSkillDesc.find-skills':
      'Werkt alleen in het agentvenster en heeft internet nodig om skills te vinden en installatie voor te stellen.',
  },
  ms: {
    'builtinSkillTitle.meeting-minutes': 'Minit mesyuarat',
    'builtinSkillDesc.meeting-minutes':
      'Menyusun nota mesyuarat menjadi minit yang menunjukkan keputusan dan tindakan susulan.',
    'builtinSkillTitle.internal-comms': 'Pengumuman, buletin dan soalan lazim',
    'builtinSkillDesc.internal-comms':
      'Menulis pengumuman, buletin, laporan kemajuan, soalan lazim dan mesej dalaman lain.',
    'builtinSkillTitle.humanizer': 'Buang kesan AI (teks bahasa Inggeris)',
    'builtinSkillDesc.humanizer':
      'Mencari ungkapan yang berbunyi seperti ditulis AI dalam teks bahasa Inggeris dan menjadikannya semula jadi tanpa mengubah maksud.',
    'builtinSkillTitle.copy-editing': 'Menyunting tulisan (teks bahasa Inggeris)',
    'builtinSkillDesc.copy-editing':
      'Menyemak teks bahasa Inggeris yang sudah ditulis beberapa kali supaya lebih jelas dan ringkas.',
    'builtinSkillTitle.find-skills': 'Cari kemahiran',
    'builtinSkillDesc.find-skills':
      'Hanya berfungsi dalam tetingkap ejen dan memerlukan internet untuk mencari kemahiran serta mencadangkan pemasangannya.',
  },
  he: {
    'builtinSkillTitle.meeting-minutes': 'סיכום פגישה',
    'builtinSkillDesc.meeting-minutes': 'הופך רשימות מפגישה לסיכום שמציג את ההחלטות ואת המשימות.',
    'builtinSkillTitle.internal-comms': 'הודעות, עלוני מידע ושאלות נפוצות',
    'builtinSkillDesc.internal-comms':
      'כותב הודעות, עלוני מידע, דיווחי התקדמות, שאלות נפוצות ושאר טקסטים פנימיים.',
    'builtinSkillTitle.humanizer': 'הסרת הרושם של AI (טקסט באנגלית)',
    'builtinSkillDesc.humanizer':
      'מאתר בטקסט באנגלית ניסוחים שנשמעים כאילו AI כתב אותם והופך אותם לטבעיים בלי לשנות את התוכן.',
    'builtinSkillTitle.copy-editing': 'עריכת לשון (טקסט באנגלית)',
    'builtinSkillDesc.copy-editing':
      'עובר כמה פעמים על טקסט באנגלית שכבר נכתב והופך אותו לבהיר ולתמציתי יותר.',
    'builtinSkillTitle.find-skills': 'חיפוש מיומנויות',
    'builtinSkillDesc.find-skills':
      'פועל רק בחלון הסוכן ודורש אינטרנט כדי למצוא מיומנויות ולהציע להתקין אותן.',
  },
  hi: {
    'builtinSkillTitle.meeting-minutes': 'बैठक का कार्यवृत्त',
    'builtinSkillDesc.meeting-minutes':
      'बैठक के नोट्स को ऐसे कार्यवृत्त में बदलता है जिसमें निर्णय और करने के काम साफ़ दिखें।',
    'builtinSkillTitle.internal-comms': 'सूचनाएँ, न्यूज़लेटर और सामान्य प्रश्न',
    'builtinSkillDesc.internal-comms':
      'सूचनाएँ, न्यूज़लेटर, प्रगति रिपोर्ट, सामान्य प्रश्न और दूसरे आंतरिक संदेश लिखता है।',
    'builtinSkillTitle.humanizer': 'AI जैसा लहजा हटाएँ (अंग्रेज़ी पाठ)',
    'builtinSkillDesc.humanizer':
      'अंग्रेज़ी पाठ में AI के लिखे जैसे लगने वाले वाक्यांश ढूँढता है और अर्थ बदले बिना उन्हें स्वाभाविक बनाता है।',
    'builtinSkillTitle.copy-editing': 'पाठ सँवारें (अंग्रेज़ी पाठ)',
    'builtinSkillDesc.copy-editing':
      'पहले से लिखे अंग्रेज़ी पाठ को कई बार जाँचकर उसे ज़्यादा साफ़ और संक्षिप्त बनाता है।',
    'builtinSkillTitle.find-skills': 'स्किल खोजें',
    'builtinSkillDesc.find-skills':
      'केवल एजेंट विंडो में काम करता है और स्किल खोजने व उन्हें इंस्टॉल करने का सुझाव देने के लिए इंटरनेट चाहिए।',
  },
  'zh-TW': {
    'builtinSkillTitle.meeting-minutes': '整理會議紀錄',
    'builtinSkillDesc.meeting-minutes': '把會議筆記整理成列明決議事項和待辦事項的會議紀錄。',
    'builtinSkillTitle.internal-comms': '撰寫公告、電子報和常見問題',
    'builtinSkillDesc.internal-comms': '撰寫公告、內部電子報、進度報告、常見問題等組織內部的文字。',
    'builtinSkillTitle.humanizer': '去除 AI 痕跡（以英文文字為準）',
    'builtinSkillDesc.humanizer':
      '找出英文文字中帶有 AI 痕跡的說法，在不改變內容的前提下改得更自然。',
    'builtinSkillTitle.copy-editing': '潤飾文字（以英文文字為準）',
    'builtinSkillDesc.copy-editing': '把已經寫好的英文文字逐次檢查，改得更清楚、更簡潔。',
    'builtinSkillTitle.find-skills': '尋找技能',
    'builtinSkillDesc.find-skills':
      '僅能在代理程式視窗中使用，需要連網，用來尋找所需技能並建議安裝。',
  },
  vi: {
    'builtinSkillTitle.meeting-minutes': 'Biên bản cuộc họp',
    'builtinSkillDesc.meeting-minutes':
      'Biến ghi chú cuộc họp thành biên bản nêu rõ các quyết định và việc cần làm.',
    'builtinSkillTitle.internal-comms': 'Thông báo, bản tin và câu hỏi thường gặp',
    'builtinSkillDesc.internal-comms':
      'Viết thông báo, bản tin, báo cáo tiến độ, câu hỏi thường gặp và các văn bản nội bộ khác.',
    'builtinSkillTitle.humanizer': 'Bỏ giọng AI (văn bản tiếng Anh)',
    'builtinSkillDesc.humanizer':
      'Tìm trong văn bản tiếng Anh những cách diễn đạt nghe như AI viết và sửa cho tự nhiên mà không đổi nội dung.',
    'builtinSkillTitle.copy-editing': 'Trau chuốt câu chữ (văn bản tiếng Anh)',
    'builtinSkillDesc.copy-editing':
      'Rà lại nhiều lượt một văn bản tiếng Anh đã viết để nó rõ ràng và gọn hơn.',
    'builtinSkillTitle.find-skills': 'Tìm kỹ năng',
    'builtinSkillDesc.find-skills':
      'Chỉ dùng được trong cửa sổ tác tử và cần internet để tìm kỹ năng và đề xuất cài đặt.',
  },
})

export type BuiltinSkillStringKey = keyof typeof zh

/** `builtinSkillText(lang, key)`: one built-in skill string in that language */
export const builtinSkillText: (lang: Lang, key: BuiltinSkillStringKey) => string =
  createI18n(BUILTIN_SKILL_STRINGS)

/** Display title of a built-in skill in `lang` (key `builtinSkillTitle.<name>`) */
export function builtinSkillTitle(lang: Lang, name: BuiltinSkillName): string {
  return builtinSkillText(lang, `builtinSkillTitle.${name}`)
}

/** One-line description of a built-in skill in `lang` (key `builtinSkillDesc.<name>`) */
export function builtinSkillDesc(lang: Lang, name: BuiltinSkillName): string {
  return builtinSkillText(lang, `builtinSkillDesc.${name}`)
}

/** Narrows a skill name read from disk or settings to a built-in skill name */
export function isBuiltinSkillName(name: string): name is BuiltinSkillName {
  return (BUILTIN_SKILL_NAMES as readonly string[]).includes(name)
}
