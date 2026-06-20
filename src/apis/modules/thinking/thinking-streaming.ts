import ollama from 'ollama'

export async function thinkingStreaming() {
  const response = await ollama.chat({
    model: 'qwen3:8b',
    messages: [
      {
        role: 'user',
        content: 'What is 10 + 23',
      },
    ],
    stream: true,
    think: true,
  })

  let startedThinking = false
  let finishedThinking = false

  for await (const chunk of response) {
    if (chunk.message.thinking && !startedThinking) {
      startedThinking = true
      process.stdout.write('\nthinkingStreaming\tThinking:\n========\n\n')
    } else if (chunk.message.content && startedThinking && !finishedThinking) {
      finishedThinking = true
      process.stdout.write('\nthinkingStreaming\tResponse:\n========\n\n')
    }

    if (chunk.message.thinking) {
      process.stdout.write(chunk.message.thinking)
    } else if (chunk.message.content) {
      process.stdout.write(chunk.message.content)
    }
  }
}

