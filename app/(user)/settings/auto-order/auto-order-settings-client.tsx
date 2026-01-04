'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/database.types'

type Vendor = Database['public']['Tables']['vendors']['Row']
type MenuItem = Database['public']['Tables']['menu_items']['Row']
type AutoOrderTemplate = Database['public']['Tables']['auto_order_templates']['Row']

interface AutoOrderSettingsClientProps {
  vendors: Vendor[]
  menusByVendor: Map<number, MenuItem[]>
  initialTemplates: AutoOrderTemplate[]
}

const DAYS_OF_WEEK = [
  { value: 0, label: '日曜日' },
  { value: 1, label: '月曜日' },
  { value: 2, label: '火曜日' },
  { value: 3, label: '水曜日' },
  { value: 4, label: '木曜日' },
  { value: 5, label: '金曜日' },
  { value: 6, label: '土曜日' },
  { value: null, label: '毎日' },
]

/**
 * 自動注文設定クライアントコンポーネント
 */
export default function AutoOrderSettingsClient({
  vendors,
  menusByVendor,
  initialTemplates,
}: AutoOrderSettingsClientProps) {
  const [templates, setTemplates] = useState<AutoOrderTemplate[]>(initialTemplates)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const supabase = createClient()

  // フォーム状態
  const [formDayOfWeek, setFormDayOfWeek] = useState<number | null>(null)
  const [formMenuId, setFormMenuId] = useState<number | null>(null)
  const [formQuantity, setFormQuantity] = useState(1)

  // テンプレートを曜日別にグループ化
  const templatesByDay = new Map<number | null, AutoOrderTemplate[]>()
  templates.forEach((template) => {
    const day = template.day_of_week
    if (!templatesByDay.has(day)) {
      templatesByDay.set(day, [])
    }
    templatesByDay.get(day)?.push(template)
  })

  const resetForm = () => {
    setFormDayOfWeek(null)
    setFormMenuId(null)
    setFormQuantity(1)
    setShowAddForm(false)
    setEditingId(null)
  }

  const handleAdd = () => {
    resetForm()
    setShowAddForm(true)
  }

  const handleEdit = (template: AutoOrderTemplate) => {
    setFormDayOfWeek(template.day_of_week)
    setFormMenuId(template.menu_id)
    setFormQuantity(template.quantity)
    setEditingId(template.id)
    setShowAddForm(true)
  }

  // 重複チェック関数
  const checkDuplicate = (dayOfWeek: number | null): string | null => {
    // 編集時は現在編集中のテンプレートを除外
    const otherTemplates = templates.filter(t => t.id !== editingId)

    // 毎日テンプレート（day_of_week = null）の場合
    if (dayOfWeek === null) {
      // 既に毎日テンプレートがあるかチェック
      const hasEveryday = otherTemplates.some(t => t.day_of_week === null)
      if (hasEveryday) {
        return '毎日のテンプレートは既に設定されています。既存のテンプレートを編集するか削除してください。'
      }
      // 特定の曜日のテンプレートがあるかチェック（毎日テンプレートは全曜日に適用されるため）
      const hasSpecificDay = otherTemplates.some(t => t.day_of_week !== null)
      if (hasSpecificDay) {
        return '特定の曜日のテンプレートが既に設定されています。毎日テンプレートと同時に設定することはできません。'
      }
    } else {
      // 特定の曜日のテンプレートの場合
      // 同じ曜日のテンプレートがあるかチェック
      const hasSameDay = otherTemplates.some(t => t.day_of_week === dayOfWeek)
      if (hasSameDay) {
        const dayLabel = DAYS_OF_WEEK.find(d => d.value === dayOfWeek)?.label || 'この曜日'
        return `${dayLabel}のテンプレートは既に設定されています。既存のテンプレートを編集するか削除してください。`
      }
      // 毎日テンプレートがあるかチェック（毎日テンプレートは全曜日に適用されるため）
      const hasEveryday = otherTemplates.some(t => t.day_of_week === null)
      if (hasEveryday) {
        return '毎日のテンプレートが既に設定されています。特定の曜日のテンプレートと同時に設定することはできません。'
      }
    }

    return null
  }

  const handleSave = async () => {
    if (!formMenuId || formQuantity < 1) {
      alert('メニューと数量を正しく入力してください')
      return
    }

    // 重複チェック
    const duplicateError = checkDuplicate(formDayOfWeek)
    if (duplicateError) {
      alert(duplicateError)
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('認証が必要です')
        return
      }

      if (editingId) {
        // 更新
        const { error } = await (supabase
          .from('auto_order_templates') as any)
          .update({
            menu_id: formMenuId,
            quantity: formQuantity,
            day_of_week: formDayOfWeek,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        // 新規作成
        const { error } = await (supabase
          .from('auto_order_templates') as any)
          .insert({
            user_id: user.id,
            menu_id: formMenuId,
            quantity: formQuantity,
            day_of_week: formDayOfWeek,
          })

        if (error) throw error
      }

      // テンプレート一覧を再取得
      const { data: newTemplates } = await supabase
        .from('auto_order_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true, nullsFirst: false })

      if (newTemplates) {
        setTemplates(newTemplates)
      }

      resetForm()
    } catch (error) {
      console.error('Failed to save template:', error)
      alert('テンプレートの保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('このテンプレートを削除しますか？')) {
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('認証が必要です')
        return
      }

      const { error } = await supabase
        .from('auto_order_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      // テンプレート一覧を再取得
      const { data: newTemplates } = await supabase
        .from('auto_order_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true, nullsFirst: false })

      if (newTemplates) {
        setTemplates(newTemplates)
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
      alert('テンプレートの削除に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // メニュー名を取得
  const getMenuName = (menuId: number): string => {
    for (const [vendorId, menus] of menusByVendor.entries()) {
      const menu = menus.find(m => m.id === menuId)
      if (menu) {
        const vendor = vendors.find(v => v.id === vendorId)
        return `${vendor?.name || ''} - ${menu.name}`
      }
    }
    return `メニューID: ${menuId}`
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">⚙️ 自動注文設定</h1>
        <p className="text-gray-500 mt-1">毎日自動でお弁当を注文する設定</p>
      </div>

      {/* テンプレート一覧 */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">自動注文テンプレート</h2>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            + テンプレート追加
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>テンプレートがありません</p>
            <p className="text-sm mt-1">「テンプレート追加」ボタンから追加してください</p>
          </div>
        ) : (
          <div className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const dayTemplates = templatesByDay.get(day.value) || []
              if (dayTemplates.length === 0) return null

              return (
                <div key={day.value ?? 'everyday'} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <h3 className="font-medium text-gray-700 mb-2">{day.label}</h3>
                  <div className="space-y-2">
                    {dayTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-gray-800">
                            {getMenuName(template.menu_id)}
                          </div>
                          <div className="text-sm text-gray-500">
                            数量: {template.quantity}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(template)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            disabled={loading}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 追加・編集フォーム */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">
            {editingId ? 'テンプレート編集' : 'テンプレート追加'}
          </h2>
          <div className="space-y-4">
            {/* 曜日選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                曜日
              </label>
              <select
                value={formDayOfWeek ?? ''}
                onChange={(e) => setFormDayOfWeek(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">毎日</option>
                {DAYS_OF_WEEK.filter(d => d.value !== null).map((day) => {
                  // 編集時は現在編集中のテンプレートを除外
                  const otherTemplates = templates.filter(t => t.id !== editingId)
                  // 毎日テンプレートがある場合は、特定の曜日は選択不可
                  const hasEveryday = otherTemplates.some(t => t.day_of_week === null)
                  // 同じ曜日のテンプレートがある場合は選択不可
                  const hasSameDay = otherTemplates.some(t => t.day_of_week === day.value)
                  const isDisabled = hasEveryday || hasSameDay

                  return (
                    <option
                      key={day.value}
                      value={day.value}
                      disabled={isDisabled}
                    >
                      {day.label}
                      {isDisabled ? ' (既に設定済み)' : ''}
                    </option>
                  )
                })}
              </select>
              {(() => {
                const otherTemplates = templates.filter(t => t.id !== editingId)
                const hasEveryday = otherTemplates.some(t => t.day_of_week === null)
                const hasSpecificDay = otherTemplates.some(t => t.day_of_week !== null)
                
                if (hasEveryday && formDayOfWeek === null) {
                  return (
                    <p className="mt-1 text-sm text-red-600">
                      毎日のテンプレートは既に設定されています
                    </p>
                  )
                }
                if (hasEveryday && formDayOfWeek !== null) {
                  return (
                    <p className="mt-1 text-sm text-red-600">
                      毎日のテンプレートが既に設定されているため、特定の曜日は選択できません
                    </p>
                  )
                }
                if (hasSpecificDay && formDayOfWeek === null) {
                  return (
                    <p className="mt-1 text-sm text-red-600">
                      特定の曜日のテンプレートが既に設定されているため、毎日テンプレートは設定できません
                    </p>
                  )
                }
                return null
              })()}
            </div>

            {/* メニュー選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メニュー
              </label>
              <select
                value={formMenuId ?? ''}
                onChange={(e) => setFormMenuId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">選択してください</option>
                {vendors.map((vendor) => {
                  const menus = menusByVendor.get(vendor.id) || []
                  if (menus.length === 0) return null
                  return (
                    <optgroup key={vendor.id} label={vendor.name}>
                      {menus.map((menu) => (
                        <option key={menu.id} value={menu.id}>
                          {menu.name}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>

            {/* 数量入力 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                数量
              </label>
              <input
                type="number"
                min="1"
                value={formQuantity}
                onChange={(e) => setFormQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* ボタン */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={resetForm}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 注意事項 */}
      <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
        <h3 className="font-medium text-amber-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>注意事項</span>
        </h3>
        <ul className="mt-2 text-sm text-amber-700 space-y-1">
          <li>• 自動注文は毎日の締切時刻に実行されます</li>
          <li>• 既に注文がある日はスキップされます</li>
          <li>• 自動注文後も締切前であれば変更・キャンセルできます</li>
          <li>• 同じ曜日（または毎日）に複数のテンプレートを設定することはできません</li>
          <li>• 毎日テンプレートと特定の曜日テンプレートを同時に設定することはできません</li>
        </ul>
      </div>
    </div>
  )
}
