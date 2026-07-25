async function expandQuery(originalQuery) {
  const expansion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{
      role: 'user',
      content: `Generate 3 alternative phrasings of this query: "${originalQuery}"`,
    }],
  });

  return [originalQuery, ...expansion.choices[0].message.content.split('\n')];
}
