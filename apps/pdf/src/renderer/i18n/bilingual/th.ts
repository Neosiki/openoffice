import type { zh } from './zh'

export const th = {
  blToggle: 'คำแปลเคียงข้าง',
  blToggleTip:
    'แสดงคำแปลที่บันทึกไว้ข้างแต่ละหน้า การเปิดมุมมองนี้เพียงอย่างเดียวจะไม่ส่งอะไรไปยัง AI',
  blLanguage: 'ภาษาของคำแปล',
  blStoredLangs: 'คำแปลที่บันทึกไว้',
  blOtherLangs: 'ภาษาอื่น',
  blLoading: 'กำลังอ่านโครงสร้างเอกสาร… ({done}/{total} หน้า)',
  blLoadingStart: 'กำลังอ่านโครงสร้างเอกสาร…',
  blFailed: 'อ่านโครงสร้างเอกสารไม่ได้ จึงแสดงคอลัมน์คำแปลไม่ได้',
  blUnavailable:
    'แสดงคอลัมน์คำแปลไม่ได้: ยังไม่ได้บันทึกไฟล์ หรือหน้าต่างนี้อ่านโครงสร้างเอกสารไม่ได้',
  blUnsavedPages: 'บันทึกเพื่อให้คอลัมน์คำแปลตรงกับหน้า',
  blContinued: 'ต่อจากหน้าก่อนหน้า',
  blCollapseAsk: 'พับคอลัมน์คำแปลไหม',
  blCollapse: 'พับ',
  blKeep: 'คงไว้',
  blExpand: 'กางคอลัมน์คำแปล',
  blFontSmaller: 'ตัวอักษรคำแปลเล็กลง',
  blFontLarger: 'ตัวอักษรคำแปลใหญ่ขึ้น',
  blResize: 'ปรับความกว้างคอลัมน์คำแปล',
  blClose: 'ปิดคำแปลเคียงข้าง',
  blPageHeader: 'หน้า {page}',
  blPageCount: 'แปลแล้ว {translated}/{units}',
  blNoText: 'หน้านี้ไม่มีข้อความให้แปล',
  blPendingTip: 'ยังไม่ได้แปล (ข้อความต้นฉบับ)',
  blFailedTip: 'แปลย่อหน้านี้ไม่ได้ (ข้อความต้นฉบับ)',
  blEditedTip: 'คำแปลที่มีคนแก้ไข',
} satisfies Record<keyof typeof zh, string>
