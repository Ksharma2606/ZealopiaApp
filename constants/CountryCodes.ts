export interface CountryDialCode {
  name: string;
  iso2: string;
  dialCode: string;
}

// Converts a 2-letter ISO country code into its flag emoji using regional indicator symbols.
export const getFlagEmoji = (iso2: string): string =>
  iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

// Curated list of common dial codes. Not exhaustive (~all ISO countries) by design -
// keeps the picker easy to scan; India is first since it's the app's primary market.
export const COUNTRY_CODES: CountryDialCode[] = [
  { name: 'India', iso2: 'IN', dialCode: '+91' },
  { name: 'United States', iso2: 'US', dialCode: '+1' },
  { name: 'United Kingdom', iso2: 'GB', dialCode: '+44' },
  { name: 'United Arab Emirates', iso2: 'AE', dialCode: '+971' },
  { name: 'Saudi Arabia', iso2: 'SA', dialCode: '+966' },
  { name: 'Qatar', iso2: 'QA', dialCode: '+974' },
  { name: 'Kuwait', iso2: 'KW', dialCode: '+965' },
  { name: 'Bahrain', iso2: 'BH', dialCode: '+973' },
  { name: 'Oman', iso2: 'OM', dialCode: '+968' },
  { name: 'Canada', iso2: 'CA', dialCode: '+1' },
  { name: 'Australia', iso2: 'AU', dialCode: '+61' },
  { name: 'New Zealand', iso2: 'NZ', dialCode: '+64' },
  { name: 'Singapore', iso2: 'SG', dialCode: '+65' },
  { name: 'Malaysia', iso2: 'MY', dialCode: '+60' },
  { name: 'Pakistan', iso2: 'PK', dialCode: '+92' },
  { name: 'Bangladesh', iso2: 'BD', dialCode: '+880' },
  { name: 'Sri Lanka', iso2: 'LK', dialCode: '+94' },
  { name: 'Nepal', iso2: 'NP', dialCode: '+977' },
  { name: 'Germany', iso2: 'DE', dialCode: '+49' },
  { name: 'France', iso2: 'FR', dialCode: '+33' },
  { name: 'Spain', iso2: 'ES', dialCode: '+34' },
  { name: 'Italy', iso2: 'IT', dialCode: '+39' },
  { name: 'Netherlands', iso2: 'NL', dialCode: '+31' },
  { name: 'Ireland', iso2: 'IE', dialCode: '+353' },
  { name: 'Philippines', iso2: 'PH', dialCode: '+63' },
  { name: 'Indonesia', iso2: 'ID', dialCode: '+62' },
  { name: 'Thailand', iso2: 'TH', dialCode: '+66' },
  { name: 'Vietnam', iso2: 'VN', dialCode: '+84' },
  { name: 'Hong Kong', iso2: 'HK', dialCode: '+852' },
  { name: 'Japan', iso2: 'JP', dialCode: '+81' },
  { name: 'South Korea', iso2: 'KR', dialCode: '+82' },
  { name: 'China', iso2: 'CN', dialCode: '+86' },
  { name: 'Nigeria', iso2: 'NG', dialCode: '+234' },
  { name: 'South Africa', iso2: 'ZA', dialCode: '+27' },
  { name: 'Kenya', iso2: 'KE', dialCode: '+254' },
  { name: 'Egypt', iso2: 'EG', dialCode: '+20' },
  { name: 'Brazil', iso2: 'BR', dialCode: '+55' },
  { name: 'Mexico', iso2: 'MX', dialCode: '+52' },
];
