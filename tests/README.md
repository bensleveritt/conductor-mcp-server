# Test Suite Documentation

## Overview

Comprehensive test suite for the Conductor MCP Server using Bun's built-in test runner.

**Current Status:**
- ✅ 100 tests passing
- ✅ 0 tests failing
- ✅ 152 expect() assertions
- ✅ Fast execution (~60ms)

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test tests/unit/utils/memory.test.ts

# Run tests with coverage (when needed)
bun test --coverage
```

## Test Structure

```
tests/
├── fixtures/
│   └── mock-ollama-responses.ts    # Reusable mock data
├── unit/
│   ├── utils/
│   │   ├── memory.test.ts          # 26 tests - ConversationMemoryManager
│   │   ├── ollama-client.test.ts   # 18 tests - OllamaClient
│   │   └── config.test.ts          # 19 tests - Configuration loading
│   └── tools/
│       ├── chat.test.ts             # 15 tests - Chat tool
│       ├── listmodels.test.ts       # 10 tests - List models tool
│       └── version.test.ts          # 12 tests - Version tool
└── integration/
    └── (future integration tests)
```

## Test Coverage by Component

### Utils (63 tests total)

**memory.test.ts** - 26 tests
- Conversation ID generation
- Create/get/delete operations
- Message management
- Metadata updates
- Cleanup logic (TTL, max conversations)

**ollama-client.test.ts** - 18 tests
- Constructor behavior
- List models (success, errors)
- Server availability checks
- Chat (streaming and non-streaming)
- Generate methods
- Error handling

**config.test.ts** - 19 tests
- Environment variable parsing
- Default values
- DISABLED_TOOLS parsing
- MAX_CONVERSATIONS validation
- Combined configurations

### Tools (37 tests total)

**chat.test.ts** - 15 tests
- New conversation creation
- Conversation continuation
- File context handling
- Thinking mode system messages
- Temperature options
- Input validation (prompt, model, temperature, thinking_mode)

**listmodels.test.ts** - 10 tests
- Model list retrieval
- Formatting (size, parameters)
- Empty list handling
- Error handling
- Models without details

**version.test.ts** - 12 tests
- Version information
- Configuration display
- Ollama availability status
- Tool listing
- Input validation

## Testing Patterns

### Mocking

```typescript
import { mock } from "bun:test";

// Mock fetch responses
globalThis.fetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data: "value" })
  } as Response)
);

// Mock module functions
const originalOllama = (await import("../../../src/utils/ollama-client")).ollama;
(originalOllama as any).chat = mock(() => Promise.resolve(mockResponse));
```

### Fixtures

```typescript
import { mockModels, createMockChatResponse } from "../../fixtures/mock-ollama-responses";

// Use predefined mocks
const response = createMockChatResponse("Test content");
```

### Testing Async Generators

```typescript
test("yields streaming response chunks", async () => {
  const results = [];
  for await (const chunk of client.chatStream(request)) {
    results.push(chunk);
  }
  expect(results).toEqual(expectedChunks);
});
```

## What's Tested

✅ **Core Utilities**
- Conversation memory management
- Ollama API client
- Configuration loading

✅ **Tool Functionality**
- Input validation with Zod schemas
- Tool execution logic
- Error handling
- Response formatting

✅ **Edge Cases**
- Empty inputs
- Invalid data
- Network failures
- Missing optional parameters

## What's NOT Yet Tested

⚠️ **Workflow Tools** (debug, thinkdeep, planner, consensus, codereview, precommit)
- These tools follow similar patterns to chat
- Can be tested using the same mocking approach
- Deferred to keep initial implementation focused

⚠️ **Integration Tests**
- Server orchestration
- Tool registration
- Request routing
- MCP protocol compliance

⚠️ **E2E Tests**
- Real Ollama server interaction
- Full conversation flows
- Marked as optional (requires local Ollama)

## Adding New Tests

### 1. Create Test File

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { YourComponent } from "../../../src/path/to/component";

describe("YourComponent", () => {
  beforeEach(() => {
    // Setup
  });

  test("does something", () => {
    expect(true).toBe(true);
  });
});
```

### 2. Mock Dependencies

```typescript
import { mock } from "bun:test";

const mockFn = mock(() => "mocked value");
```

### 3. Run Tests

```bash
bun test path/to/your.test.ts
```

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Clear Assertions**: Use descriptive expect messages
3. **Mock External Dependencies**: Don't rely on real Ollama server
4. **Test Edge Cases**: Empty inputs, errors, timeouts
5. **Keep Tests Fast**: Current suite runs in ~60ms
6. **Use Fixtures**: Reuse mock data from fixtures/

## Continuous Integration

When setting up CI:

```yaml
# Example GitHub Actions
- name: Run tests
  run: bun test

# Skip E2E tests that require Ollama
- name: Run unit tests only
  run: bun test tests/unit/
```

## Future Improvements

1. Add integration tests for server orchestration
2. Add workflow tool tests (debug, thinkdeep, etc.)
3. Increase coverage to 90%+ on critical paths
4. Add performance benchmarks
5. Add E2E tests with real Ollama (optional in CI)
