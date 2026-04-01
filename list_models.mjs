import { OpenAI } from 'openai';
import 'dotenv/config';

const openai = new OpenAI();

async function listModels() {
  try {
    const list = await openai.models.list();
    console.log("=== Available OpenAI Models ===");
    const modelIds = list.data.map(m => m.id).sort();
    modelIds.forEach(id => {
      if (id.includes('gpt') || id.includes('o1') || id.includes('o3')) {
        console.log(`- ${id}`);
      }
    });
  } catch (err) {
    console.error("Error fetching model list:", err.message);
  }
}

listModels();
