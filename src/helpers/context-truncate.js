/**
 * Context Truncation Helper
 * 
 * Intelligently truncates conversation history to fit within model context limits.
 * 
 * Strategy:
 * - Keeps ALL system messages (role="system") - these define behavior
 * - Uses sliding window for user/assistant messages
 * - Keeps most recent messages (they're most relevant)
 * - Adds truncation notice if messages were removed
 * - Handles multimodal content (text + images)
 */

/**
 * Estimate token count from text
 * Aggressive approximation to prevent underestimation
 * - 1 token ≈ 2.5 characters (conservative for technical content)
 * - Apply 1.3x safety multiplier for markdown, code, special chars
 */
function estimateTokens(text) {
  if (!text) return 0;
  const baseTokens = Math.ceil(text.length / 2.5);
  // Safety multiplier: technical content tokenizes more heavily
  return Math.ceil(baseTokens * 1.3);
}

/**
 * Count tokens in a message (handles multimodal content)
 */
function countMessageTokens(message) {
  if (!message) return 0;
  
  let tokens = 0;
  
  // Handle content as array (multimodal format)
  if (Array.isArray(message.content)) {
    for (const item of message.content) {
      if (item.type === 'text' && item.text) {
        tokens += estimateTokens(item.text);
      } else if (item.type === 'image_url') {
        // Images consume significant tokens (rough estimate: 256-512 tokens per image)
        tokens += 400;
      }
    }
  } 
  // Handle content as string (text-only format)
  else if (typeof message.content === 'string') {
    tokens += estimateTokens(message.content);
  }
  
  // Add overhead for role and structure (~10 tokens)
  tokens += 10;
  
  return tokens;
}

/**
 * Truncate messages array to fit within maxInputTokens
 * 
 * @param {Array} messages - Original messages array
 * @param {number} maxInputTokens - Maximum tokens allowed for input
 * @returns {Object} { messages: Array, stats: Object }
 */
function truncateContext(messages, maxInputTokens) {
  if (!messages || !Array.isArray(messages)) {
    return { messages: [], stats: { original: 0, truncated: 0, removed: 0 } };
  }
  
  // Separate system messages from conversation
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  // Count tokens in system messages (these are always kept)
  let systemTokens = 0;
  for (const msg of systemMessages) {
    systemTokens += countMessageTokens(msg);
  }
  
  // Reserve tokens for output + safety margin (500 tokens)
  const safetyMargin = 500;
  const availableForConversation = maxInputTokens - systemTokens - safetyMargin;
  
  if (availableForConversation <= 0) {
    // System messages alone exceed limit - keep only system messages
    return {
      messages: systemMessages,
      stats: {
        original: messages.length,
        truncated: systemMessages.length,
        removed: conversationMessages.length,
        systemTokens,
        conversationTokens: 0,
        limit: maxInputTokens
      }
    };
  }
  
  // Build conversation from most recent backwards until we hit token limit
  const keptConversation = [];
  let conversationTokens = 0;
  
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i];
    const msgTokens = countMessageTokens(msg);
    
    // Check if adding this message would exceed limit
    if (conversationTokens + msgTokens > availableForConversation) {
      break;
    }
    
    keptConversation.unshift(msg); // Add to beginning (we're going backwards)
    conversationTokens += msgTokens;
  }
  
  // Build final messages array
  let finalMessages = [...systemMessages];
  
  // Add truncation notice if we removed messages
  const removedCount = conversationMessages.length - keptConversation.length;
  if (removedCount > 0) {
    finalMessages.push({
      role: 'system',
      content: `[Context truncated: ${removedCount} older messages removed to fit ${maxInputTokens} token limit. Conversation continues below.]`
    });
  }
  
  finalMessages = [...finalMessages, ...keptConversation];
  
  return {
    messages: finalMessages,
    stats: {
      original: messages.length,
      truncated: finalMessages.length,
      removed: removedCount,
      systemTokens,
      conversationTokens,
      limit: maxInputTokens
    }
  };
}

module.exports = {
  truncateContext,
  estimateTokens,
  countMessageTokens
};
