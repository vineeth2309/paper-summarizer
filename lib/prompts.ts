import { readFile } from "node:fs/promises";
import path from "node:path";

const promptPath = path.join(process.cwd(), "prompts", "paper-agent.md");

export async function loadPaperAgentPrompt() {
  return readFile(promptPath, "utf8");
}
