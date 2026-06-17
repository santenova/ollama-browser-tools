import ollama from 'ollama'

export async function thinkingEnabled() {
  const response = await ollama.chat({
    model: 'gpt-oss:20b',
    messages: [
      {
        role: 'user',
        content: 'What is 10 + 23',
      },
    ],
    stream: true,
    think: true,
  })
}

