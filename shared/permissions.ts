// Single source of truth for permissions, used by the API (enforcement) and the UI (role editor, menus).

export interface PermissionGroup {
  id: string
  title: string
  kind: 'staff' | 'student'
  items: { key: string; label: string }[]
}

const g = (id: string, title: string, kind: 'staff' | 'student', items: [string, string][]): PermissionGroup => ({
  id,
  title,
  kind,
  items: items.map(([k, label]) => ({ key: `${id}.${k}`, label })),
})

export const PERMISSION_GROUPS: PermissionGroup[] = [
  g('dashboard', 'لوحة التحكم', 'staff', [['view', 'عرض لوحة التحكم']]),
  g('maintenance', 'بلاغات الصيانة', 'staff', [
    ['list', 'قائمة البلاغات'],
    ['update', 'تحديث حالة البلاغ'],
    ['assign', 'إسناد البلاغ لفني'],
    ['delete', 'حذف بلاغ'],
    ['export', 'تصدير Excel'],
    ['notify', 'استقبال إشعارات البلاغات الجديدة'],
  ]),
  g('inspections', 'التفتيش', 'staff', [
    ['list', 'عرض الغرف والأجنحة وحالة التفتيش'],
    ['inspect', 'تقييم وتعديل التقييم'],
    ['delete', 'حذف تقييم'],
    ['criteria', 'إدارة المعايير'],
  ]),
  g('results', 'النتائج والجوائز', 'staff', [
    ['view', 'عرض النتائج'],
    ['export', 'تصدير وطباعة النتائج'],
    ['publish', 'إعلان النتائج للطلاب'],
  ]),
  g('students', 'الطلاب', 'staff', [
    ['list', 'قائمة الطلاب'],
    ['create', 'إضافة طالب'],
    ['edit', 'تعديل بيانات الطالب'],
    ['delete', 'حذف طالب'],
    ['import', 'استيراد الطلاب من Excel'],
    ['suspend', 'إيقاف وتفعيل الحساب'],
    ['block_requests', 'منع وإعادة استقبال البلاغات'],
    ['send_link', 'إرسال رابط التفعيل'],
  ]),
  g('staff', 'الموظفين', 'staff', [
    ['list', 'قائمة الموظفين'],
    ['create', 'إضافة موظف'],
    ['edit', 'تعديل موظف'],
    ['delete', 'حذف موظف'],
  ]),
  g('roles', 'الصلاحيات', 'staff', [
    ['list', 'قائمة الصلاحيات'],
    ['create', 'إضافة صلاحية'],
    ['edit', 'تعديل صلاحية'],
    ['delete', 'حذف صلاحية'],
  ]),
  g('housing', 'المباني والغرف', 'staff', [
    ['list', 'عرض المباني والغرف'],
    ['manage', 'إضافة وتعديل وحذف'],
    ['qr', 'طباعة الباركود'],
  ]),
  g('activity', 'سجل الأنشطة', 'staff', [['view', 'عرض سجل الأنشطة']]),
  g('settings', 'الإعدادات', 'staff', [
    ['manage', 'تعديل الإعدادات والجوائز'],
    ['backup', 'تنزيل النسخ الاحتياطية'],
  ]),
  g('portal', 'بوابة الطالب', 'student', [
    ['maintenance_create', 'رفع بلاغ صيانة'],
    ['maintenance_view', 'متابعة بلاغاتي'],
    ['inspection_view', 'عرض تقييم غرفتي وجناحي'],
    ['results_view', 'عرض الفائزين بالجوائز'],
  ]),
]

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((grp) => grp.items.map((i) => i.key))
export const permissionsFor = (kind: 'staff' | 'student') =>
  PERMISSION_GROUPS.filter((grp) => grp.kind === kind).flatMap((grp) => grp.items.map((i) => i.key))

export const DEFAULT_ROLES: { nameAr: string; nameEn: string; kind: 'staff' | 'student'; isDefault?: boolean; permissions: string[] }[] = [
  {
    nameAr: 'مشرف سكن',
    nameEn: 'Housing supervisor',
    kind: 'staff',
    permissions: [
      'dashboard.view', 'maintenance.list', 'maintenance.update', 'maintenance.assign', 'maintenance.export', 'maintenance.notify',
      'inspections.list', 'inspections.inspect', 'results.view', 'students.list', 'students.edit', 'students.suspend',
      'students.block_requests', 'students.send_link', 'housing.list', 'housing.qr',
    ],
  },
  {
    nameAr: 'فني صيانة',
    nameEn: 'Maintenance technician',
    kind: 'staff',
    permissions: ['dashboard.view', 'maintenance.list', 'maintenance.update', 'maintenance.notify'],
  },
  {
    nameAr: 'لجنة التفتيش',
    nameEn: 'Inspection committee',
    kind: 'staff',
    permissions: ['dashboard.view', 'inspections.list', 'inspections.inspect', 'results.view', 'housing.list'],
  },
  { nameAr: 'طالب', nameEn: 'Student', kind: 'student', isDefault: true, permissions: permissionsFor('student') },
]
