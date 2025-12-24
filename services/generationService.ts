
import { GoogleGenAI, Type } from "@google/genai";
import { GenerationSettings, KieSettings, OpenRouterSettings, SystemInstructions, TelegramSettings } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function extractJson(text: string) {
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
    throw new Error(`Invalid JSON. Output: ${text.substring(0, 100)}...`);
  }
}

async function callOpenRouter(prompt: string, apiKey: string, model: string, systemInstruction: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`OpenRouter Error ${response.status}`);
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

export const regeneratePostCaption = async (
  topic: string,
  imagePrompts: string[],
  settings: GenerationSettings,
  instructions: SystemInstructions,
  openRouterSettings?: OpenRouterSettings,
  refinement?: string
) => {
  let captionInput = `Topic: ${topic}. Slide contents:\n` + imagePrompts.map((p, i) => `${i+1}: ${p}`).join('\n');
  if (refinement && refinement.trim() !== "") {
    captionInput += `\n\nREFINEMENT INSTRUCTIONS FROM USER: ${refinement}. Please rewrite the caption incorporating this feedback.`;
  }
  
  if (settings.textService === 'openrouter' && openRouterSettings?.apiKey) {
    return await callOpenRouter(captionInput, openRouterSettings.apiKey, settings.openrouterModel, instructions.captionGenerator);
  } else {
    return await callGeminiText(captionInput, instructions.captionGenerator, false);
  }
};

export const regenerateSingleImage = async (
  originalPrompt: string,
  settings: GenerationSettings,
  kieSettings?: KieSettings,
  refinement?: string
) => {
  const styleSuffix = (settings.style && settings.style !== 'None / Custom') ? `. Visual style: ${settings.style}. ` : '. ';
  let fullPrompt = `${originalPrompt}${styleSuffix}${settings.customStylePrompt}. High quality, 4k, professional photography.`;
  
  if (refinement && refinement.trim() !== "") {
    fullPrompt += ` USER REQUESTED CHANGES: ${refinement}. Ensure visual adjustments reflect this.`;
  }
  
  const validRefImages = settings.referenceImages.filter(url => url.trim() !== '');

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
    if (data) return `data:image/png;base64,${data}`;
  } else if (settings.imageService === 'kie' && kieSettings?.apiKey) {
    const kieInput: any = { prompt: fullPrompt, aspect_ratio: settings.aspectRatio, resolution: "1K" };
    if (validRefImages.length > 0) kieInput.image_input = validRefImages;

    const create = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${kieSettings.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: "nano-banana-pro", input: kieInput })
    }).then(r => r.json());
    
    if (create.code === 200) {
      // Increased timeout: 120 attempts * 4s = 480s (8 minutes)
      for (let attempt = 0; attempt < 120; attempt++) {
        await sleep(4000);
        const poll = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${create.data.taskId}`, { 
          headers: { 'Authorization': `Bearer ${kieSettings.apiKey}` } 
        }).then(r => r.json());
        
        if (poll.data?.state === 'success') {
          const res = JSON.parse(poll.data.resultJson);
          return res.resultUrls[0];
        } else if (poll.data?.state === 'failed') {
          throw new Error(`Kie job failed: ${poll.data.reason || 'Unknown error'}`);
        }
      }
      throw new Error("Kie generation timed out (8 min limit reached)");
    }
  }
  throw new Error("Generation failed");
};

export const generateCarouselBatch = async (
  topic: string,
  settings: GenerationSettings,
  instructions: SystemInstructions,
  kieSettings?: KieSettings,
  openRouterSettings?: OpenRouterSettings,
  refinement?: string
) => {
  let structurePrompt = `Create exactly ${settings.count} visual slide prompts in Russian for a carousel about: "${topic}". 
  Format as JSON: { "prompts": ["Slide 1 visual description with text overlay content", "Slide 2..."] }. 
  Style: ${settings.style}. ${settings.customStylePrompt}`;
  
  if (refinement && refinement.trim() !== "") {
    structurePrompt += `\n\nREFINEMENT REQUESTED: ${refinement}. Adjust the structure and slide contents accordingly.`;
  }
  
  let promptsRaw: string;
  if (settings.textService === 'openrouter' && openRouterSettings?.apiKey) {
    promptsRaw = await callOpenRouter(structurePrompt, openRouterSettings.apiKey, settings.openrouterModel, instructions.imageGenerator);
  } else {
    promptsRaw = await callGeminiText(structurePrompt, instructions.imageGenerator, true);
  }
  
  const promptsData = extractJson(promptsRaw);
  const imagePrompts: string[] = promptsData.prompts || [];
  if (!imagePrompts.length) throw new Error("No prompts generated");

  const captionPromise = regeneratePostCaption(topic, imagePrompts, settings, instructions, openRouterSettings, refinement);

  const imagePromises = imagePrompts.map(async (prompt, i) => {
    try {
      const url = await regenerateSingleImage(prompt, settings, kieSettings, refinement);
      return { id: Math.random().toString(36).substr(2, 9), imageUrl: url, description: prompt };
    } catch (err) {
      console.error(`Slide ${i} failed:`, err);
      return null;
    }
  });

  const [caption, ...imageResults] = await Promise.all([captionPromise, ...imagePromises]);
  const images = imageResults.filter((img): img is any => img !== null);

  if (images.length === 0) throw new Error("All image generations failed.");

  return { images, caption };
};

export const publishToTelegram = async (images: string[], caption: string, settings: TelegramSettings) => {
  if (!settings.botToken || !settings.channelId) throw new Error("Credentials missing");
  const media = images.map((url, idx) => ({
    type: 'photo',
    media: url, 
    caption: idx === 0 ? caption : undefined,
    parse_mode: 'HTML'
  }));
  const response = await fetch(`https://api.telegram.org/bot${settings.botToken}/sendMediaGroup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: settings.channelId, media })
  });
  const resData = await response.json();
  if (!resData.ok) throw new Error(resData.description || "TG Error");
  return true;
};
