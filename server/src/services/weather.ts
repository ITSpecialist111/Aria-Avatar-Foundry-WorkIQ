/**
 * Weather service using Open-Meteo free API (no API key required).
 * Default location: London, UK.
 */

interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  icon: string;
  location: string;
  updatedAt: number;
}

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
}

// WMO weather codes → human-readable conditions + icons
const WMO_CODES: Record<number, { condition: string; icon: string }> = {
  0: { condition: 'Clear sky', icon: '☀️' },
  1: { condition: 'Mainly clear', icon: '🌤️' },
  2: { condition: 'Partly cloudy', icon: '⛅' },
  3: { condition: 'Overcast', icon: '☁️' },
  45: { condition: 'Foggy', icon: '🌫️' },
  48: { condition: 'Rime fog', icon: '🌫️' },
  51: { condition: 'Light drizzle', icon: '🌦️' },
  53: { condition: 'Moderate drizzle', icon: '🌦️' },
  55: { condition: 'Dense drizzle', icon: '🌧️' },
  61: { condition: 'Light rain', icon: '🌧️' },
  63: { condition: 'Moderate rain', icon: '🌧️' },
  65: { condition: 'Heavy rain', icon: '🌧️' },
  71: { condition: 'Light snow', icon: '🌨️' },
  73: { condition: 'Moderate snow', icon: '🌨️' },
  75: { condition: 'Heavy snow', icon: '❄️' },
  80: { condition: 'Rain showers', icon: '🌦️' },
  81: { condition: 'Moderate showers', icon: '🌧️' },
  82: { condition: 'Violent showers', icon: '⛈️' },
  85: { condition: 'Snow showers', icon: '🌨️' },
  86: { condition: 'Heavy snow showers', icon: '❄️' },
  95: { condition: 'Thunderstorm', icon: '⛈️' },
  96: { condition: 'Thunderstorm with hail', icon: '⛈️' },
  99: { condition: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

// London defaults
const DEFAULT_LAT = 51.5074;
const DEFAULT_LON = -0.1278;
const DEFAULT_LOCATION = 'London, UK';

// Cache weather for 15 minutes
let cachedWeather: WeatherData | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

async function geocode(city: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    const data = await res.json() as { results?: Array<{ latitude: number; longitude: number; name: string; country: string }> };
    if (data.results && data.results.length > 0) {
      const r = data.results[0]!;
      return {
        latitude: r.latitude,
        longitude: r.longitude,
        name: r.name,
        country: r.country,
      };
    }
  } catch (err) {
    console.error('[Weather] Geocode failed:', err);
  }
  return null;
}

export async function getWeather(city?: string): Promise<WeatherData> {
  // Return cached if fresh
  if (cachedWeather && Date.now() - cachedWeather.updatedAt < CACHE_TTL_MS && !city) {
    return cachedWeather;
  }

  let lat = DEFAULT_LAT;
  let lon = DEFAULT_LON;
  let location = DEFAULT_LOCATION;

  if (city) {
    const geo = await geocode(city);
    if (geo) {
      lat = geo.latitude;
      lon = geo.longitude;
      location = `${geo.name}, ${geo.country}`;
    }
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`;

  const res = await fetch(url);
  const data = await res.json() as { current?: { weather_code?: number; temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number; wind_speed_10m?: number } };

  const code = data.current?.weather_code ?? 0;
  const wmo = WMO_CODES[code] || { condition: 'Unknown', icon: '🌡️' };

  const weather: WeatherData = {
    temperature: Math.round(data.current?.temperature_2m ?? 0),
    feelsLike: Math.round(data.current?.apparent_temperature ?? 0),
    humidity: data.current?.relative_humidity_2m ?? 0,
    windSpeed: Math.round(data.current?.wind_speed_10m ?? 0),
    condition: wmo.condition,
    icon: wmo.icon,
    location,
    updatedAt: Date.now(),
  };

  // Cache if using default location
  if (!city) {
    cachedWeather = weather;
  }

  console.log(`[Weather] ${weather.icon} ${weather.location}: ${weather.temperature}°C, ${weather.condition}`);
  return weather;
}
