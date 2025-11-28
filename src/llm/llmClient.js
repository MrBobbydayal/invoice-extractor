import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const PROVIDER = process.env.LLM_PROVIDER || "groq";

export async function callLLM(prompt) {
  if (PROVIDER === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.LLM_MODEL;

    if (!apiKey || !model) {
      throw new Error("Missing GROQ_API_KEY or LLM_MODEL");
    }

    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: model,
          messages: [
            {
              role: "system",
              content: "You are an expert JSON invoice extractor.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0,
          max_tokens: 2048,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 120000,
        }
      );

      return (
        response.data?.choices?.[0]?.message?.content ||
        JSON.stringify(response.data)
      );
    } catch (error) {
      console.error("Groq LLM ERROR:", error.response?.data || error.message);
      throw new Error("Groq request failed");
    }
  }

  throw new Error("Unsupported LLM_PROVIDER");
}
