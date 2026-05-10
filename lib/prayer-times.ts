import { PrayerTimes } from './supabase/types'

interface AladhanResponse {
  code: number
  status: string
  data: {
    timings: Record<string, string>
    date: { readable: string; timestamp: string }
  }
}

export async function fetchPrayerTimes(
  lat: number,
  lng: number,
  method = 3, // MWL=3, ISNA=2, Egypt=5, Makkah=4
  date?: string
): Promise<PrayerTimes | null> {
  try {
    const dateStr = date ?? new Date().toISOString().split('T')[0]
    const [year, month, day] = dateStr.split('-')
    const url = `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${lat}&longitude=${lng}&method=${method}`

    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null

    const json: AladhanResponse = await res.json()
    const t = json.data.timings

    return {
      Fajr: t.Fajr,
      Dhuhr: t.Dhuhr,
      Asr: t.Asr,
      Maghrib: t.Maghrib,
      Isha: t.Isha,
      Sunrise: t.Sunrise,
      Sunset: t.Sunset,
    }
  } catch {
    return null
  }
}

export const PRAYER_METHOD_MAP: Record<string, number> = {
  MWL: 3,
  ISNA: 2,
  Egypt: 5,
  Makkah: 4,
  Karachi: 1,
  Tehran: 7,
  Shia: 0,
}

// XP per prayer status
export const PRAYER_XP = { on_time: 30, late: 10, missed: 0 } as const

// Determine prayer status based on time elapsed
export function determinePrayerStatus(
  scheduledTime: string,
  completedAt: Date,
  prayerName: string
): 'on_time' | 'late' {
  const [sh, sm] = scheduledTime.split(':').map(Number)
  const scheduledMinutes = sh * 60 + sm
  const completedMinutes = completedAt.getHours() * 60 + completedAt.getMinutes()
  // Allow 30 min grace period for on-time (except Fajr which is more strict)
  const grace = prayerName === 'Fajr' ? 15 : 30
  return completedMinutes <= scheduledMinutes + grace ? 'on_time' : 'late'
}

// Get Qibla direction from lat/lng
export function getQiblaDirection(lat: number, lng: number): number {
  const MECCA_LAT = 21.4225
  const MECCA_LNG = 39.8262
  const latRad = (lat * Math.PI) / 180
  const meccaLatRad = (MECCA_LAT * Math.PI) / 180
  const diffLng = ((MECCA_LNG - lng) * Math.PI) / 180

  const y = Math.sin(diffLng) * Math.cos(meccaLatRad)
  const x =
    Math.cos(latRad) * Math.sin(meccaLatRad) -
    Math.sin(latRad) * Math.cos(meccaLatRad) * Math.cos(diffLng)

  const angle = Math.atan2(y, x)
  return ((angle * 180) / Math.PI + 360) % 360
}
