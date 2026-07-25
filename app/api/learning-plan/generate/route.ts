import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { CONTENT_REGISTRY } from '@/lib/content-registry';
import { createLearningPlan, FirebaseLearningPlan } from '@/lib/firebase-learning-plans';
import { getUserLearningProgress } from '@/lib/firebase';

interface GenerateLearningPlanRequest {
  userGoal: string;
  userId?: string;
}

interface OpenAILearningPlanResponse {
  title: string;
  description: string;
  topics: string[]; // Just an array of content IDs
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateLearningPlanRequest = await request.json();
    const { userGoal, userId } = body;

    // Validate input
    if (!userGoal || userGoal.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: userGoal' },
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

    // Get user's completed topics for personalization
    let targetUserId = userId;
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get user's learning progress for personalization
    let completedTopics: any[] = [];
    try {
      const userProgress = await getUserLearningProgress(targetUserId);
      completedTopics = userProgress || [];
    } catch (error) {
      // If user progress fetch fails, continue without personalization
      console.error('Failed to fetch user progress, continuing without personalization:', error);
    }

    // Prepare content registry for AI with better context
    const contentSummary = CONTENT_REGISTRY
      .filter(node => node.status === 'active')
      .map(node => ({
        id: node.id,
        title: node.title,
        section: node.section,
        level: node.level,
        duration: node.duration,
        tags: node.tags.slice(0, 4),
        prerequisites: node.prerequisites.slice(0, 2),
        hasQuiz: node.hasQuiz,
        hasScenarios: node.hasScenarios,
        related: node.related.slice(0, 2)
      }));

    // Create comprehensive prompt with better structure for quality
    const prompt = `You are an expert learning path designer. Create a comprehensive, well-structured learning plan.

USER GOAL: "${userGoal}"

USER'S COMPLETED TOPICS: ${completedTopics.length > 0 ? 
  `The user has already completed these topics:
${JSON.stringify(completedTopics, null, 2)}

IMPORTANT: TTry not toinclude these completed topics in the new learning plan. Instead:
- Build upon this existing knowledge as prerequisites
- Suggest more advanced topics that build on completed ones
- Consider the user's demonstrated skill level from completed topics
- Reference completed topics when explaining prerequisites` : 
  'The user is starting fresh with no completed topics.'}

INSTRUCTIONS: Analyze the user's goal to infer their skill level and desired scope. Look for clues like:
- "basics", "fundamentals", "introduction" → beginner level, shorter plan
- "advanced", "deep dive", "master" → advanced level, comprehensive plan  
- "overview", "quick" → shorter, focused plan
- "complete", "comprehensive" → longer, thorough plan

AVAILABLE CONTENT:
${JSON.stringify(contentSummary, null, 2)}

DETAILED INSTRUCTIONS:
1. Analyze the user's goal to infer appropriate skill level and scope
2. Select 6-15 most relevant topics based on the inferred scope (fewer for "quick" goals, more for "comprehensive")
3. Consider prerequisites and learning progression - check the "prerequisites" field
4. Balance theory with practical application - mix sections when possible
5. Include foundational concepts before advanced topics
6. Match the difficulty level to what the user is asking for
7. Create a compelling title and detailed description explaining the learning journey

QUALITY CRITERIA:
- Logical learning progression (fundamentals → intermediate → advanced)
- Prerequisite dependencies respected (check prerequisites field)
- Build appropriately on the user's existing knowledge
- Mix of different content types when possible (hasQuiz, hasScenarios)
- Appropriate difficulty curve for skill level
- Clear learning objectives and outcomes
- Consider related topics for comprehensive coverage

Respond with well-structured JSON:
{
  "title": "Compelling, specific plan title (e.g., 'Complete System Design Mastery Path')",
  "description": "Detailed 2-3 sentence description explaining what the learner will achieve and why this progression makes sense",
  "topics": ["topic-id-1", "topic-id-2", "topic-id-3", ...]
}`;

    // Call OpenAI API
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    console.log('🤖 Making OpenAI API call with model:', model);
    console.log('📏 Prompt size:', prompt.length, 'characters');
    console.log('📊 Content items:', contentSummary.length);
    
    const startTime = Date.now();
    
    let aiResponse: string | undefined;
    
    if (model === 'gpt-5-nano') {
      // Use the new responses API for gpt-5-nano
      const response = await openai.responses.create({
        model: "gpt-5-nano",
        input: [
          {
            role: 'system',
            content: 'You are an expert system design educator. Respond only with valid JSON, no markdown formatting.',

          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        text: {
          "format": {
            "type": "text"
          },
          "verbosity": "medium"
        },
        reasoning: {
          "effort": "low"
        },
        tools: [],
        store: true,
        include: [
          "reasoning.encrypted_content"
        ]
      });
      
      const duration = Date.now() - startTime;
      console.log('✅ OpenAI responses API response received in', duration, 'ms');
      console.log('🔍 Response structure:', {
        hasOutputText: !!response.output_text,
        outputText: response.output_text?.substring(0, 100) + '...',
        allKeys: Object.keys(response)
      });
      aiResponse = response.output_text;
    } else {
      // Use standard chat completions for other models
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert system design educator. Respond only with valid JSON, no markdown formatting.',

          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_completion_tokens: 2000,
      });

      const duration = Date.now() - startTime;
      console.log('✅ OpenAI chat API response received in', duration, 'ms:', {
        choices: completion.choices?.length,
        usage: completion.usage,
        firstChoice: completion.choices[0]?.message?.content?.substring(0, 100) + '...'
      });

      aiResponse = completion.choices[0]?.message?.content || undefined;
    }
    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // Parse AI response
    let aiPlan: OpenAILearningPlanResponse;
    try {
      // Clean up response in case of markdown formatting
      const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
      aiPlan = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('Invalid AI response format');
    }

    // Validate topics exist in content registry and aren't already completed
    const completedTopicIds = completedTopics.map(t => t?.id).filter(Boolean);
    const validTopics = aiPlan.topics.filter(topicId => {
      const contentExists = CONTENT_REGISTRY.some(node => node.id === topicId);
      const alreadyCompleted = completedTopicIds.includes(topicId);
      
      if (!contentExists) {
        console.warn(`Content ID not found: ${topicId}`);
        return false;
      }
      
      if (alreadyCompleted) {
        console.warn(`Skipping already completed topic: ${topicId}`);
        return false;
      }
      
      return true;
    });

    if (validTopics.length === 0) {
      throw new Error('No valid topics found in AI response');
    }

    const filteredCount = aiPlan.topics.length - validTopics.length;
    if (filteredCount > 0) {
      console.log(`🔄 Filtered out ${filteredCount} topics (already completed or invalid)`);
    }
    
    console.log(`✅ Final learning plan: ${validTopics.length} topics selected`);

    // Simple badge logic - we can add this back later if needed
    // For now, just focus on the core functionality

    // Create simple learning plan data
    const learningPlanData: Omit<FirebaseLearningPlan, 'id' | 'userId' | 'slug' | 'createdAt' | 'updatedAt'> = {
      title: aiPlan.title,
      description: aiPlan.description,
      userGoal,
      topics: validTopics, // Just the array of content IDs
      status: 'active',
      skillLevel: 'beginner', // Default - AI determines actual difficulty in topic selection
    };

    // Return the generated plan data (client will save to Firebase)
    return NextResponse.json({
      success: true,
      plan: {
        ...learningPlanData,
        userId: targetUserId,
        topics: validTopics, // Just the array of content IDs
        totalTopics: validTopics.length, // Add this for UI compatibility
      },
    });

  } catch (error) {
    console.error('❌ Error generating learning plan:', error);
    
    // Return appropriate error response
    if (error instanceof Error) {
      console.error('❌ Error message:', error.message);
      
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' },
          { status: 503 }
        );
      }
      
      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'AI service temporarily unavailable due to high demand' },
          { status: 429 }
        );
      }

      // Return the actual error message in development
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json(
          { 
            error: 'Failed to generate learning plan. Please try again.',
            debug: error.message
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate learning plan. Please try again.' },
      { status: 500 }
    );
  }
}
