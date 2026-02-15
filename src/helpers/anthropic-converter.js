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

  // Ensure content array is not empty (Anthropic requires at least one block)
  if (content.length === 0) {
    content.push({
      type: "text",
      text: message.content || ""
    });
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
 * 
 * This is a stateful converter that needs to track:
 * - Whether we've sent message_start
 * - Which content blocks are active
 * - Tool call accumulation state
 */
class AnthropicStreamConverter {
  constructor() {
    this.messageStartSent = false;
    this.textBlockIndex = 0;
    this.textBlockStarted = false;
    this.toolCallState = new Map(); // Track tool call accumulation by index
  }

  convert(openaiChunk) {
    const lines = openaiChunk.toString().split('\n');
    const anthropicChunks = [];

    // Send message_start on first chunk
    if (!this.messageStartSent) {
      anthropicChunks.push('event: message_start\ndata: {"type":"message_start","message":{"id":"msg_stream","type":"message","role":"assistant","content":[],"model":"unknown","stop_reason":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\n');
      this.messageStartSent = true;
    }

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      
      const dataStr = line.slice(6);
      if (dataStr === '[DONE]') {
        // Close any open content blocks
        if (this.textBlockStarted) {
          anthropicChunks.push('event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n');
        }
        anthropicChunks.push('event: message_stop\ndata: {"type":"message_stop"}\n\n');
        continue;
      }

      try {
        const data = JSON.parse(dataStr);
        const delta = data.choices?.[0]?.delta;
        
        if (!delta) continue;

        // Handle text content delta
        if (delta.content) {
          if (!this.textBlockStarted) {
            // Start text block
            anthropicChunks.push('event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n');
            this.textBlockStarted = true;
          }
          
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
            const idx = toolCall.index || 0;
            
            if (!this.toolCallState.has(idx)) {
              this.toolCallState.set(idx, { id: null, name: null, arguments: '' });
            }
            
            const state = this.toolCallState.get(idx);
            
            if (toolCall.id) {
              state.id = toolCall.id;
            }
            
            if (toolCall.function?.name) {
              state.name = toolCall.function.name;
              
              // Send content_block_start for tool_use
              const blockIndex = this.textBlockStarted ? idx + 1 : idx;
              const chunk = {
                type: "content_block_start",
                index: blockIndex,
                content_block: {
                  type: "tool_use",
                  id: state.id || `call_${idx}`,
                  name: state.name,
                  input: {}
                }
              };
              anthropicChunks.push(`event: content_block_start\ndata: ${JSON.stringify(chunk)}\n\n`);
            }
            
            if (toolCall.function?.arguments) {
              state.arguments += toolCall.function.arguments;
              
              const blockIndex = this.textBlockStarted ? idx + 1 : idx;
              const chunk = {
                type: "content_block_delta",
                index: blockIndex,
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
}

function convertOpenAIStreamToAnthropic(openaiChunk) {
  // For backward compatibility, create a converter instance
  // In production, this should be created once per stream
  if (!convertOpenAIStreamToAnthropic._converter) {
    convertOpenAIStreamToAnthropic._converter = new AnthropicStreamConverter();
  }
  return convertOpenAIStreamToAnthropic._converter.convert(openaiChunk);
}

module.exports = {
  convertOpenAIToAnthropic,
  convertOpenAIStreamToAnthropic,
  AnthropicStreamConverter
};
