'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/supabase/types'
import { ChevronRight, MapPin, User, Tag, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Props {
  userId: string
  initialCategories: Category[]
}

export default function OnboardingClient({ userId, initialCategories }: Props) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [city, setCity] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const [categories, setCategories] = useState(initialCategories)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function detectLocation() {
    setGeoLoading(true)
    try {
      const res = await fetch('https://ipapi.co/json/')
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      if (data.error) throw new Error(data.reason)
      setLat(String(data.latitude.toFixed(6)))
      setLng(String(data.longitude.toFixed(6)))
      setCity([data.city, data.country_name].filter(Boolean).join(', '))
      toast.success('Location detected!')
    } catch {
      toast.error('Could not detect location — you can set it later in Settings')
    } finally {
      setGeoLoading(false)
    }
  }

  function updateCategoryColor(id: string, color: string) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)))
  }

  async function finish() {
    setSaving(true)
    try {
      // Save profile
      const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (name.trim()) profileUpdate.full_name = name.trim()
      if (lat && lng) {
        profileUpdate.location_lat = Number(lat)
        profileUpdate.location_lng = Number(lng)
        profileUpdate.city = city
        profileUpdate.city_name = city
      }
      await supabase.from('profiles').update(profileUpdate).eq('id', userId)

      // Save any changed category colors
      for (const cat of categories) {
        await supabase.from('categories').update({ color: cat.color }).eq('id', cat.id)
      }

      // Sync prayer times if location was set
      if (lat && lng) {
        await fetch('/api/prayers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: new Date().toISOString().split('T')[0] }),
        })
      }

      toast.success('Welcome to MyDayOS! 🎉')
      router.push('/week')
    } catch {
      toast.error('Something went wrong, please try again')
    } finally {
      setSaving(false)
    }
  }

  const steps = [
    { n: 1, label: 'Name', icon: User },
    { n: 2, label: 'Location', icon: MapPin },
    { n: 3, label: 'Categories', icon: Tag },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3">
            M
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to MyDayOS</h1>
          <p className="text-slate-400 text-sm mt-1">Let&apos;s set up your account in 3 quick steps</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map(({ n, label, icon: Icon }) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  step === n
                    ? 'bg-blue-600 text-white'
                    : step > n
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-slate-800 text-slate-500',
                )}
              >
                {step > n ? <CheckCircle size={12} /> : <Icon size={12} />}
                {label}
              </div>
              {n < 3 && <ChevronRight size={14} className="text-slate-700" />}
            </div>
          ))}
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">What&apos;s your name?</h2>
              <p className="text-slate-400 text-sm">Used for your daily greeting</p>
            </div>
            <input
              autoFocus
              placeholder="e.g. Mohamed"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(2)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Your location</h2>
              <p className="text-slate-400 text-sm">
                Used to calculate accurate prayer times. You can skip this and set it later in
                Settings.
              </p>
            </div>

            <button
              onClick={detectLocation}
              disabled={geoLoading}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-white py-3 rounded-xl text-sm transition-colors"
            >
              <MapPin size={16} className="text-blue-400" />
              {geoLoading ? 'Detecting...' : '📍 Auto-detect my location'}
            </button>

            {city && (
              <p className="text-sm text-green-400 text-center">📍 {city}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Latitude"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <input
                placeholder="Longitude"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium py-3 rounded-xl transition-colors text-sm"
              >
                Skip for now
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Categories */}
        {step === 3 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Your categories</h2>
              <p className="text-slate-400 text-sm">
                These 7 categories organise your tasks and prayers. You can customise colours now or
                later in Settings.
              </p>
            </div>

            {categories.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                Categories will be set up automatically.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm text-white flex-1">
                      {cat.icon} {cat.name}
                    </span>
                    <input
                      type="color"
                      value={cat.color}
                      onChange={(e) => updateCategoryColor(cat.id, e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                      title="Change colour"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={finish}
              disabled={saving}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {saving ? 'Setting up...' : "Let's go! 🚀"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
