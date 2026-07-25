class ProductionRAG {
  constructor(options = {}) {
    this.openai = new OpenAI();
    this.pinecone = new PineconeClient();
    this.cache = new Map();
    this.options = {
      maxRetrieval: 10,
      maxContextTokens: 8000,
      temperature: 0.1,
      ...options,
    };
  }

  async query(userQuestion, conversationHistory = []) {
    try {
      const processedQuery = await this.preprocessQuery(userQuestion, conversationHistory);
      const cacheKey = this.getCacheKey(processedQuery);
      if (this.cache.has(cacheKey)) {
        return this.generateWithCache(processedQuery, cacheKey);
      }

      const [vectorResults, keywordResults] = await Promise.all([
        this.vectorSearch(processedQuery),
        this.keywordSearch(processedQuery),
      ]);
      const rankedResults = await this.hybridRank(vectorResults, keywordResults, processedQuery);
      const optimizedContext = this.optimizeContext(rankedResults, this.options.maxContextTokens);
      const response = await this.generateStreamingResponse(
        processedQuery,
        optimizedContext,
        conversationHistory,
      );

      this.cache.set(cacheKey, { context: optimizedContext, timestamp: Date.now() });
      return response;
    } catch (error) {
      return this.handleError(error, userQuestion);
    }
  }

  async preprocessQuery(query, history) {
    if (history.length === 0) return query;
    const contextPrompt = `
Given this conversation history and current question,
rewrite the question to be self-contained:

History: ${history.slice(-3).map((item) => `${item.role}: ${item.content}`).join('\n')}
Current: ${query}

Rewritten:`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: contextPrompt }],
      temperature: 0,
    });
    return response.choices[0].message.content.trim();
  }

  async hybridRank(vectorResults, keywordResults) {
    const allResults = new Map();
    vectorResults.forEach((result) => {
      allResults.set(result.id, { ...result, vectorScore: result.score, keywordScore: 0 });
    });
    keywordResults.forEach((result) => {
      if (allResults.has(result.id)) {
        allResults.get(result.id).keywordScore = result.score;
      } else {
        allResults.set(result.id, { ...result, vectorScore: 0, keywordScore: result.score });
      }
    });

    return Array.from(allResults.values())
      .map((result) => ({
        ...result,
        hybridScore: result.vectorScore * 0.7 + result.keywordScore * 0.3,
      }))
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, this.options.maxRetrieval);
  }

  async generateStreamingResponse(query, context, history) {
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant that answers questions using the provided context.

INSTRUCTIONS:
1. Use ONLY information from the context
2. If context doesn't contain the answer, say so clearly
3. Cite sources with [1], [2] etc.
4. Be concise but complete
5. Consider the conversation history for context

Context:
${context.map((doc, index) => `[${index + 1}] ${doc.content}`).join('\n\n')}`,
      },
      ...history,
      { role: 'user', content: query },
    ];

    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: this.options.temperature,
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      this.emit('chunk', content);
    }
    return fullResponse;
  }

  handleError(error) {
    console.error('RAG Error:', error);
    if (error.code === 'context_length_exceeded') {
      return "I found relevant information but it's too extensive to process. Please ask a more specific question.";
    }
    if (error.code === 'rate_limit_exceeded') {
      return "I'm experiencing high demand. Please try again in a moment.";
    }
    return 'I encountered an error while searching for information. Please try rephrasing your question.';
  }
}
