import type { MessageBoxOptions, OpenDialogOptions, SaveDialogOptions } from 'electron'
import { createI18n, defineStrings, type Lang } from '@genoffice/i18n'
import type { ProjectTrustAnswer, ProjectTrustPrompt } from '@genoffice/project-store'

/**
 * The shell main process's project folder dialogs (decision 0088): the
 * first-time trust prompt (spec 5.10), the download question for a file that
 * is not on this PC (spec 5.8), "new project" and the folder pickers (spec
 * 5.1). Only the texts and the dialog options live here, so they are testable
 * without Electron; `index.ts` shows them parented to the asking window.
 */

const zh = {
  trustTitle: '要使用这个文件夹中的说明吗？',
  trustMessage: '“{name}”文件夹中有并非由这台电脑上的应用写入的说明、记忆或对话。',
  trustHint: '请先阅读再选择。选择“不使用说明”时，AI 只使用文件夹中的文件和这台电脑上的对话。',
  trustInstructions: '说明（instructions.md）',
  trustMemory: '记忆（memory.md）',
  trustForeignChats: '在其他电脑上写的对话',
  trustMoreChats: '……另有 {count} 个',
  chatUntitled: '（无标题）',
  trustUse: '使用',
  trustWithout: '不使用说明',
  cancel: '取消',
  downloadTitle: '文件不在这台电脑上',
  downloadMessage: '“{file}”不在这台电脑上，需要先下载。要下载吗？',
  downloadButton: '下载',
  newProjectTitle: '新建项目',
  newProjectName: '新项目',
  newProjectButton: '创建',
  useExistingMessage: '要把这个文件夹用作项目吗？',
  useExistingButton: '使用',
  pickFolderTitle: '选择用作项目的文件夹',
  relocateTitle: '重新选择项目文件夹',
  pickParentTitle: '选择新项目的位置',
  pickFolderButton: '选择',
}

type Keys = Record<keyof typeof zh, string>

export const PROJECT_DIALOG_STRINGS = defineStrings({
  zh,
  en: {
    trustTitle: 'Use the instructions in this folder?',
    trustMessage:
      'The folder “{name}” holds instructions, memory or chats that the app on this PC did not write.',
    trustHint:
      'Read them, then choose. With “Use without instructions” the AI uses only the folder’s files and this PC’s chats.',
    trustInstructions: 'Instructions (instructions.md)',
    trustMemory: 'Memory (memory.md)',
    trustForeignChats: 'Chats written on other PCs',
    trustMoreChats: '…and {count} more',
    chatUntitled: '(untitled)',
    trustUse: 'Use',
    trustWithout: 'Use without instructions',
    cancel: 'Cancel',
    downloadTitle: 'File not on this PC',
    downloadMessage: '“{file}” is not on this PC and has to be downloaded. Download it?',
    downloadButton: 'Download',
    newProjectTitle: 'New project',
    newProjectName: 'New project',
    newProjectButton: 'Create',
    useExistingMessage: 'Use this folder as the project?',
    useExistingButton: 'Use',
    pickFolderTitle: 'Choose a folder to use as a project',
    relocateTitle: 'Choose the project folder again',
    pickParentTitle: 'Choose where to create the new project',
    pickFolderButton: 'Choose',
  } satisfies Keys,
  ja: {
    trustTitle: 'このフォルダーの指示を使いますか？',
    trustMessage:
      '「{name}」フォルダーには、この PC のアプリが書いていない指示・記憶・会話があります。',
    trustHint:
      '読んでから選んでください。「指示なしで使う」を選ぶと、AI はフォルダーのファイルとこの PC の会話だけを使います。',
    trustInstructions: '指示（instructions.md）',
    trustMemory: '記憶（memory.md）',
    trustForeignChats: 'ほかの PC で書かれた会話',
    trustMoreChats: '…ほか {count} 件',
    chatUntitled: '（無題）',
    trustUse: '使う',
    trustWithout: '指示なしで使う',
    cancel: 'キャンセル',
    downloadTitle: 'この PC にないファイル',
    downloadMessage:
      '「{file}」はこの PC にないため、ダウンロードが必要です。ダウンロードしますか？',
    downloadButton: 'ダウンロード',
    newProjectTitle: '新しいプロジェクト',
    newProjectName: '新しいプロジェクト',
    newProjectButton: '作成',
    useExistingMessage: 'このフォルダーをプロジェクトとして使いますか？',
    useExistingButton: '使う',
    pickFolderTitle: 'プロジェクトとして使うフォルダーを選ぶ',
    relocateTitle: 'プロジェクトフォルダーを選び直す',
    pickParentTitle: '新しいプロジェクトを作る場所を選ぶ',
    pickFolderButton: '選択',
  } satisfies Keys,
  ko: {
    trustTitle: '이 폴더의 지침을 쓸까요?',
    trustMessage: '‘{name}’ 폴더에 이 PC의 앱이 쓰지 않은 지침·기억·대화가 있습니다.',
    trustHint:
      '읽어 보고 고르세요. [지침 없이 쓰기]를 고르면 AI는 폴더의 파일과 이 PC의 대화만 씁니다.',
    trustInstructions: '지침 (instructions.md)',
    trustMemory: '기억 (memory.md)',
    trustForeignChats: '다른 PC에서 쓴 대화',
    trustMoreChats: '…그 밖에 {count}개',
    chatUntitled: '(제목 없음)',
    trustUse: '쓰기',
    trustWithout: '지침 없이 쓰기',
    cancel: '취소',
    downloadTitle: 'PC에 없는 파일',
    downloadMessage: '‘{file}’은 PC에 없어 내려받아야 합니다. 내려받을까요?',
    downloadButton: '내려받기',
    newProjectTitle: '새 프로젝트',
    newProjectName: '새 프로젝트',
    newProjectButton: '만들기',
    useExistingMessage: '이 폴더를 프로젝트로 쓸까요?',
    useExistingButton: '쓰기',
    pickFolderTitle: '프로젝트로 쓸 폴더 고르기',
    relocateTitle: '프로젝트 폴더 다시 고르기',
    pickParentTitle: '새 프로젝트를 만들 곳 고르기',
    pickFolderButton: '고르기',
  } satisfies Keys,
  fr: {
    trustTitle: 'Utiliser les consignes de ce dossier ?',
    trustMessage:
      'Le dossier « {name} » contient des consignes, une mémoire ou des conversations que l’application de ce PC n’a pas écrites.',
    trustHint:
      'Lisez-les, puis choisissez. Avec « Utiliser sans consignes », l’IA n’utilise que les fichiers du dossier et les conversations de ce PC.',
    trustInstructions: 'Consignes (instructions.md)',
    trustMemory: 'Mémoire (memory.md)',
    trustForeignChats: 'Conversations écrites sur d’autres PC',
    trustMoreChats: '…et {count} de plus',
    chatUntitled: '(sans titre)',
    trustUse: 'Utiliser',
    trustWithout: 'Utiliser sans consignes',
    cancel: 'Annuler',
    downloadTitle: 'Fichier absent de ce PC',
    downloadMessage: '« {file} » n’est pas sur ce PC et doit être téléchargé. Le télécharger ?',
    downloadButton: 'Télécharger',
    newProjectTitle: 'Nouveau projet',
    newProjectName: 'Nouveau projet',
    newProjectButton: 'Créer',
    useExistingMessage: 'Utiliser ce dossier comme projet ?',
    useExistingButton: 'Utiliser',
    pickFolderTitle: 'Choisir un dossier à utiliser comme projet',
    relocateTitle: 'Choisir à nouveau le dossier du projet',
    pickParentTitle: 'Choisir où créer le nouveau projet',
    pickFolderButton: 'Choisir',
  } satisfies Keys,
  de: {
    trustTitle: 'Die Anweisungen in diesem Ordner verwenden?',
    trustMessage:
      'Der Ordner „{name}“ enthält Anweisungen, Erinnerungen oder Chats, die nicht von der App auf diesem PC geschrieben wurden.',
    trustHint:
      'Lesen Sie sie und wählen Sie dann. Mit „Ohne Anweisungen verwenden“ nutzt die KI nur die Dateien des Ordners und die Chats dieses PCs.',
    trustInstructions: 'Anweisungen (instructions.md)',
    trustMemory: 'Erinnerungen (memory.md)',
    trustForeignChats: 'Auf anderen PCs geschriebene Chats',
    trustMoreChats: '…und {count} weitere',
    chatUntitled: '(ohne Titel)',
    trustUse: 'Verwenden',
    trustWithout: 'Ohne Anweisungen verwenden',
    cancel: 'Abbrechen',
    downloadTitle: 'Datei nicht auf diesem PC',
    downloadMessage:
      '„{file}“ ist nicht auf diesem PC und muss heruntergeladen werden. Herunterladen?',
    downloadButton: 'Herunterladen',
    newProjectTitle: 'Neues Projekt',
    newProjectName: 'Neues Projekt',
    newProjectButton: 'Erstellen',
    useExistingMessage: 'Diesen Ordner als Projekt verwenden?',
    useExistingButton: 'Verwenden',
    pickFolderTitle: 'Ordner als Projekt auswählen',
    relocateTitle: 'Projektordner erneut auswählen',
    pickParentTitle: 'Ort für das neue Projekt auswählen',
    pickFolderButton: 'Auswählen',
  } satisfies Keys,
  es: {
    trustTitle: '¿Usar las instrucciones de esta carpeta?',
    trustMessage:
      'La carpeta «{name}» contiene instrucciones, memoria o conversaciones que la aplicación de este PC no escribió.',
    trustHint:
      'Léalas y luego elija. Con «Usar sin instrucciones», la IA solo usa los archivos de la carpeta y las conversaciones de este PC.',
    trustInstructions: 'Instrucciones (instructions.md)',
    trustMemory: 'Memoria (memory.md)',
    trustForeignChats: 'Conversaciones escritas en otros PC',
    trustMoreChats: '…y {count} más',
    chatUntitled: '(sin título)',
    trustUse: 'Usar',
    trustWithout: 'Usar sin instrucciones',
    cancel: 'Cancelar',
    downloadTitle: 'Archivo que no está en este PC',
    downloadMessage: '«{file}» no está en este PC y hay que descargarlo. ¿Descargarlo?',
    downloadButton: 'Descargar',
    newProjectTitle: 'Nuevo proyecto',
    newProjectName: 'Nuevo proyecto',
    newProjectButton: 'Crear',
    useExistingMessage: '¿Usar esta carpeta como proyecto?',
    useExistingButton: 'Usar',
    pickFolderTitle: 'Elegir una carpeta para usarla como proyecto',
    relocateTitle: 'Volver a elegir la carpeta del proyecto',
    pickParentTitle: 'Elegir dónde crear el nuevo proyecto',
    pickFolderButton: 'Elegir',
  } satisfies Keys,
  th: {
    trustTitle: 'ใช้คำแนะนำในโฟลเดอร์นี้ไหม',
    trustMessage: 'โฟลเดอร์ “{name}” มีคำแนะนำ ความจำ หรือแชตที่แอปบนพีซีเครื่องนี้ไม่ได้เขียน',
    trustHint:
      'อ่านก่อนแล้วจึงเลือก หากเลือก “ใช้โดยไม่มีคำแนะนำ” AI จะใช้เฉพาะไฟล์ในโฟลเดอร์และแชตของพีซีเครื่องนี้',
    trustInstructions: 'คำแนะนำ (instructions.md)',
    trustMemory: 'ความจำ (memory.md)',
    trustForeignChats: 'แชตที่เขียนบนพีซีเครื่องอื่น',
    trustMoreChats: '…และอีก {count} รายการ',
    chatUntitled: '(ไม่มีชื่อ)',
    trustUse: 'ใช้',
    trustWithout: 'ใช้โดยไม่มีคำแนะนำ',
    cancel: 'ยกเลิก',
    downloadTitle: 'ไฟล์ไม่อยู่ในพีซีเครื่องนี้',
    downloadMessage: '“{file}” ไม่อยู่ในพีซีเครื่องนี้และต้องดาวน์โหลดก่อน ดาวน์โหลดไหม',
    downloadButton: 'ดาวน์โหลด',
    newProjectTitle: 'โปรเจกต์ใหม่',
    newProjectName: 'โปรเจกต์ใหม่',
    newProjectButton: 'สร้าง',
    useExistingMessage: 'ใช้โฟลเดอร์นี้เป็นโปรเจกต์ไหม',
    useExistingButton: 'ใช้',
    pickFolderTitle: 'เลือกโฟลเดอร์ที่จะใช้เป็นโปรเจกต์',
    relocateTitle: 'เลือกโฟลเดอร์โปรเจกต์อีกครั้ง',
    pickParentTitle: 'เลือกที่สำหรับสร้างโปรเจกต์ใหม่',
    pickFolderButton: 'เลือก',
  } satisfies Keys,
  id: {
    trustTitle: 'Gunakan petunjuk di folder ini?',
    trustMessage:
      'Folder “{name}” berisi petunjuk, memori, atau obrolan yang tidak ditulis oleh aplikasi di PC ini.',
    trustHint:
      'Baca dulu, lalu pilih. Dengan “Gunakan tanpa petunjuk”, AI hanya memakai file di folder dan obrolan PC ini.',
    trustInstructions: 'Petunjuk (instructions.md)',
    trustMemory: 'Memori (memory.md)',
    trustForeignChats: 'Obrolan yang ditulis di PC lain',
    trustMoreChats: '…dan {count} lainnya',
    chatUntitled: '(tanpa judul)',
    trustUse: 'Gunakan',
    trustWithout: 'Gunakan tanpa petunjuk',
    cancel: 'Batal',
    downloadTitle: 'File tidak ada di PC ini',
    downloadMessage: '“{file}” tidak ada di PC ini dan harus diunduh. Unduh sekarang?',
    downloadButton: 'Unduh',
    newProjectTitle: 'Proyek baru',
    newProjectName: 'Proyek baru',
    newProjectButton: 'Buat',
    useExistingMessage: 'Gunakan folder ini sebagai proyek?',
    useExistingButton: 'Gunakan',
    pickFolderTitle: 'Pilih folder untuk dijadikan proyek',
    relocateTitle: 'Pilih ulang folder proyek',
    pickParentTitle: 'Pilih tempat untuk membuat proyek baru',
    pickFolderButton: 'Pilih',
  } satisfies Keys,
  ru: {
    trustTitle: 'Использовать инструкции из этой папки?',
    trustMessage:
      'В папке «{name}» есть инструкции, память или чаты, которые записало не приложение на этом ПК.',
    trustHint:
      'Прочитайте и выберите. При варианте «Без инструкций» ИИ использует только файлы папки и чаты этого ПК.',
    trustInstructions: 'Инструкции (instructions.md)',
    trustMemory: 'Память (memory.md)',
    trustForeignChats: 'Чаты, написанные на других ПК',
    trustMoreChats: '…и ещё {count}',
    chatUntitled: '(без названия)',
    trustUse: 'Использовать',
    trustWithout: 'Без инструкций',
    cancel: 'Отмена',
    downloadTitle: 'Файла нет на этом ПК',
    downloadMessage: 'Файла «{file}» нет на этом ПК, его нужно скачать. Скачать?',
    downloadButton: 'Скачать',
    newProjectTitle: 'Новый проект',
    newProjectName: 'Новый проект',
    newProjectButton: 'Создать',
    useExistingMessage: 'Использовать эту папку как проект?',
    useExistingButton: 'Использовать',
    pickFolderTitle: 'Выберите папку для проекта',
    relocateTitle: 'Выберите папку проекта заново',
    pickParentTitle: 'Выберите, где создать новый проект',
    pickFolderButton: 'Выбрать',
  } satisfies Keys,
  ar: {
    trustTitle: 'هل تريد استخدام التعليمات الموجودة في هذا المجلد؟',
    trustMessage:
      'يحتوي المجلد «{name}» على تعليمات أو ذاكرة أو محادثات لم يكتبها التطبيق على هذا الحاسوب.',
    trustHint:
      'اقرأها ثم اختر. عند اختيار «الاستخدام دون تعليمات» لا يستخدم الذكاء الاصطناعي إلا ملفات المجلد ومحادثات هذا الحاسوب.',
    trustInstructions: 'التعليمات (instructions.md)',
    trustMemory: 'الذاكرة (memory.md)',
    trustForeignChats: 'محادثات كُتبت على حواسيب أخرى',
    trustMoreChats: '…و{count} أخرى',
    chatUntitled: '(بلا عنوان)',
    trustUse: 'استخدام',
    trustWithout: 'الاستخدام دون تعليمات',
    cancel: 'إلغاء',
    downloadTitle: 'الملف غير موجود على هذا الحاسوب',
    downloadMessage: 'الملف «{file}» غير موجود على هذا الحاسوب ويجب تنزيله. هل تريد تنزيله؟',
    downloadButton: 'تنزيل',
    newProjectTitle: 'مشروع جديد',
    newProjectName: 'مشروع جديد',
    newProjectButton: 'إنشاء',
    useExistingMessage: 'هل تريد استخدام هذا المجلد كمشروع؟',
    useExistingButton: 'استخدام',
    pickFolderTitle: 'اختر مجلدًا لاستخدامه كمشروع',
    relocateTitle: 'اختر مجلد المشروع من جديد',
    pickParentTitle: 'اختر مكان إنشاء المشروع الجديد',
    pickFolderButton: 'اختيار',
  } satisfies Keys,
  pt: {
    trustTitle: 'Usar as instruções desta pasta?',
    trustMessage:
      'A pasta “{name}” contém instruções, memória ou conversas que o aplicativo deste PC não escreveu.',
    trustHint:
      'Leia e depois escolha. Com “Usar sem instruções”, a IA usa apenas os arquivos da pasta e as conversas deste PC.',
    trustInstructions: 'Instruções (instructions.md)',
    trustMemory: 'Memória (memory.md)',
    trustForeignChats: 'Conversas escritas em outros PCs',
    trustMoreChats: '…e mais {count}',
    chatUntitled: '(sem título)',
    trustUse: 'Usar',
    trustWithout: 'Usar sem instruções',
    cancel: 'Cancelar',
    downloadTitle: 'Arquivo fora deste PC',
    downloadMessage: '“{file}” não está neste PC e precisa ser baixado. Baixar agora?',
    downloadButton: 'Baixar',
    newProjectTitle: 'Novo projeto',
    newProjectName: 'Novo projeto',
    newProjectButton: 'Criar',
    useExistingMessage: 'Usar esta pasta como projeto?',
    useExistingButton: 'Usar',
    pickFolderTitle: 'Escolher uma pasta para usar como projeto',
    relocateTitle: 'Escolher de novo a pasta do projeto',
    pickParentTitle: 'Escolher onde criar o novo projeto',
    pickFolderButton: 'Escolher',
  } satisfies Keys,
  it: {
    trustTitle: 'Usare le istruzioni di questa cartella?',
    trustMessage:
      'La cartella “{name}” contiene istruzioni, memoria o chat che l’app di questo PC non ha scritto.',
    trustHint:
      'Leggile, poi scegli. Con “Usa senza istruzioni” l’IA usa solo i file della cartella e le chat di questo PC.',
    trustInstructions: 'Istruzioni (instructions.md)',
    trustMemory: 'Memoria (memory.md)',
    trustForeignChats: 'Chat scritte su altri PC',
    trustMoreChats: '…e altre {count}',
    chatUntitled: '(senza titolo)',
    trustUse: 'Usa',
    trustWithout: 'Usa senza istruzioni',
    cancel: 'Annulla',
    downloadTitle: 'File non presente su questo PC',
    downloadMessage: '“{file}” non è su questo PC e va scaricato. Scaricarlo?',
    downloadButton: 'Scarica',
    newProjectTitle: 'Nuovo progetto',
    newProjectName: 'Nuovo progetto',
    newProjectButton: 'Crea',
    useExistingMessage: 'Usare questa cartella come progetto?',
    useExistingButton: 'Usa',
    pickFolderTitle: 'Scegli una cartella da usare come progetto',
    relocateTitle: 'Scegli di nuovo la cartella del progetto',
    pickParentTitle: 'Scegli dove creare il nuovo progetto',
    pickFolderButton: 'Scegli',
  } satisfies Keys,
  pl: {
    trustTitle: 'Użyć instrukcji z tego folderu?',
    trustMessage:
      'Folder „{name}” zawiera instrukcje, pamięć lub czaty, których nie zapisała aplikacja na tym komputerze.',
    trustHint:
      'Przeczytaj je, a potem wybierz. Przy „Użyj bez instrukcji” AI korzysta tylko z plików folderu i czatów z tego komputera.',
    trustInstructions: 'Instrukcje (instructions.md)',
    trustMemory: 'Pamięć (memory.md)',
    trustForeignChats: 'Czaty napisane na innych komputerach',
    trustMoreChats: '…i jeszcze {count}',
    chatUntitled: '(bez tytułu)',
    trustUse: 'Użyj',
    trustWithout: 'Użyj bez instrukcji',
    cancel: 'Anuluj',
    downloadTitle: 'Pliku nie ma na tym komputerze',
    downloadMessage: 'Pliku „{file}” nie ma na tym komputerze i trzeba go pobrać. Pobrać?',
    downloadButton: 'Pobierz',
    newProjectTitle: 'Nowy projekt',
    newProjectName: 'Nowy projekt',
    newProjectButton: 'Utwórz',
    useExistingMessage: 'Użyć tego folderu jako projektu?',
    useExistingButton: 'Użyj',
    pickFolderTitle: 'Wybierz folder na projekt',
    relocateTitle: 'Wybierz ponownie folder projektu',
    pickParentTitle: 'Wybierz, gdzie utworzyć nowy projekt',
    pickFolderButton: 'Wybierz',
  } satisfies Keys,
  cs: {
    trustTitle: 'Použít pokyny z této složky?',
    trustMessage:
      'Složka „{name}“ obsahuje pokyny, paměť nebo konverzace, které nezapsala aplikace na tomto počítači.',
    trustHint:
      'Přečtěte si je a pak vyberte. Při volbě „Použít bez pokynů“ AI použije jen soubory ve složce a konverzace z tohoto počítače.',
    trustInstructions: 'Pokyny (instructions.md)',
    trustMemory: 'Paměť (memory.md)',
    trustForeignChats: 'Konverzace napsané na jiných počítačích',
    trustMoreChats: '…a dalších {count}',
    chatUntitled: '(bez názvu)',
    trustUse: 'Použít',
    trustWithout: 'Použít bez pokynů',
    cancel: 'Zrušit',
    downloadTitle: 'Soubor není na tomto počítači',
    downloadMessage: 'Soubor „{file}“ není na tomto počítači a je třeba ho stáhnout. Stáhnout?',
    downloadButton: 'Stáhnout',
    newProjectTitle: 'Nový projekt',
    newProjectName: 'Nový projekt',
    newProjectButton: 'Vytvořit',
    useExistingMessage: 'Použít tuto složku jako projekt?',
    useExistingButton: 'Použít',
    pickFolderTitle: 'Vyberte složku pro projekt',
    relocateTitle: 'Znovu vyberte složku projektu',
    pickParentTitle: 'Vyberte, kde vytvořit nový projekt',
    pickFolderButton: 'Vybrat',
  } satisfies Keys,
  nl: {
    trustTitle: 'De instructies in deze map gebruiken?',
    trustMessage:
      'De map ‘{name}’ bevat instructies, geheugen of chats die niet door de app op deze pc zijn geschreven.',
    trustHint:
      'Lees ze en kies dan. Met ‘Gebruiken zonder instructies’ gebruikt de AI alleen de bestanden in de map en de chats van deze pc.',
    trustInstructions: 'Instructies (instructions.md)',
    trustMemory: 'Geheugen (memory.md)',
    trustForeignChats: 'Chats geschreven op andere pc’s',
    trustMoreChats: '…en nog {count}',
    chatUntitled: '(zonder titel)',
    trustUse: 'Gebruiken',
    trustWithout: 'Gebruiken zonder instructies',
    cancel: 'Annuleren',
    downloadTitle: 'Bestand niet op deze pc',
    downloadMessage: '‘{file}’ staat niet op deze pc en moet worden gedownload. Downloaden?',
    downloadButton: 'Downloaden',
    newProjectTitle: 'Nieuw project',
    newProjectName: 'Nieuw project',
    newProjectButton: 'Maken',
    useExistingMessage: 'Deze map als project gebruiken?',
    useExistingButton: 'Gebruiken',
    pickFolderTitle: 'Kies een map om als project te gebruiken',
    relocateTitle: 'Kies de projectmap opnieuw',
    pickParentTitle: 'Kies waar het nieuwe project komt',
    pickFolderButton: 'Kiezen',
  } satisfies Keys,
  ms: {
    trustTitle: 'Guna arahan dalam folder ini?',
    trustMessage:
      'Folder “{name}” mengandungi arahan, memori atau sembang yang tidak ditulis oleh aplikasi pada PC ini.',
    trustHint:
      'Baca dahulu, kemudian pilih. Dengan “Guna tanpa arahan”, AI hanya menggunakan fail dalam folder dan sembang PC ini.',
    trustInstructions: 'Arahan (instructions.md)',
    trustMemory: 'Memori (memory.md)',
    trustForeignChats: 'Sembang yang ditulis pada PC lain',
    trustMoreChats: '…dan {count} lagi',
    chatUntitled: '(tiada tajuk)',
    trustUse: 'Guna',
    trustWithout: 'Guna tanpa arahan',
    cancel: 'Batal',
    downloadTitle: 'Fail tiada pada PC ini',
    downloadMessage: '“{file}” tiada pada PC ini dan perlu dimuat turun. Muat turun?',
    downloadButton: 'Muat turun',
    newProjectTitle: 'Projek baharu',
    newProjectName: 'Projek baharu',
    newProjectButton: 'Cipta',
    useExistingMessage: 'Guna folder ini sebagai projek?',
    useExistingButton: 'Guna',
    pickFolderTitle: 'Pilih folder untuk dijadikan projek',
    relocateTitle: 'Pilih semula folder projek',
    pickParentTitle: 'Pilih tempat untuk mencipta projek baharu',
    pickFolderButton: 'Pilih',
  } satisfies Keys,
  he: {
    trustTitle: 'להשתמש בהנחיות שבתיקייה הזו?',
    trustMessage: 'התיקייה „{name}” מכילה הנחיות, זיכרון או שיחות שהאפליקציה במחשב הזה לא כתבה.',
    trustHint:
      'קראו ואז בחרו. באפשרות „שימוש בלי הנחיות” הבינה המלאכותית משתמשת רק בקבצי התיקייה ובשיחות של המחשב הזה.',
    trustInstructions: 'הנחיות (instructions.md)',
    trustMemory: 'זיכרון (memory.md)',
    trustForeignChats: 'שיחות שנכתבו במחשבים אחרים',
    trustMoreChats: '…ועוד {count}',
    chatUntitled: '(ללא כותרת)',
    trustUse: 'שימוש',
    trustWithout: 'שימוש בלי הנחיות',
    cancel: 'ביטול',
    downloadTitle: 'הקובץ לא נמצא במחשב הזה',
    downloadMessage: 'הקובץ „{file}” לא נמצא במחשב הזה וצריך להוריד אותו. להוריד?',
    downloadButton: 'הורדה',
    newProjectTitle: 'פרויקט חדש',
    newProjectName: 'פרויקט חדש',
    newProjectButton: 'יצירה',
    useExistingMessage: 'להשתמש בתיקייה הזו כפרויקט?',
    useExistingButton: 'שימוש',
    pickFolderTitle: 'בחירת תיקייה לשימוש כפרויקט',
    relocateTitle: 'בחירה מחדש של תיקיית הפרויקט',
    pickParentTitle: 'בחירת מקום ליצירת הפרויקט החדש',
    pickFolderButton: 'בחירה',
  } satisfies Keys,
  hi: {
    trustTitle: 'क्या इस फ़ोल्डर के निर्देश इस्तेमाल करें?',
    trustMessage:
      '“{name}” फ़ोल्डर में ऐसे निर्देश, स्मृति या चैट हैं जिन्हें इस PC के ऐप ने नहीं लिखा।',
    trustHint:
      'पहले पढ़ें, फिर चुनें। “निर्देशों के बिना इस्तेमाल करें” चुनने पर AI केवल फ़ोल्डर की फ़ाइलें और इस PC की चैट इस्तेमाल करता है।',
    trustInstructions: 'निर्देश (instructions.md)',
    trustMemory: 'स्मृति (memory.md)',
    trustForeignChats: 'दूसरे PC पर लिखी गई चैट',
    trustMoreChats: '…और {count}',
    chatUntitled: '(बिना शीर्षक)',
    trustUse: 'इस्तेमाल करें',
    trustWithout: 'निर्देशों के बिना इस्तेमाल करें',
    cancel: 'रद्द करें',
    downloadTitle: 'फ़ाइल इस PC पर नहीं है',
    downloadMessage: '“{file}” इस PC पर नहीं है और इसे डाउनलोड करना होगा। डाउनलोड करें?',
    downloadButton: 'डाउनलोड करें',
    newProjectTitle: 'नया प्रोजेक्ट',
    newProjectName: 'नया प्रोजेक्ट',
    newProjectButton: 'बनाएँ',
    useExistingMessage: 'क्या इस फ़ोल्डर को प्रोजेक्ट के रूप में इस्तेमाल करें?',
    useExistingButton: 'इस्तेमाल करें',
    pickFolderTitle: 'प्रोजेक्ट के लिए फ़ोल्डर चुनें',
    relocateTitle: 'प्रोजेक्ट फ़ोल्डर फिर से चुनें',
    pickParentTitle: 'नया प्रोजेक्ट बनाने की जगह चुनें',
    pickFolderButton: 'चुनें',
  } satisfies Keys,
  'zh-TW': {
    trustTitle: '要使用這個資料夾中的說明嗎？',
    trustMessage: '「{name}」資料夾中有並非由這台電腦上的應用程式寫入的說明、記憶或對話。',
    trustHint: '請先閱讀再選擇。選擇「不使用說明」時，AI 只使用資料夾中的檔案和這台電腦上的對話。',
    trustInstructions: '說明（instructions.md）',
    trustMemory: '記憶（memory.md）',
    trustForeignChats: '在其他電腦上寫的對話',
    trustMoreChats: '……另有 {count} 個',
    chatUntitled: '（無標題）',
    trustUse: '使用',
    trustWithout: '不使用說明',
    cancel: '取消',
    downloadTitle: '檔案不在這台電腦上',
    downloadMessage: '「{file}」不在這台電腦上，需要先下載。要下載嗎？',
    downloadButton: '下載',
    newProjectTitle: '新增專案',
    newProjectName: '新專案',
    newProjectButton: '建立',
    useExistingMessage: '要把這個資料夾用作專案嗎？',
    useExistingButton: '使用',
    pickFolderTitle: '選擇用作專案的資料夾',
    relocateTitle: '重新選擇專案資料夾',
    pickParentTitle: '選擇新專案的位置',
    pickFolderButton: '選擇',
  } satisfies Keys,
  vi: {
    trustTitle: 'Dùng hướng dẫn trong thư mục này?',
    trustMessage:
      'Thư mục “{name}” có hướng dẫn, bộ nhớ hoặc cuộc trò chuyện không do ứng dụng trên máy này viết.',
    trustHint:
      'Hãy đọc rồi chọn. Với “Dùng mà không có hướng dẫn”, AI chỉ dùng các tệp trong thư mục và cuộc trò chuyện của máy này.',
    trustInstructions: 'Hướng dẫn (instructions.md)',
    trustMemory: 'Bộ nhớ (memory.md)',
    trustForeignChats: 'Cuộc trò chuyện viết trên máy khác',
    trustMoreChats: '…và {count} cuộc khác',
    chatUntitled: '(không có tiêu đề)',
    trustUse: 'Dùng',
    trustWithout: 'Dùng mà không có hướng dẫn',
    cancel: 'Hủy',
    downloadTitle: 'Tệp không có trên máy này',
    downloadMessage: '“{file}” không có trên máy này và cần được tải xuống. Tải xuống?',
    downloadButton: 'Tải xuống',
    newProjectTitle: 'Dự án mới',
    newProjectName: 'Dự án mới',
    newProjectButton: 'Tạo',
    useExistingMessage: 'Dùng thư mục này làm dự án?',
    useExistingButton: 'Dùng',
    pickFolderTitle: 'Chọn thư mục để dùng làm dự án',
    relocateTitle: 'Chọn lại thư mục dự án',
    pickParentTitle: 'Chọn nơi tạo dự án mới',
    pickFolderButton: 'Chọn',
  } satisfies Keys,
})

export const projectDialogText = createI18n(PROJECT_DIALOG_STRINGS)

/** Characters of each text the trust prompt shows; the rest is cut with an ellipsis */
export const TRUST_TEXT_SHOWN_CHARS = 1_500

/** Chats from other PCs the trust prompt lists by name; the rest are counted */
export const TRUST_CHATS_SHOWN = 20

/** `text` cut to `max` characters (whole code points) with an ellipsis */
export function shownText(text: string, max = TRUST_TEXT_SHOWN_CHARS): string {
  const chars = Array.from(text.trim())
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('')
}

function shownDate(iso: string, lang: Lang): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(at)
  } catch {
    return at.toISOString()
  }
}

/** The response index of each trust prompt button */
const TRUST_USE = 0
const TRUST_WITHOUT = 1
const TRUST_CANCEL = 2

/**
 * The first-time trust prompt (spec 5.10): the texts this install did not write
 * (each cut for display) and the chats from other PCs, with [use] / [use without
 * instructions] / [cancel]. Cancel is the default and what closing means.
 */
export function trustPromptOptions(lang: Lang, prompt: ProjectTrustPrompt): MessageBoxOptions {
  const t = (key: keyof typeof zh, params?: Record<string, string | number>) =>
    projectDialogText(lang, key, params)
  const parts: string[] = [t('trustHint'), prompt.folderPath]
  const section = (label: string, text: string | null) => {
    if (text !== null && text.trim()) parts.push(`— ${label} —\n${shownText(text)}`)
  }
  section(t('trustInstructions'), prompt.instructions)
  section(t('trustMemory'), prompt.memory)
  section('AGENTS.md', prompt.agents)
  section('CLAUDE.md', prompt.claude)
  if (prompt.foreignChats.length > 0) {
    const lines = prompt.foreignChats
      .slice(0, TRUST_CHATS_SHOWN)
      .map(
        (chat) =>
          `• ${shownText(chat.title, 120) || t('chatUntitled')} (${shownDate(chat.updatedAt, lang)})`,
      )
    const more = prompt.foreignChats.length - TRUST_CHATS_SHOWN
    if (more > 0) lines.push(t('trustMoreChats', { count: more }))
    parts.push(`— ${t('trustForeignChats')} —\n${lines.join('\n')}`)
  }
  return {
    type: 'question',
    title: t('trustTitle'),
    message: t('trustMessage', { name: prompt.name }),
    detail: parts.join('\n\n'),
    buttons: [t('trustUse'), t('trustWithout'), t('cancel')],
    defaultId: TRUST_CANCEL,
    cancelId: TRUST_CANCEL,
    noLink: true,
  }
}

/** The person's answer from the trust prompt's response; anything but the two choices cancels */
export function trustAnswerOf(response: number): ProjectTrustAnswer {
  if (response === TRUST_USE) return 'use'
  if (response === TRUST_WITHOUT) return 'without'
  return null
}

/** "'<file>' is not on this PC ...": [download] is response 0; cancel is the default */
export function downloadPromptOptions(lang: Lang, fileName: string): MessageBoxOptions {
  return {
    type: 'question',
    title: projectDialogText(lang, 'downloadTitle'),
    message: projectDialogText(lang, 'downloadMessage', { file: fileName }),
    buttons: [projectDialogText(lang, 'downloadButton'), projectDialogText(lang, 'cancel')],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  }
}

/** "Use this folder as the project?" for a new project whose folder exists: [use] is response 0 */
export function useExistingPromptOptions(lang: Lang, folderPath: string): MessageBoxOptions {
  return {
    type: 'question',
    title: projectDialogText(lang, 'newProjectTitle'),
    message: projectDialogText(lang, 'useExistingMessage'),
    detail: folderPath,
    buttons: [projectDialogText(lang, 'useExistingButton'), projectDialogText(lang, 'cancel')],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  }
}

/**
 * "New project": a save dialog at `<parent>/<name>` where the person types the
 * name and may pick another place (spec 5.1 "[elsewhere…]")
 */
export function newProjectDialogOptions(lang: Lang, defaultPath: string): SaveDialogOptions {
  return {
    title: projectDialogText(lang, 'newProjectTitle'),
    defaultPath,
    buttonLabel: projectDialogText(lang, 'newProjectButton'),
    properties: ['createDirectory'],
  }
}

export type ProjectFolderPickPurpose = 'add' | 'relocate' | 'parent'

/** The folder picker for "add folder", relocating a missing project, and a new project's parent */
export function folderPickerOptions(
  lang: Lang,
  purpose: ProjectFolderPickPurpose,
): OpenDialogOptions {
  const title =
    purpose === 'add'
      ? 'pickFolderTitle'
      : purpose === 'relocate'
        ? 'relocateTitle'
        : 'pickParentTitle'
  return {
    title: projectDialogText(lang, title),
    buttonLabel: projectDialogText(lang, 'pickFolderButton'),
    properties: ['openDirectory', 'createDirectory'],
  }
}
