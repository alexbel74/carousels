
import React, { useState, useEffect } from 'react';
import { 
  Plus, Send, Image as ImageIcon, Trash2, CheckCircle, Loader2,
  Layout, Type as TypeIcon, Globe, ShieldCheck, X, Zap, Sparkles, Cloud, Server, Cpu, AlertCircle, Share2, Link as LinkIcon, Download, RotateCw, Calendar, Clock, MessageSquare
} from 'lucide-react';
import JSZip from 'jszip';
import { CarouselPost, GenerationSettings, AppState, Language, TelegramSettings, KieSettings, OpenRouterSettings, SystemInstructions } from './types';
import { generateCarouselBatch, publishToTelegram, regeneratePostCaption, regenerateSingleImage } from './services/generationService';
import { translations } from './translations';
import { defaultImagePromptGenerator, defaultCaptionGenerator } from './defaultPrompts';

const STYLES = [
  'None / Custom', 'Cinematic Photorealistic', 'Minimalist Vector Art', 'Cyberpunk Neon', 
  'Soft Pastel Watercolor', '3D Isometric Render', 'Analog Film 35mm', 'Dark Academia', 
  'Surreal Collage', 'Vintage Soviet Poster', 'Ghibli Anime Style', 'Hyper-Realistic 8k',
  'Pencil Charcoal Sketch', 'Double Exposure Art', 'Vaporwave Aesthetic', 'Claymation / Plasticine',
  'Futuristic UI Glassmorphism', 'Noir Monochrome', 'Renaissance Oil Painting', 'Abstract Memphis',
  'Bauhaus Geometric', 'Glitch Art', 'Pop Art Warhol', 'Gothic Dark Fantasy', 'Steampunk Victorian',
  'Infographic Flat Design', 'Ukiyo-e Japanese Woodblock', 'Graffiti Street Art', 'Stained Glass'
];

const OPENROUTER_MODELS = [
  'openai/gpt-4.1-mini', 'openai/gpt-4.1', 'openai/gpt-5', 'openai/gpt-5.1',
  'anthropic/claude-sonnet-4.5', 'anthropic/claude-3.7-sonnet', 'google/gemini-2.5-pro',
  'google/gemini-3-flash-preview', 'google/gemini-3-pro-preview'
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
  const [isZipping, setIsZipping] = useState(false);
  const [isRegeneratingText, setIsRegeneratingText] = useState(false);
  const [regeneratingImageId, setRegeneratingImageId] = useState<string | null>(null);
  
  // Custom Modal State for Refinement
  const [refinementModal, setRefinementModal] = useState<{
    isOpen: boolean;
    type: 'all' | 'text' | 'image';
    targetPost: CarouselPost | null;
    targetImageId?: string;
    targetDescription?: string;
  }>({ isOpen: false, type: 'all', targetPost: null });
  const [refinementText, setRefinementText] = useState('');

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

  const handleDownloadImage = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `slide-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllAsZip = async (post: CarouselPost) => {
    if (post.images.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folderName = post.topic.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 30);
      const folder = zip.folder(folderName);
      
      const promises = post.images.map(async (img, idx) => {
        try {
          const response = await fetch(img.imageUrl, { mode: 'cors', cache: 'no-cache', credentials: 'omit' });
          if (!response.ok) throw new Error("Fetch failed");
          const blob = await response.blob();
          folder?.file(`slide-${idx + 1}.png`, blob);
        } catch (e) { console.error(`Failed zip part ${idx}`, e); }
      });
      
      await Promise.all(promises);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) { alert("Zip failed. Check connection."); } finally { setIsZipping(false); }
  };

  const checkApiKey = async () => {
    try {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }
    } catch (e) {}
    return true;
  };

  // REGENERATION HANDLERS VIA MODAL
  const openRefinement = (type: 'all' | 'text' | 'image', post: CarouselPost, imageId?: string, description?: string) => {
    setRefinementText('');
    setRefinementModal({
      isOpen: true,
      type,
      targetPost: post,
      targetImageId: imageId,
      targetDescription: description
    });
  };

  const confirmRefinement = async () => {
    const { type, targetPost, targetImageId, targetDescription } = refinementModal;
    if (!targetPost) return;
    
    setRefinementModal(prev => ({ ...prev, isOpen: false }));
    const currentRefinement = refinementText.trim();

    if (type === 'all') {
      setPosts(prev => prev.map(p => p.id === targetPost.id ? { ...p, status: 'processing', images: [], caption: '' } : p));
      setIsGenerating(true);
      try {
        if (settings.textService === 'google' || settings.imageService === 'google') await checkApiKey();
        const result = await generateCarouselBatch(targetPost.topic, settings, instructions, kieSettings, openRouterSettings, currentRefinement);
        setPosts(prev => prev.map(p => p.id === targetPost.id ? { ...p, ...result, status: 'completed' } : p));
      } catch (err: any) {
        if (err.message?.includes("Requested entity was not found")) await window.aistudio.openSelectKey();
        setPosts(prev => prev.map(p => p.id === targetPost.id ? { ...p, status: 'failed' } : p));
        alert(err.message);
      } finally { setIsGenerating(false); }
    } else if (type === 'text') {
      setIsRegeneratingText(true);
      try {
        if (settings.textService === 'google') await checkApiKey();
        const newCaption = await regeneratePostCaption(targetPost.topic, targetPost.images.map(img => img.description), settings, instructions, openRouterSettings, currentRefinement);
        setPosts(prev => prev.map(p => p.id === targetPost.id ? { ...p, caption: newCaption } : p));
      } catch (err: any) {
        if (err.message?.includes("Requested entity was not found")) await window.aistudio.openSelectKey();
        alert(err.message);
      } finally { setIsRegeneratingText(false); }
    } else if (type === 'image' && targetImageId && targetDescription) {
      setRegeneratingImageId(targetImageId);
      try {
        if (settings.imageService === 'google') await checkApiKey();
        const newUrl = await regenerateSingleImage(targetDescription, settings, kieSettings, currentRefinement);
        setPosts(prev => prev.map(p => p.id === targetPost.id ? {
          ...p,
          images: p.images.map(img => img.id === targetImageId ? { ...img, imageUrl: newUrl } : img)
        } : p));
      } catch (err: any) {
        if (err.message?.includes("Requested entity was not found")) await window.aistudio.openSelectKey();
        alert(err.message);
      } finally { setRegeneratingImageId(null); }
    }
  };

  const handlePublish = async (post: CarouselPost) => {
    if (!tgSettings.botToken || !tgSettings.channelId) { alert(t.missingTelegram); setShowAdmin(true); return; }
    setIsPublishing(true);
    try {
      await publishToTelegram(post.images.map(i => i.imageUrl), post.caption, tgSettings);
      alert(t.publishSuccess);
    } catch (err: any) { alert(t.publishError + ": " + err.message); } finally { setIsPublishing(false); }
  };

  const startGeneration = async () => {
    await checkApiKey();
    const validTopics = topics.filter(t => t.trim() !== '');
    if (!validTopics.length) return;
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
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'failed' } : p));
        setErrorMessage(err.message);
      }
    }
    setIsGenerating(false);
  };

  const activePost = posts.find(p => p.id === activePostId);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-200 font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-80 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActivePostId(null)}>
            <div className="p-2 bg-blue-600 rounded-lg"><Layout className="w-5 h-5 text-white" /></div>
            <h1 className="text-lg font-bold">Carousel <span className="text-blue-500">Pro</span></h1>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"><Globe className="w-4 h-4" /></button>
            <button onClick={() => setShowAdmin(true)} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"><ShieldCheck className="w-4 h-4" /></button>
          </div>
        </header>

        <div className="space-y-6">
          <section className="space-y-3">
             <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">{t.topicsLabel}</label>
             {topics.map((topic, idx) => (
               <div key={idx} className="relative group">
                 <input type="text" value={topic} onChange={(e) => setTopics(topics.map((t, i) => i === idx ? e.target.value : t))} placeholder={t.topicPlaceholder} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                 {topics.length > 1 && <button onClick={() => setTopics(topics.filter((_, i) => i !== idx))} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>}
               </div>
             ))}
             <button onClick={() => setTopics([...topics, ''])} className="w-full py-2 border border-dashed border-slate-700 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-all font-medium">+ {t.addTopic}</button>
          </section>

          <section className="space-y-4 pt-4 border-t border-slate-800">
            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">{t.carouselSettings}</label>
            
            {/* Провайдеры */}
            <div className="space-y-3">
               <div>
                  <label className="text-[9px] text-slate-500 uppercase font-bold mb-1.5 block">{t.textService}</label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-800 rounded-lg">
                    <button onClick={() => setSettings({...settings, textService: 'google'})} className={`py-1 text-[9px] font-bold rounded transition-all ${settings.textService === 'google' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}>GOOGLE</button>
                    <button onClick={() => setSettings({...settings, textService: 'openrouter'})} className={`py-1 text-[9px] font-bold rounded transition-all ${settings.textService === 'openrouter' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}>OPENROUTER</button>
                  </div>
               </div>
               <div>
                  <label className="text-[9px] text-slate-500 uppercase font-bold mb-1.5 block">{t.visualEngine}</label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-800 rounded-lg">
                    <button onClick={() => setSettings({...settings, imageService: 'google'})} className={`py-1 text-[9px] font-bold rounded transition-all ${settings.imageService === 'google' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}>GOOGLE</button>
                    <button onClick={() => setSettings({...settings, imageService: 'kie'})} className={`py-1 text-[9px] font-bold rounded transition-all ${settings.imageService === 'kie' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}>KIE.AI</button>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1">
                 <label className="text-[10px] text-slate-500 uppercase font-bold">{t.imageCount}: {settings.count}</label>
                 <input type="range" min="1" max="10" value={settings.count} onChange={e => setSettings({...settings, count: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 rounded-lg accent-blue-600 cursor-pointer" />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] text-slate-500 uppercase font-bold">{t.aspect}</label>
                 <select value={settings.aspectRatio} onChange={e => setSettings({...settings, aspectRatio: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1 px-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-500">
                   <option value="1:1">1:1 Square</option>
                   <option value="4:5">4:5 Insta</option>
                   <option value="16:9">16:9 Wide</option>
                   <option value="9:16">9:16 Story</option>
                 </select>
               </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase font-bold">{t.baseStyle}</label>
              <select value={settings.style} onChange={e => setSettings({...settings, style: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-2 text-[11px] outline-none focus:ring-1 focus:ring-blue-500">
                {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-600 font-bold uppercase">{t.extraPromptLabel}</label>
              <textarea value={settings.customStylePrompt} onChange={e => setSettings({...settings, customStylePrompt: e.target.value})} placeholder={t.styleDetailsPlaceholder} className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-[10px] h-16 resize-none outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">{t.referenceImagesLabel}</label>
              {settings.referenceImages.map((url, idx) => (
                <div key={idx} className="relative group">
                  <input type="text" value={url} onChange={(e) => {
                    const nr = [...settings.referenceImages]; nr[idx] = e.target.value; setSettings({...settings, referenceImages: nr});
                  }} placeholder="Image URL..." className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-[9px] outline-none focus:ring-1 focus:ring-blue-500" />
                  <button onClick={() => setSettings({...settings, referenceImages: settings.referenceImages.filter((_, i) => i !== idx)})} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              {settings.referenceImages.length < 3 && (
                <button onClick={() => setSettings({...settings, referenceImages: [...settings.referenceImages, '']})} className="w-full py-1 border border-dashed border-slate-700 rounded-lg text-[10px] text-slate-500 hover:text-slate-300 transition-all font-medium">+ Reference</button>
              )}
            </div>
          </section>

          <button onClick={startGeneration} disabled={isGenerating} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 mt-4 active:scale-95">
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {isGenerating ? t.generating : t.generateButton}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        <div className="border-b border-slate-800 p-4 bg-slate-900/30 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2">
            <button onClick={() => setActivePostId(null)} className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${activePostId === null ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>{t.dashboard}</button>
            {posts.map(post => (
              <button key={post.id} onClick={() => setActivePostId(post.id)} className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-2 ${activePostId === post.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                {post.status === 'processing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <div className={`w-2 h-2 rounded-full ${post.status === 'completed' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : post.status === 'failed' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-slate-600 animate-pulse'}`} />}
                {post.topic.substring(0, 15)}...
              </button>
            ))}
          </div>
          {posts.length > 0 && <button onClick={() => {if(confirm(t.confirmClear)) setPosts([]);}} className="text-[10px] font-bold text-slate-600 hover:text-red-400 uppercase tracking-widest transition-colors">{t.clearHistory}</button>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-10">
          {activePost ? (
            <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
              {activePost.status === 'processing' ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
                  <Loader2 className="w-14 h-14 text-blue-500 animate-spin" />
                  <h2 className="text-2xl font-bold">{t.generating}...</h2>
                  <p className="text-slate-500 text-sm max-w-sm">Parallel batch generation active. Capturing all high-quality frames from {settings.imageService.toUpperCase()}.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                    <h2 className="text-4xl font-black text-white tracking-tight">{activePost.topic}</h2>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => openRefinement('all', activePost)} disabled={isGenerating} className="px-5 py-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-700 transition-all disabled:opacity-50"><RotateCw className="w-4 h-4" /> {t.regenerateAll}</button>
                      <button onClick={() => handleDownloadAllAsZip(activePost)} disabled={isZipping} className="px-5 py-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-700 transition-all disabled:opacity-50">{isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} ZIP</button>
                      <button onClick={() => handlePublish(activePost)} disabled={isPublishing} className="px-5 py-3 bg-blue-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">{isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} {t.publishTelegram}</button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><ImageIcon className="w-4 h-4" /> {t.visualSequence}</h3>
                    <div className="flex overflow-x-auto pb-6 gap-6 snap-x no-scrollbar">
                      {activePost.images.map((img, i) => (
                        <div key={img.id} className="min-w-[340px] md:min-w-[480px] aspect-square snap-center relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group">
                          <img src={img.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-8 flex flex-col justify-end">
                             <p className="text-[11px] text-slate-300 font-medium leading-relaxed mb-4 line-clamp-4">{img.description}</p>
                             <div className="flex gap-3">
                               <button onClick={() => handleDownloadImage(img.imageUrl, i)} className="px-4 py-2 bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-xl text-[10px] font-bold flex items-center gap-2 transition-all"><Download className="w-3.5 h-3.5" /> {t.download}</button>
                               <button onClick={() => openRefinement('image', activePost, img.id, img.description)} disabled={regeneratingImageId === img.id} className="px-4 py-2 bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-xl text-[10px] font-bold flex items-center gap-2 transition-all disabled:opacity-50">
                                 {regeneratingImageId === img.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />} {t.regenerateImage}
                               </button>
                             </div>
                          </div>
                          <div className="absolute top-5 left-5 bg-black/70 backdrop-blur px-4 py-1.5 rounded-full text-[10px] font-black border border-white/10 tracking-widest">SLIDE {i+1}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-4">
                       <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><TypeIcon className="w-4 h-4" /> {t.postContent}</h3>
                          <button onClick={() => openRefinement('text', activePost)} disabled={isRegeneratingText} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-2 uppercase tracking-widest transition-all disabled:opacity-50">
                            {isRegeneratingText ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />} {t.regenerateCaption}
                          </button>
                       </div>
                       <div className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 min-h-[400px]">
                          <textarea value={activePost.caption} onChange={e => setPosts(posts.map(p => p.id === activePost.id ? {...p, caption: e.target.value} : p))} className="w-full h-full bg-transparent border-none outline-none text-slate-200 font-mono text-sm leading-relaxed resize-none selection:bg-blue-500/30" />
                       </div>
                    </div>
                    <div className="space-y-6 self-start">
                       <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Post Details</h3>
                       <div className="bg-slate-900/40 border border-slate-800 rounded-[32px] p-6 space-y-6">
                          <div className="space-y-1">
                             <label className="text-[9px] font-bold text-slate-600 uppercase">Target Channel</label>
                             <div className="flex items-center gap-2 text-sm font-bold text-blue-400 truncate"><Globe className="w-4 h-4" /> {tgSettings.channelId || "Not set"}</div>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-bold text-slate-600 uppercase">Generation Config</label>
                             <div className="text-[11px] font-bold text-slate-400 flex items-center gap-2 uppercase"><Cpu className="w-4 h-4" /> {settings.imageService} + {settings.textService}</div>
                             <div className="text-[10px] text-slate-500 mt-1">{settings.aspectRatio} Aspect • {settings.style}</div>
                          </div>
                       </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black text-white tracking-tight">{t.dashboard}</h2>
                {posts.length > 0 && (
                   <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                     <div className="flex items-center gap-1.5"><Layout className="w-3.5 h-3.5" /> {posts.length} {t.history}</div>
                   </div>
                )}
              </div>

              {posts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.map(post => (
                    <div 
                      key={post.id} 
                      onClick={() => setActivePostId(post.id)}
                      className="group bg-slate-900/40 border border-slate-800 rounded-[32px] p-6 cursor-pointer hover:border-blue-500/50 hover:bg-slate-900/60 transition-all flex flex-col gap-4 shadow-sm hover:shadow-xl hover:shadow-blue-500/5"
                    >
                      <div className="flex items-center justify-between">
                        <div className={`w-3 h-3 rounded-full ${post.status === 'completed' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : post.status === 'failed' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-slate-600 animate-pulse'}`} />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(post.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-200 line-clamp-2 group-hover:text-white transition-colors">{post.topic}</h3>
                      <div className="mt-auto flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                         <div className="flex items-center gap-1.5"><ImageIcon className="w-3 h-3" /> {post.images.length} {t.images}</div>
                         <div className="text-blue-500 group-hover:translate-x-1 transition-transform">{t.viewPost} →</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-8 max-w-md mx-auto opacity-80">
                  <div className="w-28 h-28 bg-slate-900 rounded-[40px] flex items-center justify-center border border-slate-800 shadow-2xl animate-pulse">
                    <Layout className="w-12 h-12 text-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">{t.firstCarouselTitle}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{t.firstCarouselDesc}</p>
                  </div>
                  <div className="flex gap-2 w-full">
                    <div className="flex-1 p-3 bg-slate-900/40 rounded-2xl border border-slate-800 text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Parallel Batch</div>
                    <div className="flex-1 p-3 bg-slate-900/40 rounded-2xl border border-slate-800 text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Regen System</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* REFINEMENT MODAL - REPLACES WINDOW.PROMPT */}
      {refinementModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
           <div className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500"><MessageSquare className="w-6 h-6" /></div>
                <h3 className="text-xl font-bold">{t.refinePromptLabel}</h3>
             </div>
             <p className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-widest">
               Targeting: {refinementModal.type === 'all' ? 'FULL CAROUSEL' : refinementModal.type === 'text' ? 'POST CAPTION' : 'SINGLE IMAGE'}
             </p>
             <textarea 
                value={refinementText} 
                onChange={e => setRefinementText(e.target.value)}
                autoFocus
                placeholder="e.g. Make it more professional, change the colors to gold and black..." 
                className="w-full h-32 bg-slate-800 border border-slate-700 rounded-2xl py-4 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none mb-6"
             />
             <div className="flex gap-4">
                <button onClick={() => setRefinementModal({ isOpen: false, type: 'all', targetPost: null })} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold transition-all text-sm uppercase tracking-widest">Cancel</button>
                <button onClick={confirmRefinement} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold transition-all text-sm uppercase tracking-widest shadow-lg shadow-blue-600/20">Confirm</button>
             </div>
           </div>
        </div>
      )}

      {/* Admin Panel */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-[40px] w-full max-w-4xl p-10 max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-10">
               <h3 className="text-3xl font-black flex items-center gap-4"><ShieldCheck className="w-8 h-8 text-indigo-500" /> {t.adminPanel}</h3>
               <button onClick={() => setShowAdmin(false)} className="p-3 hover:bg-slate-800 rounded-full transition-all text-slate-500"><X className="w-7 h-7" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.telegramSettings}</h4>
                  <input type="password" value={tgSettings.botToken} onChange={e => setTgSettings({...tgSettings, botToken: e.target.value})} placeholder={t.botToken} className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  <input type="text" value={tgSettings.channelId} onChange={e => setTgSettings({...tgSettings, channelId: e.target.value})} placeholder={t.channelId} className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">API Providers</h4>
                  <input type="password" value={kieSettings.apiKey} onChange={e => setKieSettings({apiKey: e.target.value})} placeholder={t.kieApiKey} className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  <input type="password" value={openRouterSettings.apiKey} onChange={e => setOpenRouterSettings({apiKey: e.target.value})} placeholder={t.openrouterApiKey} className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
              </div>
              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Prompts</h4>
                  <label className="text-[9px] text-slate-600 block uppercase font-bold tracking-tighter">Image Prompt Architect</label>
                  <textarea value={instructions.imageGenerator} onChange={e => setInstructions({...instructions, imageGenerator: e.target.value})} className="w-full h-44 bg-slate-800 border border-slate-700 rounded-2xl py-4 px-5 text-[10px] font-mono leading-relaxed outline-none focus:ring-1 focus:ring-indigo-500 transition-all" />
                  <label className="text-[9px] text-slate-600 block uppercase font-bold tracking-tighter">Caption Writer</label>
                  <textarea value={instructions.captionGenerator} onChange={e => setInstructions({...instructions, captionGenerator: e.target.value})} className="w-full h-44 bg-slate-800 border border-slate-700 rounded-2xl py-4 px-5 text-[10px] font-mono leading-relaxed outline-none focus:ring-1 focus:ring-indigo-500 transition-all" />
                </div>
              </div>
            </div>
            <button onClick={saveAdminSettings} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 rounded-[20px] font-black text-white mt-12 transition-all text-lg tracking-widest uppercase shadow-xl shadow-indigo-500/20 active:scale-95">
              {t.saveSettings}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
