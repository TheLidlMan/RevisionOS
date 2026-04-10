import { useState } from 'react';
import { Palette } from 'lucide-react';
import { DashboardSunrise, DashboardCyberpunk, DashboardPaper, DashboardForest, DashboardMinimal } from './themes';

const themes = [
  { name: 'Sunrise Studio', key: 'sunrise', desc: 'Warm, light, inviting with amber accents', component: DashboardSunrise },
  { name: 'Cyberpunk OS', key: 'cyberpunk', desc: 'Neon futuristic HUD with glitch effects', component: DashboardCyberpunk },
  { name: 'Paper & Ink', key: 'paper', desc: 'Academic notebook with serif fonts and parchment', component: DashboardPaper },
  { name: 'Forest Retreat', key: 'forest', desc: 'Calming earth tones with organic shapes', component: DashboardForest },
  { name: 'Glass Minimal', key: 'minimal', desc: 'Ultra-clean glassmorphism with max whitespace', component: DashboardMinimal },
];

export default function ThemePreview() {
  const [selected, setSelected] = useState('sunrise');
  const Theme = themes.find(t => t.key === selected)?.component || DashboardSunrise;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Palette className="w-6 h-6 text-teal" />
        <h1 className="text-2xl font-bold">Theme Preview</h1>
      </div>
      <p className="text-gray-400 mb-6 text-sm">Select a theme to preview. Tell me which one you prefer!</p>
      <div className="flex flex-wrap gap-3 mb-8">
        {themes.map(t => (
          <button key={t.key} onClick={() => setSelected(t.key)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              selected === t.key ? 'bg-teal text-white shadow-lg shadow-teal/20' : 'bg-navy-light border border-gray-800 text-gray-300 hover:border-gray-600'
            }`}>
            {t.name}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500 mb-4">{themes.find(t => t.key === selected)?.desc}</p>
      <div className="rounded-2xl border border-gray-800 overflow-hidden">
        <Theme />
      </div>
    </div>
  );
}
