import { createClient } from '@/lib/supabase/server'
import AutoOrderSettingsClient from './auto-order-settings-client'

/**
 * 自動注文設定ページ（サーバーコンポーネント）
 * メニュー一覧を取得してクライアントコンポーネントに渡す
 */
export default async function AutoOrderSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 有効な業者とメニューを取得
  const { data: vendors } = await supabase
    .from('vendors')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // 業者が存在する場合のみメニューを取得
  const vendorIds = (vendors as Array<{ id: number | string }> | null)?.map(v => v.id) || []
  let menuItems = null

  if (vendorIds.length > 0) {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_active', true)
      .in('vendor_id', vendorIds)
      .order('name', { ascending: true })
    
    menuItems = data
  } else {
    menuItems = []
  }

  // 業者別にメニューをグループ化
  type MenuItem = { vendor_id: number | string; [key: string]: any }
  const menusByVendor = new Map() as Map<number, MenuItem[]>
  (menuItems as MenuItem[] | null)?.forEach((menu) => {
    const vendorId = typeof menu.vendor_id === 'string' ? parseInt(menu.vendor_id, 10) : menu.vendor_id
    if (isNaN(vendorId)) return
    if (!menusByVendor.has(vendorId)) {
      menusByVendor.set(vendorId, [])
    }
    menusByVendor.get(vendorId)?.push(menu)
  })

  // 既存のテンプレートを取得
  const { data: templates } = await supabase
    .from('auto_order_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('day_of_week', { ascending: true, nullsFirst: false })

  return (
    <AutoOrderSettingsClient
      vendors={vendors || []}
      menusByVendor={menusByVendor as any}
      initialTemplates={templates || []}
    />
  )
}
