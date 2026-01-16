
import { GoogleGenAI, Type } from "@google/genai";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // The result includes the Base64 prefix, which we need to remove.
        resolve(reader.result.split(',')[1]);
      } else {
        resolve(''); // Or handle ArrayBuffer case if necessary
      }
    };
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export async function analyzeImage(imageFile: File): Promise<{ colors: string[], tags: string[] }> {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          imagePart,
          {
            text: "Analyze this image. Identify the 5 most dominant colors and generate 3-4 descriptive tags based on the color palette (e.g., 'Warm Tones', 'Cool Blues', 'Earthy', 'Monochromatic', 'Vibrant'). Return a JSON object with two keys: 'colors' (an array of hex color codes) and 'tags' (an array of strings). Example: {\"colors\": [\"#RRGGBB\"], \"tags\": [\"Earthy\", \"Muted\"]}. Only return the JSON object."
          }
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            colors: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
                description: 'A hex color code, e.g., #FFFFFF'
              }
            },
            tags: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
                description: 'A descriptive color tag, e.g., Warm Tones'
              }
            }
          }
        }
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      const colors = (parsed.colors && Array.isArray(parsed.colors)) ? parsed.colors : [];
      const tags = (parsed.tags && Array.isArray(parsed.tags)) ? parsed.tags : [];
      return { colors, tags };
    }
    return { colors: [], tags: [] };

  } catch (error) {
    console.error("Error analyzing image:", error);
    // Propagate the error to be handled by the caller
    throw new Error(`Failed to analyze image with Gemini API. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
}
