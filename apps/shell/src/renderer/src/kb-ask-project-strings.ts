import { createI18n, defineStrings, type Lang, type Params } from '@genoffice/i18n'

/**
 * The home ask panel's own wording for project folders (decision 0088). The
 * picker, the chat menu and the notice lines bring theirs from @genoffice/ui;
 * this is only what the home ask says when a chosen project cannot be used
 * for a question. `zh` defines the key set.
 */
const zh = {
  askProjectMissing: '找不到所选项目的文件夹，因此没有发送。请在下方重新选择项目。',
}

export const kbAskProjectStrings = defineStrings({
  zh,
  en: {
    askProjectMissing:
      'The chosen project’s folder could not be found, so nothing was sent. Choose the project again below.',
  },
  ja: {
    askProjectMissing:
      '選んだプロジェクトのフォルダーが見つからないため、送信しませんでした。下でプロジェクトを選び直してください。',
  },
  ko: {
    askProjectMissing:
      '고른 프로젝트의 폴더를 찾을 수 없어 보내지 않았습니다. 아래에서 프로젝트를 다시 고르세요.',
  },
  fr: {
    askProjectMissing:
      'Le dossier du projet choisi est introuvable : rien n’a été envoyé. Choisissez de nouveau le projet ci-dessous.',
  },
  de: {
    askProjectMissing:
      'Der Ordner des gewählten Projekts wurde nicht gefunden, daher wurde nichts gesendet. Wählen Sie das Projekt unten erneut.',
  },
  es: {
    askProjectMissing:
      'No se encontró la carpeta del proyecto elegido, así que no se envió nada. Vuelve a elegir el proyecto abajo.',
  },
  th: {
    askProjectMissing:
      'ไม่พบโฟลเดอร์ของโปรเจกต์ที่เลือก จึงไม่ได้ส่งคำถาม โปรดเลือกโปรเจกต์อีกครั้งด้านล่าง',
  },
  id: {
    askProjectMissing:
      'Folder proyek yang dipilih tidak ditemukan, jadi tidak ada yang dikirim. Pilih proyek lagi di bawah.',
  },
  ru: {
    askProjectMissing:
      'Папка выбранного проекта не найдена, поэтому ничего не отправлено. Выберите проект ниже ещё раз.',
  },
  ar: {
    askProjectMissing:
      'تعذّر العثور على مجلد المشروع المختار، لذا لم يُرسَل شيء. اختر المشروع مرة أخرى في الأسفل.',
  },
  pt: {
    askProjectMissing:
      'A pasta do projeto escolhido não foi encontrada, por isso nada foi enviado. Escolha o projeto novamente abaixo.',
  },
  it: {
    askProjectMissing:
      'La cartella del progetto scelto non è stata trovata, quindi non è stato inviato nulla. Scegli di nuovo il progetto qui sotto.',
  },
  pl: {
    askProjectMissing:
      'Nie znaleziono folderu wybranego projektu, więc nic nie wysłano. Wybierz projekt ponownie poniżej.',
  },
  cs: {
    askProjectMissing:
      'Složka vybraného projektu nebyla nalezena, proto se nic neodeslalo. Vyberte projekt níže znovu.',
  },
  nl: {
    askProjectMissing:
      'De map van het gekozen project is niet gevonden, dus er is niets verstuurd. Kies het project hieronder opnieuw.',
  },
  ms: {
    askProjectMissing:
      'Folder projek yang dipilih tidak ditemui, jadi tiada apa-apa dihantar. Pilih projek sekali lagi di bawah.',
  },
  he: {
    askProjectMissing:
      'התיקייה של הפרויקט שנבחר לא נמצאה, ולכן לא נשלח דבר. בחרו שוב את הפרויקט למטה.',
  },
  hi: {
    askProjectMissing:
      'चुने गए प्रोजेक्ट का फ़ोल्डर नहीं मिला, इसलिए कुछ नहीं भेजा गया। नीचे प्रोजेक्ट फिर से चुनें।',
  },
  'zh-TW': {
    askProjectMissing: '找不到所選專案的資料夾，因此沒有送出。請在下方重新選擇專案。',
  },
  vi: {
    askProjectMissing:
      'Không tìm thấy thư mục của dự án đã chọn nên chưa gửi gì. Hãy chọn lại dự án ở bên dưới.',
  },
})

export type KbAskProjectStringKey = keyof typeof zh

const translate = createI18n(kbAskProjectStrings)

export function kbAskProjectText(lang: Lang, key: KbAskProjectStringKey, params?: Params): string {
  return translate(lang, key, params)
}
