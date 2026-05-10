'use client'

import { useState } from 'react'
import { Profile } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { Settings, MapPin, Bell, Moon, Briefcase, User, Save } from 'lucide-react'
import toast from 'react-hot-toast'

interface SettingsPageClientProps {
  userId: string
  profile: Profile | null
  email: string
}

const PRAYER_METHODS = [
  { id: 'MWL', name: 'Muslim World League' },
  { id: 'ISNA', name: 'ISNA (North America)' },
  { id: 'Egypt', name: 'Egyptian General Authority' },
  { id: 'Makkah', name: 'Umm al-Qura (Makkah)' },
]

export default function SettingsPageClient({ userId, profile, email }: SettingsPageClientProps) {
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    prayer_method: profile?.prayer_method ?? 'MWL',
    location_lat: profile?.location_lat ?? '',
    location_lng: profile?.location_lng ?? '',
    city_name: profile?.city_name ?? '',
    notification_offset_minutes: profile?.notification_offset_minutes ?? 10,
    work_start_hour: profile?.work_start_hour ?? 9,
    work_hours_per_day: profile?.work_hours_per_day ?? 8,
  })
  const [saving, setSaving] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const supabase = createClient()

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name,
      prayer_method: form.prayer_method,
      location_lat: form.location_lat ? Number(form.location_lat) : null,
      location_lng: form.location_lng ? Number(form.location_lng) : null,
      city_name: form.city_name,
      notification_offset_minutes: form.notification_offset_minutes,
      work_start_hour: form.work_start_hour,
      work_hours_per_day: form.work_hours_per_day,
      updated_at: new Date().toISOString(),
    }).eq('id', userId)
    setSaving(false)
    if (error) toast.error('Failed to save settings')
    else toast.success('Settings saved!')
  }

  function detectLocation() {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        setForm(f => ({
          ...f,
          location_lat: pos.coords.latitude.toFixed(6),
          location_lng: pos.coords.longitude.toFixed(6),
        }))
        // Reverse geocode using a free API
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || ''
          const country = data.address?.country || ''
          setForm(f => ({ ...f, city_name: [city, country].filter(Boolean).join(', ') }))
        } catch { /* ignore reverse geocode errors */ }
        setGeoLoading(false)
        toast.success('Location detected!')
      },
      () => { toast.error('Location access denied'); setGeoLoading(false) }
    )
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
            {form.city_name && (
              <p className="text-xs text-slate-400 mt-1.5">📍 {form.city_name}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Alert {form.notification_offset_minutes} min before prayer
            </label>
            <input type="range" min="0" max="30" step="5" value={form.notification_offset_minutes}
              onChange={e => setForm(f => ({ ...f, notification_offset_minutes: Number(e.target.value) }))}
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
            <input type="number" min="1" max="12" value={form.work_hours_per_day}
              onChange={e => setForm(f => ({ ...f, work_hours_per_day: Number(e.target.value) }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500" />
          </div>
        </div>
      </Section>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl transition-colors">
        <Save size={16} />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
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
