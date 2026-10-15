import React, { useState, useEffect, useRef, useMemo } from 'react';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  Home, Calendar, CalendarDays, BarChart, Settings, 
  Upload, Download, FileJson, Sun, Moon, Menu, X, 
  Plus, Edit, Trash2, Check, AlertCircle, Copy, Eye, FolderOpen, FolderPlus, Pencil, FileSpreadsheet, ImageDown, HardDrive, 
  Save, FileText, Image as ImageIcon,
  Info, Camera as Instagram, PlayCircle as Youtube, ShieldCheck, Zap, Globe,
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

// Mapping warna solid dibuat eksplisit agar aman saat build Tailwind.
// Jangan gunakan class dinamis seperti `bg-${color}-500`, karena bisa tidak terbaca oleh Tailwind purge/JIT.
const CATEGORY_SOLID_COLORS = {
  'Akademik': 'bg-blue-500',
  'Asesmen': 'bg-purple-500',
  'Kesiswaan': 'bg-green-500',
  'Libur': 'bg-red-500',
  'Nasional': 'bg-red-600',
  'Cuti Bersama': 'bg-pink-400',
  'Lainnya': 'bg-gray-500'
};

const getCategorySolidClass = (category) => CATEGORY_SOLID_COLORS[category] || CATEGORY_SOLID_COLORS['Lainnya'];
const getCategoryCalendarClass = (category) => `${getCategorySolidClass(category)} text-white font-bold shadow-sm${category === 'Cuti Bersama' ? ' opacity-90' : ''}`;

const CUSTOM_COLORS = ['#3b82f6', '#a855f7', '#22c55e', '#ef4444', '#ec4899', '#f97316', '#6366f1', '#14b8a6', '#64748b'];

const NORMAL_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];


const APP_VERSION = '1.1.0';
const PROJECTS_STORAGE_KEY = 'kalista_projects_v1';
const LEGACY_STORAGE_KEY = 'kalista_data';
const HOLIDAY_CATEGORIES = new Set(['Libur', 'Nasional', 'Cuti Bersama']);
const NONREGULAR_CATEGORIES = new Set(['Akademik', 'Asesmen', 'Kesiswaan', 'Lainnya']);
const ALLOWED_CATEGORIES = ['Akademik', 'Asesmen', 'Kesiswaan', 'Libur', 'Nasional', 'Cuti Bersama', 'Lainnya'];

const DEFAULT_DATA = {
  identity: { namaDinas: '', namaSekolah: '', alamat: '', desa: '', kecamatan: '', kabupaten: '', provinsi: '', tahunPelajaran: '2026/2027', jenjang: 'SMA' },
  signer: { nama: '', jabatan: 'Kepala Sekolah', jenisNomor: 'NIP', nomor: '', jenisNomorCustom: '', tempatOption: 'kabupaten', tempatManual: '', tanggalOption: 'hari_ini', tanggalManual: '' },
  assets: { logoKiri: null, logoKanan: null, ttd: null, stempel: null },
  settings: { hariSekolah: '5' },
  events: []
};

const cloneData = (value) => JSON.parse(JSON.stringify(value));
const normalizeData = (value = {}) => ({
  identity: { ...DEFAULT_DATA.identity, ...(value.identity || {}) },
  signer: { ...DEFAULT_DATA.signer, ...(value.signer || {}) },
  assets: { ...DEFAULT_DATA.assets, ...(value.assets || {}) },
  settings: { ...DEFAULT_DATA.settings, ...(value.settings || {}) },
  events: Array.isArray(value.events) ? value.events : []
});

const makeProjectName = (data) => {
  const school = data?.identity?.namaSekolah?.trim() || 'Proyek Kalender';
  const year = data?.identity?.tahunPelajaran?.trim() || 'Tahun Pelajaran';
  return `${school} — ${year}`;
};

const parseLocalDate = (dateString) => {
  const parts = String(dateString || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date('invalid');
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const isWorkingDate = (dateObj, settings) => {
  const day = dateObj.getDay();
  if (settings.hariSekolah === '5') return day !== 0 && day !== 6;
  if (settings.hariSekolah === '6') return day !== 0;
  if (settings.hariSekolah === '6j') return day !== 5;
  return day !== 0;
};

const eventCoversDate = (event, dateObj) => {
  const start = parseLocalDate(event.startDate);
  const end = parseLocalDate(event.endDate || event.startDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const t = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
  return t >= start.getTime() && t <= end.getTime();
};

const calculateAcademicStats = (events, yearStr, settings) => {
  const startYear = getAcademicStartYear(yearStr);
  const sequence = [
    { m: 6, y: startYear, sem: 1 }, { m: 7, y: startYear, sem: 1 }, { m: 8, y: startYear, sem: 1 },
    { m: 9, y: startYear, sem: 1 }, { m: 10, y: startYear, sem: 1 }, { m: 11, y: startYear, sem: 1 },
    { m: 0, y: startYear + 1, sem: 2 }, { m: 1, y: startYear + 1, sem: 2 }, { m: 2, y: startYear + 1, sem: 2 },
    { m: 3, y: startYear + 1, sem: 2 }, { m: 4, y: startYear + 1, sem: 2 }, { m: 5, y: startYear + 1, sem: 2 }
  ];
  const monthly = sequence.map(({m, y, sem}) => {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let potentialDays = 0, holidayDays = 0, effectiveDays = 0, activityDays = 0, regularDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(y, m, day);
      if (!isWorkingDate(date, settings)) continue;
      potentialDays++;
      const dayEvents = events.filter(event => eventCoversDate(event, date));
      const isHoliday = dayEvents.some(event => HOLIDAY_CATEGORIES.has(event.category));
      const hasNonregularActivity = dayEvents.some(event => NONREGULAR_CATEGORIES.has(event.category));
      if (isHoliday) {
        holidayDays++;
        continue;
      }
      effectiveDays++;
      if (hasNonregularActivity) activityDays++;
      else regularDays++;
    }
    const daysPerWeek = settings.hariSekolah === '5' ? 5 : 6;
    return {
      month: NORMAL_MONTHS[m], monthIndex: m, year: y, semester: sem,
      grossWeeks: Math.ceil(daysInMonth / 7), potentialDays, holidayDays,
      effectiveDays, activityDays, regularDays,
      effectiveWeeks: Math.round(effectiveDays / daysPerWeek)
    };
  });
  const total = monthly.reduce((acc, row) => {
    for (const key of ['grossWeeks','potentialDays','holidayDays','effectiveDays','activityDays','regularDays','effectiveWeeks']) acc[key] += row[key];
    return acc;
  }, {grossWeeks:0,potentialDays:0,holidayDays:0,effectiveDays:0,activityDays:0,regularDays:0,effectiveWeeks:0});
  return { monthly, total };
};

const shiftDateByYears = (dateString, delta) => {
  const date = parseLocalDate(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  date.setFullYear(date.getFullYear() + delta);
  return formatLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
};

const loadProjectStore = () => {
  try {
    const existing = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed.projects) && parsed.projects.length) {
        return {
          activeProjectId: parsed.activeProjectId || parsed.projects[0].id,
          projects: parsed.projects.map(project => ({...project, data: normalizeData(project.data)}))
        };
      }
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const data = legacy ? normalizeData(JSON.parse(legacy)) : cloneData(DEFAULT_DATA);
    const id = generateId();
    return { activeProjectId: id, projects: [{ id, name: makeProjectName(data), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), data }] };
  } catch (error) {
    console.error(error);
    const id = generateId();
    return { activeProjectId: id, projects: [{ id, name: 'Proyek Kalender — 2026/2027', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), data: cloneData(DEFAULT_DATA) }] };
  }
};

function useProjectManager() {
  const [store, setStore] = useState(loadProjectStore);
  const [saveState, setSaveState] = useState({ status: 'saved', savedAt: new Date() });
  const activeProject = store.projects.find(project => project.id === store.activeProjectId) || store.projects[0];
  const data = activeProject?.data || cloneData(DEFAULT_DATA);

  useEffect(() => {
    setSaveState(prev => ({ ...prev, status: 'saving' }));
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(store));
        setSaveState({ status: 'saved', savedAt: new Date() });
      } catch (error) {
        console.error(error);
        setSaveState(prev => ({ ...prev, status: 'error' }));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [store]);

  const setData = (updater) => setStore(prev => ({
    ...prev,
    projects: prev.projects.map(project => {
      if (project.id !== prev.activeProjectId) return project;
      const nextData = normalizeData(typeof updater === 'function' ? updater(project.data) : updater);
      return { ...project, data: nextData, updatedAt: new Date().toISOString() };
    })
  }));

  const createProject = (name, year = '2026/2027') => {
    const id = generateId();
    const newData = cloneData(DEFAULT_DATA);
    newData.identity.tahunPelajaran = year;
    const project = { id, name: name?.trim() || `Proyek Kalender — ${year}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), data: newData };
    setStore(prev => ({ activeProjectId: id, projects: [...prev.projects, project] }));
  };

  const renameProject = (id, name) => {
    if (!name?.trim()) return;
    setStore(prev => ({ ...prev, projects: prev.projects.map(project => project.id === id ? {...project, name: name.trim(), updatedAt: new Date().toISOString()} : project) }));
  };

  const openProject = (id) => setStore(prev => ({ ...prev, activeProjectId: id }));

  const deleteProject = (id) => {
    setStore(prev => {
      if (prev.projects.length <= 1) return prev;
      const projects = prev.projects.filter(project => project.id !== id);
      return { projects, activeProjectId: prev.activeProjectId === id ? projects[0].id : prev.activeProjectId };
    });
  };

  const duplicateProject = (id, mode, newName, newYear) => {
    const source = store.projects.find(project => project.id === id);
    if (!source) return;
    const sourceYear = getAcademicStartYear(source.data.identity.tahunPelajaran);
    const targetYear = getAcademicStartYear(newYear);
    const delta = targetYear - sourceYear;
    const duplicatedData = normalizeData(cloneData(source.data));
    duplicatedData.identity.tahunPelajaran = newYear;
    if (mode === 'structure') duplicatedData.events = [];
    else duplicatedData.events = duplicatedData.events.map(event => ({...event, id: generateId(), startDate: shiftDateByYears(event.startDate, delta), endDate: shiftDateByYears(event.endDate || event.startDate, delta)}));
    const newId = generateId();
    const project = { id: newId, name: newName?.trim() || `${source.name} — Salinan`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), data: duplicatedData };
    setStore(prev => ({ activeProjectId: newId, projects: [...prev.projects, project] }));
  };

  const importProject = (projectData, name) => {
    const id = generateId();
    const normalized = normalizeData(projectData);
    const project = { id, name: name?.trim() || makeProjectName(normalized), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), data: normalized };
    setStore(prev => ({ activeProjectId: id, projects: [...prev.projects, project] }));
  };

  const resetAllProjects = () => {
    localStorage.removeItem(PROJECTS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    window.location.reload();
  };

  return { store, activeProject, data, setData, saveState, createProject, renameProject, openProject, deleteProject, duplicateProject, importProject, resetAllProjects };
}

// --- UTILS ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const formatLocalDate = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const isValidAcademicYear = (yearStr = '') => {
  const match = String(yearStr).trim().match(/^(\d{4})\/(\d{4})$/);
  if (!match) return false;
  return Number(match[2]) === Number(match[1]) + 1;
};

const getAcademicStartYear = (yearStr = '') => {
  if (isValidAcademicYear(yearStr)) return Number(String(yearStr).split('/')[0]);
  const parsed = parseInt(String(yearStr).split('/')[0], 10);
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
};

const getAcademicYearError = (yearStr = '') => {
  if (isValidAcademicYear(yearStr)) return '';
  return 'Format Tahun Pelajaran harus seperti 2026/2027, dan tahun kedua harus tepat 1 tahun setelah tahun pertama.';
};

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

// --- MAIN APP COMPONENT ---
export default function App() {
  const projectManager = useProjectManager();
  const { data, setData, activeProject, saveState } = projectManager;
  const [ui, setUi] = useState({ view: 'dashboard', sidebarOpen: false, isDark: false });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', ui.isDark);
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
      case 'backup': return <BackupView projectManager={projectManager} showToast={showToast} />;
      case 'about': return <AboutView />;
      default: return <IdentitasView data={data} updateData={updateData} showToast={showToast} onNext={() => setUi({...ui, view: 'kegiatan'})} />;
    }
  };

  const getStepLevel = () => {
    if (ui.view === 'dashboard') return 1;
    if (ui.view === 'kegiatan') return 2;
    if (['kalender', 'timeline', 'efektif'].includes(ui.view)) return 3;
    if (ui.view === 'export') return 4;
    return 0;
  };
  const stepLevel = getStepLevel();

  return (
    <div className={`flex h-screen w-full bg-slate-50 text-slate-800 font-sans transition-colors duration-300 dark:bg-slate-900 dark:text-slate-100 ${ui.isDark ? 'dark' : ''}`}>
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 shadow-xl transform ${ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col print:hidden`}>
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <CalendarDays size={28} className="stroke-[2.5]" />
            <span className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">Kalista
              <span className="text-slate-500 dark:text-slate-400 text-xs font-normal block tracking-normal -mt-1">Kaldik Asistant</span>
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
          <NavItem icon={<Download size={18}/>} label="Ekspor" active={ui.view === 'export'} onClick={() => setUi({...ui, view: 'export', sidebarOpen: false})} />
          <NavItem icon={<FileJson size={18}/>} label="Backup & Restore" active={ui.view === 'backup'} onClick={() => setUi({...ui, view: 'backup', sidebarOpen: false})} />
          <div className="pt-2"></div>
          <NavItem icon={<Info size={18}/>} label="Tentang Aplikasi" active={ui.view === 'about'} onClick={() => setUi({...ui, view: 'about', sidebarOpen: false})} />
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-800 shadow-sm z-30 print:hidden border-b dark:border-slate-700">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => setUi({...ui, sidebarOpen: true})} className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-md dark:hover:bg-slate-700"><Menu size={24} /></button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 hidden sm:block">{ui.view === 'dashboard' ? 'Identitas Sekolah' : ui.view === 'export' ? 'Ekspor' : ui.view.charAt(0).toUpperCase() + ui.view.slice(1)}</h1>
              <p className="text-xs text-slate-400 truncate max-w-[45vw] hidden sm:block">{activeProject?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${saveState.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
              <Check size={14}/>{saveState.status === 'saving' ? 'Menyimpan…' : saveState.status === 'error' ? 'Penyimpanan penuh' : `Tersimpan otomatis ${saveState.savedAt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`}
            </div>
            <button onClick={() => setUi({...ui, isDark: !ui.isDark})} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full dark:hover:bg-slate-700 transition-colors bg-slate-100 dark:bg-slate-700">{ui.isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-600" />}</button>
          </div>
        </header>

        {stepLevel > 0 && (
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 print:hidden z-20 overflow-x-auto shadow-sm">
            <div className="flex items-center justify-between max-w-4xl mx-auto min-w-[500px]">
              {[{num:1,label:'Isi Data',view:'dashboard'},{num:2,label:'Kegiatan',view:'kegiatan'},{num:3,label:'Kalender',view:'kalender'},{num:4,label:'Ekspor',view:'export'}].map((step, idx) => (
                <div key={idx} className="flex items-center">
                  <button onClick={() => setUi({...ui, view: step.view})} className={`flex items-center gap-2 transition-all ${stepLevel >= step.num ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'} hover:opacity-80`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${stepLevel >= step.num ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/50 dark:border-blue-400' : 'border-slate-300 dark:border-slate-600 bg-transparent'}`}>{stepLevel > step.num ? <Check size={14} className="stroke-[3]"/> : step.num}</div>
                    <span className="text-sm font-bold tracking-wide">{step.label}</span>
                  </button>
                  {idx < 3 && <ChevronRight size={18} className="mx-4 text-slate-300 dark:text-slate-700" />}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative"><div className="max-w-7xl mx-auto print:max-w-none print:m-0 print:p-0">{renderView()}</div></div>
      </main>

      {toast && <div className="fixed bottom-4 right-4 z-[9999] animate-fade-in-up"><div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}<span className="font-medium">{toast.msg}</span></div></div>}
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes spin-slow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.animate-fade-in-up{animation:fadeInUp .3s ease-out forwards}.animate-fade-in{animation:fadeInUp .2s ease-out forwards}.animate-spin-slow{animation:spin-slow 3s linear infinite}`}</style>
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
      <div className="mt-3 text-[11px] sm:text-xs text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-2">
        <span className="block truncate">
          <strong className="text-slate-700 dark:text-slate-300">Tanggal dipilih:</strong>{' '}
          <span className="text-slate-800 dark:text-slate-200 font-semibold">
            {startDate ? formatDate(startDate) : '-'}{startDate !== endDate && endDate ? ` — ${formatDate(endDate)}` : ''}
          </span>
        </span>
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

  const tahunPelajaranError = getAcademicYearError(data.identity.tahunPelajaran);

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
          <div className="flex flex-col gap-1.5">
            <Input label="Tahun Pelajaran" value={data.identity.tahunPelajaran} placeholder="Contoh: 2026/2027" onChange={(e) => handleChange('identity', 'tahunPelajaran', e.target.value)} />
            {tahunPelajaranError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-start gap-1.5">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {tahunPelajaranError}
              </p>
            )}
          </div>
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
         <Button size="lg" className="w-full sm:w-auto px-10 shadow-lg group" onClick={() => {
           if (tahunPelajaranError) return showToast(tahunPelajaranError, 'error');
           showToast('Disimpan!', 'success');
           if(onNext) onNext();
         }}>
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
  const [syncModal, setSyncModal] = useState({ isOpen: false, isLoading: false });
  const [syncReviewModal, setSyncReviewModal] = useState({ isOpen: false, items: [], skippedCount: 0 });
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });
  const excelInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState({ isOpen: false, valid: [], errors: [] });
  
  const [syncTextIdx, setSyncTextIdx] = useState(0);
  const syncTexts = [
    "Jalan-Jalan ke Kota Blitar\nJangan lupa memborong diskon\nMohon tunggu sabar sebentar\nReferensi libur sedang disiapkan!",
    "Menghubungi server Google Calendar...",
    "Mengekstrak data hari libur resmi...",
    "Membuka database kalender lokal...",
    "Menyesuaikan tanggal dan zona waktu...",
    "Memeriksa jadwal kalender global...",
    "Menyiapkan daftar review libur...",
    "Pergi memancing di waktu fajar,\nDapat ikan besarnya sehasta.\nAplikasi sedang bekerja pintar,\nReferensi libur siap diperiksa bersama!"
  ];

  useEffect(() => {
    let interval;
    if (syncModal.isLoading) {
      interval = setInterval(() => setSyncTextIdx(prev => (prev + 1) % syncTexts.length), 6000);
    } else {
      setSyncTextIdx(0);
    }
    return () => clearInterval(interval);
  }, [syncModal.isLoading]);

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


  const excelDateToLocal = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return formatLocalDate(value.getFullYear(), value.getMonth(), value.getDate());
    const raw = value && typeof value === 'object' && 'result' in value ? value.result : value;
    const text = String(raw ?? '').trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? '' : formatLocalDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  };

  const handleDownloadExcelTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Kalista';
      const sheet = workbook.addWorksheet('Kegiatan Kalender');
      sheet.columns = [
        { header: 'Nama Kegiatan', key: 'name', width: 38 },
        { header: 'Tanggal Mulai', key: 'startDate', width: 18 },
        { header: 'Tanggal Selesai', key: 'endDate', width: 18 },
        { header: 'Jenis Kegiatan', key: 'category', width: 20 },
        { header: 'Catatan', key: 'notes', width: 42 }
      ];
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.addRow({ name: 'Contoh: Asesmen Sumatif', startDate: new Date(getAcademicStartYear(data.identity.tahunPelajaran), 8, 14), endDate: new Date(getAcademicStartYear(data.identity.tahunPelajaran), 8, 18), category: 'Asesmen', notes: 'Baris contoh dapat dihapus.' });
      for (let row = 2; row <= 500; row++) {
        sheet.getCell(`B${row}`).numFmt = 'dd/mm/yyyy';
        sheet.getCell(`C${row}`).numFmt = 'dd/mm/yyyy';
        sheet.getCell(`D${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`"${ALLOWED_CATEGORIES.join(',')}"`], showErrorMessage: true, errorTitle: 'Jenis tidak valid', error: 'Pilih jenis kegiatan dari daftar dropdown.' };
      }
      const guide = workbook.addWorksheet('Petunjuk');
      guide.addRows([
        ['PETUNJUK IMPOR KALISTA'],
        ['1. Isi kegiatan pada sheet Kegiatan Kalender.'],
        ['2. Gunakan dropdown pada kolom Jenis Kegiatan.'],
        ['3. Tanggal Selesai boleh kosong; otomatis sama dengan Tanggal Mulai.'],
        ['4. Setiap kegiatan yang masuk kalender dianggap menggunakan satu hari penuh.'],
        ['5. Libur mengurangi Hari Efektif Sekolah; kegiatan nonlibur mengurangi Hari Pembelajaran Reguler.']
      ]);
      guide.getColumn(1).width = 90;
      guide.getCell('A1').font = { bold: true, size: 16 };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Format_Impor_Kalista_${data.identity.tahunPelajaran.replace('/','-')}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast('Format Excel berhasil diunduh.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Gagal membuat format Excel.', 'error');
    }
  };

  const handleExcelImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet('Kegiatan Kalender') || workbook.worksheets[0];
      if (!sheet) throw new Error('Sheet tidak ditemukan.');
      const valid = [], errors = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const name = String(row.getCell(1).value ?? '').trim();
        const startDate = excelDateToLocal(row.getCell(2).value);
        const endDate = excelDateToLocal(row.getCell(3).value) || startDate;
        const category = String(row.getCell(4).value ?? '').trim();
        const notes = String(row.getCell(5).value ?? '').trim();
        if (!name && !startDate && !category) return;
        const rowErrors = [];
        if (!name) rowErrors.push('Nama kegiatan kosong');
        if (!startDate) rowErrors.push('Tanggal mulai tidak valid');
        if (!ALLOWED_CATEGORIES.includes(category)) rowErrors.push('Jenis kegiatan tidak sesuai dropdown');
        if (startDate && endDate && parseLocalDate(endDate).getTime() < parseLocalDate(startDate).getTime()) rowErrors.push('Tanggal selesai lebih awal');
        if (rowErrors.length) errors.push({ rowNumber, name: name || '(tanpa nama)', messages: rowErrors });
        else valid.push({ id: generateId(), name, startDate, endDate, category, notes, customColor: '' });
      });
      setImportPreview({ isOpen: true, valid, errors });
    } catch (error) {
      console.error(error);
      showToast('File Excel tidak dapat dibaca.', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const confirmExcelImport = () => {
    const existingKeys = new Set(events.map(e => `${e.name.toLowerCase()}|${e.startDate}|${e.endDate || e.startDate}`));
    const unique = importPreview.valid.filter(e => !existingKeys.has(`${e.name.toLowerCase()}|${e.startDate}|${e.endDate}`));
    updateEvents([...events, ...unique].sort((a,b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime()));
    showToast(`${unique.length} kegiatan berhasil diimpor.`, 'success');
    setImportPreview({ isOpen: false, valid: [], errors: [] });
  };

  const removeSyncReviewItem = (id) => {
    setSyncReviewModal(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
  };

  const confirmAddReviewedHolidays = () => {
    if (syncReviewModal.items.length === 0) {
      showToast('Tidak ada libur yang dipilih untuk ditambahkan.', 'error');
      return;
    }
    updateEvents([...events, ...syncReviewModal.items].sort((a, b) => new Date(a.startDate) - new Date(b.startDate)));
    showToast(`✨ ${syncReviewModal.items.length} referensi libur berhasil ditambahkan setelah review!`, 'success');
    setSyncReviewModal({ isOpen: false, items: [], skippedCount: 0 });
  };

  const handleSyncHolidays = async () => {
    const tahunPelajaranError = getAcademicYearError(data.identity.tahunPelajaran);
    if (tahunPelajaranError) {
      showToast(tahunPelajaranError, 'error');
      return;
    }

    setSyncModal({ isOpen: true, isLoading: true });
    try {
      const startYear = getAcademicStartYear(data.identity.tahunPelajaran);
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

      const makeHolidayKey = (ev) => `${ev.startDate}|${(ev.name || '').toLowerCase().trim()}`;
      const existingHolidayKeys = new Set(
        events
          .filter(e => e.category === 'Nasional' || e.category === 'Cuti Bersama')
          .map(makeHolidayKey)
      );
      const uniqueNewEvents = newEvents.filter(e => !existingHolidayKeys.has(makeHolidayKey(e)));
      const skippedCount = newEvents.length - uniqueNewEvents.length;

      if (uniqueNewEvents.length === 0) {
         showToast('Referensi libur nasional sudah ada di daftar kegiatan.', 'success');
      } else {
        setSyncReviewModal({ isOpen: true, items: uniqueNewEvents, skippedCount });
        showToast(`✨ ${uniqueNewEvents.length} data ditemukan. Review dulu sebelum ditambahkan.`, 'success');
      }
    } catch (error) {
      showToast('Gagal mengambil referensi: ' + error.message, 'error');
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
        
        <div className="flex gap-3 w-full xl:w-auto flex-wrap items-center">
          <Button onClick={handleDownloadExcelTemplate} variant="secondary" className="flex-1 sm:flex-none border border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"><FileSpreadsheet size={18} className="mr-2"/> Unduh Format</Button>
          <input ref={excelInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleExcelImport}/>
          <Button onClick={() => excelInputRef.current?.click()} variant="secondary" className="flex-1 sm:flex-none border border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"><Upload size={18} className="mr-2"/> Impor Excel</Button>
          {/* Tombol Referensi Libur */}
          <Button onClick={() => setSyncModal({ isOpen: true, isLoading: false })} variant="secondary" className="flex-1 sm:flex-none border border-red-500 text-red-600 bg-red-50/50 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-all shadow-[0_0_10px_rgba(239,68,68,0.4)] hover:shadow-[0_0_15px_rgba(239,68,68,0.7)] font-bold">
            <CalendarDays size={18} className="mr-2 text-red-500 animate-pulse" /> Ambil Referensi Libur
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
         <Button size="lg" className="w-full sm:w-auto px-10 shadow-lg group" onClick={() => {
           const tahunPelajaranError = getAcademicYearError(data.identity.tahunPelajaran);
           if (tahunPelajaranError) return showToast(tahunPelajaranError, 'error');
           onNext && onNext();
         }}>
           <Save size={20} className="mr-2" /> Simpan & Cek Kalender <ChevronRightCircle size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
         </Button>
      </div>

      {isOpen && (
        <Modal
          title={editingId ? 'Edit Kegiatan' : 'Tambah Kegiatan'}
          onClose={() => setIsOpen(false)}
          size="xl"
          mobileMode="fullscreen"
          footer={
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setIsOpen(false)}>Batal</Button>
              <Button className="w-full sm:w-auto" onClick={handleSave}>Simpan Kegiatan</Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)] gap-4 lg:gap-6 items-start">
            <Input className="lg:col-start-1 lg:row-start-1" label="Nama Kegiatan" value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus />

            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-4">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Rentang Tanggal Kegiatan</label>
              <CustomDateRangePicker
                startDate={form.startDate}
                endDate={form.endDate}
                onChange={(start, end) => setForm({...form, startDate: start, endDate: end})}
                existingEvents={events}
              />
            </div>

            <Select className="lg:col-start-1 lg:row-start-2" label="Kategori Standar" value={form.category} onChange={e => setForm({...form, category: e.target.value})} options={Object.keys(CATEGORIES)} />

            <div className="lg:col-start-1 lg:row-start-3">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5"><Palette size={14}/> Warna Kustom (Opsional)</label>
              <div className="flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                {CUSTOM_COLORS.map(c => (
                  <button type="button" key={c} onClick={() => setForm({...form, customColor: c})}
                    style={{backgroundColor: c}}
                    className={`w-8 h-8 rounded-full shadow-sm hover:scale-110 transition-transform ${form.customColor === c ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-slate-100 dark:ring-offset-slate-800' : ''}`}
                    aria-label={`Pilih warna ${c}`}
                  />
                ))}
                <button type="button" onClick={() => setForm({...form, customColor: ''})} className="text-xs px-3 py-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">Gunakan Warna Bawaan</button>
              </div>
            </div>

            <Input className="lg:col-start-1 lg:row-start-4" label="Catatan Tambahan" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
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

      {/* MODAL REVIEW HASIL REFERENSI LIBUR */}
      {syncReviewModal.isOpen && (
        <Modal
          title="Review Libur Nasional"
          onClose={() => setSyncReviewModal({ isOpen: false, items: [], skippedCount: 0 })}
          size="lg"
          mobileMode="sheet"
          footer={
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setSyncReviewModal({ isOpen: false, items: [], skippedCount: 0 })}>Batal</Button>
              <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700" onClick={confirmAddReviewedHolidays}>Tambahkan yang Dipilih</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 p-4 rounded-xl text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
              <p className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={17}/> Periksa sebelum ditambahkan</p>
              <p>Data berikut adalah referensi awal. Untuk dokumen resmi sekolah, cocokkan kembali dengan SKB pemerintah dan kalender akademik daerah.</p>
              {syncReviewModal.skippedCount > 0 && <p className="text-xs mt-2 opacity-80">{syncReviewModal.skippedCount} data serupa sudah ada dan otomatis dilewati.</p>}
            </div>

            <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-200 dark:divide-slate-700">
              {syncReviewModal.items.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">Semua item sudah dihapus dari daftar review.</div>
              ) : (
                syncReviewModal.items.map(item => (
                  <div key={item.id} className="p-3 flex items-start justify-between gap-3 bg-white dark:bg-slate-800">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-tight">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatDate(item.startDate)} · {item.category} · {item.notes}</p>
                    </div>
                    <button onClick={() => removeSyncReviewItem(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md flex-shrink-0" title="Hapus dari daftar review">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))
              )}
            </div>

          </div>
        </Modal>
      )}


      {importPreview.isOpen && (
        <Modal title="Preview Impor Excel" size="xl" mobileMode="fullscreen" onClose={() => setImportPreview({ isOpen: false, valid: [], errors: [] })}
          footer={<><Button variant="secondary" className="w-full sm:w-auto" onClick={() => setImportPreview({ isOpen: false, valid: [], errors: [] })}>Batal</Button><Button className="w-full sm:w-auto" disabled={importPreview.valid.length === 0} onClick={confirmExcelImport}>Impor {importPreview.valid.length} Data Valid</Button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-green-800"><p className="text-xs uppercase font-bold">Data valid</p><p className="text-3xl font-black">{importPreview.valid.length}</p></div>
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800"><p className="text-xs uppercase font-bold">Perlu diperbaiki</p><p className="text-3xl font-black">{importPreview.errors.length}</p></div>
            </div>
            {importPreview.errors.length > 0 && <div className="rounded-xl border border-red-200 overflow-hidden"><div className="bg-red-50 px-4 py-3 font-bold text-red-800">Baris bermasalah tidak akan diimpor</div><div className="max-h-52 overflow-y-auto divide-y">{importPreview.errors.map(error => <div key={error.rowNumber} className="p-3 text-sm"><strong>Baris {error.rowNumber}: {error.name}</strong><p className="text-red-600">{error.messages.join(' • ')}</p></div>)}</div></div>}
            <div className="rounded-xl border border-slate-200 overflow-hidden"><div className="bg-slate-50 px-4 py-3 font-bold">Preview data valid</div><div className="max-h-72 overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-white"><tr><th className="p-3 text-left">Tanggal</th><th className="p-3 text-left">Kegiatan</th><th className="p-3 text-left">Jenis</th></tr></thead><tbody>{importPreview.valid.slice(0,100).map(item => <tr key={item.id} className="border-t"><td className="p-3 whitespace-nowrap">{formatDate(item.startDate)}</td><td className="p-3">{item.name}</td><td className="p-3">{item.category}</td></tr>)}</tbody></table></div></div>
          </div>
        </Modal>
      )}

      {/* MODAL ANIMASI TEXT CAROUSEL SINKRONISASI LIBUR */}
      {syncModal.isOpen && (
        <Modal
          title="📅 Ambil Referensi Libur"
          onClose={() => !syncModal.isLoading && setSyncModal({ isOpen: false, isLoading: false })}
          size="lg"
          mobileMode="sheet"
          footer={!syncModal.isLoading ? (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setSyncModal({ isOpen: false, isLoading: false })}>Batal</Button>
              <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700" onClick={handleSyncHolidays}>Ambil Referensi</Button>
            </div>
          ) : null}
        >
          <div className="space-y-4">
            {syncModal.isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-40 animate-pulse rounded-full w-16 h-16 -ml-2 -mt-2"></div>
                  <Globe size={48} className="text-emerald-600 dark:text-emerald-400 relative animate-spin-slow" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">Mengambil Referensi...</h4>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-3 whitespace-pre-line bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed max-w-sm mx-auto transition-opacity duration-300">
                    {syncTexts[syncTextIdx]}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-slate-800 dark:text-slate-300 text-sm">
                  <p className="font-bold flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-100"><Globe size={18} className="text-emerald-500"/> Referensi Libur Nasional</p>
                  <p className="leading-relaxed mb-2">Aplikasi akan mencoba mengambil referensi hari libur dari Google Calendar dan database lokal. Jika layanan online terhambat, Bapak/Ibu tetap dapat menambahkan atau mengedit libur secara manual.</p>
                  <p className="text-xs text-slate-500 px-2 py-1 bg-white dark:bg-slate-800 rounded">Rentang: <strong>Juli {getAcademicStartYear(data.identity.tahunPelajaran)}</strong> s.d <strong>Juni {getAcademicStartYear(data.identity.tahunPelajaran) + 1}</strong>.</p>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function KalenderView({ events, yearStr, settings, onExport, isPrint = false, monthsPerPage = 12, data, showToast, legalMode = 'official' }) {
  const startYear = getAcademicStartYear(yearStr);
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
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
            <div key={d} className={`flex items-center justify-center text-center leading-none ${isPrint ? 'h-[12px]' : 'h-5'}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {blanks.map(b => (
            <div key={`blank-${b}`} className={`border border-slate-100 dark:border-slate-700/50 rounded p-0 ${isPrint ? 'h-[22px]' : 'h-9'}`}></div>
          ))}
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
                 bgClass = getCategoryCalendarClass(priorityEvent.category);
               }
            }

            return (
              <div
                key={d}
                className={`pdf-calendar-day border border-slate-200 dark:border-slate-700 rounded transition-colors relative group cursor-default p-0 overflow-visible ${bgClass} ${isPrint ? 'text-[10px]' : 'text-sm'}`}
                style={{ ...inlineStyle, boxSizing: 'border-box', height: isPrint ? '22px' : '36px', display: 'table', width: '100%' }}
              >
                <span
                  className="pdf-calendar-day-number tabular-nums"
                  style={{ display: 'table-cell', width: '100%', height: '100%', verticalAlign: 'middle', textAlign: 'center', margin: 0, padding: 0, lineHeight: 'normal' }}
                >
                  {d}
                </span>
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
               bgClass = getCategorySolidClass(ev.category);
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


  if (isPrint) {
    const calendar = generateAcademicYear();
    return (
      <>
        {monthsPerPage === 12 ? (
          <>
            <PrintPage isLandscape={true} customPadding="10px 40px 40px 40px">
               <PrintHeader data={data} mode={legalMode} />
               <h2 className="text-center font-bold text-base mb-1 text-black uppercase">Kalender Pendidikan Tahun Ajaran {yearStr}</h2>
               <div className="grid grid-cols-4 gap-x-4 gap-y-1 flex-1">
                  {calendar}
               </div>
            </PrintPage>
            <PrintPage isLandscape={true} customPadding="10px 40px 40px 40px">
               <div className="text-center mb-6 mt-2">
                 <h2 className="font-bold text-lg text-black uppercase border-b-2 border-black pb-2 inline-block mx-auto">{legalMode === 'official' ? 'Keterangan & Pengesahan' : 'Keterangan Kalender'}</h2>
               </div>
               <div className="flex-1">
                 {renderLegend()}
               </div>
               <PrintSigner data={data} mode={legalMode} />
            </PrintPage>
          </>
        ) : (
          <>
            <PrintPage isLandscape={false}>
               <PrintHeader data={data} mode={legalMode} />
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
               <PrintSigner data={data} mode={legalMode} />
            </PrintPage>
          </>
        )}
      </>
    );
  }

  return (
    <div className={`space-y-6 relative animate-fade-in-up`}>
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Kalender Pendidikan</h2>
        <p className="text-slate-500">Tahun Pelajaran {yearStr}</p>
      </div>
      
      <div id="kalender-capture-area" className="bg-slate-50 dark:bg-slate-900 sm:p-4 rounded-xl">
        <div className="grid gap-4 xl:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
           {generateAcademicYear()}
        </div>
        {renderLegend()}
      </div>
      
      {onExport && !isPrint && (
        <div className="flex justify-end pt-4 pb-6">
          <Button onClick={onExport} size="lg" className="w-full sm:w-auto shadow-lg"><Download size={20} className="mr-2" /> Lanjut ke Ekspor</Button>
        </div>
      )}
    </div>
  );
}

function TimelineView({ events, yearStr, onExport, isPrint = false, data, legalMode = 'official' }) {
  const startYear = getAcademicStartYear(yearStr);
  const startDate = new Date(startYear, 6, 1); 
  const endDate = new Date(startYear + 1, 5, 30); 
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

  const getPosition = (dateStr) => {
    const d = new Date(dateStr);
    if (d < startDate) return 0;
    if (d > endDate) return 100;
    return ((d - startDate) / (1000 * 60 * 60 * 24) / totalDays) * 100;
  };

  const validEvents = events.filter(e => {
    const eventStart = new Date(e.startDate);
    const eventEnd = new Date(e.endDate || e.startDate);
    return eventStart <= endDate && eventEnd >= startDate;
  }).sort((a,b) => new Date(a.startDate) - new Date(b.startDate));

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
                bgClass = getCategorySolidClass(ev.category);
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
            {idx === 0 && <PrintHeader data={data} mode={legalMode} />}
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
        <div className="flex justify-end pt-4 pb-6">
          <Button onClick={onExport} size="lg" className="w-full sm:w-auto shadow-lg"><Download size={20} className="mr-2" /> Lanjut ke Ekspor</Button>
        </div>
      )}
    </div>
  );
}

function EfektifView({ events, yearStr, settings, onExport, isPrint = false, data, legalMode = 'official' }) {
  const { monthly: stats, total } = useMemo(() => calculateAcademicStats(events, yearStr, settings), [events, yearStr, settings]);
  const semesterTotal = (semester) => stats.filter(row => row.semester === semester).reduce((acc,row) => ({potentialDays:acc.potentialDays+row.potentialDays,holidayDays:acc.holidayDays+row.holidayDays,effectiveDays:acc.effectiveDays+row.effectiveDays,activityDays:acc.activityDays+row.activityDays,regularDays:acc.regularDays+row.regularDays,effectiveWeeks:acc.effectiveWeeks+row.effectiveWeeks}), {potentialDays:0,holidayDays:0,effectiveDays:0,activityDays:0,regularDays:0,effectiveWeeks:0});

  const renderSemester = (semester, title, tone) => {
    const rows = stats.filter(row => row.semester === semester);
    const sum = semesterTotal(semester);
    return <div className={`rounded-2xl overflow-hidden break-inside-avoid ${isPrint ? 'border border-slate-300 bg-white' : 'bg-white shadow-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
      <div className={`p-4 ${isPrint ? tone === 'blue' ? 'bg-blue-100' : 'bg-green-100' : tone === 'blue' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
        <h3 className={`font-bold text-lg ${isPrint ? tone === 'blue' ? 'text-blue-900' : 'text-green-900' : ''}`}>{title}</h3>
        <p className={`text-xs ${isPrint ? 'text-slate-700' : 'text-white/85'}`}>Efektif {sum.effectiveDays} hari • Pembelajaran reguler {sum.regularDays} hari</p>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-xs text-left">
        <thead className={isPrint ? 'bg-slate-50 text-black' : 'bg-slate-50 dark:bg-slate-700/50'}><tr><th className="px-3 py-2">Bulan</th><th className="px-2 py-2 text-center" title="Hari kerja potensial">Pot.</th><th className="px-2 py-2 text-center">Libur</th><th className="px-2 py-2 text-center">Efektif</th><th className="px-2 py-2 text-center" title="Hari kegiatan nonreguler">Keg.</th><th className="px-2 py-2 text-center">Reguler</th></tr></thead>
        <tbody className={isPrint ? 'text-black' : 'text-slate-700 dark:text-slate-300'}>{rows.map(row => <tr key={`${row.month}-${row.year}`} className="border-t dark:border-slate-700"><td className="px-3 py-2 font-medium">{row.month} {row.year}</td><td className="px-2 py-2 text-center">{row.potentialDays}</td><td className="px-2 py-2 text-center text-red-500">{row.holidayDays}</td><td className="px-2 py-2 text-center font-bold text-blue-600">{row.effectiveDays}</td><td className="px-2 py-2 text-center text-amber-600">{row.activityDays}</td><td className="px-2 py-2 text-center font-black text-green-600">{row.regularDays}</td></tr>)}</tbody>
      </table></div>
    </div>;
  };

  const summary = <div className={`grid grid-cols-2 md:grid-cols-5 gap-3 ${isPrint ? 'mb-5' : ''}`}>
    {[['Hari Kerja Potensial',total.potentialDays,'slate'],['Hari Libur',total.holidayDays,'red'],['Hari Efektif Sekolah',total.effectiveDays,'blue'],['Hari Kegiatan',total.activityDays,'amber'],['Hari Pembelajaran Reguler',total.regularDays,'green']].map(([label,value,tone]) => <div key={label} className="rounded-xl border p-3 text-center bg-slate-50 border-slate-200"><p className="text-[10px] uppercase font-bold text-slate-500 leading-tight">{label}</p><p className="text-2xl font-black text-slate-800">{value}</p></div>)}
  </div>;

  const content = <><div className="mb-5">{summary}</div><div className={`grid gap-5 ${isPrint ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>{renderSemester(1,'Semester Ganjil','blue')}{renderSemester(2,'Semester Genap','green')}</div></>;

  if (isPrint) return <PrintPage isLandscape={false}><PrintHeader data={data} mode={legalMode}/><h2 className="text-center font-bold text-lg mb-5 text-black uppercase border-b-2 border-black pb-2 inline-block mx-auto">Rincian Hari Efektif TA {yearStr}</h2><div className="flex-1">{content}</div><PrintSigner data={data} mode={legalMode}/></PrintPage>;

  return <div className="space-y-6 relative animate-fade-in-up"><div><h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Hari Efektif & Pembelajaran Reguler</h2><p className="text-slate-500">Kalkulasi otomatis berdasarkan pola {settings.hariSekolah} hari sekolah.</p></div>{content}<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 text-sm text-amber-800 dark:text-amber-200 leading-relaxed"><p className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={17}/> Cara membaca hasil</p><p><strong>Hari Efektif Sekolah</strong> adalah hari kerja dikurangi seluruh libur. <strong>Hari Pembelajaran Reguler</strong> adalah hari efektif sekolah dikurangi tanggal yang berisi kegiatan Akademik, Asesmen, Kesiswaan, atau Lainnya. Jika beberapa kegiatan berlangsung pada tanggal yang sama, tanggal hanya dihitung satu kali.</p></div>{onExport && <div className="flex justify-end pt-4 pb-6"><Button onClick={onExport} size="lg" className="w-full sm:w-auto shadow-lg"><Download size={20} className="mr-2"/> Lanjut ke Ekspor</Button></div>}</div>;
}

// --- ENGINE PDF & PNG EKSPOR (100% FIX ABSOLUT) ---
function ExportView({ data, showToast }) {
  const [docType, setDocType] = useState('kalender');
  const [monthsPerPage, setMonthsPerPage] = useState(12);
  const [format, setFormat] = useState('pdf');
  const [legalMode, setLegalMode] = useState('official');
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [validationDismissed, setValidationDismissed] = useState(false);
  const stats = useMemo(() => calculateAcademicStats(data.events, data.identity.tahunPelajaran, data.settings), [data.events, data.identity.tahunPelajaran, data.settings]);

  useEffect(() => setValidationDismissed(false), [docType, legalMode, data.identity, data.signer, data.assets]);

  const validationMessages = useMemo(() => {
    const messages = [];
    const yearError = getAcademicYearError(data.identity.tahunPelajaran);
    if (yearError) messages.push(yearError);
    if (!data.events.length) messages.push('Belum ada kegiatan pada kalender.');
    if (legalMode !== 'plain' && !data.identity.namaSekolah?.trim()) messages.push('Nama sekolah belum diisi.');
    if (legalMode === 'official') {
      if (!data.signer.nama?.trim()) messages.push('Nama penandatangan belum diisi.');
      if (!data.assets.logoKiri && !data.assets.logoKanan) messages.push('Logo belum diunggah; dokumen tetap dapat diekspor.');
      if (!data.assets.ttd) messages.push('Tanda tangan belum diunggah; dokumen tetap dapat diekspor.');
    }
    return messages;
  }, [data, legalMode]);

  const renderDocument = () => <>
    {docType === 'kalender' && <KalenderView events={data.events} yearStr={data.identity.tahunPelajaran} settings={data.settings} monthsPerPage={monthsPerPage} isPrint data={data} legalMode={legalMode}/>} 
    {docType === 'efektif' && <EfektifView events={data.events} yearStr={data.identity.tahunPelajaran} settings={data.settings} isPrint data={data} legalMode={legalMode}/>} 
    {docType === 'timeline' && <TimelineView events={data.events} yearStr={data.identity.tahunPelajaran} isPrint data={data} legalMode={legalMode}/>} 
  </>;

  const waitForAssets = async (element) => {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all(Array.from(element.querySelectorAll('img')).map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })));
  };

  const exportPages = async () => {
    if (getAcademicYearError(data.identity.tahunPelajaran)) return showToast(getAcademicYearError(data.identity.tahunPelajaran), 'error');
    const container = document.getElementById('export-render-container');
    if (!container || isExporting) return;
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await waitForAssets(container);
      const pages = Array.from(container.querySelectorAll('.pdf-print-page'));
      if (!pages.length) throw new Error('Halaman ekspor tidak ditemukan.');
      const modeName = legalMode === 'official' ? 'Resmi' : legalMode === 'compact' ? 'Ringkas' : 'Polosan';
      const baseName = `Kalista_${docType}_${modeName}_${data.identity.tahunPelajaran.replace('/','-')}`;
      if (format === 'pdf') {
        const firstLandscape = (docType === 'kalender' && monthsPerPage === 12) || docType === 'timeline';
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: firstLandscape ? 'landscape' : 'portrait', compress: true });
        for (let index = 0; index < pages.length; index++) {
          const page = pages[index];
          const landscape = page.offsetWidth > page.offsetHeight;
          if (index > 0) pdf.addPage('a4', landscape ? 'landscape' : 'portrait');
          const canvas = await html2canvas(page, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 });
          const width = landscape ? 297 : 210, height = landscape ? 210 : 297;
          pdf.addImage(canvas.toDataURL('image/jpeg', .96), 'JPEG', 0, 0, width, height);
          canvas.width = 0; canvas.height = 0;
          await new Promise(resolve => setTimeout(resolve, 180));
        }
        pdf.save(`${baseName}.pdf`);
      } else {
        const scale = format === 'png-high' ? 3 : 1.75;
        for (let index = 0; index < pages.length; index++) {
          const canvas = await html2canvas(pages[index], { scale, useCORS: true, logging: false, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 });
          const link = document.createElement('a');
          link.download = `${baseName}_Halaman-${index+1}.png`;
          link.href = canvas.toDataURL('image/png', 1);
          link.click();
          canvas.width = 0; canvas.height = 0;
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      }
      showToast(format === 'pdf' ? 'PDF berhasil diunduh.' : 'PNG berhasil diunduh.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Ekspor gagal. Coba gunakan kualitas standar atau tutup aplikasi lain.', 'error');
    } finally { setIsExporting(false); }
  };

  const categories = ALLOWED_CATEGORIES.map(category => ({category, count: data.events.filter(event => event.category === category).length})).filter(item => item.count > 0);

  return <div className="space-y-6 max-w-6xl mx-auto animate-fade-in-up pb-10">
    <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-4 mb-6"><div className="p-3 rounded-2xl bg-blue-100 text-blue-600"><Download size={32}/></div><div><h2 className="text-2xl font-black">Ekspor Dokumen</h2><p className="text-slate-500">Pilih format, tampilan legalitas, dan periksa preview sebelum mengunduh.</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border dark:border-slate-700">
        <Select label="Dokumen" value={docType} onChange={e=>setDocType(e.target.value)} options={[{label:'Kalender Pendidikan',value:'kalender'},{label:'Hari Efektif',value:'efektif'},{label:'Timeline Visual',value:'timeline'}]}/>
        <Select label="Format" value={format} onChange={e=>setFormat(e.target.value)} options={[{label:'PDF',value:'pdf'},{label:'PNG Standar',value:'png-standard'},{label:'PNG Resolusi Tinggi',value:'png-high'}]}/>
        <Select label="Tampilan" value={legalMode} onChange={e=>setLegalMode(e.target.value)} options={[{label:'Resmi — kop & legalitas',value:'official'},{label:'Ringkas — nama sekolah',value:'compact'},{label:'Polosan — konten visual',value:'plain'}]}/>
        {docType === 'kalender' ? <Select label="Layout Kalender" value={monthsPerPage} onChange={e=>setMonthsPerPage(Number(e.target.value))} options={[{label:'Landscape 12 bulan',value:12},{label:'Portrait 8 + 4 bulan',value:8}]}/> : <div className="rounded-xl border bg-white dark:bg-slate-800 p-3"><p className="text-xs font-bold text-slate-500">Layout otomatis</p><p className="font-semibold mt-2">{docType === 'timeline' ? 'A4 Landscape' : 'A4 Portrait'}</p></div>}
      </div>
    </div>

    {!validationDismissed && validationMessages.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3"><AlertTriangle className="text-amber-600 flex-shrink-0"/><div className="flex-1"><p className="font-bold text-amber-900">Pemeriksaan sebelum ekspor</p><ul className="text-sm text-amber-800 mt-1 list-disc list-inside">{validationMessages.map(message=><li key={message}>{message}</li>)}</ul><p className="text-xs text-amber-700 mt-2">Pesan ini tidak memblokir ekspor.</p></div><button onClick={()=>setValidationDismissed(true)} className="p-1 rounded hover:bg-amber-100"><X size={18}/></button></div>}

    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[['Hari Kerja',stats.total.potentialDays],['Hari Libur',stats.total.holidayDays],['Hari Efektif',stats.total.effectiveDays],['Hari Kegiatan',stats.total.activityDays],['Pembelajaran Reguler',stats.total.regularDays]].map(([label,value])=><div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-4 text-center"><p className="text-xs text-slate-500 font-bold uppercase">{label}</p><p className="text-3xl font-black mt-1">{value}</p></div>)}</div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 p-5"><div className="flex justify-between items-center mb-4"><h3 className="font-black text-lg flex items-center gap-2"><Eye size={20}/> Preview Ekspor</h3><Button variant="secondary" size="sm" onClick={()=>setShowPreview(!showPreview)}>{showPreview?'Sembunyikan':'Tampilkan'}</Button></div>{showPreview && <div className="h-[560px] overflow-auto rounded-xl bg-slate-200 dark:bg-slate-950 p-4"><div style={{transform:'scale(.46)',transformOrigin:'top left',width:'218%'}} className="flex flex-col gap-4">{renderDocument()}</div></div>}</div>
      <div className="space-y-4"><div className="bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 p-5"><h3 className="font-black mb-3">Ringkasan Final</h3><div className="space-y-2 text-sm"><p className="flex justify-between"><span>Jumlah kegiatan</span><strong>{data.events.length}</strong></p>{categories.map(item=><p key={item.category} className="flex justify-between text-slate-600 dark:text-slate-300"><span>{item.category}</span><strong>{item.count}</strong></p>)}</div></div><Button onClick={exportPages} disabled={isExporting} size="lg" className="w-full shadow-xl">{isExporting?<><Zap size={20} className="mr-2 animate-spin"/> Memproses…</>:format==='pdf'?<><Download size={20} className="mr-2"/> Unduh PDF</>:<><ImageDown size={20} className="mr-2"/> Unduh PNG</>}</Button></div>
    </div>

    {isExporting && <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center"><Zap size={64} className="text-blue-600 animate-pulse mb-4"/><h2 className="text-2xl font-black">Menyiapkan Ekspor…</h2><p className="text-slate-500 mt-2">Jangan tutup halaman sampai proses selesai.</p></div>}
    <div aria-hidden="true" style={{position:'fixed',left:0,top:0,zIndex:isExporting?9990:-1000,visibility:isExporting?'visible':'hidden',pointerEvents:'none'}}><div id="export-render-container" className="flex flex-col gap-4">{renderDocument()}</div></div>
  </div>;
}

function BackupView({ projectManager, showToast }) {
  const { store, activeProject, data, createProject, renameProject, openProject, deleteProject, duplicateProject, importProject, resetAllProjects, saveState } = projectManager;
  const fileInputRef = useRef(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState(null);
  const [duplicateForm, setDuplicateForm] = useState({ name:'', year:'', mode:'structure' });
  const [newProject, setNewProject] = useState({ name:'', year:'2026/2027' });

  const downloadBackup = (project = activeProject) => {
    const payload = { appName:'Kalista', appVersion:APP_VERSION, exportedAt:new Date().toISOString(), projectName:project.name, ...project.data };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const link = document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`kalista-${project.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(link.href);
    showToast('Backup proyek berhasil diunduh.','success');
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0]; if(!file) return;
    const reader = new FileReader(); reader.onload = e => { try { const imported=JSON.parse(e.target.result); if(!imported.identity || !Array.isArray(imported.events)) throw new Error(); importProject(imported, imported.projectName || file.name.replace(/\.json$/i,'')); showToast('Proyek berhasil direstore dan dibuka.','success'); } catch { showToast('Format backup tidak valid.','error'); } }; reader.readAsText(file); event.target.value='';
  };

  const storageBytes = new Blob([localStorage.getItem(PROJECTS_STORAGE_KEY) || '']).size;
  const storageMb = storageBytes / 1024 / 1024;

  return <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-10">
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl p-6 sm:p-8 shadow-xl"><div className="flex flex-col sm:flex-row justify-between gap-4"><div><p className="text-blue-200 text-xs uppercase font-bold">Proyek aktif</p><h2 className="text-2xl font-black mt-1">{activeProject.name}</h2><p className="text-blue-100 text-sm mt-2">{saveState.status==='saving'?'Menyimpan perubahan…':`Tersimpan otomatis • ${saveState.savedAt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={()=>downloadBackup()}><Download size={17} className="mr-2"/> Backup</Button><input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport}/><Button variant="secondary" onClick={()=>fileInputRef.current?.click()}><Upload size={17} className="mr-2"/> Restore</Button></div></div></div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 overflow-hidden"><div className="p-5 border-b dark:border-slate-700"><h3 className="font-black text-lg flex items-center gap-2"><FolderOpen size={20}/> Proyek Tersimpan</h3><p className="text-sm text-slate-500">Kalista otomatis membuka kembali proyek terakhir saat browser dijalankan.</p></div><div className="divide-y dark:divide-slate-700">{store.projects.map(project=><div key={project.id} className={`p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${project.id===activeProject.id?'bg-blue-50 dark:bg-blue-900/20':''}`}><div className="flex-1 min-w-0"><p className="font-bold truncate">{project.name}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={project.id===activeProject.id?'secondary':'primary'} onClick={()=>openProject(project.id)}>{project.id===activeProject.id?'Aktif':'Buka'}</Button><button title="Ganti nama" onClick={()=>{const name=window.prompt('Nama proyek baru',project.name);if(name)renameProject(project.id,name)}} className="p-2 rounded-lg border hover:bg-slate-100"><Pencil size={16}/></button><button title="Duplikasikan" onClick={()=>{setDuplicateTarget(project);setDuplicateForm({name:`${project.name} — Salinan`,year:project.data.identity.tahunPelajaran,mode:'structure'})}} className="p-2 rounded-lg border hover:bg-slate-100"><Copy size={16}/></button><button disabled={store.projects.length<=1} title="Hapus" onClick={()=>{if(window.confirm(`Hapus proyek “${project.name}”?`))deleteProject(project.id)}} className="p-2 rounded-lg border text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16}/></button></div></div>)}</div></div>
      <div className="space-y-5"><div className="bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 p-5"><h3 className="font-black flex items-center gap-2 mb-4"><FolderPlus size={20}/> Proyek Baru</h3><div className="space-y-3"><Input label="Nama Proyek" value={newProject.name} onChange={e=>setNewProject({...newProject,name:e.target.value})} placeholder="Contoh: Kaldik SMA 2027/2028"/><Input label="Tahun Pelajaran" value={newProject.year} onChange={e=>setNewProject({...newProject,year:e.target.value})}/><Button className="w-full" onClick={()=>{if(!isValidAcademicYear(newProject.year))return showToast(getAcademicYearError(newProject.year),'error');createProject(newProject.name,newProject.year);setNewProject({name:'',year:newProject.year})}}>Buat & Buka</Button></div></div><div className="bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 p-5"><h3 className="font-black flex items-center gap-2"><HardDrive size={20}/> Penyimpanan Lokal</h3><p className="text-sm text-slate-500 mt-2">Terpakai sekitar <strong>{storageMb.toFixed(2)} MB</strong>. Aset gambar disimpan per proyek dan dikompresi otomatis.</p>{storageMb>3.5&&<p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mt-3">Penyimpanan mulai besar. Unduh backup lalu hapus proyek yang tidak diperlukan.</p>}</div></div></div>

    <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-3xl border border-red-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4"><div><h3 className="font-bold text-red-800 dark:text-red-300">Reset Seluruh Proyek</h3><p className="text-sm text-red-600 dark:text-red-400">Menghapus semua proyek lokal dari browser ini.</p></div><Button className="bg-red-600 hover:bg-red-700" onClick={()=>setConfirmReset(true)}>Reset Total</Button></div>

    {duplicateTarget&&<Modal title="Duplikasikan Proyek" onClose={()=>setDuplicateTarget(null)} footer={<><Button variant="secondary" onClick={()=>setDuplicateTarget(null)}>Batal</Button><Button onClick={()=>{if(!isValidAcademicYear(duplicateForm.year))return showToast(getAcademicYearError(duplicateForm.year),'error');duplicateProject(duplicateTarget.id,duplicateForm.mode,duplicateForm.name,duplicateForm.year);setDuplicateTarget(null)}}>Duplikasikan</Button></>}><div className="space-y-4"><Input label="Nama Proyek Baru" value={duplicateForm.name} onChange={e=>setDuplicateForm({...duplicateForm,name:e.target.value})}/><Input label="Tahun Pelajaran Baru" value={duplicateForm.year} onChange={e=>setDuplicateForm({...duplicateForm,year:e.target.value})}/><Select label="Isi yang Disalin" value={duplicateForm.mode} onChange={e=>setDuplicateForm({...duplicateForm,mode:e.target.value})} options={[{label:'Struktur Saja — tanpa kegiatan',value:'structure'},{label:'Semua Data — tanggal kegiatan digeser otomatis',value:'all'}]}/></div></Modal>}
    {confirmReset&&<Modal title="Peringatan Bahaya" onClose={()=>setConfirmReset(false)} footer={<><Button variant="secondary" onClick={()=>setConfirmReset(false)}>Batal</Button><Button className="bg-red-600 hover:bg-red-700" onClick={resetAllProjects}>Ya, Hapus Semua</Button></>}><p className="text-slate-600 dark:text-slate-300">Semua proyek, identitas, kegiatan, dan aset pada browser ini akan dihapus. Pastikan proyek penting sudah di-backup.</p></Modal>}
  </div>;
}

function AboutView() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up pb-10">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white text-center shadow-lg relative overflow-hidden transition-all hover:shadow-xl hover:scale-[1.02]">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-20"><CalendarDays size={180} /></div>
        <h1 className="text-4xl font-black mb-4 relative z-10">Kalista</h1>
        <p className="text-blue-100 text-lg max-w-xl mx-auto relative z-10 leading-relaxed font-medium">Kaldik Asistant</p>
        <p className="text-blue-200 text-sm max-w-xl mx-auto relative z-10 leading-relaxed mt-2">Alat bantu praktis untuk menyusun kalender pendidikan, hari efektif, pembelajaran reguler, timeline, proyek, serta dokumen PDF maupun PNG.</p>
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
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">Aplikasi ini mengutamakan penyimpanan lokal di perangkat pengguna. Data utama seperti identitas sekolah, jadwal, tanda tangan, dan stempel tersimpan di <strong>Local Storage</strong> browser. Kalista tidak menggunakan fitur AI, login, cloud sync, maupun API key rahasia.</p>
         </div>
         <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 transition-all hover:shadow-md">
            <FileText size={32} className="text-blue-500 mb-4" />
            <h4 className="font-bold text-lg mb-2 text-slate-800 dark:text-slate-100">Legalitas & Teknologi Canggih</h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-3">Hak cipta dari dokumen kalender dan timeline yang dihasilkan sepenuhnya menjadi milik Anda dan institusi sekolah Anda. Kalista memakai teknologi ringan dan praktis:</p>
            <ul className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed list-disc list-inside space-y-1.5 ml-1">
              <li><strong>Google Calendar ICS, database lokal & Nager.Date:</strong> Referensi awal hari libur nasional.</li>
              <li><strong>React & Tailwind CSS:</strong> Antarmuka responsif kelas atas.</li>
              <li><strong>html2canvas & jsPDF:</strong> Mesin perender PDF dan PNG multi-halaman.<br/><strong>ExcelJS:</strong> Impor Excel terkontrol dengan dropdown kategori.</li>
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

function Modal({ title, onClose, children, footer = null, size = 'md', mobileMode = 'dialog', bodyClassName = '' }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl'
  };
  const widthClass = widthClasses[size] || widthClasses.md;
  const isFullscreen = mobileMode === 'fullscreen';
  const isSheet = mobileMode === 'sheet';

  const overlayClass = isSheet
    ? 'items-end sm:items-center p-0 sm:p-4'
    : isFullscreen
      ? 'items-stretch sm:items-center p-0 sm:p-4'
      : 'items-center p-2 sm:p-4';

  const panelShapeClass = isFullscreen
    ? 'h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[90dvh] sm:rounded-3xl'
    : isSheet
      ? 'max-h-[88dvh] rounded-t-3xl sm:rounded-3xl'
      : 'max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] rounded-2xl sm:rounded-3xl';

  return (
    <div className={`fixed inset-0 z-[100] flex justify-center bg-slate-900/40 backdrop-blur-[2px] animate-fade-in overflow-hidden ${overlayClass}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`bg-white dark:bg-slate-800 shadow-2xl w-full ${widthClass} ${panelShapeClass} overflow-hidden transform transition-all scale-100 border border-slate-200 dark:border-slate-700 flex flex-col`}>
        <div className="flex justify-between items-center px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800 z-20 text-slate-800 dark:text-slate-100">
          <h3 className="font-bold text-lg sm:text-xl leading-tight pr-3">{title}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors flex-shrink-0" aria-label="Tutup modal"><X size={20}/></button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 sm:py-5 text-slate-800 dark:text-slate-100 ${bodyClassName}`}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 sm:px-5 py-3 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

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

const PrintHeader = ({ data, mode = 'official' }) => {
  if (mode === 'plain') return null;
  if (mode === 'compact') return <div className="text-center border-b-2 border-slate-500 pb-3 mb-5"><h1 className="text-2xl font-black uppercase text-black">{data.identity.namaSekolah || 'NAMA SEKOLAH'}</h1><p className="text-sm text-slate-700">{data.identity.kabupaten ? `${data.identity.kabupaten}, ${data.identity.provinsi}` : data.identity.provinsi}</p></div>;
  return <div className="text-center border-b-4 border-slate-800 pb-4 mb-6 flex justify-between items-center w-full flex-shrink-0">
    {data.assets.logoKiri ? <img src={data.assets.logoKiri} alt="Logo 1" className="h-24 w-24 object-contain" /> : <div className="w-24"></div>}
    <div className="flex-1 px-4"><h2 className="text-xl font-bold uppercase text-black">{data.identity.namaDinas || 'DINAS PENDIDIKAN'}</h2><h1 className="text-3xl font-black uppercase tracking-wider text-black">{data.identity.namaSekolah || 'NAMA SEKOLAH'}</h1><p className="text-sm mt-1 text-black">{data.identity.alamat} Kec. {data.identity.kecamatan} Kab. {data.identity.kabupaten} Prov. {data.identity.provinsi}</p></div>
    {data.assets.logoKanan ? <img src={data.assets.logoKanan} alt="Logo 2" className="h-24 w-24 object-contain" /> : <div className="w-24"></div>}
  </div>;
};

const PrintSigner = ({ data, mode = 'official' }) => {
  if (mode !== 'official') return null;
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