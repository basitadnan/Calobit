import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { calculateGoals } from '../utils/calculations';
import { getTemplates, saveTemplate, deleteTemplate, resetAll } from '../utils/storage';
import { User, Calculator, Trash2, RotateCcw, Plus, X } from 'lucide-react';

export default function Settings() {
  const { profile, setProfile, goals, updateGoals, settings, updateSettings, currentUser, logout } = useApp();
  const [templates, setTemplates] = useState(() => getTemplates());
  const [showReset, setShowReset] = useState(false);
  const [editGoals, setEditGoals] = useState({ ...goals });
  const [editProfile, setEditProfile] = useState({
    name: profile?.name || '', height: profile?.height || '', weight: profile?.weight || '',
    age: profile?.age || '', sex: profile?.sex || 'male', activity: profile?.activity || 'moderate',
    goal: profile?.goal || 'maintain', pace: profile?.pace || 0.5,
  });
  const [templateName, setTemplateName] = useState('');
  const [templateCals, setTemplateCals] = useState('');

  const handleRecalc = () => {
    const computed = calculateGoals(editProfile);
    setEditGoals(computed);
    updateGoals(computed);
    setProfile({ ...profile, ...editProfile, goals: computed });
  };

  const handleSaveGoals = () => { updateGoals(editGoals); };

  const handleAddTemplate = () => {
    if (!templateName) return;
    saveTemplate({ name: templateName, calories: parseInt(templateCals) || 0 });
    setTemplates(getTemplates());
    setTemplateName(''); setTemplateCals('');
  };

  const handleDeleteTemplate = (id) => {
    deleteTemplate(id);
    setTemplates(getTemplates());
  };

  const handleReset = () => {
    resetAll();
    window.location.reload();
  };

  return (
    <div className="page fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        <User size={22} style={{ verticalAlign: 'text-bottom', marginRight: 8 }} />Settings
      </h2>

      {/* Active Profile */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Active Profile</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>👤 {profile?.name || currentUser} (@{currentUser})</p>
        </div>
        <button className="btn-small" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1A1A1A', color: '#fff', fontSize: 11 }}>
          Switch Profile
        </button>
      </div>

      {/* Profile */}
      <div className="settings-group">
        <h3>Profile</h3>
        <div className="form-group">
          <label>Name</label>
          <input className="input-field" value={editProfile.name} onChange={e => setEditProfile(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Height (cm)</label>
            <input className="input-field" type="number" value={editProfile.height} onChange={e => setEditProfile(p => ({ ...p, height: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Weight (kg)</label>
            <input className="input-field" type="number" value={editProfile.weight} onChange={e => setEditProfile(p => ({ ...p, weight: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Age</label>
            <input className="input-field" type="number" value={editProfile.age} onChange={e => setEditProfile(p => ({ ...p, age: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Sex</label>
            <div className="toggle-group">
              <button className={`toggle-opt ${editProfile.sex === 'male' ? 'active' : ''}`} onClick={() => setEditProfile(p => ({ ...p, sex: 'male' }))}>Male</button>
              <button className={`toggle-opt ${editProfile.sex === 'female' ? 'active' : ''}`} onClick={() => setEditProfile(p => ({ ...p, sex: 'female' }))}>Female</button>
            </div>
          </div>
        </div>
        <button className="btn-primary" onClick={handleRecalc} style={{ marginTop: 8 }}>
          <Calculator size={16} /> Recalculate Goals
        </button>
      </div>

      {/* Manual Goals */}
      <div className="settings-group">
        <h3>Daily Goals (Manual)</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Calories</label>
            <input className="input-field" type="number" value={editGoals.calories} onChange={e => setEditGoals(g => ({ ...g, calories: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="form-group">
            <label>Protein (g)</label>
            <input className="input-field" type="number" value={editGoals.protein} onChange={e => setEditGoals(g => ({ ...g, protein: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Carbs (g)</label>
            <input className="input-field" type="number" value={editGoals.carbs} onChange={e => setEditGoals(g => ({ ...g, carbs: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="form-group">
            <label>Fat (g)</label>
            <input className="input-field" type="number" value={editGoals.fat} onChange={e => setEditGoals(g => ({ ...g, fat: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>
        <button className="btn-primary" onClick={handleSaveGoals}>Save Goals</button>
      </div>

      {/* Toggles */}
      <div className="settings-group">
        <h3>Preferences</h3>
        <div className="setting-row">
          <label>Units</label>
          <div className="toggle-group">
            <button className={`toggle-opt ${settings.units === 'metric' ? 'active' : ''}`} onClick={() => updateSettings({ ...settings, units: 'metric' })}>Metric</button>
            <button className={`toggle-opt ${settings.units === 'imperial' ? 'active' : ''}`} onClick={() => updateSettings({ ...settings, units: 'imperial' })}>Imperial</button>
          </div>
        </div>
      </div>

      {/* Meal Templates */}
      <div className="settings-group">
        <h3>Meal Templates</h3>
        {templates.map(t => (
          <div key={t.id} className="setting-row">
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</p>
              <p style={{ fontSize: 12, color: '#6B7280' }}>{t.calories} kcal</p>
            </div>
            <button onClick={() => handleDeleteTemplate(t.id)} style={{ background: 'none', color: '#EF4444' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="input-field" placeholder="Template name" value={templateName} onChange={e => setTemplateName(e.target.value)} style={{ flex: 1 }} />
          <input className="input-field" placeholder="kcal" type="number" value={templateCals} onChange={e => setTemplateCals(e.target.value)} style={{ width: 80 }} />
          <button className="btn-small" onClick={handleAddTemplate}><Plus size={14} /></button>
        </div>
      </div>

      {/* Reset */}
      <div className="settings-group">
        <h3>Danger Zone</h3>
        {showReset ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={handleReset} style={{ background: '#EF4444', color: '#fff' }}>
              <Trash2 size={16} /> Confirm Reset
            </button>
            <button className="btn-secondary" onClick={() => setShowReset(false)}>
              <X size={16} /> Cancel
            </button>
          </div>
        ) : (
          <button className="btn-secondary" onClick={() => setShowReset(true)} style={{ borderColor: '#EF4444', color: '#EF4444' }}>
            <RotateCcw size={16} /> Reset App
          </button>
        )}
      </div>
    </div>
  );
}
