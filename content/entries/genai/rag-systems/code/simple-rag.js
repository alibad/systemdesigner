import OpenAI from 'openai';
import { PineconeClient } from '@pinecone-database/pinecone';

class SimpleRAG {
  constructor() {
    this.openai = new OpenAI();
    this.pinecone = new PineconeClient();
  }

  async query(userQuestion) {
    const embedding = await this.openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: userQuestion,
    });

    const searchResults = await this.pinecone.query({
      vector: embedding.data[0].embedding,
      topK: 5,
      includeMetadata: true,
    });

    const context = searchResults.matches
      .map((match) => match.metadata.text)
      .join('\n\n');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Answer questions using only the provided context.' },
        { role: 'user', content: `Context: ${context}\n\nQuestion: ${userQuestion}` },
      ],
    });

    return response.choices[0].message.content;
  }
}
