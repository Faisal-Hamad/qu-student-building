import { useState } from 'react'
import { useApi } from '../../api'
import { Empty, Loading, PageTitle } from '../../components/ui'
import { formatDate } from '../../lib/util'
import type { ActivityRow } from '../../../shared/types'

const LABELS: Record<string, string> = {
  'auth.login': 'تسجيل دخول',
  'auth.activated': 'تفعيل الحساب',
  'auth.password_reset': 'إعادة تعيين كلمة المرور',
  'auth.password_changed': 'تغيير كلمة المرور',
  'setup.completed': 'إعداد النظام',
  'housing.standard_created': 'إنشاء مبانٍ بالهيكل القياسي',
  'housing.building_created': 'إضافة مبنى',
  'housing.building_deleted': 'حذف مبنى',
  'housing.wing_created': 'إضافة جناح',
  'housing.wing_deleted': 'حذف جناح',
  'housing.room_deleted': 'حذف غرفة',
  'students.created': 'إضافة طالب',
  'students.updated': 'تعديل طالب',
  'students.flags': 'تغيير حالة طالب',
  'students.deleted': 'حذف طالب',
  'students.imported': 'استيراد طلاب',
  'people.link_sent': 'إرسال رابط تفعيل',
  'people.link_generated': 'إنشاء رابط تفعيل يدوي',
  'staff.created': 'إضافة موظف',
  'staff.updated': 'تعديل موظف',
  'staff.deleted': 'حذف موظف',
  'roles.created': 'إضافة صلاحية',
  'roles.updated': 'تعديل صلاحية',
  'roles.deleted': 'حذف صلاحية',
  'maintenance.created': 'رفع بلاغ صيانة',
  'maintenance.updated': 'تحديث بلاغ',
  'maintenance.deleted': 'حذف بلاغ',
  'inspections.saved': 'حفظ تقييم',
  'inspections.deleted': 'حذف تقييم',
  'inspections.new_round': 'بدء جولة تفتيش جديدة',
  'settings.criteria': 'تعديل معايير التفتيش',
  'settings.updated': 'تعديل الإعدادات',
  'results.published': 'إعلان النتائج',
  'results.unpublished': 'إخفاء النتائج',
  'backup.downloaded': 'تنزيل نسخة احتياطية',
}

function summary(d: Record<string, unknown> | null) {
  if (!d) return ''
  const parts = [d.name, d.sr, d.status && `الحالة: ${d.status}`, d.created !== undefined && `جديد ${d.created} · محدّث ${d.updated} · أخطاء ${d.errors}`].filter(Boolean)
  return parts.join(' · ')
}

export default function Activity() {
  const [page, setPage] = useState(1)
  const q = useApi<ActivityRow[]>(`/activity?page=${page}`)
  return (
    <>
      <PageTitle title="سجل الأنشطة" sub="كل العمليات المهمة في النظام، مع من نفذها ومتى" />
      <div className="card overflow-hidden">
        {!q.data ? <Loading /> : q.data.length === 0 ? <Empty>لا توجد أنشطة</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs text-ink-3">
                <tr>
                  <th className="px-3 py-2 text-start">العملية</th>
                  <th className="px-3 py-2 text-start">المستخدم</th>
                  <th className="px-3 py-2 text-start">التاريخ</th>
                  <th className="px-3 py-2 text-start">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {q.data.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{LABELS[a.action] ?? a.action}</div>
                      <div className="text-xs text-ink-3">{summary(a.details)}</div>
                    </td>
                    <td className="px-3 py-2.5">{a.actorName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-ink-2">{formatDate(a.createdAt)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-ink-3" dir="ltr">{a.ip ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-between border-t border-line px-4 py-3">
          <button className="btn-ghost px-3 py-1.5" disabled={page <= 1} onClick={() => setPage(page - 1)}>الأحدث</button>
          <button className="btn-ghost px-3 py-1.5" disabled={(q.data?.length ?? 0) < 50} onClick={() => setPage(page + 1)}>الأقدم</button>
        </div>
      </div>
    </>
  )
}
