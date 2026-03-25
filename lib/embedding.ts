import OpenAI from "openai";
import { average } from "@/lib/utils";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function localEmbedding(text: string) {
  const buckets = Array.from({ length: 12 }, () => 0);

  for (let index = 0; index < text.length; index += 1) {
    buckets[index % buckets.length] += text.charCodeAt(index) / 255;
  }

  return buckets.map((value, index) => Number((value / (text.length || 1) + index * 0.02).toFixed(6)));
}

export async function embedText(text: string) {
  if (!openai) {
    return localEmbedding(text);
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000)
  });

  return response.data[0]?.embedding ?? localEmbedding(text);
}

export function projectEmbedding(vector: number[]) {
  const x = average(vector.filter((_, index) => index % 2 === 0));
  const y = average(vector.filter((_, index) => index % 2 === 1));

  return {
    x: Number((x * 100).toFixed(3)),
    y: Number((y * 100).toFixed(3))
  };
}
