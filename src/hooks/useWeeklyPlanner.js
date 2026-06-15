import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { generateWeeklyPlan } from '../services/aiService';
import { fetchWeatherForecast } from '../services/weatherCache';

export const useWeeklyPlanner = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [weather, setWeather] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const productsSnap = await getDocs(collection(db, 'products'));
      const productsData = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProducts(productsData);

      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const historyQuery = query(
        collection(db, 'schedule'),
        where('date', '>=', fourteenDaysAgo.toISOString().split('T')[0]),
        orderBy('date', 'desc'),
        limit(20)
      );
      const historySnap = await getDocs(historyQuery);
      const historyData = historySnap.docs.map(d => d.data());
      setHistory(historyData);

      const weatherData = await fetchWeatherForecast();
      setWeather(weatherData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const plan = await generateWeeklyPlan(products, history, weather);
      setRecommendations(plan);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const approvePlan = async (planData) => {
    try {
      const batch = [];
      for (const day of planData) {
        batch.push({
          date: day.date,
          drip: `Apply ${day.product} via drip`,
          spray: `${day.product} – ${day.dose}`,
          field: 'AI Recommended',
          note: `AI: ${day.reason}${day.lowStockWarning ? ' ⚠️ ' + day.lowStockWarning : ''}`,
          type: 'monitor',
          done: false
        });
      }
      for (const entry of batch) {
        await addDoc(collection(db, 'schedule'), entry);
      }
      return { success: true, count: batch.length };
    } catch (err) {
      throw new Error(`Failed to approve plan: ${err.message}`);
    }
  };

  return { recommendations, loading, error, products, history, weather, loadData, generatePlan, approvePlan };
};
