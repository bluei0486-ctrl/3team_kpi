import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    console.log("Testing API Key:", process.env.GEMINI_API_KEY);
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Hello, answer with exactly one word: YES",
    });
    console.log("Success! Response:", response.text);
  } catch (error) {
    console.error("API Test Failed:");
    console.error(error);
  }
}

test();
