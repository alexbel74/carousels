
import React, { useState, useEffect } from 'react';
import { 
  Plus, Send, Image as ImageIcon, Trash2, CheckCircle, Loader2,
  Layout, Type as TypeIcon, Globe, ShieldCheck, X, Zap, Sparkles, Cloud, Server, Cpu, AlertCircle, Share2, Link as LinkIcon
} from 'lucide-react';
import { CarouselPost, GenerationSettings, AppState, Language, TelegramSettings, KieSettings, OpenRouterSettings, SystemInstructions } from './types';
import { generateCarouselBatch, publishToTelegram } from './services/generationService';
import { translations } from './translations';
import { defaultImagePromptGenerator, defaultCaptionGenerator } from './defaultPrompts';

const STYLES = [
  'Cinematic Photorealistic', 
  'Minimalist Vector Art', 
  'Cyberpunk Neon', 
  'Soft Pastel Watercolor', 
  '3D Isometric Render', 
  'Analog Film 35mm', 
  'Dark Academia', 
  'Surreal Collage',
  'Vintage Soviet Poster',
  'Ghibli Anime Style',
  'Hyper-Realistic 8k',
  'Pencil Charcoal Sketch',
  'Double Exposure Art',
  'Vaporwave Aesthetic',
  'Claymation / Plasticine',
  'Futuristic UI Glassmorphism',
  'Noir Monochrome',
  'Renaissance Oil Painting',
  'Abstract Memphis',
  'Bauhaus Geometric',
  'Glitch Art',
  'Pop Art Warhol',
  'Gothic Dark Fantasy',
  'Steampunk Victorian',
  'Infographic Flat Design',
  'Ukiyo-e Japanese Woodblock',
  'Graffiti Street Art',
  'Stained Glass'
];

const OPENROUTER_MODELS = [
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

const safeLoad = (key: string, defaultValue: any) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) { return defaultValue; }
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.API_KEY_REQUIRED);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'ru');
  const [showAdmin, setShowAdmin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [tgSettings, setTgSettings] = useState<TelegramSettings>(() => safeLoad('tgSettings', { botToken: '', channelId: '' }));
  const [kieSettings, setKieSettings] = useState<KieSettings>(() => safeLoad('kieSettings', { apiKey: '' }));
  const [openRouterSettings, setOpenRouterSettings] = useState<OpenRouterSettings>(() => safeLoad('openRouterSettings', { apiKey: '' }));
  const [instructions, setInstructions] = useState<SystemInstructions>(() => safeLoad('systemInstructions', { 
    imageGenerator: defaultImagePromptGenerator, 
    captionGenerator: defaultCaptionGenerator 
  }));

  const [topics, setTopics] = useState<string[]>(['']);
  const [settings, setSettings] = useState<GenerationSettings>(() => safeLoad('generationSettings', {
    textService: 'google',
    imageService: 'google',
    googleModel: 'gemini-3-pro-image-preview',
    openrouterModel: OPENROUTER_MODELS[0],
    count: 5,
    style: STYLES[0],
    aspectRatio: '1:1',
    customStylePrompt: '',
    referenceImages: ['']
  }));
  
  const [posts, setPosts] = useState<CarouselPost[]>(() => safeLoad('carouselHistory', []));
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const t = translations[language] || translations['en'];

  useEffect(() => {
    (async () => {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) setAppState(AppState.READY);
      } catch (e) { console.error("API Key check failed", e); }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem('lang', language);
    localStorage.setItem('carouselHistory', JSON.stringify(posts));
    localStorage.setItem('generationSettings', JSON.stringify(settings));
  }, [language, posts, settings]);

  const saveAdminSettings = () => {
    localStorage.setItem('tgSettings', JSON.stringify(tgSettings));
    localStorage.setItem('kieSettings', JSON.stringify(kieSettings));
    localStorage.setItem('openRouterSettings', JSON.stringify(openRouterSettings));
    localStorage.setItem('systemInstructions', JSON.stringify(instructions));
    alert(t.settingsSaved);
    setShowAdmin(false);
  };

  const handlePublish = async (post: CarouselPost) => {
    if (!tgSettings.botToken || !tgSettings.channelId) {
      alert(t.missingTelegram);
      setShowAdmin(true);
      return;
    }
    setIsPublishing(true);
    try {
      await publishToTelegram(post.images.map(i => i.imageUrl), post.caption, tgSettings);
      alert(t.publishSuccess);
    } catch (err: any) {
      alert(t.publishError + ": " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const startGeneration = async () => {
    setErrorMessage(null);
    if (appState !== AppState.READY) {
      await window.aistudio.openSelectKey();
      setAppState(AppState.READY);
      return;
    }

    const validTopics = topics.filter(topic => topic.trim() !== '');
    if (validTopics.length === 0) return;

    setIsGenerating(true);
    const newPosts: CarouselPost[] = validTopics.map(topic => ({
      id: Math.random().toString(36).substr(2, 9),
      topic, images: [], caption: '', status: 'pending', timestamp: Date.now()
    }));
    
    setPosts(prev => [...newPosts, ...prev]);
    setActivePostId(newPosts[0].id);

    for (const post of newPosts) {
      try {
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'processing' } : p));
        const result = await generateCarouselBatch(post.topic, settings, instructions, kieSettings, openRouterSettings);
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, ...result, status: 'completed' } : p));
      } catch (err: any) {
        console.error("Generation error:", err);
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'failed' } : p));
        setErrorMessage(err.message);
      }
    }
    setIsGenerating(false);
  };

  const activePost = posts.find(p => p.id === activePostId);

  const handleRefImageChange = (index: number, value: string) => {
    const newRefs = [...settings.referenceImages];
    newRefs[index] = value;
    setSettings({...settings, referenceImages: newRefs});
  };

  const addRefImage = () => {
    if (settings.referenceImages.length < 3) {
      setSettings({...settings, referenceImages: [...settings.referenceImages, '']});
    }
  };

  const removeRefImage = (index: number) => {
    const newRefs = settings.referenceImages.filter((_, i) => i !== index);
    setSettings({...settings, referenceImages: newRefs.length === 0 ? [''] : newRefs});
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Sidebar */}
      <aside className="w-full md:w-80 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setActivePostId(null)}>
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform"><Layout className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-bold tracking-tight">Carousel <span className="text-blue-500">Pro</span></h1>
          </div>
          <div className="flex gap-1">
            <button title="Language" onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"><Globe className="w-4 h-4" /></button>
            <button title="Settings" onClick={() => setShowAdmin(true)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"><ShieldCheck className="w-4 h-4" /></button>
          </div>
        </header>

        <div className="space-y-6">
          <section>
            <label className="text-[10px] font-bold uppercase text-slate-500 mb-3 block tracking-widest">{t.topicsLabel}</label>
            <div className="space-y-2">
              {topics.map((topic, idx) => (
                <div key={idx} className="relative group">
                  <input type="text" value={topic} onChange={(e) => setTopics(topics.map((t, i) => i === idx ? e.target.value : t))} placeholder={t.topicPlaceholder} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
                  {topics.length > 1 && <button onClick={() => setTopics(topics.filter((_, i) => i !== idx))} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
              <button onClick={() => setTopics([...topics, ''])} className="w-full py-2.5 border border-dashed border-slate-700 rounded-xl text-slate-500 text-sm flex items-center justify-center gap-2 hover:border-slate-500 hover:text-slate-300 transition-all"><Plus className="w-4 h-4" /> {t.addTopic}</button>
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[10px] font-bold uppercase text-slate-500 block tracking-widest">{t.carouselSettings}</label>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 block mb-2 font-bold uppercase">{t.textService}</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-800 rounded-xl">
                  <button onClick={() => setSettings({...settings, textService: 'google'})} className={`py-1.5 text-[10px] font-bold rounded-lg transition-all ${settings.textService === 'google' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>GOOGLE</button>
                  <button onClick={() => setSettings({...settings, textService: 'openrouter'})} className={`py-1.5 text-[10px] font-bold rounded-lg transition-all ${settings.textService === 'openrouter' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>OPENROUTER</button>
                </div>
              </div>
              
              {settings.textService === 'openrouter' && (
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-bold uppercase ml-1">{t.modelLabel}</label>
                  <select value={settings.openrouterModel} onChange={e => setSettings({...settings, openrouterModel: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/50">
                    {OPENROUTER_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] text-slate-500 block mb-2 font-bold uppercase">{t.imageService}</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-800 rounded-xl">
                  <button onClick={() => setSettings({...settings, imageService: 'google'})} className={`py-1.5 text-[10px] font-bold rounded-lg transition-all ${settings.imageService === 'google' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>GOOGLE</button>
                  <button onClick={() => setSettings({...settings, imageService: 'kie'})} className={`py-1.5 text-[10px] font-bold rounded-lg transition-all ${settings.imageService === 'kie' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>KIE.AI</button>
                </div>
              </div>

              {settings.imageService === 'google' && (
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-bold uppercase ml-1">{t.modelLabel}</label>
                  <select value={settings.googleModel} onChange={e => setSettings({...settings, googleModel: e.target.value as any})} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-2 text-xs">
                    <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image (High Res)</option>
                    <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                 <div className="space-y-2">
                   <label className="text-[10px] text-slate-500 mb-1 block uppercase font-bold">{t.imageCount}: {settings.count}</label>
                   <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    step="1"
                    value={settings.count} 
                    onChange={e => setSettings({...settings, count: parseInt(e.target.value)})} 
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                   />
                 </div>
                 <div>
                   <label className="text-[10px] text-slate-500 mb-1 block uppercase">{t.aspect}</label>
                   <select value={settings.aspectRatio} onChange={e => setSettings({...settings, aspectRatio: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs outline-none">
                     <option value="1:1">1:1 Square</option>
                     <option value="4:5">4:5 Insta</option>
                     <option value="16:9">16:9 Wide</option>
                     <option value="9:16">9:16 Story</option>
                   </select>
                 </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 mb-1 block uppercase">{t.baseStyle}</label>
                  <select value={settings.style} onChange={e => setSettings({...settings, style: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/50">
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-bold uppercase ml-1">{t.extraPromptLabel}</label>
                  <textarea 
                    value={settings.customStylePrompt} 
                    onChange={e => setSettings({...settings, customStylePrompt: e.target.value})} 
                    placeholder={t.styleDetailsPlaceholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-[11px] h-20 outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-bold uppercase text-slate-500 block tracking-widest">{t.referenceImagesLabel}</label>
                <div className="space-y-2">
                  {settings.referenceImages.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"><LinkIcon className="w-3 h-3" /></div>
                      <input 
                        type="text" 
                        value={url} 
                        onChange={(e) => handleRefImageChange(idx, e.target.value)} 
                        placeholder={t.refImagePlaceholder} 
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 pl-8 pr-8 text-[10px] outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" 
                      />
                      <button onClick={() => removeRefImage(idx)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {settings.referenceImages.length < 3 && (
                    <button onClick={addRefImage} className="w-full py-1.5 border border-dashed border-slate-700 rounded-xl text-slate-600 text-[10px] flex items-center justify-center gap-1.5 hover:border-slate-500 hover:text-slate-400 transition-all font-bold uppercase tracking-wider"><Plus className="w-3 h-3" /> Add Image URL</button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {errorMessage && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-[10px] flex gap-2 animate-pulse">
              <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
            </div>
          )}

          <button 
            onClick={startGeneration} 
            disabled={isGenerating} 
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {isGenerating ? t.generating : t.generateButton}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        <div className="border-b border-slate-800 p-4 bg-slate-900/30 backdrop-blur-md flex items-center justify-between overflow-x-auto no-scrollbar gap-4 sticky top-0 z-10">
          <div className="flex gap-2">
            <button 
              onClick={() => setActivePostId(null)} 
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-2 ${activePostId === null ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
            >
              <Layout className="w-3 h-3" />
              {language === 'ru' ? 'Дашборд' : 'Dashboard'}
            </button>
            {posts.map(post => (
              <button 
                key={post.id} 
                onClick={() => setActivePostId(post.id)} 
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-2 ${activePostId === post.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
              >
                {post.status === 'processing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <div className={`w-2 h-2 rounded-full ${post.status === 'completed' ? 'bg-green-500' : post.status === 'failed' ? 'bg-red-500' : 'bg-slate-600'}`} />}
                {post.topic.length > 20 ? post.topic.substring(0, 20) + '...' : post.topic}
              </button>
            ))}
          </div>
          {posts.length > 0 && <button onClick={() => { if(confirm(t.confirmClear)) setPosts([]); }} className="text-[10px] font-bold text-slate-600 hover:text-red-400 uppercase tracking-widest">{t.clearHistory}</button>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 relative">
          {activePost ? (
            <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {activePost.status === 'processing' ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-8">
                   <div className="relative">
                      <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                         <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
                      </div>
                   </div>
                   <div className="text-center space-y-2">
                      <h2 className="text-2xl font-black text-white">{t.generating}...</h2>
                      <p className="text-slate-500 text-sm max-w-xs">{activePost.topic}</p>
                   </div>
                   <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                         <span>{t.status}</span>
                         <span className="text-blue-500">{t.processing}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                         <div className="h-full bg-blue-500 animate-[progress_2s_infinite_linear]" style={{width: '60%'}} />
                      </div>
                      <p className="text-[10px] text-center text-slate-600 italic">This usually takes 30-60 seconds per topic...</p>
                   </div>
                </div>
              ) : activePost.status === 'failed' ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
                   <div className="w-20 h-20 bg-red-900/20 border border-red-500/50 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-10 h-10 text-red-500" />
                   </div>
                   <div>
                      <h2 className="text-2xl font-bold text-white">Generation Failed</h2>
                      <p className="text-slate-400 text-sm mt-1">{errorMessage || "Unexpected error occurred."}</p>
                   </div>
                   <button onClick={() => startGeneration()} className="px-6 py-2 bg-slate-800 rounded-xl text-sm font-bold border border-slate-700 hover:bg-slate-700 transition-all">Try Again</button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                    <div className="space-y-2">
                      <h2 className="text-4xl font-black text-white tracking-tight">{activePost.topic}</h2>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-bold"><CheckCircle className="w-3 h-3 text-green-500" /> {t[activePost.status as keyof typeof t] || activePost.status}</span>
                        <span>•</span>
                        <span>{activePost.images.length} {t.slides}</span>
                      </div>
                    </div>
                    
                    {activePost.status === 'completed' && (
                      <button 
                        onClick={() => handlePublish(activePost)} 
                        disabled={isPublishing}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                      >
                        {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                        {t.publishTelegram}
                      </button>
                    )}
                  </div>

                  {activePost.images.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><ImageIcon className="w-4 h-4" /> {t.visualSequence}</h3>
                      <div className="flex overflow-x-auto pb-6 gap-6 snap-x no-scrollbar">
                        {activePost.images.map((img, i) => (
                          <div key={img.id} className="min-w-[320px] md:min-w-[450px] aspect-square snap-center relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group cursor-zoom-in">
                            <img src={img.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                               <p className="text-[10px] text-slate-300 font-medium leading-relaxed">{img.description}</p>
                            </div>
                            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black border border-white/10">{t.frame} {i+1}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-4">
                       <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><TypeIcon className="w-4 h-4" /> {t.postContent}</h3>
                       <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 relative min-h-[400px]">
                          <textarea 
                            value={activePost.caption} 
                            onChange={e => setPosts(posts.map(p => p.id === activePost.id ? {...p, caption: e.target.value} : p))} 
                            className="w-full h-full bg-transparent border-none outline-none text-slate-200 font-mono text-sm leading-relaxed resize-none selection:bg-blue-500/40" 
                          />
                       </div>
                    </div>
                    
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">{t.postDetails}</h3>
                      <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6 space-y-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{t.targetChannel}</label>
                           <div className="flex items-center gap-2 text-sm font-bold text-blue-400">
                             <Globe className="w-4 h-4" />
                             {tgSettings.channelId || "Not configured"}
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Engine</label>
                           <div className="text-sm font-bold text-slate-400 flex items-center gap-2">
                             <Cpu className="w-4 h-4" />
                             {settings.imageService.toUpperCase()} + {settings.textService.toUpperCase()}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : posts.length > 0 ? (
            <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
               <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black text-white">{language === 'ru' ? 'Все генерации' : 'All Generations'}</h2>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{posts.length} {t.totalCarousels}</div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {posts.map(post => (
                   <div 
                     key={post.id} 
                     onClick={() => setActivePostId(post.id)}
                     className="bg-slate-900/40 border border-slate-800 p-6 rounded-[32px] cursor-pointer hover:border-blue-500/50 hover:bg-slate-900/60 transition-all group relative overflow-hidden"
                   >
                     <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className={`w-2 h-2 rounded-full mt-1.5 ${post.status === 'completed' ? 'bg-green-500' : post.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{new Date(post.timestamp).toLocaleDateString()}</span>
                     </div>
                     <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors relative z-10">{post.topic}</h3>
                     <p className="text-xs text-slate-500 mb-6 relative z-10">{post.images.length} {t.slides}</p>
                     <div className="flex -space-x-3 overflow-hidden relative z-10">
                       {post.images.slice(0, 5).map(img => (
                         <img key={img.id} src={img.imageUrl} className="w-10 h-10 rounded-2xl border-2 border-slate-950 object-cover shadow-lg" />
                       ))}
                       {post.images.length > 5 && (
                         <div className="w-10 h-10 rounded-2xl border-2 border-slate-950 bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">+{post.images.length - 5}</div>
                       )}
                     </div>
                     <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-600/5 rounded-full blur-3xl group-hover:bg-blue-600/10 transition-colors" />
                   </div>
                 ))}
               </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8 max-w-md mx-auto">
              <div className="w-32 h-32 bg-slate-900 rounded-[40px] flex items-center justify-center border border-slate-800 shadow-2xl relative overflow-hidden group">
                 <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-10 transition-opacity" />
                 <Layout className="w-16 h-16 text-slate-700 group-hover:text-blue-500 transition-colors" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">{t.firstCarouselTitle}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{t.firstCarouselDesc}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full">
                 <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-left space-y-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mb-2" />
                    <h4 className="text-xs font-bold text-white">Nano Banana PRO</h4>
                    <p className="text-[10px] text-slate-500">Hyper-realistic AI visuals for professional channels.</p>
                 </div>
                 <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-left space-y-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mb-2" />
                    <h4 className="text-xs font-bold text-white">Batch Mode</h4>
                    <p className="text-[10px] text-slate-500">Generate multiple posts for the whole week at once.</p>
                 </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Admin Panel Modal */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-[40px] w-full max-w-4xl p-10 relative max-h-[90vh] overflow-y-auto shadow-[0_0_100px_rgba(37,99,235,0.2)]">
            <button onClick={() => setShowAdmin(false)} className="absolute top-8 right-8 p-3 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><X className="w-6 h-6" /></button>
            <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-3"><ShieldCheck className="w-8 h-8 text-indigo-500" /> {t.adminPanel}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2"><Send className="w-4 h-4" /> Telegram Bot API</h4>
                  <div className="space-y-3">
                    <input type="password" value={tgSettings.botToken} onChange={e => setTgSettings({...tgSettings, botToken: e.target.value})} placeholder={t.botToken} className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3.5 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500/50" />
                    <input type="text" value={tgSettings.channelId} onChange={e => setTgSettings({...tgSettings, channelId: e.target.value})} placeholder={t.channelId} className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3.5 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2"><Server className="w-4 h-4" /> External Providers</h4>
                  <div className="space-y-3">
                    <input type="password" value={kieSettings.apiKey} onChange={e => setKieSettings({apiKey: e.target.value})} placeholder={t.kieApiKey} className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3.5 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
                    <input type="password" value={openRouterSettings.apiKey} onChange={e => setOpenRouterSettings({apiKey: e.target.value})} placeholder={t.openrouterApiKey} className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3.5 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2"><Cpu className="w-4 h-4" /> Agentic System Prompts</h4>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Image Generation Architect</label>
                    <textarea value={instructions.imageGenerator} onChange={e => setInstructions({...instructions, imageGenerator: e.target.value})} className="w-full h-40 bg-slate-800 border border-slate-700 rounded-2xl py-4 px-5 text-[11px] font-mono leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Telegram Viral Caption Writer</label>
                    <textarea value={instructions.captionGenerator} onChange={e => setInstructions({...instructions, captionGenerator: e.target.value})} className="w-full h-40 bg-slate-800 border border-slate-700 rounded-2xl py-4 px-5 text-[11px] font-mono leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                </div>
              </div>
            </div>

            <button onClick={saveAdminSettings} className="w-full py-5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-[1.01] active:scale-[0.99] rounded-3xl font-black text-white transition-all mt-12 shadow-2xl shadow-indigo-500/20">{t.saveSettings}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
