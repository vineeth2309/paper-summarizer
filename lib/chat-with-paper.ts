import OpenAI from "openai";
import { getOpenAIModel } from "@/lib/openai-config";
import { prisma } from "@/lib/prisma";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function buildGroundingPack(paper: Awaited<ReturnType<typeof getPaperForChat>>) {
  if (!paper) {
    return "";
  }

  return [
    `Paper: ${paper.title}`,
    `Abstract: ${paper.abstract ?? "N/A"}`,
    `Summary: ${JSON.stringify(paper.summaryData ?? {}, null, 2)}`,
    `Sections: ${paper.sections.slice(0, 8).map((section) => `${section.heading ?? "Section"}: ${section.content.slice(0, 700)}`).join("\n\n")}`,
    `Figures: ${paper.figures.map((figure) => `${figure.label}: ${figure.caption ?? "No caption"}`).join("\n")}`,
    `References: ${paper.references.map((reference) => `${reference.citeKey ?? ""} ${reference.title ?? reference.rawText}`).join("\n")}`
  ].join("\n\n");
}

async function getPaperForChat(paperId: string) {
  return prisma.paper.findUnique({
    where: { id: paperId },
    include: {
      sections: {
        orderBy: {
          orderIndex: "asc"
        }
      },
      figures: true,
      references: true
    }
  });
}

export async function askPaperQuestion(params: {
  userId: string;
  paperId: string;
  threadId: string;
  question: string;
}) {
  const paper = await getPaperForChat(params.paperId);

  if (!paper || paper.userId !== params.userId) {
    throw new Error("Paper not found.");
  }

  await prisma.chatMessage.create({
    data: {
      threadId: params.threadId,
      role: "user",
      content: params.question
    }
  });

  const grounding = buildGroundingPack(paper);
  let answer = "I could not answer that from the available paper context.";

  if (!openai) {
    answer = `OpenAI is not configured, so this is a grounded local fallback.\n\nQuestion: ${params.question}\n\nPaper abstract: ${paper.abstract ?? "No abstract available."}`;
  } else {
    const response = await openai.chat.completions.create({
      model: getOpenAIModel("chat"),
      messages: [
        {
          role: "system",
          content:
            "You are a paper reading assistant. Answer only from the provided paper context. Mention uncertainty when the paper does not support a claim."
        },
        {
          role: "user",
          content: `${grounding}\n\nQuestion: ${params.question}`
        }
      ]
    });

    answer = response.choices[0]?.message.content ?? answer;
  }

  const assistantMessage = await prisma.chatMessage.create({
    data: {
      threadId: params.threadId,
      role: "assistant",
      content: answer
    }
  });

  return assistantMessage;
}
