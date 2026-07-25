import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { CONTENT_REGISTRY } from '@/lib/content-registry';

interface ExplainRequest {
  selectedText: string;
  context: string;
  pageUrl: string;
  pageTitle: string;
  pageContent?: string; // Full page content for better context
}

export async function POST(request: NextRequest) {
  try {
    const body: ExplainRequest = await request.json();
    const { selectedText, context, pageUrl, pageTitle, pageContent } = body;

    // Validate input
    if (!selectedText || selectedText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: selectedText' },
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

    // Create concise prompt for faster response
    const systemPrompt = `You are a system design educator. Explain concepts clearly and concisely (2-4 sentences) for ${contentLevel} learners.`;

    // Use page content if available, otherwise fall back to context
    const contextInfo = pageContent
      ? `Page content:\n${pageContent.slice(0, 2000)}${pageContent.length > 2000 ? '...' : ''}`
      : context
        ? `Context: "${context}"`
        : '';

    const userPrompt = `Studying: "${pageTitle}" (${section})
Selected: "${selectedText}"

${contextInfo}

Explain "${selectedText}" briefly: what it means, why it matters, and a simple example.`;

    console.log(`🤖 Generating explanation for: "${selectedText}" on page: ${pageTitle}`);

    // Generate streaming explanation using GPT-4
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using the faster, cheaper model for quick explanations
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 300, // Keep explanations concise
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
    console.error('❌ Error generating explanation:', error);
    
    // Provide fallback for common terms if API fails
    const fallbackExplanations: Record<string, string> = {
      'load balancing': 'Load balancing distributes incoming network traffic across multiple servers to ensure no single server becomes overwhelmed. This improves application availability, reliability, and scalability by preventing any single point of failure.',
      'caching': 'Caching stores frequently accessed data in fast storage (like memory) to reduce database queries and improve response times. It\'s a key technique for scaling applications and reducing latency.',
      'microservices': 'Microservices architecture breaks applications into small, independent services that communicate via APIs. Each service handles a specific business function and can be developed, deployed, and scaled independently.',
      'database sharding': 'Database sharding splits a large database into smaller, more manageable pieces called shards. Each shard holds a subset of the data, allowing horizontal scaling and improved query performance.',
      'message queue': 'Message queues enable asynchronous communication between services by temporarily storing messages. This decouples services, improves fault tolerance, and helps manage traffic spikes.',
    };

    const selectedLower = (error as any)?.selectedText?.toLowerCase() || '';
    const fallback = Object.entries(fallbackExplanations).find(([key]) => 
      selectedLower.includes(key)
    )?.[1];

    if (fallback) {
      return NextResponse.json({
        explanation: fallback,
        selectedText: (error as any)?.selectedText || '',
        metadata: {
          source: 'fallback',
        }
      });
    }

    return NextResponse.json(
      { 
        error: 'Failed to generate explanation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}