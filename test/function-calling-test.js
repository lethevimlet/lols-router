#!/usr/bin/env node

/**
 * Function Calling Test for qwen3-coder-30b-instruct
 * Tests if the model supports OpenAI-style function calling
 */

const SERVER_URL = process.env.SERVER_URL || 'http://192.168.0.21:3000';

async function testFunctionCalling() {
  console.log('🧪 Testing Function Calling with qwen3-coder-30b-instruct\n');
  console.log(`Server: ${SERVER_URL}\n`);

  const tools = [
    {
      type: "function",
      function: {
        name: "get_current_weather",
        description: "Get the current weather in a given location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state, e.g. San Francisco, CA"
            },
            unit: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              description: "The temperature unit"
            }
          },
          required: ["location"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "calculate",
        description: "Perform a mathematical calculation",
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "The mathematical expression to evaluate, e.g. '2 + 2'"
            }
          },
          required: ["expression"]
        }
      }
    }
  ];

  const testCases = [
    {
      name: "Weather query",
      messages: [
        {
          role: "user",
          content: "What's the weather like in Paris right now?"
        }
      ]
    },
    {
      name: "Math calculation",
      messages: [
        {
          role: "user",
          content: "Calculate 42 * 17 + 23"
        }
      ]
    },
    {
      name: "Multi-function scenario",
      messages: [
        {
          role: "user",
          content: "What's the weather in Tokyo and calculate 100 / 5"
        }
      ]
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`❓ Query: "${testCase.messages[0].content}"`);

    try {
      const response = await fetch(`${SERVER_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: JSON.stringify({
          model: 'qwen3-coder-30b-instruct',
          messages: testCase.messages,
          tools: tools,
          tool_choice: 'auto',
          max_tokens: 500,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      
      // Check if response contains tool calls
      const message = data.choices[0].message;
      
      console.log('\n📤 Response:');
      console.log(`   Finish reason: ${data.choices[0].finish_reason}`);
      
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`   ✅ Tool calls detected: ${message.tool_calls.length}`);
        message.tool_calls.forEach((call, idx) => {
          console.log(`\n   Tool Call #${idx + 1}:`);
          console.log(`     Function: ${call.function.name}`);
          console.log(`     Arguments: ${call.function.arguments}`);
        });
        passed++;
      } else if (message.content) {
        console.log(`   ❌ No tool calls - got text response instead:`);
        console.log(`   "${message.content.substring(0, 200)}..."`);
        failed++;
      } else {
        console.log(`   ⚠️  No tool calls and no content`);
        failed++;
      }

      // Show token usage
      if (data.usage) {
        console.log(`\n   Tokens: ${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion = ${data.usage.total_tokens} total`);
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (passed === testCases.length) {
    console.log('✅ Function calling is WORKING on qwen3-coder-30b-instruct!\n');
  } else if (passed > 0) {
    console.log('⚠️  Function calling is PARTIALLY working\n');
  } else {
    console.log('❌ Function calling is NOT working - model returns text instead\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

testFunctionCalling().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
