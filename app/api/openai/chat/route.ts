import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { CONTENT_REGISTRY, getContentByPath } from '@/lib/content-registry';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  pageUrl: string;
  pageTitle: string;
  pageContent?: string;
  selectedText?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, pageUrl, pageTitle, pageContent, selectedText } = body;

    // Validate input
    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: messages' },
        { status: 400 }
      );
    }

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' },
        { status: 503 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let pagePath = pageUrl;
    try {
      pagePath = new URL(pageUrl).pathname;
    } catch {
      // Relative paths are already suitable for registry lookup.
    }
    const currentContent = getContentByPath(pagePath);

    const contentLevel = currentContent?.level || 'intermediate';
    const contentTags = currentContent?.tags?.slice(0, 5).join(', ') || 'system design';
    const relatedTopics = currentContent?.related
      ?.slice(0, 3)
      .map(id => CONTENT_REGISTRY.find(c => c.id === id)?.title)
      .filter(Boolean)
      .join(', ') || '';
    const normalizedPageContent = pageContent
      ?.replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12_000);

    const systemPrompt = `You are a precise, practical system design educator helping a ${contentLevel}-level learner.

Current page: "${currentContent?.title || pageTitle}"
Topic tags: ${contentTags}
${relatedTopics ? `Related lessons: ${relatedTopics}` : ''}
${selectedText ? `\nThe learner selected this passage:\n"${selectedText}"` : ''}

${normalizedPageContent ? `\nLesson content:\n${normalizedPageContent}` : ''}

Use the lesson as the primary source of context. Answer the learner's actual question first, explain unfamiliar terms, and connect details to concrete architecture decisions or failure modes. If the lesson does not support a claim, say so instead of inventing specifics. Stay concise by default, but use short bullets or a worked example when that makes the answer clearer.`;

    console.log(`💬 Processing chat message for: ${pageTitle}`);

    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 500,
      presence_penalty: 0.3,
      frequency_penalty: 0.3,
      stream: true,
    });

    // Create a ReadableStream to stream the response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          console.error('❌ Error in stream:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('❌ Error generating chat response:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate response',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
