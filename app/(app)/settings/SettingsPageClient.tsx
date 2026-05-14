'use client'

import { useState, useRef, useEffect } from 'react'
import { Profile, Category } from '@/lib/supabase/types'
import { Settings, MapPin, Bell, Briefcase, User, Save, Tag, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

interface SettingsPageClientProps {
  userId: string
  profile: Profile | null
  email: string
  initialCategories: Category[]
}

// ─── Predefined icon & colour palettes ───────────────────────────────────────
const PRESET_ICONS = [
  '💼', '📊', '💻', '📋', '📁', '🖥️',
  '📚', '🎓', '📖', '✏️', '🔬', '🧪',
  '👨‍👩‍👦', '❤️', '🏠', '👶', '🤝',
  '🏃', '🧘', '💪', '⚽', '🎾', '🏋️',
  '💰', '📈', '💳', '🏦',
  '🎨', '🎵', '📷', '✍️', '🎭',
  '🌟', '🎯', '🚀', '🌱', '✨', '⭐',
  '🕌', '🙏', '🌙', '📿',
  '📌', '🏷️', '📝', '🔖', '🗂️',
  '🧠', '🔥', '💡', '⚡', '🌊',
]

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b',
  '#ef4444', '#f97316', '#06b6d4', '#ec4899',
  '#14b8a6', '#64748b', '#a855f7', '#84cc16',
]

const PRAYER_METHODS = [
  { id: 'MWL', name: 'Muslim World League' },
  { id: 'ISNA', name: 'ISNA (North America)' },
  { id: 'Egypt', name: 'Egyptian General Authority' },
  { id: 'Makkah', name: 'Umm al-Qura (Makkah)' },
]

export default function SettingsPageClient({ userId, profile, email, initialCategories }: SettingsPageClientProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [newCatIcon, setNewCatIcon] = useState('📌')
  const [catSaving, setCatSaving] = useState(false)
  const supabase = createClient()

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    prayer_method: profile?.prayer_method ?? 'MWL',
    location_lat: profile?.location_lat != null ? String(profile.location_lat) : '',
    location_lng: profile?.location_lng != null ? String(profile.location_lng) : '',
    city: profile?.city_name ?? profile?.city ?? '',
    prayer_notification_offset: profile?.notification_offset_minutes ?? profile?.prayer_notification_offset ?? 10,
    work_start_hour: profile?.work_start_hour ?? 9,
    work_hours: profile?.work_hours_per_day ?? profile?.work_hours ?? 8,
  })
  const [saving, setSaving] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: form.full_name,
        prayer_method: form.prayer_method,
        location_lat: form.location_lat ? Number(form.location_lat) : null,
        location_lng: form.location_lng ? Number(form.location_lng) : null,
        city: form.city,
        prayer_notification_offset: form.prayer_notification_offset,
        work_start_hour: form.work_start_hour,
        work_hours: form.work_hours,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const err = await res.json()
      console.error('Settings save error:', err)
      toast.error(`Failed to save: ${err.error}`)
      return
    }
    toast.success('Settings saved!')

    // Auto-sync prayer times for today if location is set
    if (form.location_lat && form.location_lng) {
      setSyncing(true)
      try {
        const today = new Date().toISOString().split('T')[0]
        const res = await fetch('/api/prayers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: today }),
        })
        if (res.ok) toast.success('Prayer times synced!')
        else {
          const err = await res.json()
          toast.error(err.error ?? 'Prayer sync failed')
        }
      } catch {
        toast.error('Prayer sync failed — check network')
      } finally {
        setSyncing(false)
      }
    }
  }

  async function detectLocation() {
    setGeoLoading(true)
    try {
      const res = await fetch('https://ipapi.co/json/')
      if (!res.ok) throw new Error('request failed')
      const data = await res.json()
      if (data.error) throw new Error(data.reason || 'lookup failed')
      const lat = String(data.latitude.toFixed(6))
      const lng = String(data.longitude.toFixed(6))
      const city = [data.city, data.country_name].filter(Boolean).join(', ')
      setForm(f => ({ ...f, location_lat: lat, location_lng: lng, city }))
      toast.success('Location detected! Click Save Settings to apply.')
    } catch {
      toast.error('Could not detect location — enter coordinates manually')
    } finally {
      setGeoLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Configure your MyDayOS experience</p>
      </div>

      {/* Account */}
      <Section icon={User} title="Account">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Full Name</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Email</label>
            <input value={email} disabled className="w-full bg-slate-800 border border-slate-800 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed" />
          </div>
        </div>
      </Section>

      {/* Prayer */}
      <Section icon={Bell} title="Prayer Settings">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Calculation Method</label>
            <select value={form.prayer_method} onChange={e => setForm(f => ({ ...f, prayer_method: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
              {PRAYER_METHODS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-2 block flex items-center gap-1">
              <MapPin size={11} /> Location
            </label>
            <div className="flex gap-2 mb-2">
              <button onClick={detectLocation} disabled={geoLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                {geoLoading ? 'Detecting...' : '📍 Auto-detect'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Latitude" value={form.location_lat}
                onChange={e => setForm(f => ({ ...f, location_lat: e.target.value }))}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500" />
              <input placeholder="Longitude" value={form.location_lng}
                onChange={e => setForm(f => ({ ...f, location_lng: e.target.value }))}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500" />
            </div>
            {form.city && (
              <p className="text-xs text-slate-400 mt-1.5">📍 {form.city}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Alert {form.prayer_notification_offset} min before prayer
            </label>
            <input type="range" min="0" max="30" step="5" value={form.prayer_notification_offset}
              onChange={e => setForm(f => ({ ...f, prayer_notification_offset: Number(e.target.value) }))}
              className="w-full accent-purple-500" />
            <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
              <span>0 min</span><span>15 min</span><span>30 min</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Work */}
      <Section icon={Briefcase} title="Work Settings">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Work start hour</label>
            <select value={form.work_start_hour} onChange={e => setForm(f => ({ ...f, work_start_hour: Number(e.target.value) }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500">
              {Array.from({ length: 14 }, (_, i) => i + 5).map(h => (
                <option key={h} value={h}>{h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Hours per day</label>
            <input type="number" min="1" max="12" value={form.work_hours}
              onChange={e => setForm(f => ({ ...f, work_hours: Number(e.target.value) }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500" />
          </div>
        </div>
      </Section>

      <button onClick={save} disabled={saving || syncing}
        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl transition-colors">
        <Save size={16} />
        {saving ? 'Saving...' : syncing ? 'Syncing prayers...' : 'Save Settings'}
      </button>

      {/* Categories */}
      <Section icon={Tag} title="Categories">
        <div className="space-y-2 mb-4">
          {categories.map((cat) => (
            <div key={cat.id} className="p-3 bg-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <ColorPicker
                  value={cat.color}
                  onChange={async (color) => {
                    setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, color } : c))
                    await supabase.from('categories').update({ color }).eq('id', cat.id)
                  }}
                />
                <IconPicker
                  value={cat.icon}
                  onChange={async (icon) => {
                    setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, icon } : c))
                    await supabase.from('categories').update({ icon }).eq('id', cat.id)
                  }}
                />
                <input
                  defaultValue={cat.name}
                  onBlur={async (e) => {
                    const name = e.target.value.trim()
                    if (!name) return
                    setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, name } : c))
                    await supabase.from('categories').update({ name }).eq('id', cat.id)
                  }}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
                {!cat.is_default && (
                  <button
                    onClick={async () => {
                      await supabase.from('categories').delete().eq('id', cat.id)
                      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
                      toast.success('Category deleted')
                    }}
                    className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add new category */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-2">
          <p className="text-xs text-slate-500 font-medium">New category</p>
          <div className="flex items-center gap-2">
            <ColorPicker value={newCatColor} onChange={setNewCatColor} />
            <IconPicker value={newCatIcon} onChange={setNewCatIcon} />
            <input
              placeholder="Category name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={addCategory}
              disabled={!newCatName.trim() || catSaving}
              className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-sm transition-colors flex-shrink-0"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          {/* Preview */}
          {newCatName.trim() && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-slate-500">Preview:</span>
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${newCatColor}22`, color: newCatColor, border: `1px solid ${newCatColor}44` }}
              >
                {newCatIcon} {newCatName.trim()}
              </span>
            </div>
          )}
        </div>
      </Section>
    </div>
  )

  async function addCategory() {
    if (!newCatName.trim() || catSaving) return
    setCatSaving(true)
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, name: newCatName.trim(), color: newCatColor, icon: newCatIcon || '📌', is_default: false })
      .select()
      .single()
    setCatSaving(false)
    if (error) { toast.error('Failed to add category'); return }
    setCategories((prev) => [...prev, data])
    setNewCatName('')
    setNewCatIcon('📌')
    toast.success('Category added!')
  }
}

// ─── Icon Picker ──────────────────────────────────────────────────────────────
function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Pick icon"
        className="w-10 h-10 flex items-center justify-center text-xl bg-slate-700 hover:bg-slate-600 rounded-xl border border-slate-600 hover:border-purple-500 transition-colors"
      >
        {value}
      </button>
      {open && (
        <div className="absolute z-50 top-12 left-0 bg-slate-800 border border-slate-700 rounded-xl p-2.5 shadow-2xl w-60">
          <p className="text-[10px] text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Pick an icon</p>
          <div className="grid grid-cols-8 gap-0.5 mb-2">
            {PRESET_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => { onChange(icon); setOpen(false) }}
                className={cn(
                  'w-7 h-7 flex items-center justify-center text-base rounded-lg transition-colors hover:bg-slate-600',
                  value === icon ? 'bg-purple-500/30 ring-1 ring-purple-500' : '',
                )}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 pt-1.5 border-t border-slate-700">
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Custom emoji…"
              maxLength={4}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              disabled={!custom.trim()}
              onClick={() => { if (custom.trim()) { onChange(custom.trim()); setCustom(''); setOpen(false) } }}
              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Use
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Color Picker ─────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])

  const isPreset = PRESET_COLORS.includes(value)

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Pick color"
        className="w-10 h-10 rounded-xl border-2 border-slate-600 hover:border-purple-500 transition-colors flex-shrink-0"
        style={{ backgroundColor: value }}
      />
      {open && (
        <div className="absolute z-50 top-12 left-0 bg-slate-800 border border-slate-700 rounded-xl p-2.5 shadow-2xl w-52">
          <p className="text-[10px] text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Pick a color</p>
          <div className="grid grid-cols-6 gap-1.5 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false) }}
                className={cn(
                  'w-7 h-7 rounded-lg border-2 transition-all hover:scale-110',
                  value === c ? 'border-white scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-700">
            <div
              className="w-7 h-7 rounded-lg border-2 border-slate-600 cursor-pointer flex-shrink-0 transition-all hover:scale-110"
              style={{ backgroundColor: !isPreset ? value : '#334155' }}
              onClick={() => colorInputRef.current?.click()}
              title="Custom color"
            />
            <span className="text-xs text-slate-400">Custom:</span>
            <span className="text-xs text-slate-500 font-mono">{!isPreset ? value : '—'}</span>
            <input
              ref={colorInputRef}
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: any, title: string, children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
        <Icon size={16} className="text-purple-400" /> {title}
      </h2>
      {children}
    </div>
  )
}
