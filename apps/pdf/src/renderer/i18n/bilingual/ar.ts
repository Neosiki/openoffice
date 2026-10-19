import type { zh } from './zh'

export const ar = {
  blToggle: 'الترجمة جنبًا إلى جنب',
  blToggleTip:
    'يعرض الترجمة المحفوظة بجانب كل صفحة. تشغيل هذا العرض وحده لا يرسل أي شيء إلى الذكاء الاصطناعي.',
  blLanguage: 'لغة الترجمة',
  blStoredLangs: 'الترجمات المحفوظة',
  blOtherLangs: 'لغات أخرى',
  blLoading: 'جارٍ قراءة بنية المستند… ({done}/{total} صفحة)',
  blLoadingStart: 'جارٍ قراءة بنية المستند…',
  blFailed: 'تعذّرت قراءة بنية المستند، لذا لا يمكن عرض عمود الترجمة.',
  blUnavailable:
    'عمود الترجمة غير متاح: الملف غير محفوظ، أو لا تستطيع هذه النافذة قراءة بنية المستند.',
  blUnsavedPages: 'احفظ لمحاذاة عمود الترجمة مع الصفحات',
  blContinued: 'تتمة من الصفحة السابقة',
  blCollapseAsk: 'هل تريد طي عمود الترجمة؟',
  blCollapse: 'طي',
  blKeep: 'إبقاء',
  blExpand: 'توسيع عمود الترجمة',
  blFontSmaller: 'تصغير نص الترجمة',
  blFontLarger: 'تكبير نص الترجمة',
  blResize: 'تغيير عرض عمود الترجمة',
  blClose: 'إيقاف الترجمة جنبًا إلى جنب',
  blPageHeader: 'الصفحة {page}',
  blPageCount: 'تمت ترجمة {translated}/{units}',
  blNoText: 'لا يوجد في هذه الصفحة نص للترجمة.',
  blPendingTip: 'لم تُترجم بعد (النص الأصلي).',
  blFailedTip: 'تعذّرت ترجمة هذه الفقرة (النص الأصلي).',
  blEditedTip: 'ترجمة عدّلها شخص.',
} satisfies Record<keyof typeof zh, string>
