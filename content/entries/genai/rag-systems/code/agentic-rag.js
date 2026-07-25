class AgenticRAG {
  constructor() {
    this.openai = new OpenAI();
    this.tools = {
      vectorSearch: this.vectorSearch.bind(this),
      webSearch: this.webSearch.bind(this),
      sqlQuery: this.sqlQuery.bind(this),
      calculator: this.calculator.bind(this),
    };
  }

  async query(userQuestion) {
    const plan = await this.createRetrievalPlan(userQuestion);
    const gatheredInfo = await this.executeRetrievalPlan(plan);
    return this.synthesizeAnswer(userQuestion, gatheredInfo);
  }

  async createRetrievalPlan(question) {
    const planningPrompt = `
Analyze this question and create a step-by-step plan to gather information:

Question: ${question}

Available tools:
- vectorSearch: Search internal knowledge base
- webSearch: Search current web information
- sqlQuery: Query structured databases
- calculator: Perform calculations

Create a JSON plan whose steps contain tool, query or expression, and reason.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: planningPrompt }],
    });
    return JSON.parse(response.choices[0].message.content);
  }

  async executeRetrievalPlan(plan) {
    const results = [];
    for (const step of plan.steps) {
      try {
        const result = await this.tools[step.tool](step.query || step.expression);
        results.push({ step, result, success: true });
      } catch (error) {
        results.push({ step, error: error.message, success: false });
      }
    }
    return results;
  }

  async synthesizeAnswer(question, gatheredInfo) {
    const successfulInfo = gatheredInfo
      .filter((info) => info.success)
      .map((info) => `${info.step.reason}: ${JSON.stringify(info.result)}`)
      .join('\n\n');
    const synthesisPrompt = `
Question: ${question}

Gathered Information:
${successfulInfo}

Synthesize a comprehensive answer. Explain missing or contradictory information.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: synthesisPrompt }],
    });
    return response.choices[0].message.content;
  }

  async vectorSearch(query) {
    const embedding = await this.openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: query,
    });
    return this.pinecone.query({
      vector: embedding.data[0].embedding,
      topK: 5,
      includeMetadata: true,
    });
  }
}
