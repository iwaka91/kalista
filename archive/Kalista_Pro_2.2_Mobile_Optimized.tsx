import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, Calendar, CalendarDays, BarChart, Settings, 
  Upload, Download, FileJson, Sun, Moon, Menu, X, 
  Plus, Edit, Trash2, Copy, Check, AlertCircle, 
  Save, FileText, Image as ImageIcon, Wand2,
  Info, Instagram, Youtube, ShieldCheck, Zap, Globe,
  ChevronLeft, ChevronRight, Palette, AlertTriangle, Mail,
  ChevronRightCircle
} from 'lucide-react';

// --- CUSTOM HOOKS ---
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// --- CONSTANTS ---
const CATEGORIES = {
  'Akademik': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200',
  'Asesmen': 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200',
  'Kesiswaan': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200',
  'Libur': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
  'Nasional': 'bg-red-600 text-white border-red-700 dark:bg-red-700 dark:border-red-800',
  'Cuti Bersama': 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/50 dark:text-pink-300',
  'Lainnya': 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200'
};

const CUSTOM_COLORS = ['#3b82f6', '#a855f7', '#22c55e', '#ef4444', '#ec4899', '#f97316', '#6366f1', '#14b8a6', '#64748b'];

const NORMAL_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// --- UTILS ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const formatLocalDate = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const resizeImage = (file, maxWidth = 400) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png', 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// --- GEMINI API HELPER ---
const apiKey = ""; 

const callGeminiAPI = async (prompt, isJson = false) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = { contents: [{ parts: [{ text: prompt }] }], ...(isJson && { generationConfig: { responseMimeType: "application/json" } }) };
  let delay = 1000;
  
  for (let i = 0; i <= 5; i++) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (response.status === 429) throw new Error('Limit harian AI tercapai');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      if (error.message.includes('Limit')) throw error;
      if (i === 5) throw new Error('Gagal menghubungi AI setelah beberapa percobaan.');
      await new Promise(res => setTimeout(res, delay));
      delay *= 2; 
    }
  }
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [data, setData] = useLocalStorage('kaldik_data', {
    identity: { namaDinas: '', namaSekolah: '', alamat: '', desa: '', kecamatan: '', kabupaten: '', provinsi: '', tahunPelajaran: '2026/2027', jenjang: 'SMA' },
    signer: { nama: '', jabatan: 'Kepala Sekolah', jenisNomor: 'NIP', nomor: '', jenisNomorCustom: '', tempatOption: 'kabupaten', tempatManual: '', tanggalOption: 'hari_ini', tanggalManual: '' },
    assets: { logoKiri: null, logoKanan: null, ttd: null, stempel: null },
    settings: { hariSekolah: '5' },
    events: []
  });
  
  const [ui, setUi] = useState({ view: 'dashboard', sidebarOpen: false, isDark: false });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (ui.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [ui.isDark]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000); 
  };

  const updateData = (section, payload) => {
    setData(prev => ({ ...prev, [section]: typeof payload === 'function' ? payload(prev[section]) : payload }));
  };

  const renderView = () => {
    switch (ui.view) {
      case 'dashboard': return <IdentitasView data={data} updateData={updateData} showToast={showToast} onNext={() => setUi({...ui, view: 'kegiatan'})} />;
      case 'kegiatan': return <KegiatanView events={data.events} updateEvents={(e) => updateData('events', e)} showToast={showToast} data={data} onNext={() => setUi({...ui, view: 'kalender'})} />;
      case 'kalender': return <KalenderView events={data.events} yearStr={data.identity.tahunPelajaran} settings={data.settings} onExport={() => setUi({...ui, view: 'export'})} data={data} showToast={showToast} />;
      case 'timeline': return <TimelineView events={data.events} yearStr={data.identity.tahunPelajaran} onExport={() => setUi({...ui, view: 'export'})} data={data} />;
      case 'efektif': return <EfektifView events={data.events} yearStr={data.identity.tahunPelajaran} settings={data.settings} onExport={() => setUi({...ui, view: 'export'})} data={data} />;
      case 'export': return <ExportView data={data} showToast={showToast} />;
      case 'backup': return <BackupView data={data} setData={setData} showToast={showToast} />;
      case 'about': return <AboutView />;
      default: return <IdentitasView data={data} updateData={updateData} showToast={showToast} onNext={() => setUi({...ui, view: 'kegiatan'})} />;
    }
  };

  // Logika Active Step untuk UI Wizard
  const getStepLevel = () => {
    if (ui.view === 'dashboard') return 1;
    if (ui.view === 'kegiatan') return 2;
    if (['kalender', 'timeline', 'efektif'].includes(ui.view)) return 3;
    if (ui.view === 'export') return 4;
    return 0; // Menu lain
  };
  const stepLevel = getStepLevel();

  return (
    <div className={`flex h-screen w-full bg-slate-50 text-slate-800 font-sans transition-colors duration-300 dark:bg-slate-900 dark:text-slate-100 ${ui.isDark ? 'dark' : ''}`}>
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 shadow-xl transform ${ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col print:hidden`}>
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <CalendarDays size={28} className="stroke-[2.5]" />
            <span className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              Kalista <span className="text-amber-500">Pro</span>
              <span className="text-slate-500 dark:text-slate-400 text-xs font-normal block tracking-normal -mt-1">
                Kaldik Asistant Profesional
              </span>
            </span>
          </div>
          <button onClick={() => setUi({...ui, sidebarOpen: false})} className="lg:hidden p-1 text-slate-500 hover:bg-slate-100 rounded-md dark:hover:bg-slate-700"><X size={20} /></button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <NavItem icon={<Home size={18}/>} label="Identitas Sekolah" active={ui.view === 'dashboard'} onClick={() => setUi({...ui, view: 'dashboard', sidebarOpen: false})} />
          <NavItem icon={<FileText size={18}/>} label="Kegiatan Kalender" active={ui.view === 'kegiatan'} onClick={() => setUi({...ui, view: 'kegiatan', sidebarOpen: false})} />
          <div className="pt-4 pb-2"><p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Hasil dan Visualisasi</p></div>
          <NavItem icon={<Calendar size={18}/>} label="Kalender Pendidikan" active={ui.view === 'kalender'} onClick={() => setUi({...ui, view: 'kalender', sidebarOpen: false})} />
          <NavItem icon={<BarChart size={18}/>} label="Timeline Visual" active={ui.view === 'timeline'} onClick={() => setUi({...ui, view: 'timeline', sidebarOpen: false})} />
          <NavItem icon={<Check size={18}/>} label="Hari Efektif" active={ui.view === 'efektif'} onClick={() => setUi({...ui, view: 'efektif', sidebarOpen: false})} />
          <div className="pt-4 pb-2"><p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fitur Lanjutan</p></div>
          <NavItem icon={<Download size={18}/>} label="Ekspor PDF" active={ui.view === 'export'} onClick={() => setUi({...ui, view: 'export', sidebarOpen: false})} />
          <NavItem icon={<FileJson size={18}/>} label="Backup & Restore" active={ui.view === 'backup'} onClick={() => setUi({...ui, view: 'backup', sidebarOpen: false})} />
          <div className="pt-2"></div>
          <NavItem icon={<Info size={18}/>} label="Tentang Aplikasi" active={ui.view === 'about'} onClick={() => setUi({...ui, view: 'about', sidebarOpen: false})} />
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-800 shadow-sm z-30 print:hidden border-b dark:border-slate-700">
          <div className="flex items-center gap-4">
            <button onClick={() => setUi({...ui, sidebarOpen: true})} className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-md dark:hover:bg-slate-700"><Menu size={24} /></button>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 hidden sm:block">
              {ui.view === 'dashboard' ? 'Identitas Sekolah' : ui.view === 'export' ? 'Ekspor PDF' : ui.view.charAt(0).toUpperCase() + ui.view.slice(1).replace(/([A-Z])/g, ' $1').trim()}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setUi({...ui, isDark: !ui.isDark})} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full dark:hover:bg-slate-700 transition-colors bg-slate-100 dark:bg-slate-700">
              {ui.isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-600" />}
            </button>
          </div>
        </header>

        {/* WIZARD STEPPER (3 Langkah Mudah) */}
        {stepLevel > 0 && (
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 print:hidden z-20 overflow-x-auto shadow-sm">
            <div className="flex items-center justify-between max-w-4xl mx-auto min-w-[500px]">
               {[
                 {num: 1, label: 'Isi Data', view: 'dashboard'},
                 {num: 2, label: 'Kegiatan', view: 'kegiatan'},
                 {num: 3, label: 'Kalender', view: 'kalender'},
                 {num: 4, label: 'Ekspor', view: 'export'}
               ].map((step, idx) => (
                 <div key={idx} className="flex items-center">
                    <button onClick={() => setUi({...ui, view: step.view})} className={`flex items-center gap-2 transition-all ${stepLevel >= step.num ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'} hover:opacity-80`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${stepLevel >= step.num ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/50 dark:border-blue-400' : 'border-slate-300 dark:border-slate-600 bg-transparent'}`}>
                        {stepLevel > step.num ? <Check size={14} className="stroke-[3]"/> : step.num}
                      </div>
                      <span className="text-sm font-bold tracking-wide">{step.label}</span>
                    </button>
                    {idx < 3 && <ChevronRight size={18} className="mx-4 text-slate-300 dark:text-slate-700" />}
                 </div>
               ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative">
          <div className="max-w-7xl mx-auto print:max-w-none print:m-0 print:p-0">
            {renderView()}
          </div>
        </div>
      </main>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-fade-in-up">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            <span className="font-medium">{toast.msg}</span>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        /* ANIMASI WIGGLE TILT TONGKAT AI */
        @keyframes wiggle-tilt {
            0%, 100% { transform: rotate(-5deg); }
            50% { transform: rotate(5deg) scale(1.1); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
        .animate-fade-in { animation: fadeInUp 0.2s ease-out forwards; }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
        .animate-wiggle-tilt { animation: wiggle-tilt 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// --- COMPONENTS ---
const NavItem = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium border-l-4 ${active ? 'bg-blue-50 text-blue-700 border-blue-600 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-500 shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200'}`}
  >{icon}{label}</button>
);

// --- CUSTOM DATE RANGE PICKER ---
const CustomDateRangePicker = ({ startDate, endDate, onChange, existingEvents = [] }) => {
  const [currentDate, setCurrentDate] = useState(startDate ? new Date(startDate) : new Date());
  
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleDayClick = (day) => {
    const clickedStr = formatLocalDate(currentDate.getFullYear(), currentDate.getMonth(), day);

    if (!startDate || (startDate && endDate && startDate !== endDate)) {
      onChange(clickedStr, clickedStr);
    } else {
      if (new Date(clickedStr) > new Date(startDate)) {
        onChange(startDate, clickedStr);
      } else {
        onChange(clickedStr, clickedStr);
      }
    }
  };

  const isSelected = (day) => {
    const dStr = formatLocalDate(currentDate.getFullYear(), currentDate.getMonth(), day);
    return dStr === startDate || dStr === endDate;
  };

  const isInRange = (day) => {
    if (!startDate || !endDate || startDate === endDate) return false;
    const dStr = formatLocalDate(currentDate.getFullYear(), currentDate.getMonth(), day);
    const d = new Date(dStr);
    return d > new Date(startDate) && d < new Date(endDate);
  };

  const getDayEventsSummary = (day) => {
    const dStr = formatLocalDate(currentDate.getFullYear(), currentDate.getMonth(), day);
    const matched = existingEvents.filter(e => {
      const start = new Date(e.startDate); start.setHours(0,0,0,0);
      const end = new Date(e.endDate || e.startDate); end.setHours(23,59,59,999);
      const curr = new Date(dStr);
      return curr >= start && curr <= end;
    });
    return matched.map(e => e.name).join(', ');
  };

  const daysInMonth = getDaysInMonth(currentDate.getMonth(), currentDate.getFullYear());
  const firstDay = getFirstDayOfMonth(currentDate.getMonth(), currentDate.getFullYear());
  const blanks = Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 select-none hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-center mb-3 px-1">
        <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300 transition-colors"><ChevronLeft size={18}/></button>
        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{NORMAL_MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
        <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300 transition-colors"><ChevronRight size={18}/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400 mb-2">
        {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-sm">
        {blanks.map(b => <div key={`blank-${b}`} className="p-2"></div>)}
        {days.map(d => {
          const summary = getDayEventsSummary(d);
          const hasEvent = summary.length > 0;
          const selected = isSelected(d);
          return (
            <div 
              key={d} 
              onClick={() => handleDayClick(d)}
              title={hasEvent ? `Kegiatan: ${summary}` : undefined}
              className={`cursor-pointer relative h-8 flex justify-center items-center rounded-md transition-all text-slate-800 dark:text-slate-200
                ${selected ? 'bg-blue-600 text-white font-bold dark:text-white transform scale-105 shadow-sm' : 
                  isInRange(d) ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' : 
                  'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <span className="z-10">{d}</span>
              {hasEvent && !selected && <div className="absolute bottom-1 w-1.5 h-1.5 bg-amber-500 rounded-full z-0"></div>}
              {hasEvent && selected && <div className="absolute bottom-1 w-1.5 h-1.5 bg-white rounded-full z-0 shadow-sm"></div>}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between items-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-2">
        <span>Mulai: <strong className="text-slate-800 dark:text-slate-200">{startDate ? formatDate(startDate) : '-'}</strong></span>
        {startDate !== endDate && endDate && <span>Sampai: <strong className="text-slate-800 dark:text-slate-200">{formatDate(endDate)}</strong></span>}
      </div>
    </div>
  );
};


// --- VIEWS ---
function IdentitasView({ data, updateData, showToast, onNext }) {
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, field: null });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Realtime clock & Greeting
  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 11) return 'Pagi';
    if (hour < 15) return 'Siang';
    if (hour < 18) return 'Sore';
    return 'Malam';
  };

  const handleChange = (section, field, value) => updateData(section, prev => ({ ...prev, [field]: value }));
  const handleImageUpload = async (e, field) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await resizeImage(file);
      handleChange('assets', field, base64);
      showToast('Aset berhasil diunggah dan disimpan!');
    }
  };

  const removeImageAction = () => {
    handleChange('assets', confirmDelete.field, null);
    showToast('Aset telah dihapus.');
    setConfirmDelete({ isOpen: false, field: null });
  };

  return (
    <div className="space-y-6 bg-slate-50 dark:bg-slate-900 animate-fade-in-up">
      
      {/* BANNER HERO INTERAKTIF */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Dekorasi Abstract */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-12 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
           <div>
              <h2 className="text-3xl font-black mb-2 tracking-tight">Selamat {getGreeting()}, Pendidik Hebat! 👋</h2>
              <p className="text-blue-100 font-medium text-lg max-w-xl">Mari mulai petualangan menyusun Kalender Pendidikan dengan identitas resmi institusi Anda.</p>
           </div>
           <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 shadow-inner min-w-[140px] text-center">
              <div className="text-xs text-blue-200 uppercase font-bold tracking-wider mb-1">Waktu Sistem</div>
              <div className="text-xl font-bold font-mono tracking-widest">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
           </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-all hover:shadow-md">
        <h2 className="text-xl font-bold mb-5 flex items-center gap-2 text-slate-800 dark:text-slate-100"><Home className="text-blue-500"/> Informasi Sekolah</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input label="Nama Dinas" placeholder="contoh: Dinas Pendidikan Provinsi Kalimantan Tengah" value={data.identity.namaDinas} onChange={(e) => handleChange('identity', 'namaDinas', e.target.value)} />
          <Input label="Nama Sekolah" placeholder="contoh: SMA Negeri 3 Majucekatan" value={data.identity.namaSekolah} onChange={(e) => handleChange('identity', 'namaSekolah', e.target.value)} />
          <Input label="Tahun Pelajaran" value={data.identity.tahunPelajaran} placeholder="Contoh: 2026/2027" onChange={(e) => handleChange('identity', 'tahunPelajaran', e.target.value)} />
          <Select label="Jenjang" value={data.identity.jenjang} onChange={(e) => handleChange('identity', 'jenjang', e.target.value)} options={['PAUD', 'TK', 'SD', 'SMP', 'SMA', 'SMK', 'SLB', 'Madrasah']} />
          <Input label="Alamat Lengkap" className="md:col-span-2" placeholder="contoh: Jl. Sukamulya no. 27" value={data.identity.alamat} onChange={(e) => handleChange('identity', 'alamat', e.target.value)} />
          <Input label="Desa / Kelurahan" value={data.identity.desa} onChange={(e) => handleChange('identity', 'desa', e.target.value)} />
          <Input label="Kecamatan" value={data.identity.kecamatan} onChange={(e) => handleChange('identity', 'kecamatan', e.target.value)} />
          <Input label="Kabupaten/Kota" value={data.identity.kabupaten} onChange={(e) => handleChange('identity', 'kabupaten', e.target.value)} />
          <Input label="Provinsi" value={data.identity.provinsi} onChange={(e) => handleChange('identity', 'provinsi', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-all hover:shadow-md">
          <h2 className="text-xl font-bold mb-5 flex items-center gap-2 text-slate-800 dark:text-slate-100"><Edit className="text-blue-500"/> Penandatangan (PDF)</h2>
          <div className="space-y-5">
            <Input label="Nama Lengkap" value={data.signer.nama} onChange={(e) => handleChange('signer', 'nama', e.target.value)} />
            <Input label="Jabatan" value={data.signer.jabatan} onChange={(e) => handleChange('signer', 'jabatan', e.target.value)} />
            <div className="grid grid-cols-3 gap-3 items-end">
              <Select label="Jenis ID" className="col-span-1" value={data.signer.jenisNomor} onChange={(e) => handleChange('signer', 'jenisNomor', e.target.value)} options={['NIP', 'NIPPPK', 'NBA', 'NRA', 'NRKS', 'NIY', 'Lainnya']} />
              <Input label="Nomor Induk" className="col-span-2" value={data.signer.nomor} onChange={(e) => handleChange('signer', 'nomor', e.target.value)} />
            </div>
            {data.signer.jenisNomor === 'Lainnya' && <Input label="Tulis Jenis ID Kustom" placeholder="Contoh: NUPTK, NRG, dsb." value={data.signer.jenisNomorCustom || ''} onChange={(e) => handleChange('signer', 'jenisNomorCustom', e.target.value)} />}
            <div className="pt-2 border-t dark:border-slate-700"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <Select label="Tempat TTD" value={data.signer.tempatOption} onChange={(e) => handleChange('signer', 'tempatOption', e.target.value)} options={[{label: 'Gunakan Kabupaten/Kota', value: 'kabupaten'}, {label: 'Gunakan Kecamatan', value: 'kecamatan'}, {label: 'Gunakan Desa', value: 'desa'}, {label: 'Ketik Manual', value: 'manual'}]} />
                  {data.signer.tempatOption === 'manual' && <Input placeholder="Ketik nama tempat..." value={data.signer.tempatManual || ''} onChange={(e) => handleChange('signer', 'tempatManual', e.target.value)} />}
               </div>
               <div className="space-y-1.5">
                  <Select label="Tanggal TTD" value={data.signer.tanggalOption} onChange={(e) => handleChange('signer', 'tanggalOption', e.target.value)} options={[{label: 'Hari Ini (Otomatis)', value: 'hari_ini'}, {label: 'Pilih Tanggal', value: 'manual'}]} />
                  {data.signer.tanggalOption === 'manual' && <Input type="date" value={data.signer.tanggalManual || ''} onChange={(e) => handleChange('signer', 'tanggalManual', e.target.value)} />}
               </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-all hover:shadow-md">
          <h2 className="text-xl font-bold mb-5 flex items-center gap-2 text-slate-800 dark:text-slate-100"><Settings className="text-blue-500"/> Pengaturan Sistem</h2>
          <div className="space-y-5">
            <Select label="Hari Efektif Sekolah" value={data.settings.hariSekolah} onChange={(e) => handleChange('settings', 'hariSekolah', e.target.value)} options={[{label: '5 Hari Sekolah (Senin-Jumat)', value: '5'}, {label: '6 Hari Sekolah (Senin-Sabtu)', value: '6'}, {label: '6 Hari (Jumat Libur)', value: '6j'}]} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-all hover:shadow-md">
        <h2 className="text-xl font-bold mb-5 flex items-center gap-2 text-slate-800 dark:text-slate-100"><ImageIcon className="text-blue-500"/> Upload Aset (opsional)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <ImageUploader label="Logo Kiri" value={data.assets.logoKiri} onChange={(e) => handleImageUpload(e, 'logoKiri')} onRemove={() => setConfirmDelete({isOpen: true, field: 'logoKiri'})} />
          <ImageUploader label="Logo Kanan" value={data.assets.logoKanan} onChange={(e) => handleImageUpload(e, 'logoKanan')} onRemove={() => setConfirmDelete({isOpen: true, field: 'logoKanan'})} />
          <ImageUploader label="Tanda Tangan" value={data.assets.ttd} onChange={(e) => handleImageUpload(e, 'ttd')} onRemove={() => setConfirmDelete({isOpen: true, field: 'ttd'})} />
          <ImageUploader label="Stempel" value={data.assets.stempel} onChange={(e) => handleImageUpload(e, 'stempel')} onRemove={() => setConfirmDelete({isOpen: true, field: 'stempel'})} />
        </div>
      </div>

      <div className="flex justify-end pb-8">
         <Button size="lg" className="w-full sm:w-auto px-10 shadow-lg group" onClick={() => { showToast('Disimpan!', 'success'); if(onNext) onNext(); }}>
           <Save size={20} className="mr-2" /> Lanjut ke Kegiatan <ChevronRightCircle size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
         </Button>
      </div>

      {confirmDelete.isOpen && (
        <Modal title="Konfirmasi Penghapusan" onClose={() => setConfirmDelete({ isOpen: false, field: null })}>
          <div className="flex items-start gap-4 p-2">
            <div className="p-3 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full"><AlertTriangle size={24} /></div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">Apakah Anda yakin menghapus aset ini?</p>
              <p className="text-sm text-slate-500 mt-1">Aktivitas ini tidak dapat diurungkan.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6">
            <Button variant="secondary" onClick={() => setConfirmDelete({ isOpen: false, field: null })}>Tidak, Batal</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={removeImageAction}>Ya, Hapus</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KegiatanView({ events, updateEvents, showToast, data, onNext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', category: 'Akademik', notes: '', customColor: '' });

  const [aiLoading, setAiLoading] = useState(false);
  const [announcementModal, setAnnouncementModal] = useState({ isOpen: false, text: '', isLoading: false, eventName: '' });
  const [syncModal, setSyncModal] = useState({ isOpen: false, isLoading: false });
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });
  
  const [aiTextIdx, setAiTextIdx] = useState(0);
  const aiTexts = [
    "Minum kopi di pagi hari,\nMakan donat rasanya nikmat.\nAsisten AI sedang mencari,\nIde kegiatan yang paling tepat!",
    "AI meracik 5 kegiatan, kegiatan ini dapat diedit setelah tampil...",
    "Anda dapat gunakan fitur ini berkali-kali untuk referensi baru...",
    "Pergi ke pasar membeli ragi,\nSinggah sebentar membeli duku.\nTunggu sebentar sabarlah di hati,\nAI meracik kegiatan untukmu."
  ];

  const [syncTextIdx, setSyncTextIdx] = useState(0);
  const syncTexts = [
    "Jalan-Jalan ke Kota Blitar\nJangan lupa memborong diskon\nMohon tunggu sabar sebentar\nTanggal merah sedang disinkron!",
    "Menghubungi server Google Calendar...",
    "Mengekstrak data hari libur resmi...",
    "Membuka database kalender lokal...",
    "Menyesuaikan tanggal dan zona waktu...",
    "Memeriksa jadwal kalender global...",
    "Menyinkronkan dan memfinalisasi data...",
    "Pergi memancing di waktu fajar,\nDapat ikan besarnya sehasta.\nAplikasi sedang bekerja pintar,\nMenyinkronkan libur di depan mata!"
  ];

  useEffect(() => {
    let interval;
    if (aiLoading) {
      interval = setInterval(() => setAiTextIdx(prev => (prev + 1) % aiTexts.length), 6000);
    } else {
      setAiTextIdx(0);
    }
    return () => clearInterval(interval);
  }, [aiLoading]);

  useEffect(() => {
    let interval;
    if (syncModal.isLoading) {
      interval = setInterval(() => setSyncTextIdx(prev => (prev + 1) % syncTexts.length), 6000);
    } else {
      setSyncTextIdx(0);
    }
    return () => clearInterval(interval);
  }, [syncModal.isLoading]);

  const copyToClipboard = (text) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Teks berhasil disalin!', 'success');
    } catch (err) {
      showToast('Gagal menyalin teks', 'error');
    }
  };

  const handleSave = () => {
    if (!form.name || !form.startDate) return showToast('Nama dan Tanggal Kegiatan wajib diisi', 'error');
    let newEvents = [...events];
    if (editingId) {
      newEvents = newEvents.map(e => e.id === editingId ? { ...form, id: editingId } : e);
      showToast('Kegiatan diperbarui');
    } else {
      newEvents.push({ ...form, id: generateId(), endDate: form.endDate || form.startDate });
      showToast('Kegiatan ditambahkan');
    }
    newEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    updateEvents(newEvents);
    setIsOpen(false);
    setForm({ name: '', startDate: '', endDate: '', category: 'Akademik', notes: '', customColor: '' });
    setEditingId(null);
  };

  const handleEdit = (ev) => { setForm(ev); setEditingId(ev.id); setIsOpen(true); };
  const initiateDelete = (id) => setConfirmDelete({ isOpen: true, id });
  
  const confirmDeleteAction = () => {
    updateEvents(events.filter(e => e.id !== confirmDelete.id));
    showToast('Kegiatan telah dihapus.');
    setConfirmDelete({ isOpen: false, id: null });
  };

  const handleGenerateIdeas = async () => {
    setAiLoading(true);
    const existingNames = events.map(e => e.name).join(', ');
    const prompt = `Buat 5 kegiatan sekolah ${data.identity.jenjang} TA ${data.identity.tahunPelajaran}. 
    PENTING: Jangan berikan kegiatan yang sudah ada di jadwal ini: [${existingNames}]. Berikan saran yang sepenuhnya baru.
    Format JSON array HANYA: [{"name":"x","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","category":"Akademik/Asesmen/Libur/Nasional/Kesiswaan/Lainnya","notes":"x"}]`;
    
    try {
      const responseText = await callGeminiAPI(prompt, true);
      const ideas = JSON.parse(responseText);
      const newEvents = ideas.map(idea => ({ ...idea, id: generateId(), category: CATEGORIES[idea.category] ? idea.category : 'Lainnya' }));
      updateEvents([...events, ...newEvents].sort((a, b) => new Date(a.startDate) - new Date(b.startDate)));
      showToast('✨ 5 Saran kegiatan ditambahkan!', 'success');
    } catch (error) { 
      showToast(error.message, 'error'); 
    } finally { 
      setAiLoading(false); 
    }
  };

  const handleGenerateAnnouncement = async (ev) => {
    setAnnouncementModal({ isOpen: true, text: '', isLoading: true, eventName: ev.name });
    const prompt = `Draf surat ortu acara "${ev.name}" tgl ${formatDate(ev.startDate)}. Sekolah: ${data.identity.namaSekolah || 'Sekolah'}. Singkat, padat, maks 2 paragraf.`;
    try {
      const text = await callGeminiAPI(prompt, false);
      setAnnouncementModal({ isOpen: true, text: text, isLoading: false, eventName: ev.name });
    } catch (error) { setAnnouncementModal(prev => ({ ...prev, isLoading: false, text: 'Gagal membuat pengumuman: ' + error.message })); }
  };

  const handleSyncHolidays = async () => {
    setSyncModal({ isOpen: true, isLoading: true });
    try {
      const startYearStr = data.identity.tahunPelajaran.split('/')[0];
      const startYear = parseInt(startYearStr) || new Date().getFullYear();
      const nextYear = startYear + 1;

      const INTERNAL_DB_2026 = [
        { name: 'Tahun Baru 2026 Masehi', date: '2026-01-01', isCuti: false, source: 'internal' },
        { name: 'Isra Mikraj', date: '2026-02-14', isCuti: false, source: 'internal' },
        { name: 'Tahun Baru Imlek', date: '2026-02-17', isCuti: false, source: 'internal' },
        { name: 'Hari Raya Nyepi', date: '2026-03-19', isCuti: false, source: 'internal' },
        { name: 'Idul Fitri 1447 H', date: '2026-03-20', isCuti: false, source: 'internal' },
        { name: 'Hari Buruh Internasional', date: '2026-05-01', isCuti: false, source: 'internal' },
        { name: 'Kenaikan Yesus Kristus', date: '2026-05-14', isCuti: false, source: 'internal' },
        { name: 'Idul Adha 1447 H', date: '2026-05-27', isCuti: false, source: 'internal' },
        { name: 'Hari Raya Waisak', date: '2026-05-31', isCuti: false, source: 'internal' },
        { name: 'Hari Lahir Pancasila', date: '2026-06-01', isCuti: false, source: 'internal' },
        { name: 'Tahun Baru Islam 1448 H', date: '2026-06-16', isCuti: false, source: 'internal' },
        { name: 'Hari Kemerdekaan RI', date: '2026-08-17', isCuti: false, source: 'internal' },
        { name: 'Maulid Nabi Muhammad SAW', date: '2026-09-16', isCuti: false, source: 'internal' },
        { name: 'Hari Raya Natal', date: '2026-12-25', isCuti: false, source: 'internal' },
        { name: 'Cuti Bersama Natal', date: '2026-12-24', isCuti: true, source: 'internal' }
      ];

      const fetchHolidays = async (year, isFirstYear) => {
        if (isFirstYear) {
          try {
            const icsUrl = 'https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics';
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(icsUrl)}`;
            const res = await fetch(proxyUrl);
            if (res.ok) {
              const text = await res.text();
              const eventsIcal = [];
              const lines = text.split(/\r?\n/);
              let inEvent = false, currentEvent = {};
              for (let line of lines) {
                if (line.startsWith('BEGIN:VEVENT')) { inEvent = true; currentEvent = {}; }
                else if (line.startsWith('END:VEVENT')) {
                  if (inEvent && currentEvent.date && currentEvent.date.startsWith(year.toString())) eventsIcal.push(currentEvent);
                  inEvent = false;
                }
                else if (inEvent) {
                  if (line.startsWith('DTSTART;VALUE=DATE:')) {
                    const rawDate = line.split(':')[1];
                    currentEvent.date = `${rawDate.substring(0,4)}-${rawDate.substring(4,6)}-${rawDate.substring(6,8)}`;
                  } else if (line.startsWith('SUMMARY:')) {
                    currentEvent.name = line.substring(8);
                  }
                }
              }
              if (eventsIcal.length > 0) {
                 return eventsIcal.map(e => ({ name: e.name, date: e.date, isCuti: e.name.toLowerCase().includes('cuti bersama'), source: 'ical' }));
              }
            }
          } catch(e) { console.warn('Akses Google Kalender Terhambat Proxy'); }

          if (year === 2026) return INTERNAL_DB_2026;
        } else {
          try {
            const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`);
            if (res.ok) {
              const json = await res.json();
              return json.map(d => ({
                name: d.localName || d.name, 
                date: d.date, 
                isCuti: false, 
                source: 'global-prediction' 
              }));
            }
          } catch(e) { throw new Error(`Data libur tahun ${year} gagal diakses.`); }
        }
        return [];
      };

      const [data1, data2] = await Promise.all([
        fetchHolidays(startYear, true), 
        fetchHolidays(nextYear, false)
      ]);
      
      const filteredData1 = data1.filter(h => {
        const m = parseInt(h.date.split('-')[1], 10);
        return m >= 7 && m <= 12;
      });

      const filteredData2 = data2.filter(h => {
        const m = parseInt(h.date.split('-')[1], 10);
        return m >= 1 && m <= 6;
      });
      
      const allHolidays = [...filteredData1, ...filteredData2];
      if (allHolidays.length === 0) throw new Error('Seluruh layanan database sedang tidak tersedia.');

      const newEvents = allHolidays.map(h => {
        let eventName = h.name;
        let eventNotes = h.isCuti ? 'Cuti Bersama (SKB)' : 'Libur Nasional (SKB)';
        let eventCategory = h.isCuti ? 'Cuti Bersama' : 'Nasional';

        if (h.source === 'global-prediction') {
          eventName = h.name;
          eventNotes = 'Libur Nasional (Estimasi)';
        } else if (h.source === 'ical') {
          eventNotes = h.isCuti ? 'Cuti Bersama (Google Calendar)' : 'Libur Nasional (Google Calendar)';
        } else if (h.source === 'internal') {
          eventNotes = h.isCuti ? 'Cuti Bersama (Database Lokal)' : 'Libur Nasional (Database Lokal)';
        }

        return {
          id: generateId(),
          name: eventName,
          startDate: h.date, 
          endDate: h.date,
          category: eventCategory,
          notes: eventNotes
        };
      });

      const existingDates = new Set(events.filter(e => e.category === 'Nasional' || e.category === 'Cuti Bersama').map(e => e.startDate));
      const uniqueNewEvents = newEvents.filter(e => !existingDates.has(e.startDate));

      if (uniqueNewEvents.length === 0) {
         showToast('Data kalender nasional sudah up-to-date.', 'success');
      } else {
        updateEvents([...events, ...uniqueNewEvents].sort((a, b) => new Date(a.startDate) - new Date(b.startDate)));
        showToast(`✨ ${uniqueNewEvents.length} Libur berhasil disinkronkan!`, 'success');
      }
    } catch (error) {
      showToast('Gagal sinkronisasi: ' + error.message, 'error');
    } finally { 
      setSyncModal({ isOpen: false, isLoading: false }); 
    }
  };

  return (
    <div className="space-y-6 bg-slate-50 dark:bg-slate-900 animate-fade-in-up">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Daftar Kegiatan</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Kelola agenda akademik, libur, dan kegiatan lainnya.</p>
        </div>
        
        <div className="flex gap-3 w-full xl:w-auto flex-wrap sm:flex-nowrap items-center">
          {/* Efek Neon Cyberpunk Red di Tombol Sinkronisasi */}
          <Button onClick={() => setSyncModal({ isOpen: true, isLoading: false })} variant="secondary" className="flex-1 sm:flex-none border border-red-500 text-red-600 bg-red-50/50 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-all shadow-[0_0_10px_rgba(239,68,68,0.4)] hover:shadow-[0_0_15px_rgba(239,68,68,0.7)] font-bold">
            <CalendarDays size={18} className="mr-2 text-red-500 animate-pulse" /> Sinkron Libur Nasional
          </Button>
          
          {/* Efek Wiggle Tilt pada Tongkat AI */}
          <Button onClick={handleGenerateIdeas} disabled={aiLoading} variant="secondary" className="flex-1 sm:flex-none border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
            <Wand2 size={18} className="mr-2 text-indigo-600 dark:text-indigo-400 animate-wiggle-tilt" /> Sarankan Kegiatan (AI)
          </Button>
          
          <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          
          <Button onClick={() => { setEditingId(null); setForm({ name: '', startDate: '', endDate: '', category: 'Akademik', notes: '', customColor: '' }); setIsOpen(true); }} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow-md">
            <Plus size={18} className="mr-1.5" /> Tambah Kegiatan
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[600px]">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 rounded-tl-3xl">Tanggal</th>
                <th className="px-6 py-4">Kegiatan</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4 text-right rounded-tr-3xl">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              {events.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">Belum ada kegiatan. Klik Tambah Kegiatan.</td></tr>
              ) : (
                events.map((ev, i) => (
                  <tr key={ev.id} className="border-b dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">
                      {formatDate(ev.startDate)}
                      {ev.endDate && ev.endDate !== ev.startDate && <span className="block text-xs text-slate-400 font-normal">s/d {formatDate(ev.endDate)}</span>}
                    </td>
                    <td className="px-6 py-3">
                      <p className="font-semibold">{ev.name}</p>
                      {ev.notes && <p className="text-xs text-slate-500 truncate max-w-xs">{ev.notes}</p>}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${CATEGORIES[ev.category] || CATEGORIES['Lainnya']}`} style={ev.customColor ? {backgroundColor: ev.customColor, color: 'white', borderColor: ev.customColor} : {}}>
                        {ev.category}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleGenerateAnnouncement(ev)} title="✨ Buat Draf Pengumuman AI" className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md dark:text-indigo-400 dark:hover:bg-slate-600 transition-colors"><Wand2 size={16}/></button>
                        <button onClick={() => handleEdit(ev)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md dark:hover:bg-slate-600"><Edit size={16}/></button>
                        <button onClick={() => initiateDelete(ev.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md dark:hover:bg-slate-600"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex justify-end pb-8">
         <Button size="lg" className="w-full sm:w-auto px-10 shadow-lg group" onClick={() => onNext && onNext()}>
           <Save size={20} className="mr-2" /> Simpan & Cek Kalender <ChevronRightCircle size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
         </Button>
      </div>

      {isOpen && (
        <Modal title={editingId ? 'Edit Kegiatan' : 'Tambah Kegiatan'} onClose={() => setIsOpen(false)}>
          <div className="space-y-4">
            <Input label="Nama Kegiatan" value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus />
            
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Rentang Tanggal Kegiatan</label>
              <CustomDateRangePicker 
                startDate={form.startDate} 
                endDate={form.endDate} 
                onChange={(start, end) => setForm({...form, startDate: start, endDate: end})} 
                existingEvents={events} 
              />
            </div>
            
            <Select label="Kategori Standar" value={form.category} onChange={e => setForm({...form, category: e.target.value})} options={Object.keys(CATEGORIES)} />
            
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5"><Palette size={14}/> Warna Kustom (Opsional)</label>
              <div className="flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                {CUSTOM_COLORS.map(c => (
                  <button type="button" key={c} onClick={() => setForm({...form, customColor: c})} 
                    style={{backgroundColor: c}} 
                    className={`w-7 h-7 rounded-full shadow-sm hover:scale-110 transition-transform ${form.customColor === c ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-slate-100 dark:ring-offset-slate-800' : ''}`} 
                  />
                ))}
                <button type="button" onClick={() => setForm({...form, customColor: ''})} className="text-xs px-2 py-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md">Bawaan</button>
              </div>
            </div>

            <Input label="Catatan Tambahan" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
              <Button variant="secondary" onClick={() => setIsOpen(false)}>Batal</Button>
              <Button onClick={handleSave}>Simpan</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmDelete.isOpen && (
        <Modal title="Konfirmasi Penghapusan" onClose={() => setConfirmDelete({ isOpen: false, id: null })}>
          <div className="flex items-start gap-4 p-2">
            <div className="p-3 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full"><AlertTriangle size={24} /></div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">Apakah Anda yakin menghapus kegiatan ini?</p>
              <p className="text-sm text-slate-500 mt-1">Aktivitas ini tidak dapat diurungkan.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6">
            <Button variant="secondary" onClick={() => setConfirmDelete({ isOpen: false, id: null })}>Tidak, Batal</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDeleteAction}>Ya, Hapus</Button>
          </div>
        </Modal>
      )}

      {/* MODAL ANIMASI TEXT CAROUSEL LOADING AI */}
      {aiLoading && (
        <Modal title="✨ Asisten AI Aktif" onClose={() => {}}>
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-5">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-40 animate-pulse rounded-full w-16 h-16 -ml-2 -mt-2"></div>
              <Wand2 size={48} className="text-indigo-600 dark:text-indigo-400 relative animate-bounce" />
            </div>
            <div>
              <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">Memproses Kompilasi...</h4>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-3 whitespace-pre-line bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed max-w-sm mx-auto transition-opacity duration-300">
                {aiTexts[aiTextIdx]}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {announcementModal.isOpen && (
        <Modal title={`✨ Draf Edaran: ${announcementModal.eventName}`} onClose={() => setAnnouncementModal({ ...announcementModal, isOpen: false })}>
          <div className="space-y-4">
            {announcementModal.isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-indigo-600 dark:text-indigo-400"><Wand2 size={32} className="animate-spin mb-4" /><p className="animate-pulse font-medium">AI sedang merangkai kata-kata terbaik...</p></div>
            ) : (
              <><div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-pre-wrap text-sm max-h-64 overflow-y-auto text-slate-800 dark:text-slate-200">{announcementModal.text}</div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700"><Button variant="secondary" onClick={() => setAnnouncementModal({ ...announcementModal, isOpen: false })}>Tutup</Button><Button onClick={() => copyToClipboard(announcementModal.text)} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Copy size={16} className="mr-2" /> Salin Teks</Button></div></>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL ANIMASI TEXT CAROUSEL SINKRONISASI LIBUR */}
      {syncModal.isOpen && (
        <Modal title="📅 Sinkronisasi Libur Nasional" onClose={() => !syncModal.isLoading && setSyncModal({ isOpen: false, isLoading: false })}>
          <div className="space-y-4">
            {syncModal.isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-40 animate-pulse rounded-full w-16 h-16 -ml-2 -mt-2"></div>
                  <Globe size={48} className="text-emerald-600 dark:text-emerald-400 relative animate-spin-slow" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">Proses Sinkronisasi...</h4>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-3 whitespace-pre-line bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed max-w-sm mx-auto transition-opacity duration-300">
                    {syncTexts[syncTextIdx]}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-slate-800 dark:text-slate-300 text-sm">
                  <p className="font-bold flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-100"><Globe size={18} className="text-emerald-500"/> Sinkronisasi Cerdas</p>
                  <p className="leading-relaxed mb-2">Sistem akan menarik data kalender utama dari Google Calendar dan Database Lokal. Untuk tahun ajaran berikutnya, sistem otomatis menggunakan API Global sebagai estimasi otomatis.</p>
                  <p className="text-xs text-slate-500 px-2 py-1 bg-white dark:bg-slate-800 rounded">Rentang: <strong>Juli {data.identity.tahunPelajaran.split('/')[0]}</strong> s.d <strong>Juni {parseInt(data.identity.tahunPelajaran.split('/')[0]) + 1}</strong>.</p>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                  <Button variant="secondary" onClick={() => setSyncModal({ isOpen: false, isLoading: false })}>Batal</Button>
                  <Button onClick={handleSyncHolidays} className="bg-blue-600 hover:bg-blue-700">Mulai Sinkronisasi</Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function KalenderView({ events, yearStr, settings, onExport, isPrint = false, monthsPerPage = 12, data, showToast }) {
  const startYear = parseInt(yearStr.split('/')[0]) || new Date().getFullYear();
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const isWeekend = (dateObj) => {
    const day = dateObj.getDay();
    if (settings.hariSekolah === '5') return day === 0 || day === 6;
    if (settings.hariSekolah === '6') return day === 0;
    if (settings.hariSekolah === '6j') return day === 5;
    return day === 0;
  };

  const getDayEvents = (dateObj) => events.filter(e => {
      const start = new Date(e.startDate); const end = new Date(e.endDate || e.startDate);
      start.setHours(0,0,0,0); end.setHours(23,59,59,999);
      return dateObj >= start && dateObj <= end;
  });

  const renderMonth = (monthIndex, year) => {
    const daysInMonth = getDaysInMonth(monthIndex, year);
    const firstDay = getFirstDayOfMonth(monthIndex, year);
    const blanks = Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }, (_, i) => i); 
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div key={`${monthIndex}-${year}`} className={`break-inside-avoid bg-white rounded-2xl border ${isPrint ? 'p-2 border-slate-300 shadow-none' : 'shadow-sm p-4 border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
        <h3 className={`font-bold text-center ${isPrint ? 'mb-1 text-[11px] text-black' : 'mb-3 text-lg text-slate-800 dark:text-slate-100'}`}>{NORMAL_MONTHS[monthIndex]} {year}</h3>
        <div className={`grid grid-cols-7 gap-1 text-center font-semibold mb-1 ${isPrint ? 'text-[9px] text-slate-600' : 'text-xs text-slate-400'}`}>
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {blanks.map(b => <div key={`blank-${b}`} className={`border border-slate-100 dark:border-slate-700/50 rounded ${isPrint ? 'p-0.5' : 'p-2'}`}></div>)}
          {days.map(d => {
            const dateObj = new Date(year, monthIndex, d);
            const dayEvents = getDayEvents(dateObj);
            const isWknd = isWeekend(dateObj);
            
            let bgClass = isWknd ? (isPrint ? 'bg-red-50 text-red-600' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400') : (isPrint ? 'text-black' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300');
            
            let inlineStyle = {};
            let priorityEvent = dayEvents.length > 0 ? dayEvents[0] : null;
            
            if (priorityEvent) {
               if (priorityEvent.customColor) {
                 bgClass = 'text-white font-bold shadow-sm';
                 inlineStyle = { backgroundColor: priorityEvent.customColor };
               } else if (priorityEvent.category === 'Nasional') {
                 bgClass = 'bg-red-600 text-white font-bold shadow-sm'; 
               } else if (priorityEvent.category === 'Cuti Bersama') {
                 bgClass = 'bg-pink-400 text-white font-bold shadow-sm opacity-90'; 
               } else {
                 const catClass = CATEGORIES[priorityEvent.category] || CATEGORIES['Lainnya'];
                 const baseColor = catClass.split(' ')[0].replace('bg-', '');
                 bgClass = `bg-${baseColor.split('-')[0]}-500 text-white font-bold shadow-sm`;
               }
            }

            return (
              /* Perataan Teks Dead Center dengan leading-none dan explicit padding/height */
              <div key={d} className={`border border-slate-200 dark:border-slate-700 rounded flex items-center justify-center transition-colors relative group cursor-default leading-none ${bgClass} ${isPrint ? 'py-1 px-0.5 text-[10px] min-h-[16px]' : 'p-1.5 sm:p-2 text-sm min-h-[32px]'}`} style={inlineStyle}>
                {d}
                {!isPrint && dayEvents.length > 0 && (
                  <div className="absolute z-10 hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-1 w-48 p-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl print:hidden">
                    {dayEvents.map((ev, i) => <div key={i} className="mb-1 last:mb-0 font-medium">{ev.name}</div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLegend = () => {
    const yearEvents = events.filter(e => {
        const s = new Date(e.startDate);
        return s >= new Date(startYear, 6, 1) && s <= new Date(startYear + 1, 5, 30);
    }).sort((a,b) => new Date(a.startDate) - new Date(b.startDate));

    if (yearEvents.length === 0) return null;
    
    const colsClass = isPrint && monthsPerPage === 12 ? 'grid-cols-4' : 'grid-cols-2';

    return (
      <div className={`break-inside-avoid ${!isPrint ? 'mt-8 pt-6 border-t border-slate-200 dark:border-slate-700' : ''}`}>
        {!isPrint && (
           <h4 className={`font-bold mb-3 text-sm text-slate-700 dark:text-slate-300`}>Daftar Kegiatan & Libur:</h4>
        )}
        
        <div className={`grid gap-3 ${isPrint ? colsClass : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
          {yearEvents.map((ev, i) => {
            let bgClass = 'bg-slate-500';
            let inlineStyle = {};
            if (ev.customColor) {
               inlineStyle = { backgroundColor: ev.customColor };
            } else if (ev.category === 'Nasional') {
               bgClass = 'bg-red-600';
            } else if (ev.category === 'Cuti Bersama') {
               bgClass = 'bg-pink-400';
            } else {
               const catClass = CATEGORIES[ev.category] || CATEGORIES['Lainnya'];
               const baseColor = catClass.split(' ')[0].replace('bg-', '');
               bgClass = `bg-${baseColor.split('-')[0]}-500`;
            }

            const dArr = formatDate(ev.startDate).split(' ');
            const dShort = `${dArr[0]} ${dArr[1].substring(0,3)}`;
            const dEndArr = ev.endDate && ev.endDate !== ev.startDate ? formatDate(ev.endDate).split(' ') : null;
            const dEndShort = dEndArr ? `${dEndArr[0]} ${dEndArr[1].substring(0,3)}` : null;
            const dateText = dEndShort ? `${dShort} - ${dEndShort}` : dShort;

            return (
              <div key={i} className="flex items-start gap-2">
                <div className={`w-3 h-3 rounded-sm mt-1 flex-shrink-0 shadow-sm ${bgClass}`} style={inlineStyle}></div>
                <span className={`font-medium leading-tight ${isPrint ? 'text-black text-[10px]' : 'text-xs text-slate-600 dark:text-slate-400'}`}>
                  <strong className={isPrint ? 'text-black' : 'text-slate-800 dark:text-slate-200'}>{dateText}:</strong> {ev.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const generateAcademicYear = () => {
    let calendar = [];
    for (let m = 6; m <= 11; m++) calendar.push(renderMonth(m, startYear));
    for (let m = 0; m <= 5; m++) calendar.push(renderMonth(m, startYear + 1));
    return calendar;
  };

  const handleExportImage = async () => {
    if(!showToast) return;
    showToast('Sedang merender poster kalender resolusi tinggi...', 'success');
    try {
      if (!window.html2canvas) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.body.appendChild(script);
        await new Promise(resolve => { script.onload = resolve; });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const el = document.getElementById('kalender-capture-area');
      const canvas = await window.html2canvas(el, { 
        scale: 3, 
        useCORS: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff' 
      });
      
      const link = document.createElement('a');
      link.download = `Poster_Kalender_${yearStr.replace('/','-')}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      showToast('Gambar Kalender berhasil diunduh!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengekspor gambar', 'error');
    }
  };

  if (isPrint) {
    const calendar = generateAcademicYear();
    return (
      <>
        {monthsPerPage === 12 ? (
          <>
            <PrintPage isLandscape={true} customPadding="10px 40px 40px 40px">
               <PrintHeader data={data} />
               <h2 className="text-center font-bold text-base mb-1 text-black uppercase">Kalender Pendidikan Tahun Ajaran {yearStr}</h2>
               <div className="grid grid-cols-4 gap-x-4 gap-y-1 flex-1">
                  {calendar}
               </div>
            </PrintPage>
            <PrintPage isLandscape={true} customPadding="10px 40px 40px 40px">
               <div className="text-center mb-6 mt-2">
                 <h2 className="font-bold text-lg text-black uppercase border-b-2 border-black pb-2 inline-block mx-auto">Keterangan & Pengesahan</h2>
               </div>
               <div className="flex-1">
                 {renderLegend()}
               </div>
               <PrintSigner data={data} />
            </PrintPage>
          </>
        ) : (
          <>
            <PrintPage isLandscape={false}>
               <PrintHeader data={data} />
               <h2 className="text-center font-bold text-lg mb-2 text-black uppercase">Kalender Pendidikan Tahun Ajaran {yearStr}</h2>
               <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1">
                  {calendar.slice(0, 8)}
               </div>
            </PrintPage>
            <PrintPage isLandscape={false}>
               <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 mt-2">
                  {calendar.slice(8, 12)}
               </div>
               <div className="flex-1">
                 {renderLegend()}
               </div>
               <PrintSigner data={data} />
            </PrintPage>
          </>
        )}
      </>
    );
  }

  return (
    <div className={`space-y-6 relative animate-fade-in-up`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Kalender Pendidikan</h2>
          <p className="text-slate-500">Tahun Pelajaran {yearStr}</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button onClick={handleExportImage} variant="secondary" className="flex-1 sm:flex-none border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
             <ImageIcon size={18} className="mr-2 text-indigo-500"/> Ekspor PNG
          </Button>
        </div>
      </div>
      
      <div id="kalender-capture-area" className="bg-slate-50 dark:bg-slate-900 sm:p-4 rounded-xl">
        <div className="grid gap-4 xl:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
           {generateAcademicYear()}
        </div>
        {renderLegend()}
      </div>
      
      {onExport && !isPrint && (
         <button 
           onClick={onExport} 
           className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl px-5 py-4 flex items-center gap-2 font-bold transition-transform hover:scale-105 animate-fade-in-up"
           title="Ekspor ke PDF"
         >
           <Download size={20} className="animate-bounce" /> <span className="hidden sm:inline">Lanjut Ekspor PDF</span>
         </button>
      )}
    </div>
  );
}

function TimelineView({ events, yearStr, onExport, isPrint = false, data }) {
  const startYear = parseInt(yearStr.split('/')[0]) || new Date().getFullYear();
  const startDate = new Date(startYear, 6, 1); 
  const endDate = new Date(startYear + 1, 5, 30); 
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

  const getPosition = (dateStr) => {
    const d = new Date(dateStr);
    if (d < startDate) return 0;
    if (d > endDate) return 100;
    return ((d - startDate) / (1000 * 60 * 60 * 24) / totalDays) * 100;
  };

  const validEvents = events.filter(e => new Date(e.startDate) >= startDate || new Date(e.endDate||e.startDate) <= endDate)
                   .sort((a,b) => new Date(a.startDate) - new Date(b.startDate));

  const renderTimelineChunk = (eventsChunk) => (
      <div className={`bg-white rounded-2xl ${isPrint ? 'border border-slate-300 p-4' : 'shadow-sm p-6 border border-slate-100 dark:bg-slate-800 dark:border-slate-700 overflow-x-auto'}`}>
        <div className={isPrint ? 'w-full relative' : 'min-w-[800px] relative'}>
          
          <div className="absolute top-8 bottom-0 left-48 right-0 flex z-0 opacity-40 dark:opacity-20 pointer-events-none">
            {[6,7,8,9,10,11,0,1,2,3,4,5].map((m, i) => (
              <div key={i} className="flex-1 border-l border-dashed border-slate-400 dark:border-slate-500"></div>
            ))}
          </div>

          <div className={`flex pb-2 mb-4 break-inside-avoid relative z-10 ${isPrint ? 'border-b-2 border-slate-300' : 'border-b border-slate-700'}`}>
            <div className={`w-48 flex-shrink-0 font-bold text-sm uppercase tracking-wider ${isPrint ? 'text-black' : 'text-slate-500'}`}>Kegiatan</div>
            <div className="flex-1 relative h-6">
              {[6,7,8,9,10,11,0,1,2,3,4,5].map((m, i) => (
                <div key={i} className={`absolute text-xs font-semibold ${isPrint ? 'text-black' : 'text-slate-400'}`} style={{ left: `${(i / 12) * 100}%` }}>{NORMAL_MONTHS[m].substr(0,3)}</div>
              ))}
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            {eventsChunk.map(ev => {
              const startPct = getPosition(ev.startDate);
              const endPct = getPosition(ev.endDate || ev.startDate);
              const width = Math.max(endPct - startPct, 0.5);
              
              let bgClass = '';
              let inlineStyle = { left: `${startPct}%`, width: `${width}%` };

              if (ev.customColor) {
                inlineStyle.backgroundColor = ev.customColor;
              } else if (ev.category === 'Nasional') {
                bgClass = 'bg-red-600';
              } else if (ev.category === 'Cuti Bersama') {
                bgClass = 'bg-pink-400 opacity-90';
              } else {
                const catClass = CATEGORIES[ev.category] || CATEGORIES['Lainnya'];
                bgClass = `bg-${catClass.split(' ')[0].replace('bg-','').split('-')[0]}-500`;
              }

              const dStart = formatDate(ev.startDate).replace(/ 202[0-9]/, '');
              const dEnd = ev.endDate && ev.endDate !== ev.startDate ? formatDate(ev.endDate).replace(/ 202[0-9]/, '') : null;
              const dateText = dEnd ? `${dStart} - ${dEnd}` : dStart;

              return (
                <div key={ev.id} className={`flex items-start group break-inside-avoid ${isPrint ? 'py-1' : 'py-0'}`}>
                  <div className={`w-48 flex-shrink-0 pr-4 ${isPrint ? 'text-black' : 'text-slate-800 dark:text-slate-200'}`} title={ev.name}>
                    <div className={`text-sm font-bold leading-tight ${isPrint ? 'whitespace-normal break-words' : 'truncate'}`}>{ev.name}</div>
                    <div className={`text-[10px] mt-1 font-medium ${isPrint ? 'text-slate-600' : 'text-slate-500'}`}>
                      {dateText}
                    </div>
                  </div>
                  <div className={`flex-1 mt-1.5 relative rounded-full overflow-hidden ${isPrint ? 'bg-slate-200 h-4' : 'bg-slate-50 dark:bg-slate-700/30 h-6'}`}>
                    <div 
                      className={`absolute h-full rounded-full transition-all duration-300 opacity-80 group-hover:opacity-100 ${bgClass} ${isPrint ? 'opacity-100' : 'shadow-sm'}`}
                      style={inlineStyle}
                      title={`${ev.name} (${formatDate(ev.startDate)} - ${formatDate(ev.endDate||ev.startDate)})`}
                    ></div>
                  </div>
                </div>
              );
            })}
            {eventsChunk.length === 0 && <p className="text-center text-slate-500 text-sm py-4">Belum ada kegiatan untuk ditampilkan di timeline.</p>}
          </div>
        </div>
      </div>
  );

  if (isPrint) {
    const ITEMS_PER_PAGE = 6; 
    const chunks = [];
    for (let i = 0; i < validEvents.length; i += ITEMS_PER_PAGE) {
       chunks.push(validEvents.slice(i, i + ITEMS_PER_PAGE));
    }
    if (chunks.length === 0) chunks.push([]);

    return (
      <>
        {chunks.map((chunk, idx) => (
          <PrintPage key={idx} isLandscape={true}>
            {idx === 0 && <PrintHeader data={data} />}
            <h2 className={`text-center font-bold text-lg ${idx === 0 ? 'mb-6' : 'mb-8'} text-black uppercase border-b-2 border-black pb-2 inline-block mx-auto`}>
              Timeline Visual Kegiatan TA {yearStr} {chunks.length > 1 ? `(Hal ${idx + 1})` : ''}
            </h2>
            <div className="flex-1">
               {renderTimelineChunk(chunk)}
            </div>
          </PrintPage>
        ))}
      </>
    );
  }

  return (
    <div className={`space-y-6 relative animate-fade-in-up`}>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Timeline Visual</h2>
          <p className="text-slate-500">Gantt Chart Sederhana TA {yearStr}</p>
        </div>
      </div>
      
      {renderTimelineChunk(validEvents)}
      
      {onExport && !isPrint && (
         <button 
           onClick={onExport} 
           className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl px-5 py-4 flex items-center gap-2 font-bold transition-transform hover:scale-105 animate-fade-in-up"
           title="Ekspor ke PDF"
         >
           <Download size={20} className="animate-bounce" /> <span className="hidden sm:inline">Lanjut Ekspor PDF</span>
         </button>
      )}
    </div>
  );
}

function EfektifView({ events, yearStr, settings, onExport, isPrint = false, data }) {
  const startYear = parseInt(yearStr.split('/')[0]) || new Date().getFullYear();
  
  const getWorkingDays = (month, year) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let total = 0;
    for(let i=1; i<=daysInMonth; i++) {
      const d = new Date(year, month, i);
      const day = d.getDay();
      let isWorkDay = true;
      if (settings.hariSekolah === '5' && (day === 0 || day === 6)) isWorkDay = false;
      if (settings.hariSekolah === '6' && day === 0) isWorkDay = false;
      if (settings.hariSekolah === '6j' && day === 5) isWorkDay = false;
      if (isWorkDay) total++;
    }
    return total;
  };

  const getHolidayDays = (month, year) => {
    const liburEvents = events.filter(e => e.category === 'Libur' || e.category === 'Nasional' || e.category === 'Cuti Bersama');
    let holidayCount = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for(let i=1; i<=daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      const day = dateObj.getDay();
      let isWorkDay = true;
      if (settings.hariSekolah === '5' && (day === 0 || day === 6)) isWorkDay = false;
      if (settings.hariSekolah === '6' && day === 0) isWorkDay = false;
      if (settings.hariSekolah === '6j' && day === 5) isWorkDay = false;
      if (!isWorkDay) continue;

      const isHoliday = liburEvents.some(e => {
        const start = new Date(e.startDate); start.setHours(0,0,0,0);
        const end = new Date(e.endDate || e.startDate); end.setHours(23,59,59,999);
        return dateObj >= start && dateObj <= end;
      });
      if (isHoliday) holidayCount++;
    }
    return holidayCount;
  };

  const generateStats = () => {
    let stats = [];
    const sequence = [
      { m: 6, y: startYear, sem: 1 }, { m: 7, y: startYear, sem: 1 }, { m: 8, y: startYear, sem: 1 },
      { m: 9, y: startYear, sem: 1 }, { m: 10, y: startYear, sem: 1 }, { m: 11, y: startYear, sem: 1 },
      { m: 0, y: startYear + 1, sem: 2 }, { m: 1, y: startYear + 1, sem: 2 }, { m: 2, y: startYear + 1, sem: 2 },
      { m: 3, y: startYear + 1, sem: 2 }, { m: 4, y: startYear + 1, sem: 2 }, { m: 5, y: startYear + 1, sem: 2 },
    ];
    sequence.forEach(item => {
      const daysInMonth = new Date(item.y, item.m + 1, 0).getDate();
      const grossWeeks = Math.ceil(daysInMonth / 7); 
      const potentialWorkDays = getWorkingDays(item.m, item.y);
      const holidays = getHolidayDays(item.m, item.y);
      const effectiveDays = potentialWorkDays - holidays;
      const daysPerWeek = settings.hariSekolah === '5' ? 5 : 6;
      const effectiveWeeks = Math.round(effectiveDays / daysPerWeek);
      
      stats.push({ month: NORMAL_MONTHS[item.m], year: item.y, semester: item.sem, grossWeeks, effectiveDays, holidays, effectiveWeeks });
    });
    return stats;
  };

  const stats = generateStats();
  const sum1 = stats.filter(s => s.semester === 1).reduce((acc, curr) => ({ gw: acc.gw + curr.grossWeeks, ew: acc.ew + curr.effectiveWeeks, ed: acc.ed + curr.effectiveDays }), {gw:0, ew:0, ed:0});
  const sum2 = stats.filter(s => s.semester === 2).reduce((acc, curr) => ({ gw: acc.gw + curr.grossWeeks, ew: acc.ew + curr.effectiveWeeks, ed: acc.ed + curr.effectiveDays }), {gw:0, ew:0, ed:0});

  const efektifContent = (
      <div className={`grid gap-6 ${isPrint ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
        <div className={`rounded-2xl overflow-hidden break-inside-avoid ${isPrint ? 'border border-slate-300 bg-white' : 'bg-white shadow-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
          <div className={`p-4 ${isPrint ? 'bg-blue-100' : 'bg-blue-600 text-white'}`}>
            <h3 className={`font-bold text-lg ${isPrint ? 'text-blue-900' : ''}`}>Semester Ganjil</h3>
            <p className={`text-sm ${isPrint ? 'text-blue-800' : 'text-blue-100'}`}>Total: {sum1.ew} Minggu Efektif ({sum1.ed} Hari)</p>
          </div>
          <table className="w-full text-sm text-left">
            <thead className={isPrint ? 'bg-slate-50 border-b border-slate-300 text-black' : 'bg-slate-50 dark:bg-slate-700/50'}>
              <tr>
                <th className="px-4 py-2 border-b">Bulan</th>
                <th className="px-4 py-2 border-b text-center">Jml Minggu</th>
                <th className="px-4 py-2 border-b text-center">Mg. Efektif</th>
                <th className="px-4 py-2 border-b text-center">Hr. Libur</th>
              </tr>
            </thead>
            <tbody className={isPrint ? 'text-black' : 'text-slate-700 dark:text-slate-300'}>
              {stats.filter(s => s.semester === 1).map((s, i) => (
                <tr key={i} className={`border-b last:border-0 ${isPrint ? 'border-slate-200' : 'dark:border-slate-700'}`}>
                  <td className="px-4 py-2 font-medium">{s.month} {s.year}</td>
                  <td className="px-4 py-2 text-center">{s.grossWeeks}</td>
                  <td className={`px-4 py-2 text-center font-bold ${isPrint ? 'text-blue-700' : 'text-blue-600 dark:text-blue-400'}`}>{s.effectiveWeeks}</td>
                  <td className={`px-4 py-2 text-center ${isPrint ? 'text-red-600' : 'text-red-500'}`}>{s.holidays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`rounded-2xl overflow-hidden break-inside-avoid ${isPrint ? 'border border-slate-300 bg-white' : 'bg-white shadow-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
          <div className={`p-4 ${isPrint ? 'bg-green-100' : 'bg-green-600 text-white'}`}>
            <h3 className={`font-bold text-lg ${isPrint ? 'text-green-900' : ''}`}>Semester Genap</h3>
            <p className={`text-sm ${isPrint ? 'text-green-800' : 'text-green-100'}`}>Total: {sum2.ew} Minggu Efektif ({sum2.ed} Hari)</p>
          </div>
          <table className="w-full text-sm text-left">
            <thead className={isPrint ? 'bg-slate-50 border-b border-slate-300 text-black' : 'bg-slate-50 dark:bg-slate-700/50'}>
              <tr>
                <th className="px-4 py-2 border-b">Bulan</th>
                <th className="px-4 py-2 border-b text-center">Jml Minggu</th>
                <th className="px-4 py-2 border-b text-center">Mg. Efektif</th>
                <th className="px-4 py-2 border-b text-center">Hr. Libur</th>
              </tr>
            </thead>
            <tbody className={isPrint ? 'text-black' : 'text-slate-700 dark:text-slate-300'}>
              {stats.filter(s => s.semester === 2).map((s, i) => (
                <tr key={i} className={`border-b last:border-0 ${isPrint ? 'border-slate-200' : 'dark:border-slate-700'}`}>
                  <td className="px-4 py-2 font-medium">{s.month} {s.year}</td>
                  <td className="px-4 py-2 text-center">{s.grossWeeks}</td>
                  <td className={`px-4 py-2 text-center font-bold ${isPrint ? 'text-green-700' : 'text-green-600 dark:text-green-400'}`}>{s.effectiveWeeks}</td>
                  <td className={`px-4 py-2 text-center ${isPrint ? 'text-red-600' : 'text-red-500'}`}>{s.holidays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );

  if (isPrint) {
    return (
      <PrintPage isLandscape={false}>
        <PrintHeader data={data} />
        <h2 className="text-center font-bold text-lg mb-6 text-black uppercase border-b-2 border-black pb-2 inline-block mx-auto">Rincian Hari & Minggu Efektif TA {yearStr}</h2>
        <div className="flex-1">
           {efektifContent}
        </div>
        <PrintSigner data={data} />
      </PrintPage>
    );
  }

  return (
    <div className={`space-y-6 relative animate-fade-in-up`}>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Minggu Efektif & Hari Efektif</h2>
          <p className="text-slate-500">Kalkulasi otomatis berdasarkan pengaturan {settings.hariSekolah} hari sekolah.</p>
        </div>
      </div>
      
      {efektifContent}
      
      {onExport && !isPrint && (
         <button 
           onClick={onExport} 
           className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl px-5 py-4 flex items-center gap-2 font-bold transition-transform hover:scale-105 animate-fade-in-up"
           title="Ekspor ke PDF"
         >
           <Download size={20} className="animate-bounce" /> <span className="hidden sm:inline">Lanjut Ekspor PDF</span>
         </button>
      )}
    </div>
  );
}

// --- ENGINE PDF EKSPOR (100% FIX ABSOLUT) ---
function ExportView({ data, showToast }) {
  const [docType, setDocType] = useState('kalender');
  const [monthsPerPage, setMonthsPerPage] = useState(12); // Pilihan Layout Kalender
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!window.html2canvas) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
    if (!window.jspdf?.jsPDF) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const waitForLibrary = (test, timeout = 12000) => {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const tick = () => {
        if (test()) {
          resolve();
          return;
        }

        if (Date.now() - startedAt > timeout) {
          reject(new Error('Library PDF belum siap.'));
          return;
        }

        setTimeout(tick, 100);
      };

      tick();
    });
  };

  const waitForPdfAssets = async (element) => {
    const timer = new Promise(resolve => setTimeout(resolve, 3000));
    const assetLoader = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      const images = Array.from(element.querySelectorAll('img'));
      await Promise.all(images.map((img) => {
        if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));
    };
    return Promise.race([assetLoader(), timer]);
  };

  const handleExportPdf = async () => {
    if (isExporting) return; 
    
    window.scrollTo(0, 0); 
    setIsExporting(true);
    
    setTimeout(async () => {
      const container = document.getElementById('pdf-export-container');
      if (!container) {
        setIsExporting(false);
        return showToast('Area PDF tidak ditemukan.', 'error');
      }

      try {
        await Promise.all([
          waitForLibrary(() => !!window.html2canvas),
          waitForLibrary(() => !!window.jspdf?.jsPDF || !!window.jsPDF)
        ]);
        await waitForPdfAssets(container);

        const jsPDFCtor = window.jspdf?.jsPDF || window.jsPDF;
        const isLandscape = (docType === 'kalender' && monthsPerPage === 12) || docType === 'timeline';
        const pdfOrientation = isLandscape ? 'landscape' : 'portrait';
        
        const pdf = new jsPDFCtor({ unit: 'mm', format: 'a4', orientation: pdfOrientation, compress: true });
        
        const pages = container.querySelectorAll('.pdf-print-page');
        for (let i = 0; i < pages.length; i++) {
          if (i > 0) pdf.addPage();
          const pageEl = pages[i];
          
          // FIX OOM (Memory Leak): Jeda 300ms antar rendering canvas agar memori stabil
          await new Promise(resolve => setTimeout(resolve, 300));

          const canvasPromise = window.html2canvas(pageEl, {
            scale: 1.5, // FIX: Menggunakan resolusi optimal yang tidak membebani browser HP/Laptop
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            scrollY: 0,
            scrollX: 0
          });

          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout proses render gambar PDF")), 15000));
          const canvas = await Promise.race([canvasPromise, timeoutPromise]);
          const imgData = canvas.toDataURL('image/jpeg', 0.90);
          const pdfWidth = isLandscape ? 297 : 210;
          const pdfHeight = isLandscape ? 210 : 297;
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

          // FIX OOM: Bersihkan cache canvas secara paksa setiap iterasi
          canvas.width = 0;
          canvas.height = 0;
        }

        const filename = `KalistaPro_${docType}_${data.identity.tahunPelajaran.replace('/','-')}.pdf`;
        pdf.save(filename);
        showToast('Dokumen PDF berhasil diunduh!', 'success');
      } catch (err) { 
        console.error(err);
        showToast('Gagal mengekspor PDF. Pastikan memori browser mencukupi.', 'error'); 
      } finally {
        setIsExporting(false);
      }
    }, 800);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto relative animate-fade-in-up">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 text-center relative z-10 transition-all hover:shadow-md">
        <Download size={48} className="mx-auto text-blue-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-slate-800 dark:text-slate-100">Ekspor ke PDF Sempurna</h2>
        <p className="text-slate-500 mb-8 max-w-2xl mx-auto">Opsi telah kami sederhanakan demi menghasilkan PDF yang 100% presisi dan rapi, tanpa takut tabel terpotong. Pilih layout favorit Anda dan biarkan sistem menangani sisanya.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-left max-w-2xl mx-auto bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Select label="Pilih Dokumen Visual" value={docType} onChange={e => setDocType(e.target.value)} options={[
            {label: '📅 Kalender Pendidikan', value: 'kalender'}, 
            {label: '✅ Tabel Hari Efektif', value: 'efektif'}, 
            {label: '📈 Timeline Visual', value: 'timeline'}
          ]} />
          
          {docType === 'kalender' ? (
            <Select label="Layout Kertas Otomatis" value={monthsPerPage} onChange={e => setMonthsPerPage(Number(e.target.value))} options={[
              {label: '2 Halaman (A4 Landscape: Kalender + Legenda)', value: 12}, 
              {label: '2 Halaman (A4 Portrait: 8 Bulan + 4 Bulan & Pengesahan)', value: 8}
            ]} />
          ) : (
            <div className="flex flex-col gap-1.5 opacity-60 cursor-not-allowed">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Layout Kertas Otomatis</label>
              <div className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 font-medium">
                {docType === 'timeline' ? 'Multihalaman Dinamis (A4 Landscape)' : '1 Halaman (A4 Portrait)'}
              </div>
            </div>
          )}
        </div>
        <Button onClick={handleExportPdf} size="lg" disabled={isExporting} className="w-full sm:w-auto px-10 shadow-lg">{isExporting ? <span className="animate-pulse flex items-center"><Zap size={20} className="mr-2 animate-spin-slow"/> Sedang Menyusun Halaman PDF...</span> : <><Download size={20} className="mr-2" /> Download PDF Sekarang</>}</Button>
      </div>
      
      {/* OVERLAY LOADING: Dibuat solid agar GPU HP/Laptop tidak hang/crash akibat efek backdrop-blur */}
      {isExporting && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center">
           <Zap size={64} className="text-blue-600 animate-pulse mb-4" />
           <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wider mb-2">Menyusun PDF Paripurna...</h2>
           <p className="text-slate-600 font-medium text-center px-4 max-w-md">Sistem sedang memotret elemen dalam mode layar-penuh untuk menjaga presisi tinggi. Tolong jangan tutup halaman ini.</p>
        </div>
      )}

      {/* KOTAK RENDER PDF: Dirender aman di bawah overlay */}
      <div aria-hidden="true" style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        zIndex: isExporting ? 9990 : -1000, 
        visibility: isExporting ? 'visible' : 'hidden',
        pointerEvents: 'none' 
      }}>
        <div id="pdf-export-container" className="flex flex-col gap-4 p-8">
          {docType === 'kalender' && <KalenderView events={data.events} yearStr={data.identity.tahunPelajaran} settings={data.settings} monthsPerPage={monthsPerPage} isPrint={true} data={data} />}
          {docType === 'efektif' && <EfektifView events={data.events} yearStr={data.identity.tahunPelajaran} settings={data.settings} isPrint={true} data={data} />}
          {docType === 'timeline' && <TimelineView events={data.events} yearStr={data.identity.tahunPelajaran} isPrint={true} data={data} />}
        </div>
      </div>
    </div>
  );
}

function BackupView({ data, setData, showToast }) {
  const fileInputRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `KalistaPro_backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
    showToast('Data berhasil diekspor');
  };
  
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (importedData.identity && importedData.events) { setData(importedData); showToast('Data berhasil direstore', 'success'); } 
        else { showToast('Format file JSON tidak valid', 'error'); }
      } catch (err) { showToast('Gagal membaca file JSON', 'error'); }
    };
    reader.readAsText(file); e.target.value = '';
  };
  
  const handleReset = () => {
    localStorage.removeItem('kaldik_data'); window.location.reload(); 
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 text-center transition-all hover:shadow-md">
        <Save size={48} className="mx-auto text-blue-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-slate-800 dark:text-slate-100">Pencadangan Data</h2>
        <p className="text-slate-500 mb-8">Karena aplikasi ini berjalan 100% offline, disarankan rutin mengekspor data sebagai cadangan (Backup).</p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button onClick={handleExport} className="w-full sm:w-auto"><Download size={18} className="mr-2" /> Download Backup (JSON)</Button>
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
          <Button onClick={() => fileInputRef.current.click()} variant="secondary" className="w-full sm:w-auto"><Upload size={18} className="mr-2" /> Restore dari JSON</Button>
        </div>
      </div>
      <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-3xl border border-red-100 dark:border-red-800/50 flex justify-between items-center transition-all hover:shadow-md">
        <div><h3 className="font-bold text-red-800 dark:text-red-400">Reset Aplikasi</h3><p className="text-sm text-red-600 dark:text-red-300">Hapus semua data kegiatan dan identitas dari browser.</p></div>
        <Button onClick={() => setConfirmDelete(true)} className="bg-red-600 hover:bg-red-700 text-white">Reset Total</Button>
      </div>

      {confirmDelete && (
        <Modal title="Peringatan Bahaya" onClose={() => setConfirmDelete(false)}>
          <div className="flex items-start gap-4 p-2">
            <div className="p-3 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full"><AlertTriangle size={24} /></div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">Reset Semua Data?</p>
              <p className="text-sm text-slate-500 mt-1">Seluruh data (identitas, kegiatan, aset) akan dihapus secara permanen dari perangkat ini.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Batal</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleReset}>Ya, Hapus Semua</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AboutView() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up pb-10">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white text-center shadow-lg relative overflow-hidden transition-all hover:shadow-xl hover:scale-[1.02]">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-20"><CalendarDays size={180} /></div>
        <h1 className="text-4xl font-black mb-4 relative z-10">Kalista <span className="text-amber-400">Pro</span></h1>
        <p className="text-blue-100 text-lg max-w-xl mx-auto relative z-10 leading-relaxed font-medium">Kaldik Asistant Profesional</p>
        <p className="text-blue-200 text-sm max-w-xl mx-auto relative z-10 leading-relaxed mt-2">Alat bantu Wakil Kepala Sekolah Bidang Kurikulum, Kepala Sekolah, dan Operator Sekolah agar bekerja lebih efisien.</p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row items-center md:items-start gap-6 transition-all hover:shadow-md">
        <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400"><Info size={40} /></div>
        <div className="text-center md:text-left flex-1">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Dikembangkan dengan dedikasi oleh</h2>
          <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Toto Gutomo, S.Pd, Gr, M.Pd, CPSS</h3>
          <p className="text-slate-600 dark:text-slate-300 text-lg mb-6">Guru SMA Negeri 3 Maliku<br/>Pulang Pisau, Kalimantan Tengah</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
             <a href="mailto:totogutomo92@guru.sma.belajar.id" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold"><Mail size={16} /> Email</a>
             <a href="http://tiktok.com/@toto.gutomo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg transition-colors text-sm font-semibold"><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg> TikTok</a>
             <a href="https://www.instagram.com/toto_gutomo/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-colors text-sm font-semibold"><Instagram size={16} /> Instagram</a>
             <a href="https://www.youtube.com/c/TotoGutomo/videos" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-semibold"><Youtube size={16} /> YouTube</a>
          </div>
        </div>
      </div>

      {/* Keamanan & Legalitas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 transition-all hover:shadow-md">
            <ShieldCheck size={32} className="text-green-500 mb-4" />
            <h4 className="font-bold text-lg mb-2 text-slate-800 dark:text-slate-100">Keamanan Data Terjamin</h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Aplikasi ini memadukan kekuatan kecerdasan buatan (AI) secara online dengan penyimpanan lokal yang super aman. <strong>Teknologi AI Gemini</strong> hanya memproses instruksi sesaat untuk menghasilkan draf ide tanpa pernah mengirimkan data instansi. Seluruh data sekolah, jadwal, dan tanda tangan Anda 100% terkunci di penyimpanan perangkat lokal (*Local Storage*) dan tidak terunggah ke server pihak ketiga mana pun.</p>
         </div>
         <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 transition-all hover:shadow-md">
            <FileText size={32} className="text-blue-500 mb-4" />
            <h4 className="font-bold text-lg mb-2 text-slate-800 dark:text-slate-100">Legalitas & Teknologi Canggih</h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-3">Hak cipta dari dokumen kalender, timeline, dan surat edaran yang dihasilkan sepenuhnya menjadi milik Anda dan institusi sekolah Anda. Kami menggunakan arsitektur teknologi terdepan:</p>
            <ul className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed list-disc list-inside space-y-1.5 ml-1">
              <li><strong>Google Gemini AI API:</strong> Otomatisasi ide cerdas.</li>
              <li><strong>Google Calendar API & Nager.Date:</strong> Sinkronisasi hari libur global.</li>
              <li><strong>React & Tailwind CSS:</strong> Antarmuka responsif kelas atas.</li>
              <li><strong>html2canvas & jsPDF:</strong> Mesin perender PDF multi-halaman.</li>
            </ul>
         </div>
      </div>
    </div>
  );
}

// --- REUSABLE UI COMPONENTS ---
const Input = ({ label, type = 'text', className = '', ...props }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>}
    <input type={type} className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:shadow-sm outline-none transition-all" {...props} />
  </div>
);

const Select = ({ label, options, className = '', ...props }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>}
    <select className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:shadow-sm outline-none transition-all cursor-pointer text-slate-800 dark:text-slate-100" {...props}>
      {options.map((opt, i) => <option key={i} value={typeof opt === 'object' ? opt.value : opt} className="text-slate-800 dark:text-slate-900">{typeof opt === 'object' ? opt.label : opt}</option>)}
    </select>
  </div>
);

const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const base = "inline-flex items-center justify-center font-semibold rounded-lg transition-all focus:ring-2 focus:ring-offset-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5", lg: "px-6 py-3 text-lg" };
  const variants = { primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm focus:ring-blue-500", secondary: "bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 focus:ring-slate-500" };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100 my-auto border dark:border-slate-700">
      <div className="flex justify-between items-center p-4 border-b dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 text-slate-800 dark:text-slate-100">
        <h3 className="font-bold text-lg">{title}</h3>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors"><X size={20}/></button>
      </div>
      <div className="p-4 text-slate-800 dark:text-slate-100">{children}</div>
    </div>
  </div>
);

const ImageUploader = ({ label, value, onChange, onRemove }) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
    {value ? (
      <div className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 h-24 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center hover:shadow-md transition-shadow">
        <img src={value} alt={label} className="max-h-full max-w-full object-contain p-2" />
        <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-opacity">
          <button onClick={onRemove} className="p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700"><Trash2 size={16}/></button>
        </div>
      </div>
    ) : (
      <div className="relative h-24 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
        <input type="file" accept="image/*" onChange={onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <div className="text-slate-400 flex flex-col items-center group-hover:text-blue-500 transition-colors"><Upload size={20} className="mb-1" /><span className="text-xs font-medium">Pilih Gambar</span></div>
      </div>
    )}
  </div>
);

// --- KOMPONEN PRINT KHUSUS (ANTI POTONG) ---
const A4_PORTRAIT_WIDTH = 794;
const A4_PORTRAIT_HEIGHT = 1123;
const A4_LANDSCAPE_WIDTH = 1123;
const A4_LANDSCAPE_HEIGHT = 794;

const PrintPage = ({ children, isLandscape, customPadding, dynamicHeight }) => (
  <div className="pdf-print-page bg-white text-black mx-auto flex flex-col" style={{
    width: isLandscape ? `${A4_LANDSCAPE_WIDTH}px` : `${A4_PORTRAIT_WIDTH}px`,
    height: dynamicHeight ? 'auto' : (isLandscape ? `${A4_LANDSCAPE_HEIGHT}px` : `${A4_PORTRAIT_HEIGHT}px`),
    minHeight: isLandscape ? `${A4_LANDSCAPE_HEIGHT}px` : `${A4_PORTRAIT_HEIGHT}px`,
    padding: customPadding || '40px', 
    boxSizing: 'border-box',
    position: 'relative',
    backgroundColor: '#ffffff',
    overflow: dynamicHeight ? 'visible' : 'hidden'
  }}>
    {children}
  </div>
);

const PrintHeader = ({ data }) => (
  <div className="text-center border-b-4 border-slate-800 pb-4 mb-6 flex justify-between items-center w-full flex-shrink-0">
      {data.assets.logoKiri ? <img src={data.assets.logoKiri} alt="Logo 1" className="h-24 w-24 object-contain" /> : <div className="w-24"></div>}
      <div className="flex-1 px-4">
        <h2 className="text-xl font-bold uppercase text-black">{data.identity.namaDinas || 'DINAS PENDIDIKAN'}</h2>
        <h1 className="text-3xl font-black uppercase tracking-wider text-black">{data.identity.namaSekolah || 'NAMA SEKOLAH'}</h1>
        <p className="text-sm mt-1 text-black">{data.identity.alamat} Kec. {data.identity.kecamatan} Kab. {data.identity.kabupaten} Prov. {data.identity.provinsi}</p>
      </div>
      {data.assets.logoKanan ? <img src={data.assets.logoKanan} alt="Logo 2" className="h-24 w-24 object-contain" /> : <div className="w-24"></div>}
  </div>
);

const PrintSigner = ({ data }) => {
  const displayedJenisNomor = data.signer.jenisNomor === 'Lainnya' ? (data.signer.jenisNomorCustom || 'Lainnya') : data.signer.jenisNomor;
  const getTempatTtd = () => {
    switch(data.signer.tempatOption) {
      case 'kecamatan': return data.identity.kecamatan || 'Kecamatan';
      case 'desa': return data.identity.desa || 'Desa/Kelurahan';
      case 'manual': return data.signer.tempatManual || 'Tempat';
      default: return data.identity.kabupaten || 'Kab/Kota';
    }
  };
  const getTanggalTtd = () => {
    if (data.signer.tanggalOption === 'manual' && data.signer.tanggalManual) return formatDate(data.signer.tanggalManual);
    return formatDate(new Date().toISOString().split('T')[0]); 
  };

  return (
    <div className="mt-auto pt-4 flex justify-end w-full flex-shrink-0">
      <div className="text-center w-64">
        <p className="mb-1 text-black">{getTempatTtd()}, {getTanggalTtd()}</p>
        <p className="font-semibold text-black">{data.signer.jabatan || 'Kepala Sekolah'}</p>
        <div className="h-24 my-2 relative flex justify-center items-center">
           {data.assets.stempel && <img src={data.assets.stempel} alt="Stempel" className="absolute h-24 w-24 object-contain opacity-70 -ml-16" />}
           {data.assets.ttd && <img src={data.assets.ttd} alt="TTD" className="relative h-20 object-contain z-10" />}
        </div>
        <p className="font-bold underline text-black">{data.signer.nama || 'Nama Terang'}</p>
        <p className="text-black">{displayedJenisNomor}: {data.signer.nomor}</p>
      </div>
    </div>
  );
};