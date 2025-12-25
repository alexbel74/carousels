
import React, { useState, useEffect } from 'react';
import { 
  Layout, User as UserIcon, LogOut, Mail, Lock, Send, Trash2, Loader2, ShieldCheck, X, Users, Zap, Image as ImageIcon, Settings2, Sparkles, Cpu, Globe, Key, MessageSquare, Terminal, Download, RefreshCw, ChevronLeft, ExternalLink, Share2, Ban, CheckCircle, Maximize2, FileText
} from 'lucide-react';
import JSZip from 'jszip';
import { CarouselPost, GenerationSettings, Language, User, KieSettings, OpenRouterSettings, SystemInstructions, TelegramSettings, CarouselItem, GoogleSettings } from './types';
import { translations } from './translations';
import { generateCarouselBatch, regenerateSingleImage, regeneratePostCaption, publishToTelegram } from './services/generationService';
import { defaultImagePromptGenerator, defaultCaptionGenerator } from './defaultPrompts';

const STYLES = [
  'None / Custom', 
  'Cinematic Photorealistic', 
  'Cyberpunk Neon', 
  '3D Isometric Render', 
  'Minimalist Vector Art', 
  'Vintage Soviet Poster', 
  'Ghibli Anime Style',
  'Dark Academia Noir',
  'Futuristic Apple Aesthetic',
  'Surreal Dreamscape',
  'Ukiyo-e Woodblock Print',
  '90s Retro VHS',
  'Luxury Gold & Marble',
  'Abstract Liquid Gradient',
  'Synthwave Retro',
  'Claymation / Stop Motion',
  'Hyper-Realistic Blueprint',
  'National Geographic Nature',
  'Pop Art Andy Warhol'
];

const OPEN_ROUTER_MODELS = [
  'openai/gpt-4.1-mini',
  'openai/gpt-4.1',
  'openai/gpt-5',
  'openai/gpt-5.1',
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-sonnet-4',
  'anthropic/claude-3.7-sonnet',
  'anthropic/claude-opus-4.1',
  'anthropic/claude-opus-4.5',
  'anthropic/claude-haiku-4.5',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'google/gemini-3-flash-preview',
  'google/gemini-3-pro-preview'
];

// --- DEFAULTS ---
const DEFAULT_GEN_SETTINGS: GenerationSettings = {
  textService: 'google', 
  imageService: 'google', 
  googleModel: 'gemini-3-pro-image-preview',
  openrouterModel: OPEN_ROUTER_MODELS[0], 
  count: 5, 
  style: STYLES[0],
  aspectRatio: '1:1', 
  customStylePrompt: '', 
  referenceImages: ['', '', '']
};

const DEFAULT_KIE: KieSettings = { apiKey: '' };
const DEFAULT_GOOGLE: GoogleSettings = { apiKey: '' };
const DEFAULT_OR: OpenRouterSettings = { apiKey: '' };
const DEFAULT_TG: TelegramSettings = { botToken: '', channelId: '' };
const DEFAULT_INSTRUCTIONS: SystemInstructions = {
  imageGenerator: defaultImagePromptGenerator,
  captionGenerator: defaultCaptionGenerator
};

const App: React.FC = () => {
  // --- AUTH & NAV ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState<'dashboard' | 'generator' | 'api_keys' | 'prompts' | 'profile' | 'admin_users'>('dashboard');
  const [selectedPost, setSelectedPost] = useState<CarouselPost | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'ru');
  const t = translations[language] || translations['en'];

  // --- PERSISTENCE ---
  const uKey = (key: string) => currentUser ? `user_${currentUser.id}_${key}` : `guest_${key}`;
  const load = (key: string, def: any) => {
    const s = localStorage.getItem(uKey(key));
    return s ? JSON.parse(s) : def;
  };
  const save = (key: string, val: any) => localStorage.setItem(uKey(key), JSON.stringify(val));

  // --- USER DATA ---
  const [posts, setPosts] = useState<CarouselPost[]>([]);
  const [topics, setTopics] = useState<string[]>(['']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Initialize with load checking localStorage, or falling back to CONSTANT DEFAULTS
  const [settings, setSettings] = useState<GenerationSettings>(() => load('genSettings', DEFAULT_GEN_SETTINGS));
  const [kieSettings, setKieSettings] = useState<KieSettings>(() => load('kieSettings', DEFAULT_KIE));
  const [googleSettings, setGoogleSettings] = useState<GoogleSettings>(() => load('googleSettings', DEFAULT_GOOGLE));
  const [openRouterSettings, setOpenRouterSettings] = useState<OpenRouterSettings>(() => load('orSettings', DEFAULT_OR));
  const [tgSettings, setTgSettings] = useState<TelegramSettings>(() => load('tgSettings', DEFAULT_TG));
  const [instructions, setInstructions] = useState<SystemInstructions>(() => load('instructions', DEFAULT_INSTRUCTIONS));

  const [authForm, setAuthForm] = useState({ user: '', email: '', pass: '', confirm: '' });
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // --- MODAL STATES ---
  const [refinementState, setRefinementState] = useState<{
    isOpen: boolean;
    type: 'slide' | 'caption' | null;
    index: number | null;
    value: string;
  }>({ isOpen: false, type: null, index: null, value: '' });

  const [promptViewState, setPromptViewState] = useState<{
    isOpen: boolean;
    prompt: string;
  }>({ isOpen: false, prompt: '' });

  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Sync effect: When user changes, reload ALL data with strict defaults if nothing is found
  useEffect(() => {
    if (currentUser) {
      setPosts(load('carouselHistory', []));
      setTopics(load('topics', [''])); // LOAD USER TOPICS
      setSettings(load('genSettings', DEFAULT_GEN_SETTINGS));
      setKieSettings(load('kieSettings', DEFAULT_KIE));
      setGoogleSettings(load('googleSettings', DEFAULT_GOOGLE));
      setOpenRouterSettings(load('orSettings', DEFAULT_OR));
      setTgSettings(load('tgSettings', DEFAULT_TG));
      setInstructions(load('instructions', DEFAULT_INSTRUCTIONS));
    } else {
      // If no user (logout), reset to defaults to clear UI
      setPosts([]);
      setTopics(['']); // RESET TOPICS
      setSettings(DEFAULT_GEN_SETTINGS);
      setKieSettings(DEFAULT_KIE);
      setGoogleSettings(DEFAULT_GOOGLE);
      setOpenRouterSettings(DEFAULT_OR);
      setTgSettings(DEFAULT_TG);
      setInstructions(DEFAULT_INSTRUCTIONS);
    }
  }, [currentUser]);

  // Save effect: When data changes, save to the CURRENT user's storage
  useEffect(() => {
    if (currentUser) {
      save('carouselHistory', posts);
      save('topics', topics); // SAVE USER TOPICS
      save('genSettings', settings);
      save('kieSettings', kieSettings);
      save('googleSettings', googleSettings);
      save('orSettings', openRouterSettings);
      save('tgSettings', tgSettings);
      save('instructions', instructions);
    }
  }, [posts, topics, settings, kieSettings, googleSettings, openRouterSettings, tgSettings, instructions, currentUser]);

  // --- ACTIONS ---
  const handleAuth = () => {
    const db: User[] = JSON.parse(localStorage.getItem('users_db') || '[]');
    if (authMode === 'register') {
      if (!authForm.user || !authForm.email || !authForm.pass) { setStatus(t.fillAllFields); return; }
      if (authForm.pass !== authForm.confirm) { setStatus(t.passwordsNoMatch); return; }
      const newUser: User = { 
        id: Math.random().toString(36).substr(2, 9), 
        email: authForm.email, 
        username: authForm.user, 
        password: authForm.pass, 
        role: db.length === 0 ? 'admin' : 'user', 
        language, 
        createdAt: Date.now(),
        isBlocked: false
      };
      db.push(newUser); 
      localStorage.setItem('users_db', JSON.stringify(db)); 
      login(newUser);
    } else {
      const user = db.find(u => (u.email === authForm.user || u.username === authForm.user) && u.password === authForm.pass);
      if (user) {
        if (user.isBlocked) {
          setStatus(t.blockedError);
          return;
        }
        login(user);
      } else {
        setStatus(t.authError);
      }
    }
  };

  const login = (user: User) => { setCurrentUser(user); sessionStorage.setItem('currentUser', JSON.stringify(user)); setStatus(null); setView('dashboard'); };
  const logout = () => { setCurrentUser(null); sessionStorage.removeItem('currentUser'); setView('dashboard'); setAuthMode('login'); };

  const handleGenerate = async () => {
    const validTopics = topics.filter(t => t.trim() !== '');
    if (validTopics.length === 0) { setStatus('Введите тему!'); return; }
    setIsGenerating(true); setStatus(t.generating);
    try {
      const results = await Promise.all(validTopics.map(async (topic) => {
        const res = await generateCarouselBatch(
          topic, 
          settings, 
          instructions, 
          kieSettings, 
          openRouterSettings, 
          googleSettings.apiKey,
          undefined, 
          (progress) => setStatus(progress),
          {
            structure: t.genStructure,
            caption: t.genCaption,
            slide: t.genSlide
          }
        );
        return { id: Math.random().toString(36).substr(2, 9), topic, images: res.images, caption: res.caption, status: 'completed' as const, timestamp: Date.now() };
      }));
      setPosts(prev => [...results, ...prev]); setStatus('ГОТОВО!'); setView('dashboard');
    } catch (err: any) { setStatus('ОШИБКА: ' + err.message); } finally { setIsGenerating(false); setTimeout(() => setStatus(null), 3000); }
  };

  // --- CONFIRMATION HANDLER ---
  const requestConfirmation = (message: string, action: () => void) => {
    setConfirmationState({ isOpen: true, message, onConfirm: action });
  };

  const handleConfirm = () => {
    confirmationState.onConfirm();
    setConfirmationState({ ...confirmationState, isOpen: false });
  };

  const deletePost = (id: string) => {
    requestConfirmation('Вы уверены, что хотите удалить этот проект?', () => {
        setPosts(prev => prev.filter(p => p.id !== id));
        if (selectedPost?.id === id) setSelectedPost(null);
    });
  };

  const removeTopic = (index: number) => {
    requestConfirmation('Удалить эту тему из списка?', () => {
        setTopics(topics.filter((_, i) => i !== index));
    });
  };

  const downloadZip = async (post: CarouselPost) => {
    const zip = new JSZip();
    setStatus('СОБИРАЕМ АРХИВ...');
    try {
      for (let i = 0; i < post.images.length; i++) {
        const img = post.images[i];
        try {
            // Try fetching with cors mode, if it fails, fallback
            const response = await fetch(img.imageUrl);
            if (!response.ok) throw new Error('Network error');
            const blob = await response.blob();
            zip.file(`slide_${i + 1}.png`, blob);
        } catch (e) {
            console.error(`Failed to download image ${i+1} due to CORS or network error.`, e);
            // Fallback: create a text file with the link
            zip.file(`slide_${i + 1}_link.txt`, `Image could not be downloaded automatically due to browser security (CORS) or network issues.\n\nDownload Link: ${img.imageUrl}`);
        }
      }
      zip.file('caption.txt', post.caption);
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `carousel_${post.topic.replace(/\s+/g, '_')}.zip`;
      link.click();
    } catch (e) { setStatus('Ошибка скачивания'); } finally { setStatus(null); }
  };

  const openRefinementModal = (type: 'slide' | 'caption', index: number | null) => {
    setRefinementState({ isOpen: true, type, index, value: '' });
  };

  const handleRefinementSubmit = async () => {
    if (!selectedPost) return;
    const { type, index, value } = refinementState;
    setRefinementState({ ...refinementState, isOpen: false });

    if (type === 'slide' && index !== null) {
        setStatus(`ПЕРЕСОЗДАЕМ СЛАЙД ${index + 1}...`);
        try {
            const slide = selectedPost.images[index];
            const newUrl = await regenerateSingleImage(slide.description, settings, kieSettings, googleSettings.apiKey, value);
            const updatedImages = [...selectedPost.images];
            updatedImages[index] = { ...slide, imageUrl: newUrl };
            const updatedPost = { ...selectedPost, images: updatedImages };
            setSelectedPost(updatedPost);
            setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
            setStatus('СЛАЙД ОБНОВЛЕН!');
        } catch (e: any) { setStatus('Ошибка: ' + e.message); } finally { setTimeout(() => setStatus(null), 2000); }
    } else if (type === 'caption') {
        setStatus('ПЕРЕСОЗДАЕМ ТЕКСТ...');
        try {
            const newCaption = await regeneratePostCaption(
                selectedPost.topic, 
                selectedPost.images.map(i => i.description), 
                settings, 
                instructions, 
                openRouterSettings, 
                googleSettings.apiKey,
                value
            );
            const updatedPost = { ...selectedPost, caption: newCaption };
            setSelectedPost(updatedPost);
            setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
            setStatus('ТЕКСТ ОБНОВЛЕН!');
        } catch (e: any) { setStatus('Ошибка: ' + e.message); } finally { setTimeout(() => setStatus(null), 2000); }
    }
  };

  const handlePublishTelegram = async () => {
    if (!selectedPost) return;
    setStatus(t.publishing);
    try {
        await publishToTelegram(selectedPost.images.map(i => i.imageUrl), selectedPost.caption, tgSettings);
        setStatus(t.publishSuccess);
    } catch (e: any) {
        setStatus(`Ошибка: ${e.message}`);
    } finally {
        setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleChangePassword = () => {
    const db: User[] = JSON.parse(localStorage.getItem('users_db') || '[]');
    const userIdx = db.findIndex(u => u.id === currentUser?.id);
    if (userIdx === -1) return;
    if (db[userIdx].password !== currentPass) { setStatus(t.wrongPassword); return; }
    db[userIdx].password = newPass;
    localStorage.setItem('users_db', JSON.stringify(db));
    setStatus(t.passwordChanged);
    setCurrentPass(''); setNewPass('');
    setTimeout(() => setStatus(null), 3000);
  };

  // --- ADMIN ACTIONS ---
  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser?.id) return;
    requestConfirmation('Удалить пользователя навсегда?', () => {
        const db: User[] = JSON.parse(localStorage.getItem('users_db') || '[]');
        const updatedDb = db.filter(u => u.id !== userId);
        localStorage.setItem('users_db', JSON.stringify(updatedDb));
        setStatus('Пользователь удален');
        setTimeout(() => setStatus(null), 2000);
    });
  };

  const handleToggleBlockUser = (userId: string) => {
    if (userId === currentUser?.id) return;
    const db: User[] = JSON.parse(localStorage.getItem('users_db') || '[]');
    const userIdx = db.findIndex(u => u.id === userId);
    if (userIdx === -1) return;
    db[userIdx].isBlocked = !db[userIdx].isBlocked;
    localStorage.setItem('users_db', JSON.stringify(db));
    setStatus(db[userIdx].isBlocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
    setTimeout(() => setStatus(null), 2000);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 text-slate-200">
        <div className="max-w-[440px] w-full bg-[#111827] border border-slate-800 rounded-[48px] p-10 shadow-2xl space-y-8 animate-in zoom-in-95">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-[#2563eb] rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20"><Layout className="w-8 h-8 text-white" /></div>
            <h2 className="text-4xl font-black text-white">Carousel <span className="text-blue-500">Pro</span></h2>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-tight">{authMode === 'login' ? t.loginTitle : t.registerTitle}</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase px-2 tracking-widest">{t.username}</label>
              <input type="text" value={authForm.user} onChange={e => setAuthForm({...authForm, user: e.target.value})} className="w-full bg-[#1f2937]/50 border border-slate-700 rounded-2xl py-4 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-white" />
            </div>
            {authMode === 'register' && (
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase px-2 tracking-widest">{t.email}</label>
                <input type="email" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full bg-[#1f2937]/50 border border-slate-700 rounded-2xl py-4 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-white" />
              </div>
            )}
            <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase px-2 tracking-widest">{t.password}</label>
              <input type="password" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} className="w-full bg-[#1f2937]/50 border border-slate-700 rounded-2xl py-4 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-white" />
            </div>
            {authMode === 'register' && (
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase px-2 tracking-widest">{t.confirmPassword}</label>
                <input type="password" value={authForm.confirm} onChange={e => setAuthForm({...authForm, confirm: e.target.value})} className="w-full bg-[#1f2937]/50 border border-slate-700 rounded-2xl py-4 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-white" />
              </div>
            )}
          </div>
          {status && <p className="text-xs font-bold text-red-500 text-center animate-pulse">{status}</p>}
          <button onClick={handleAuth} className="w-full py-5 bg-[#2563eb] hover:bg-blue-500 rounded-2xl font-black text-white transition-all text-lg tracking-widest uppercase shadow-xl">{authMode === 'login' ? t.login : t.register}</button>
          <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">{authMode === 'login' ? t.noAccount : t.hasAccount} 
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-blue-500 ml-2 hover:underline">{authMode === 'login' ? 'Регистрация' : 'Войти'}</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#020617] text-slate-200 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 border-r border-slate-800 bg-[#0f172a]/95 flex flex-col shrink-0">
        <header className="p-8 pb-4 flex items-center gap-3">
          <div className="p-2 bg-[#2563eb] rounded-lg shadow-lg shadow-blue-500/10"><Layout className="w-5 h-5 text-white" /></div>
          <h1 className="text-xl font-black tracking-tight">Carousel <span className="text-blue-500">Pro</span></h1>
        </header>
        <nav className="flex-1 px-4 space-y-1 pt-6">
          {[
            { id: 'dashboard', icon: Layout, label: t.navDashboard },
            { id: 'generator', icon: Send, label: t.navGenerator },
            { id: 'api_keys', icon: Key, label: t.navApiKeys },
            { id: 'prompts', icon: Terminal, label: t.navPrompts },
            { id: 'profile', icon: UserIcon, label: t.navProfile },
          ].map(item => (
            <button key={item.id} onClick={() => { setView(item.id as any); setSelectedPost(null); }} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm uppercase tracking-wider ${view === item.id ? 'bg-[#2563eb] text-white shadow-xl shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'}`}>
              <item.icon className="w-5 h-5" /> {item.label}
            </button>
          ))}
          {currentUser.role === 'admin' && (
            <button onClick={() => setView('admin_users')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-wider ${view === 'admin_users' ? 'bg-purple-600 text-white shadow-xl shadow-purple-500/20' : 'text-slate-500 hover:bg-slate-800'}`}>
              <Users className="w-5 h-5" /> {t.adminDashboard}
            </button>
          )}
        </nav>
        <footer className="p-4 border-t border-slate-800/50">
           <button onClick={logout} className="w-full flex items-center gap-4 px-4 py-3 text-slate-500 hover:text-red-400 font-bold uppercase text-xs tracking-widest transition-colors"><LogOut className="w-4 h-4" /> {t.logout}</button>
        </footer>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto bg-[#020617] p-6 md:p-12 relative">
        <div className="max-w-6xl mx-auto space-y-10">
          
          {/* Dashboard View */}
          {view === 'dashboard' && !selectedPost && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-white tracking-tight">{t.dashboard}</h2>
                {posts.length > 0 && (
                  <button onClick={() => requestConfirmation('Вы уверены, что хотите удалить ВСЮ историю?', () => setPosts([]))} className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
                    <Trash2 className="w-3 h-3" /> Очистить всё
                  </button>
                )}
              </div>
              {posts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.map(post => (
                    <div key={post.id} onClick={() => setSelectedPost(post)} className="bg-[#111827] border border-slate-800 rounded-[32px] p-6 cursor-pointer hover:border-blue-500/50 transition-all flex flex-col gap-4 group">
                       <div className="flex justify-between items-start">
                         <h3 className="font-bold text-lg text-slate-200 line-clamp-2">{post.topic}</h3>
                         <button onClick={(e) => { e.stopPropagation(); deletePost(post.id); }} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                       </div>
                       <div className="flex -space-x-3 overflow-hidden">
                          {post.images.slice(0, 4).map((img, i) => (
                            <div key={i} className="w-10 h-10 rounded-full border-2 border-[#111827] bg-slate-800 overflow-hidden shrink-0">
                               <img src={img.imageUrl} className="w-full h-full object-cover" />
                            </div>
                          ))}
                       </div>
                       <div className="mt-auto text-[10px] font-bold text-slate-500 uppercase flex justify-between tracking-widest">
                          <span>{post.images.length} {t.images}</span>
                          <span className="text-blue-500">{t.viewPost} →</span>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-30 space-y-6">
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center"><Layout className="w-10 h-10 text-slate-600" /></div>
                  <h3 className="text-2xl font-bold text-white">{t.firstCarouselTitle}</h3>
                </div>
              )}
            </>
          )}

          {/* Project Details View */}
          {selectedPost && (
            <div className="space-y-8 animate-in slide-in-from-right-10 duration-300">
               <button onClick={() => setSelectedPost(null)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors uppercase text-[10px] font-bold tracking-widest"><ChevronLeft className="w-4 h-4" /> Назад к дашборду</button>
               <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <div>
                    <h2 className="text-4xl font-black text-white tracking-tight">{selectedPost.topic}</h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">{selectedPost.images.length} Слайдов • {new Date(selectedPost.timestamp).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => downloadZip(selectedPost)} className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"><Download className="w-4 h-4" /> Скачать ZIP</button>
                    <button onClick={handlePublishTelegram} className="flex items-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-500 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20"><Share2 className="w-4 h-4" /> В Telegram</button>
                  </div>
               </div>

               <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                  <div className="space-y-6">
                     <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Слайды карусели</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedPost.images.map((img, idx) => (
                          <div key={img.id} className="bg-[#111827] border border-slate-800 rounded-3xl p-4 space-y-4 group">
                             <div className="aspect-square rounded-2xl overflow-hidden bg-slate-800 relative">
                                <img src={img.imageUrl} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                   <button onClick={() => setZoomedImage(img.imageUrl)} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white hover:scale-110 transition-transform"><Maximize2 className="w-5 h-5" /></button>
                                   <button onClick={() => setPromptViewState({ isOpen: true, prompt: img.fullPrompt || img.description })} className="p-3 bg-indigo-600 rounded-full text-white hover:scale-110 transition-transform"><FileText className="w-5 h-5" /></button>
                                   <button onClick={() => openRefinementModal('slide', idx)} className="p-3 bg-blue-600 rounded-full text-white hover:scale-110 transition-transform"><RefreshCw className="w-5 h-5" /></button>
                                   <a href={img.imageUrl} download={`slide_${idx+1}.png`} className="p-3 bg-slate-700 rounded-full text-white hover:scale-110 transition-transform"><Download className="w-5 h-5" /></a>
                                </div>
                                <div className="absolute top-3 left-3 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-lg">{idx+1}</div>
                             </div>
                             <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed italic">{img.description}</p>
                          </div>
                        ))}
                     </div>
                  </div>
                  <div className="space-y-6">
                     <div className="flex justify-between items-center">
                       <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Текст поста</h3>
                       <button onClick={() => openRefinementModal('caption', null)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"><RefreshCw className="w-4 h-4" /></button>
                     </div>
                     <textarea value={selectedPost.caption} readOnly className="w-full h-[60vh] bg-[#111827] border border-slate-800 rounded-[40px] p-8 text-sm leading-relaxed text-slate-300 outline-none resize-none font-sans whitespace-pre-wrap" />
                  </div>
               </div>
            </div>
          )}

          {/* Generator View */}
          {view === 'generator' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in duration-500">
               <div className="lg:col-span-1 space-y-6">
                  <section className="bg-[#111827] border border-slate-800 rounded-[32px] p-6 space-y-4 shadow-xl">
                     <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">{t.topicsLabel}</label>
                     {topics.map((topic, idx) => (
                       <div key={idx} className="relative group">
                         <input type="text" value={topic} onChange={(e) => setTopics(topics.map((t, i) => i === idx ? e.target.value : t))} placeholder={t.topicPlaceholder} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl py-3 px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 text-white" />
                         {topics.length > 1 && <button onClick={() => removeTopic(idx)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>}
                       </div>
                     ))}
                     <button onClick={() => setTopics([...topics, ''])} className="w-full py-2 border border-dashed border-slate-700 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-all font-medium">+ {t.addTopic}</button>
                     <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-5 bg-[#2563eb] hover:bg-blue-500 rounded-xl font-black text-white flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-500/20 uppercase text-sm tracking-widest">
                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} {t.generateButton}
                     </button>
                  </section>
               </div>
               <div className="lg:col-span-2 space-y-6">
                  <div className="bg-[#111827] border border-slate-800 rounded-[40px] p-10 space-y-10 shadow-2xl">
                     <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3"><Settings2 className="w-6 h-6 text-blue-500" /> {t.paramsLabel}</h3>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{t.enginesLabel}</span>
                           <div className="space-y-4">
                              <div className="space-y-2"><span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{t.textService}</span>
                                 <select value={settings.textService} onChange={e => setSettings({...settings, textService: e.target.value as any})} className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl py-3.5 px-4 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                                    <option value="google">Google (Gemini 3 Pro)</option><option value="openrouter">OpenRouter (Any)</option>
                                 </select>
                              </div>
                              {settings.textService === 'openrouter' && (
                                <div className="space-y-2"><span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">OpenRouter Model</span>
                                   <select value={settings.openrouterModel} onChange={e => setSettings({...settings, openrouterModel: e.target.value})} className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl py-3.5 px-4 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                                      {OPEN_ROUTER_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                                   </select>
                                </div>
                              )}
                              <div className="space-y-2"><span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{t.visualEngine}</span>
                                 <select value={settings.imageService} onChange={e => setSettings({...settings, imageService: e.target.value as any})} className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl py-3.5 px-4 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                                    <option value="google">Google (Gemini 3 Pro Image)</option><option value="kie">Kie.ai (Nano Banana Pro)</option>
                                 </select>
                              </div>
                           </div>
                        </div>
                        <div className="space-y-6">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Format</span>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2"><span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{t.imageCount}</span>
                                 <select value={settings.count} onChange={e => setSettings({...settings, count: parseInt(e.target.value)})} className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl py-3.5 px-4 text-xs text-white outline-none">
                                    {[1,2,3,4,5,6,7,8,9,10].map(v => <option key={v} value={v}>{v}</option>)}
                                 </select>
                              </div>
                              <div className="space-y-2"><span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{t.aspectRatio}</span>
                                 <select value={settings.aspectRatio} onChange={e => setSettings({...settings, aspectRatio: e.target.value})} className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl py-3.5 px-4 text-xs text-white outline-none">
                                    <option value="1:1">1:1 Square</option><option value="9:16">9:16 Vertical</option><option value="4:5">4:5 Portrait</option>
                                 </select>
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="pt-8 space-y-6 border-t border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{t.styleLabel}</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2"><span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{t.baseStyle}</span>
                              <select value={settings.style} onChange={e => setSettings({...settings, style: e.target.value})} className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl py-3.5 px-4 text-xs text-white outline-none">
                                 {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                           </div>
                           <div className="space-y-2"><span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{t.customStyle}</span>
                              <textarea value={settings.customStylePrompt} onChange={e => setSettings({...settings, customStylePrompt: e.target.value})} className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl py-4 px-4 text-xs text-white h-24 resize-none outline-none focus:ring-1 focus:ring-blue-500" placeholder="Add specific artistic details..." />
                           </div>
                        </div>
                     </div>

                     <div className="pt-8 space-y-6 border-t border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{t.referenceLabel} (До 3 штук)</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                           {settings.referenceImages.map((url, i) => (
                             <input key={i} value={url} onChange={e => {
                               const nr = [...settings.referenceImages]; nr[i] = e.target.value; setSettings({...settings, referenceImages: nr});
                             }} placeholder={t.refPlaceholder} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl py-3 px-3 text-[10px] outline-none text-white focus:ring-1 focus:ring-blue-500 transition-all" />
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* API Keys View */}
          {view === 'api_keys' && (
            <div className="max-w-4xl space-y-8 animate-in fade-in">
               <h2 className="text-3xl font-black text-white tracking-tight">{t.navApiKeys}</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section className="bg-[#111827] border border-slate-800 rounded-[32px] p-8 space-y-6 shadow-xl">
                     <h3 className="font-bold text-blue-500 uppercase text-xs tracking-widest flex items-center gap-2"><Globe className="w-4 h-4" /> {t.tgSettingsTitle}</h3>
                     <div className="space-y-4">
                        <div className="space-y-1"><label className="text-[9px] font-bold text-slate-600 uppercase">{t.botToken}</label>
                          <input type="password" value={tgSettings.botToken} onChange={e => setTgSettings({...tgSettings, botToken: e.target.value})} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl py-3 px-4 text-xs text-white" />
                        </div>
                        <div className="space-y-1"><label className="text-[9px] font-bold text-slate-600 uppercase">{t.channelId}</label>
                          <input type="text" value={tgSettings.channelId} onChange={e => setTgSettings({...tgSettings, channelId: e.target.value})} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl py-3 px-4 text-xs text-white" />
                        </div>
                     </div>
                  </section>
                  <section className="bg-[#111827] border border-slate-800 rounded-[32px] p-8 space-y-6 flex flex-col shadow-xl">
                     <h3 className="font-bold text-blue-500 uppercase text-xs tracking-widest flex items-center gap-2"><Key className="w-4 h-4" /> Google AI API</h3>
                     <div className="space-y-1"><label className="text-[9px] font-bold text-slate-600 uppercase">{t.apiKey}</label>
                       <input type="password" value={googleSettings.apiKey} onChange={e => setGoogleSettings({...googleSettings, apiKey: e.target.value})} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl py-3 px-4 text-xs text-white" placeholder="Optional (overrides env)" />
                     </div>
                     <div className="mt-6 pt-6 border-t border-slate-800">
                         <h3 className="font-bold text-blue-500 uppercase text-xs tracking-widest flex items-center gap-2 mb-4"><Key className="w-4 h-4" /> {t.kieSettingsTitle}</h3>
                         <div className="space-y-1"><label className="text-[9px] font-bold text-slate-600 uppercase">{t.apiKey}</label>
                           <input type="password" value={kieSettings.apiKey} onChange={e => setKieSettings({...kieSettings, apiKey: e.target.value})} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl py-3 px-4 text-xs text-white" />
                         </div>
                     </div>
                     <div className="mt-auto pt-6 border-t border-slate-800">
                        <h3 className="font-bold text-blue-500 uppercase text-xs tracking-widest mb-4 flex items-center gap-2"><Globe className="w-4 h-4" /> {t.orSettingsTitle}</h3>
                        <div className="space-y-1"><label className="text-[9px] font-bold text-slate-600 uppercase">{t.apiKey}</label>
                          <input type="password" value={openRouterSettings.apiKey} onChange={e => setOpenRouterSettings({...openRouterSettings, apiKey: e.target.value})} className="w-full bg-[#1e293b] border border-slate-700 rounded-xl py-3 px-4 text-xs text-white" />
                        </div>
                     </div>
                  </section>
               </div>
               <button onClick={() => setStatus(t.settingsSaved)} className="px-10 py-4 bg-[#2563eb] hover:bg-blue-500 rounded-2xl font-black text-white text-xs tracking-widest uppercase shadow-xl transition-all active:scale-95">{t.saveSettings}</button>
            </div>
          )}

          {/* Prompt Viewer Modal */}
          {promptViewState.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="w-full max-w-2xl bg-[#111827] border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Full Prompt</h3>
                    <button onClick={() => setPromptViewState({...promptViewState, isOpen: false})} className="text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="w-full h-64 bg-[#1e293b] border border-slate-700 rounded-2xl p-4 text-sm text-white overflow-y-auto whitespace-pre-wrap font-mono">
                    {promptViewState.prompt}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(promptViewState.prompt); setStatus("Скопировано!"); }} className="w-full py-4 bg-[#2563eb] hover:bg-blue-500 rounded-2xl font-bold text-white uppercase text-xs tracking-widest transition-all shadow-xl shadow-blue-500/20">КОПИРОВАТЬ</button>
               </div>
            </div>
          )}

          {view === 'prompts' && (
            <div className="space-y-8 animate-in fade-in">
               <h2 className="text-3xl font-black text-white tracking-tight">{t.navPrompts}</h2>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon className="w-4 h-4" /> {t.promptImgTitle}</h3>
                     <textarea value={instructions.imageGenerator} onChange={e => setInstructions({...instructions, imageGenerator: e.target.value})} className="w-full h-[60vh] bg-[#111827] border border-slate-800 rounded-[32px] p-8 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono leading-relaxed" />
                  </div>
                  <div className="space-y-4">
                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare className="w-4 h-4" /> {t.promptCapTitle}</h3>
                     <textarea value={instructions.captionGenerator} onChange={e => setInstructions({...instructions, captionGenerator: e.target.value})} className="w-full h-[60vh] bg-[#111827] border border-slate-800 rounded-[32px] p-8 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono leading-relaxed" />
                  </div>
               </div>
               <button onClick={() => { save('instructions', instructions); setStatus(t.settingsSaved); }} className="px-10 py-4 bg-[#2563eb] hover:bg-blue-500 rounded-2xl font-black text-white text-xs tracking-widest uppercase shadow-xl transition-all active:scale-95">{t.saveSettings}</button>
            </div>
          )}
          
          {/* ... (Rest of Profile and Admin views remains unchanged, handled by view state switch above) ... */}

          {/* Profile View */}
          {view === 'profile' && (
            <div className="max-w-3xl mx-auto space-y-12 animate-in slide-in-from-bottom-5">
              <section className="bg-[#111827] border border-slate-800 rounded-[40px] p-10 shadow-2xl space-y-8">
                 <h2 className="text-2xl font-black text-white">{t.profileSettings}</h2>
                 <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase px-1 tracking-widest">{t.username}</label>
                          <input type="text" value={currentUser.username} readOnly className="w-full bg-[#1f2937]/50 border border-slate-700 rounded-2xl py-4 px-5 text-sm text-slate-400" />
                       </div>
                       <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase px-1 tracking-widest">{t.email}</label>
                          <input type="text" value={currentUser.email} readOnly className="w-full bg-[#1f2937]/50 border border-slate-700 rounded-2xl py-4 px-5 text-sm text-slate-400" />
                       </div>
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase px-1 tracking-widest">Language</label>
                       <select value={language} onChange={e => setLanguage(e.target.value as Language)} className="w-full bg-[#1f2937]/50 border border-slate-700 rounded-2xl py-4 px-5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500">
                         <option value="ru">Русский</option><option value="en">English</option>
                       </select>
                    </div>
                    <button className="px-10 py-4 bg-[#2563eb] hover:bg-blue-500 rounded-2xl font-black text-white transition-all text-[10px] tracking-widest uppercase active:scale-95">{t.saveChanges}</button>
                 </div>
              </section>

              <section className="bg-[#111827] border border-slate-800 rounded-[40px] p-10 shadow-2xl space-y-8">
                 <h2 className="text-2xl font-black text-white">{t.changePassword}</h2>
                 <div className="space-y-6">
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase px-1 tracking-widest">{t.currentPassword}</label>
                       <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} className="w-full bg-[#1f2937]/50 border border-slate-700 rounded-2xl py-4 px-5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase px-1 tracking-widest">{t.newPassword}</label>
                       <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full bg-[#1f2937]/50 border border-slate-700 rounded-2xl py-4 px-5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button onClick={handleChangePassword} className="px-10 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl font-black text-white text-[10px] tracking-widest uppercase transition-all active:scale-95">{t.saveChanges}</button>
                 </div>
              </section>
            </div>
          )}

          {/* Admin Dashboard */}
          {view === 'admin_users' && currentUser.role === 'admin' && (
            <div className="space-y-8 animate-in fade-in">
              <h2 className="text-3xl font-black text-white tracking-tight">{t.adminDashboard}</h2>
              <div className="bg-[#111827] border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl">
                 <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-[#0f172a]/50">
                        <th className="px-8 py-6">User</th>
                        <th className="px-8 py-6">Email</th>
                        <th className="px-8 py-6">Role</th>
                        <th className="px-8 py-6">Status</th>
                        <th className="px-8 py-6 text-right">{t.userActions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                       {JSON.parse(localStorage.getItem('users_db') || '[]').map((u: User) => (
                         <tr key={u.id} className={`hover:bg-slate-800/20 transition-colors ${u.isBlocked ? 'opacity-50 grayscale' : ''}`}>
                            <td className="px-8 py-6 font-bold text-white">{u.username}</td>
                            <td className="px-8 py-6 text-slate-400">{u.email}</td>
                            <td className="px-8 py-6">
                              <span className={`px-3 py-1 border rounded-full text-[9px] font-black uppercase ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-600/10 text-blue-500 border-blue-500/20'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                               {u.isBlocked ? (
                                 <span className="flex items-center gap-1.5 text-red-500 text-[10px] font-black uppercase"><Ban className="w-3 h-3" /> Blocked</span>
                               ) : (
                                 <span className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase"><CheckCircle className="w-3 h-3" /> Active</span>
                               )}
                            </td>
                            <td className="px-8 py-6 text-right">
                               <div className="flex justify-end gap-2">
                                  {u.id !== currentUser.id && (
                                    <>
                                      <button 
                                        onClick={() => handleToggleBlockUser(u.id)} 
                                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${u.isBlocked ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'}`}
                                      >
                                        <Ban className="w-3 h-3" /> {u.isBlocked ? t.unblockUser : t.blockUser}
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteUser(u.id)} 
                                        className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5"
                                      >
                                        <Trash2 className="w-3 h-3" /> {t.deleteUser}
                                      </button>
                                    </>
                                  )}
                               </div>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Refinement Modal */}
      {refinementState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="w-full max-w-lg bg-[#111827] border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{t.refineModalTitle}</h3>
              <textarea 
                value={refinementState.value} 
                onChange={(e) => setRefinementState({...refinementState, value: e.target.value})}
                placeholder={t.refinePlaceholder}
                className="w-full h-40 bg-[#1e293b] border border-slate-700 rounded-2xl p-4 text-sm text-white resize-none outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-4">
                 <button onClick={() => setRefinementState({...refinementState, isOpen: false})} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold text-white uppercase text-xs tracking-widest transition-all">{t.cancel}</button>
                 <button onClick={handleRefinementSubmit} className="flex-1 py-4 bg-[#2563eb] hover:bg-blue-500 rounded-2xl font-bold text-white uppercase text-xs tracking-widest transition-all shadow-xl shadow-blue-500/20">{t.refineSubmit}</button>
              </div>
           </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationState.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="w-full max-w-sm bg-[#111827] border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl text-center">
              <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-2">
                 <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{t.confirmModalTitle}</h3>
              <p className="text-sm text-slate-400 font-medium">{confirmationState.message}</p>
              <div className="flex gap-4 pt-2">
                 <button onClick={() => setConfirmationState({...confirmationState, isOpen: false})} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-white uppercase text-xs tracking-widest transition-all">{t.cancel}</button>
                 <button onClick={handleConfirm} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-white uppercase text-xs tracking-widest transition-all shadow-xl shadow-red-600/20">{t.confirmAction}</button>
              </div>
           </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setZoomedImage(null)}>
           <button onClick={() => setZoomedImage(null)} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors z-[90]">
             <X className="w-10 h-10" />
           </button>
           <img 
             src={zoomedImage} 
             className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10" 
             onClick={(e) => e.stopPropagation()} 
           />
        </div>
      )}

      {/* Global Status HUD */}
      {status && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-[#1e293b] border border-blue-500/50 px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <Zap className="w-5 h-5 text-blue-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-white">{status}</span>
          <button onClick={() => setStatus(null)} className="ml-4 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
};

export default App;
