# Public System Prompts Directory

This directory contains **public/committed** system prompt files that can be referenced in `models.json`.

## Public vs Private Prompts

- **`prompts/`** (this directory) - Public prompts committed to git
- **`.env/prompts/`** - Private prompts (git-ignored, for secrets)

When using relative paths like `"prompts/file.md"`, the system checks:
1. `.env/prompts/file.md` (private) - First
2. `prompts/file.md` (public) - Fallback

This allows private prompts to override public ones without changing configuration.

## Available Prompts

### Category-Optimized Prompts

Each prompt is specifically tailored for its use case:

| Prompt File | Category | Purpose | Model |
|-------------|----------|---------|-------|
| `tools-expert.md` | tools | Function calling, tool usage, structured output | qwen2.5-7b-instruct |
| `coding-expert.md` | code | Programming, code generation, software engineering | qwen2.5-coder-7b-instruct |
| `deep-thinker.md` | reason | Complex reasoning, analysis, problem-solving | qwen2.5-14b-instruct |
| `chat-assistant.md` | chat | Casual conversation, quick responses, friendly | qwen2.5-1.5b-instruct |
| `general-assistant.md` | default | General-purpose, versatile assistance | qwen2.5-7b-instruct |

### Prompt Characteristics

**tools-expert.md** (~1.5KB)
- Function selection and parameter extraction
- Structured output formatting
- Error handling and validation
- Optimized for tool/API interactions

**coding-expert.md** (~2.1KB)
- Production-quality code generation
- Best practices and design patterns
- Documentation and error handling
- Language-specific conventions

**deep-thinker.md** (~3.1KB)
- Systematic analysis and reasoning
- First-principles thinking
- Multiple perspectives and frameworks
- Intellectual honesty about limitations

**chat-assistant.md** (~1.9KB)
- Conversational and concise
- Friendly but professional tone
- Quick, direct responses
- Natural language style

**general-assistant.md** (~2.5KB)
- Balanced versatility
- Clear communication
- Accuracy and helpfulness
- Adapts to various task types

## Usage

### In Category Configs (lols-smart)

```json
"lols-smart": {
  "code": {
    "model": "qwen2.5-coder-7b-instruct",
    "systemPromptPath": "prompts/coding-expert.md"
  }
}
```

### In Model Configs

```json
"qwen2.5-coder-7b-instruct": {
  "type": "llama-cpp",
  "repo": "bartowski/Qwen2.5-Coder-7B-Instruct-GGUF",
  "file": "Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf",
  "port": 8022,
  "systemPromptPath": "prompts/coding-expert.md"
}
```

## Path Resolution

- **Relative paths**: Resolved from project root
  - `"prompts/coding-expert.md"` → `/path/to/lols-router/prompts/coding-expert.md`
- **Absolute paths**: Used as-is
  - `"/etc/prompts/custom.md"` → `/etc/prompts/custom.md`
- **Tilde paths**: Expanded to home directory
  - `"~/my-prompts/custom.md"` → `/home/user/my-prompts/custom.md`

## Priority

System prompts are resolved in this order (highest to lowest):

1. **Category systemPromptPath** (lols-smart, file-based)
2. **Category systemPrompt** (lols-smart, inline)
3. **Model systemPromptPath** (model config, file-based)
4. **Model systemPrompt** (model config, inline)
5. No system prompt

## Benefits

- **Better Organization**: Keep long prompts in separate files
- **Version Control**: Track changes to prompts over time
- **Reusability**: Share prompts across multiple models/categories
- **Maintainability**: Easier to edit and update

## Example Files

- `coding-expert.md` - System prompt for code generation tasks
- `deep-thinker.md` - System prompt for reasoning and analysis tasks

## File Format

System prompt files should be plain text (markdown recommended). The entire file content is used as the system prompt, with leading/trailing whitespace trimmed.

## Tips

1. Use markdown for readability
2. Keep prompts focused and clear
3. Test prompts thoroughly
4. Document prompt purpose and usage
5. Version control your prompts
