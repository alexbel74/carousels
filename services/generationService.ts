
import { GoogleGenAI, Type } from "@google/genai";
import { GenerationSettings, KieSettings, OpenRouterSettings, SystemInstructions, TelegramSettings } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function extractJson(text: string) {
  console.log("[Extraction] Input text:", text);
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = markdownRegex.exec(text)) !== null) {
      try {
        if (match[1]) return JSON.parse(match[1].trim());
      } catch (e2) {}
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (e3) {}
    }
    throw new Error(`Invalid JSON format. Model output: ${text.substring(0, 100)}...`);
  }
}

async function callOpenRouter(prompt: string, apiKey: string, model: string, systemInstruction: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Carousel Pro Nano"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenRouter Error ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGeminiText(prompt: string, systemInstruction: string, json: boolean = false) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: json ? "application/json" : "text/plain"
    }
  });
  return response.text || "";
}

export const generateCarouselBatch = async (
  topic: string,
  settings: GenerationSettings,
  instructions: SystemInstructions,
  kieSettings?: KieSettings,
  openRouterSettings?: OpenRouterSettings
) => {
  console.log("[Service] Starting generation for:", topic);

  // 1. Generate Image Prompts
  const structurePrompt = `Create exactly ${settings.count} visual slide prompts in Russian for a carousel about: "${topic}". 
  Format as JSON: { "prompts": ["Slide 1 visual description with text overlay content", "Slide 2..."] }. 
  Style: ${settings.style}. ${settings.customStylePrompt}`;
  
  let promptsRaw: string;
  if (settings.textService === 'openrouter' && openRouterSettings?.apiKey) {
    promptsRaw = await callOpenRouter(structurePrompt, openRouterSettings.apiKey, settings.openrouterModel, instructions.imageGenerator);
  } else {
    promptsRaw = await callGeminiText(structurePrompt, instructions.imageGenerator, true);
  }
  
  const promptsData = extractJson(promptsRaw);
  const imagePrompts: string[] = promptsData.prompts || [];
  if (!imagePrompts.length) throw new Error("Prompt generation returned empty array.");

  // 2. Generate Caption
  const captionInput = `Topic: ${topic}. Slide contents:\n` + imagePrompts.map((p, i) => `${i+1}: ${p}`).join('\n');
  let caption: string;
  if (settings.textService === 'openrouter' && openRouterSettings?.apiKey) {
    caption = await callOpenRouter(captionInput, openRouterSettings.apiKey, settings.openrouterModel, instructions.captionGenerator);
  } else {
    caption = await callGeminiText(captionInput, instructions.captionGenerator, false);
  }

  // 3. Generate Images
  const images: any[] = [];
  const validRefImages = settings.referenceImages.filter(url => url.trim() !== '');

  for (let i = 0; i < imagePrompts.length; i++) {
    const fullPrompt = `${imagePrompts[i]}. Visual style: ${settings.style}. ${settings.customStylePrompt}. High quality, 4k, professional photography.`;
    
    try {
      if (settings.imageService === 'google') {
        const aiImage = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const imgRes = await aiImage.models.generateContent({
          model: settings.googleModel,
          contents: { parts: [{ text: fullPrompt }] },
          config: {
            imageConfig: {
              aspectRatio: settings.aspectRatio as any,
              ...(settings.googleModel === 'gemini-3-pro-image-preview' ? { imageSize: "1K" } : {})
            }
          }
        });
        const data = imgRes.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        if (data) images.push({ 
          id: Math.random().toString(36).substr(2, 9), 
          imageUrl: `data:image/png;base64,${data}`, 
          description: imagePrompts[i] 
        });
      } else if (settings.imageService === 'kie' && kieSettings?.apiKey) {
        const kieInput: any = { 
          prompt: fullPrompt, 
          aspect_ratio: settings.aspectRatio, 
          resolution: "1K" 
        };
        
        // Only include image_input if there are actual URLs
        if (validRefImages.length > 0) {
          kieInput.image_input = validRefImages;
        }

        const create = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${kieSettings.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            model: "nano-banana-pro", 
            input: kieInput 
          })
        }).then(r => r.json());
        
        if (create.code === 200) {
          let url = '';
          for (let attempt = 0; attempt < 30; attempt++) {
            await sleep(4000);
            const poll = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${create.data.taskId}`, { 
              headers: { 'Authorization': `Bearer ${kieSettings.apiKey}` } 
            }).then(r => r.json());
            if (poll.data?.state === 'success') {
              url = JSON.parse(poll.data.resultJson).resultUrls[0];
              break;
            }
          }
          if (url) images.push({ 
            id: Math.random().toString(36).substr(2, 9), 
            imageUrl: url, 
            description: imagePrompts[i] 
          });
        }
      }
    } catch (err) {
      console.error(`Image ${i} generation failed:`, err);
    }
  }

  return { images, caption };
};

export const publishToTelegram = async (images: string[], caption: string, settings: TelegramSettings) => {
  if (!settings.botToken || !settings.channelId) throw new Error("Telegram credentials missing");

  const media = images.map((url, idx) => ({
    type: 'photo',
    media: url.startsWith('data:') ? url : url, 
    caption: idx === 0 ? caption : undefined,
    parse_mode: 'HTML'
  }));

  const remoteOnlyMedia = media.filter(m => !m.media.startsWith('data:'));
  
  if (remoteOnlyMedia.length === 0 && images.length > 0) {
     throw new Error("Base64 images cannot be sent via simple JSON. Use Kie.ai or host images to use Telegram publishing.");
  }

  const response = await fetch(`https://api.telegram.org/bot${settings.botToken}/sendMediaGroup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: settings.channelId,
      media: remoteOnlyMedia
    })
  });

  const resData = await response.json();
  if (!resData.ok) throw new Error(resData.description || "Telegram API Error");
  return true;
};
