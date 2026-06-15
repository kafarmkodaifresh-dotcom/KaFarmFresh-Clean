import { collection, doc, getDoc, setDoc, addDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const WEATHER_CITY = 'Kodaikanal';

export const fetchWeatherForecast = async () => {
  try {
    // Try to get cached forecast from Firestore first (cache for 6 hours)
    const cacheRef = doc(db, 'weatherCache', 'forecast');
    const cacheSnap = await getDoc(cacheRef);
    if (cacheSnap.exists()) {
      const data = cacheSnap.data();
      const cacheTime = new Date(data.cachedAt).getTime();
      const now = Date.now();
      if (now - cacheTime < 6 * 60 * 60 * 1000) {
        return data.forecast;
      }
    }

    // Fetch fresh forecast from OpenWeatherMap
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${WEATHER_CITY}&appid=${WEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.cod !== '200') {
      throw new Error('Weather API error');
    }

    // Extract next 7 days (approx 3-hour intervals)
    const forecast = [];
    const seenDates = new Set();
    for (const item of data.list) {
      const date = item.dt_txt.split(' ')[0];
      if (!seenDates.has(date) && forecast.length < 7) {
        seenDates.add(date);
        forecast.push({
          date: date,
          temp: Math.round(item.main.temp),
          humidity: item.main.humidity,
          wind: item.wind.speed,
          rainChance: item.pop ? Math.round(item.pop * 100) : 0,
          description: item.weather[0].description
        });
      }
    }

    // Cache in Firestore
    await setDoc(cacheRef, {
      forecast,
      cachedAt: new Date().toISOString()
    });

    return forecast;
  } catch (error) {
    console.error('Weather fetch error:', error);
    return [];
  }
};
