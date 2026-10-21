import type { zh } from './zh'

export const he = {
  noticeText:
    'מעכשיו מפעילים ומכבים כישורים בהגדרות ← כישורים. כישורים מתיקיות הכישורים של Claude ו־Codex מתחילים כבויים.',
  noticeOpenSettings: 'פתיחת ההגדרות',
  noticeClose: 'סגירה',
  nextSession: 'כישורים ששונו חלים מהפעלה הבאה',
  templateLabel: 'המסמך שיישמר כתבנית',
  templateNone: 'ללא תבנית',
  templateFromTab: 'פתוח בכרטיסייה',
  templateFromProject: 'תיקיית הפרויקט',
  templateUnsaved: 'בכרטיסייה זו יש שינויים שלא נשמרו. הקובץ השמור יהיה התבנית.',
  templateChecking: 'בודק אם יש תוכן מוסתר…',
  templateUnknown:
    'בתבנית קובץ זו לא ניתן לבדוק כאן אם יש תוכן מוסתר, ולכן אי אפשר לשמור את המסמך כמו שהוא. צרו תבנית ריקה ושמרו אותה.',
  templateTooLarge: 'המסמך הזה גדול מדי לשמירה כתבנית',
  installTitle: 'הבינה המלאכותית מציעה להתקין את הכישור הזה',
  installHint:
    'פתחו את התצוגה המקדימה כדי לראות מה הוא כולל, ואז החליטו אם להתקין. כישור שהותקן זמין מההפעלה הבאה.',
  installOpen: 'פתיחת תצוגה מקדימה',
  installDismiss: 'סגירה',
  installDismissed: 'לא הותקן',
  installCancel: 'ביטול',
} satisfies Record<keyof typeof zh, string>
