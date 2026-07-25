import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { CONTENT_REGISTRY } from '@/lib/content-registry';

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
      console.error('❌ OPENAI_API_KEY environment variable is not set');
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' },
        { status: 503 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Extract context from URL and content registry
    const pathSegments = pageUrl.split('/').filter(Boolean);
    const section = pathSegments[pathSegments.length - 2] || 'general';
    const topic = pathSegments[pathSegments.length - 1] || 'system-design';

    // Find the current content in registry for more context
    const currentContent = CONTENT_REGISTRY.find(
      content => content.path === `/${pathSegments.join('/')}`
    );

    const contentLevel = currentContent?.level || 'intermediate';
    const contentTags = currentContent?.tags?.slice(0, 5).join(', ') || 'system design';
    const relatedTopics = currentContent?.related?.slice(0, 3)
      .map(id => CONTENT_REGISTRY.find(c => c.id === id)?.title)
      .filter(Boolean)
      .join(', ') || '';

    // Create concise context-aware system prompt
    const systemPrompt = `You are a system design educator helping a ${contentLevel}-level learner.

Context: "${pageTitle}" - ${contentTags}${selectedText ? `\nDiscussing: "${selectedText}"` : ''}

${pageContent ? `\nPage content:\n${pageContent.slice(0, 2000)}${pageContent.length > 2000 ? '...' : ''}` : ''}

Be conversational and concise (2-5 sentences). Use examples from the page content when relevant.`;

    console.log(`💬 Processing chat message for: ${pageTitle}`);

    // Generate streaming response using GPT-4
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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