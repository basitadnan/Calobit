import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { getGreeting, sumMacros } from '../utils/calculations';
import { db } from '../utils/db';
import { Bell, Search, Plus, Check, Trash2, X, Utensils } from 'lucide-react';

const MEAL_ICONS = { breakfast: '🥞', lunch: '🍛', dinner: '🍽️', snack: '🍎' };
const MEAL_COLORS = {
  breakfast: { bg: '#f0fdf4', accent: '#bbf7d0' },
  lunch: { bg: '#f0f9ff', accent: '#bae6fd' },
  dinner: { bg: '#fef7ed', accent: '#fed7aa' },
  snack: { bg: '#fdf4ff', accent: '#f5d0fe' },
};

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'desi', label: 'Desi' },
  { id: 'protein', label: 'Protein' },
  { id: 'fast_food', label: 'Fast Food' },
  { id: 'italian', label: 'Italian' },
  { id: 'asian', label: 'Asian' },
  { id: 'middle_eastern', label: 'Middle Eastern' },
  { id: 'fruits', label: 'Fruits' },
  { id: 'vegetables', label: 'Vegetables' },
  { id: 'staples', label: 'Staples' },
  { id: 'nuts', label: 'Nuts' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'beverages', label: 'Beverages' },
];

export default function Dashboard() {
  const { profile, todayMeals, logMeal, removeMeal, goals, totals, remaining, mealsByType } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [grams, setGrams] = useState(100);
  const [mealType, setMealType] = useState('breakfast');
  const [loadingFoods, setLoadingFoods] = useState(false);

  const caloriePercent = Math.min((totals.calories / goals.calories) * 100, 100);
  const proteinPercent = Math.min((totals.protein / goals.protein) * 100, 100);
  const carbsPercent = Math.min((totals.carbs / goals.carbs) * 100, 100);
  const fatPercent = Math.min((totals.fat / goals.fat) * 100, 100);
  const allGoalsMet = totals.calories >= goals.calories && totals.protein >= goals.protein;

  useEffect(() => {
    let isMounted = true;
    async function loadFoods() {
      setLoadingFoods(true);
      try {
        let collection = db.foods;
        let items = await collection.toArray();
        if (selectedCategory !== 'all') {
          items = items.filter(f => f.category === selectedCategory);
        }
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          items = items.filter(f => f.name.toLowerCase().includes(q));
        }
        if (isMounted) {
          setSearchResults(items.slice(0, 40));
        }
      } catch (e) {
        console.error("Error loading foods:", e);
      } finally {
        if (isMounted) setLoadingFoods(false);
      }
    }
    loadFoods();
    return () => { isMounted = false; };
  }, [searchQuery, selectedCategory]);

  const handleLogFood = () => {
    if (!selectedFood) return;
    const factor = grams / 100;
    const cals = Math.round(selectedFood.caloriesPer100g * factor);
    const prot = Math.round(selectedFood.proteinPer100g * factor * 10) / 10;
    const carbs = Math.round(selectedFood.carbsPer100g * factor * 10) / 10;
    const fat = Math.round(selectedFood.fatPer100g * factor * 10) / 10;

    logMeal({
      name: `${grams}g ${selectedFood.name}`,
      meal_name: `${grams}g ${selectedFood.name}`,
      calories: cals,
      protein_g: prot,
      carbs_g: carbs,
      fat_g: fat,
      type: mealType,
      items: [{
        name: `${grams}g ${selectedFood.name}`,
        calories: cals,
        protein_g: prot,
        carbs_g: carbs,
        fat_g: fat,
      }]
    });
    setSelectedFood(null);
    setGrams(100);
  };

  const arcRadius = 42;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const arcOffset = arcCircumference - (caloriePercent / 100) * arcCircumference;

  return (
    <div className="page fade-in">
      {/* Top Bar */}
      <div className="page-header">
        <div className="greeting">
          <div className="avatar">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <p style={{ fontSize: 14, color: '#6B7280' }}>{getGreeting()} 👋</p>
            <p style={{ fontSize: 18, fontWeight: 700 }}>{profile?.name || 'Friend'}</p>
          </div>
        </div>
        <button style={{ background: 'none', padding: 8 }}><Bell size={22} color="#6B7280" /></button>
      </div>

      {/* Hero Calorie Card */}
      <div className="calorie-hero slide-up">
        <p style={{ fontSize: 13, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>Today's Calories</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
              {totals.calories}
              <span style={{ fontSize: 18, fontWeight: 500, color: '#6B7280' }}> kcal</span>
            </p>
          </div>
          <div style={{ position: 'relative', width: 100, height: 100 }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r={arcRadius} fill="none" stroke="#E5E7EB" strokeWidth="8" />
              <circle cx="50" cy="50" r={arcRadius} fill="none" stroke="#C6F135" strokeWidth="8"
                strokeDasharray={arcCircumference} strokeDashoffset={arcOffset}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1A' }}>{remaining.calories}</span>
              <span style={{ fontSize: 10, color: '#6B7280' }}>Left</span>
            </div>
          </div>
        </div>

        {/* Macro bars */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          {[
            { label: 'Carbs', icon: '🍞', val: totals.carbs, max: goals.carbs, color: '#C6F135', pct: carbsPercent },
            { label: 'Protein', icon: '🥛', val: totals.protein, max: goals.protein, color: '#14B8A6', pct: proteinPercent },
            { label: 'Fat', icon: '🧈', val: totals.fat, max: goals.fat, color: '#F59E0B', pct: fatPercent },
          ].map(m => (
            <div key={m.label} style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{m.icon}</span>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{m.label}</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700 }}>
                {Math.round(m.val)} <span style={{ fontWeight: 400, color: '#9CA3AF' }}>/{m.max}g</span>
              </p>
              <div className="progress-bar" style={{ marginTop: 4 }}>
                <div className="fill" style={{ width: `${m.pct}%`, background: m.val > m.max ? '#EF4444' : m.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Food Database Search & Log Card */}
      <div className="card slide-up" style={{ marginBottom: 20, animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Utensils size={18} color="#C6F135" />
          <p style={{ fontSize: 15, fontWeight: 700 }}>Search Food Database (Offline)</p>
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="input-field" style={{ paddingLeft: 38 }} placeholder="Search foods (e.g. Biryani, Chicken, Apple, Oats...)"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12, scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                border: 'none',
                background: selectedCategory === cat.id ? '#1A1A1A' : '#F3F4F6',
                color: selectedCategory === cat.id ? '#fff' : '#4B5563',
                cursor: 'pointer'
              }}>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Results List */}
        <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loadingFoods ? (
            <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>Loading database...</p>
          ) : searchResults.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>No foods found</p>
          ) : searchResults.map(food => (
            <div key={food.id || food.name} onClick={() => { setSelectedFood(food); setGrams(100); }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: '#F9FAFB',
                borderRadius: 10,
                cursor: 'pointer',
                border: '1px solid #E5E7EB',
                transition: 'all 0.2s'
              }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{food.name}</p>
                <p style={{ fontSize: 11, color: '#6B7280' }}>
                  🔥 {food.caloriesPer100g} kcal / 100g • 💪 {food.proteinPer100g}g P • 🌾 {food.carbsPer100g}g C • 🧈 {food.fatPer100g}g F
                </p>
              </div>
              <button className="food-action add"><Plus size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Food Logging Modal / Drawer */}
      {selectedFood && (
        <div className="fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card slide-up" style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, padding: 20, position: 'relative' }}>
            <button onClick={() => setSelectedFood(null)} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color="#6B7280" />
            </button>

            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Log Food</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#4B5563', marginBottom: 16 }}>{selectedFood.name}</p>

            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 600 }}>Portion Size (grams)</label>
              <input className="input-field" type="number" value={grams} onChange={e => setGrams(Math.max(1, parseInt(e.target.value) || 0))} />
            </div>

            {/* Quick Portions */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[50, 100, 150, 200, 250, 300].map(g => (
                <button key={g} onClick={() => setGrams(g)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    background: grams === g ? '#C6F135' : '#F9FAFB',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}>
                  {g}g
                </button>
              ))}
            </div>

            {/* Calculated Preview */}
            <div style={{ background: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>Calculated Nutrition ({grams}g)</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div>🔥 <b>{Math.round(selectedFood.caloriesPer100g * (grams / 100))}</b> kcal</div>
                <div>💪 <b>{Math.round(selectedFood.proteinPer100g * (grams / 100) * 10) / 10}</b>g protein</div>
                <div>🌾 <b>{Math.round(selectedFood.carbsPer100g * (grams / 100) * 10) / 10}</b>g carbs</div>
                <div>🧈 <b>{Math.round(selectedFood.fatPer100g * (grams / 100) * 10) / 10}</b>g fat</div>
              </div>
            </div>

            <div className="pill-tabs" style={{ marginBottom: 16 }}>
              {['breakfast', 'lunch', 'dinner', 'snack'].map(t => (
                <button key={t} className={`pill-tab ${mealType === t ? 'active' : ''}`} onClick={() => setMealType(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <button className="btn-primary" onClick={handleLogFood}>Log Meal ✓</button>
          </div>
        </div>
      )}

      {/* Celebration Card */}
      {allGoalsMet && (
        <div className="celebration-card slide-up" style={{ marginBottom: 20 }}>
          <div className="emoji">🎉</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>You've crushed your goals today!</h3>
          <p style={{ color: '#6B7280', fontSize: 14 }}>Amazing work — keep it up tomorrow!</p>
        </div>
      )}

      {/* Meal Suggest Section */}
      <div className="section-header"><h3>Today's Meals</h3></div>
      {['breakfast', 'lunch', 'dinner', 'snack'].map(type => {
        const meals = mealsByType[type];
        const typeTotal = sumMacros(meals);
        const mealGoal = Math.round(goals.calories / (type === 'snack' ? 6 : 3));
        const left = Math.max(0, mealGoal - typeTotal.calories);
        const pct = Math.min((typeTotal.calories / mealGoal) * 100, 100);

        return (
          <div key={type} className="meal-card" style={{ background: MEAL_COLORS[type].bg, animationDelay: `${0.1}s` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{MEAL_ICONS[type]}</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{type.charAt(0).toUpperCase() + type.slice(1)}</p>
                  <p style={{ fontSize: 12, color: '#6B7280' }}>🔥 {typeTotal.calories} kcal</p>
                </div>
              </div>
              <button className="food-action add" onClick={() => {
                setMealType(type);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}>
                <Plus size={16} />
              </button>
            </div>

            {meals.map(m => (
              <div className="food-item" key={m.id}>
                <div className="food-info">
                  <div className="food-icon">{MEAL_ICONS[type]}</div>
                  <div>
                    <p className="food-name">{m.name || m.meal_name}</p>
                    <p className="food-cal">🔥 {m.calories} kcal</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => removeMeal(m.id)} style={{ background: 'none', color: '#EF4444', padding: 4, cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                  <div className="food-action done"><Check size={14} color="#fff" /></div>
                </div>
              </div>
            ))}

            {meals.length === 0 && (
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>No {type} logged</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div className="progress-bar" style={{ flex: 1, marginRight: 12 }}>
                <div className="fill" style={{ width: `${pct}%`, background: '#C6F135' }} />
              </div>
              <span style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{left} left</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
