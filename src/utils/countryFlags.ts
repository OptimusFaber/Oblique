/** ISO 3166-1 alpha-2 → flag emoji (Unicode regional indicators). */
export function countryCodeToFlagEmoji(code: string): string {
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  const A = 0x1f1e6
  return String.fromCodePoint(A + c.charCodeAt(0) - 65, A + c.charCodeAt(1) - 65)
}

export const COMMON_COUNTRY_OPTIONS: { code: string; en: string; ru: string }[] = [
  { code: 'US', en: 'United States', ru: 'США' },
  { code: 'GB', en: 'United Kingdom', ru: 'Великобритания' },
  { code: 'DE', en: 'Germany', ru: 'Германия' },
  { code: 'FR', en: 'France', ru: 'Франция' },
  { code: 'NL', en: 'Netherlands', ru: 'Нидерланды' },
  { code: 'SG', en: 'Singapore', ru: 'Сингапур' },
  { code: 'JP', en: 'Japan', ru: 'Япония' },
  { code: 'KR', en: 'South Korea', ru: 'Корея' },
  { code: 'HK', en: 'Hong Kong', ru: 'Гонконг' },
  { code: 'TW', en: 'Taiwan', ru: 'Тайвань' },
  { code: 'RU', en: 'Russia', ru: 'Россия' },
  { code: 'FI', en: 'Finland', ru: 'Финляндия' },
  { code: 'PL', en: 'Poland', ru: 'Польша' },
  { code: 'CH', en: 'Switzerland', ru: 'Швейцария' },
  { code: 'SE', en: 'Sweden', ru: 'Швеция' },
  { code: 'CA', en: 'Canada', ru: 'Канада' },
  { code: 'AU', en: 'Australia', ru: 'Австралия' },
  { code: 'IN', en: 'India', ru: 'Индия' },
  { code: 'BR', en: 'Brazil', ru: 'Бразилия' },
  { code: 'UA', en: 'Ukraine', ru: 'Украина' },
  { code: 'KZ', en: 'Kazakhstan', ru: 'Казахстан' },
]
