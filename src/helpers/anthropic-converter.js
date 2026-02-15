/**
 * Convert OpenAI-style responses to Anthropic-style format
 * 
 * OpenAI format:
 * {
 *   "choices": [{
 *     "message": {
 *       "role": "assistant",
 *       "content": "text response",
 *       "tool_calls": [{
 *         "id": "call_123",
 *         "type": "function",
 *         "function": {
 *           "name": "function_name",
 *           "arguments": "{\"param\":\"value\"}"
 *         }
 *       }]
 *     }
 *   }]
 * }
 * 
 * Anthropic format:
 * {
 *   "id": "msg_123",
 *   "type": "message",
 *   "role": "assistant",
 *   "content": [
 *     {
 *       "type": "text",
 *       "text": "text response"
 *     },
 *     {
 *       "type": "tool_use",
 *       "id": "call_123",
 *       "name": "function_name",
 *       "input": {"param": "value"}
 *     }
 *   ],
 *   "model": "...",
 *   "stop_reason": "tool_use",
 *   "usage": {
 *     "input_tokens": 123,
 *     "output_tokens": 45
 *   }
 * }
 */

function convertOpenAIToAnthropic(openaiResponse) {
  const choice = openaiResponse.choices?.[0];
  if (!choice) {
    throw new Error("No choices in OpenAI response");
  }

  const message = choice.message;
  const content = [];

  // Add text content if present
  if (message.content && message.content.trim()) {
    content.push({
      type: "text",
      text: message.content
    });
  }

  // Convert tool calls to Anthropic format
  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      if (toolCall.type === "function") {
        content.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments)
        });
      }
    }
  }

  // Map finish_reason to stop_reason
  const finishReasonMap = {
    "stop": "end_turn",
    "length": "max_tokens",
    "tool_calls": "tool_use",
    "content_filter": "end_turn"
  };
  
  const stopReason = finishReasonMap[choice.finish_reason] || "end_turn";

  // Build Anthropic-style response
  const anthropicResponse = {
    id: openaiResponse.id || `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content: content,
    model: openaiResponse.model,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: openaiResponse.usage?.prompt_tokens || 0,
      output_tokens: openaiResponse.usage?.completion_tokens || 0
    }
  };

  return anthropicResponse;
}

/**
 * Convert OpenAI streaming chunk to Anthropic streaming format
 */
function convertOpenAIStreamToAnthropic(openaiChunk) {
  // Parse SSE data
  const lines = openaiChunk.toString().split('\n');
  const anthropicChunks = [];

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    
    const dataStr = line.slice(6);
    if (dataStr === '[DONE]') {
      anthropicChunks.push('event: message_stop\ndata: {"type":"message_stop"}\n\n');
      continue;
    }

    try {
      const data = JSON.parse(dataStr);
      const delta = data.choices?.[0]?.delta;
      
      if (!delta) continue;

      // Handle content delta
      if (delta.content) {
        const chunk = {
          type: "content_block_delta",
          index: 0,
          delta: {
            type: "text_delta",
            text: delta.content
          }
        };
        anthropicChunks.push(`event: content_block_delta\ndata: ${JSON.stringify(chunk)}\n\n`);
      }

      // Handle tool call deltas
      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.function?.name) {
            const chunk = {
              type: "content_block_start",
              index: toolCall.index || 0,
              content_block: {
                type: "tool_use",
                id: toolCall.id,
                name: toolCall.function.name
              }
            };
            anthropicChunks.push(`event: content_block_start\ndata: ${JSON.stringify(chunk)}\n\n`);
          }
          
          if (toolCall.function?.arguments) {
            const chunk = {
              type: "content_block_delta",
              index: toolCall.index || 0,
              delta: {
                type: "input_json_delta",
                partial_json: toolCall.function.arguments
              }
            };
            anthropicChunks.push(`event: content_block_delta\ndata: ${JSON.stringify(chunk)}\n\n`);
          }
        }
      }
    } catch (err) {
      // Skip invalid JSON
      continue;
    }
  }

  return anthropicChunks.join('');
}

module.exports = {
  convertOpenAIToAnthropic,
  convertOpenAIStreamToAnthropic
};
