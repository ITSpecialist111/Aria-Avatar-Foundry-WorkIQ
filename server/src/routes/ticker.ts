import { Router } from 'express';
import { getWeather } from '../services/weather';

const router = Router();

/**
 * GET /api/ticker — returns summary data for the client ticker bar.
 * Weather is fetched from Open-Meteo (cached 15min).
 * Meetings/emails come from the client-side MCP calls, not here.
 */
router.get('/ticker', async (_req, res) => {
  try {
    const weather = await getWeather();
    res.json({
      weather: {
        temperature: weather.temperature,
        feelsLike: weather.feelsLike,
        condition: weather.condition,
        icon: weather.icon,
        location: weather.location,
        humidity: weather.humidity,
        windSpeed: weather.windSpeed,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Ticker] Weather fetch failed:', error);
    res.json({
      weather: null,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/weather — detailed weather endpoint (supports ?city= query param).
 */
router.get('/weather', async (req, res) => {
  try {
    const city = req.query.city as string | undefined;
    const weather = await getWeather(city);
    res.json(weather);
  } catch (error) {
    console.error('[Weather] Fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

export default router;
