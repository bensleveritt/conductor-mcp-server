import { describe, test, expect, beforeEach } from "bun:test";
import { ConversationMemoryManager } from "../../../src/utils/memory";
import type { ChatMessage } from "../../../src/types/index";

describe("ConversationMemoryManager", () => {
  let manager: ConversationMemoryManager;

  beforeEach(() => {
    manager = new ConversationMemoryManager();
  });

  describe("generateId", () => {
    test("generates unique conversation IDs with correct format", () => {
      const id1 = manager.generateId();
      const id2 = manager.generateId();

      expect(id1).toMatch(/^conv_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^conv_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("create", () => {
    test("creates a new conversation with no initial messages", () => {
      const id = manager.create();

      expect(id).toMatch(/^conv_\d+_[a-z0-9]+$/);
      expect(manager.get(id)).toBeDefined();
      expect(manager.getMessages(id)).toEqual([]);
    });

    test("creates a conversation with initial messages", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];

      const id = manager.create(messages);
      expect(manager.getMessages(id)).toEqual(messages);
    });

    test("stores metadata correctly", () => {
      const metadata = { model: "qwen2.5:latest", thinking_mode: "high" };
      const id = manager.create([], metadata);

      const conversation = manager.get(id);
      expect(conversation?.metadata).toEqual(metadata);
    });

    test("sets created_at and updated_at timestamps", () => {
      const before = Date.now();
      const id = manager.create();
      const after = Date.now();

      const conversation = manager.get(id);
      expect(conversation?.created_at).toBeGreaterThanOrEqual(before);
      expect(conversation?.created_at).toBeLessThanOrEqual(after);
      expect(conversation?.updated_at).toBe(conversation?.created_at);
    });
  });

  describe("get", () => {
    test("returns conversation by ID", () => {
      const id = manager.create();
      const conversation = manager.get(id);

      expect(conversation).toBeDefined();
      expect(conversation?.id).toBe(id);
    });

    test("returns undefined for non-existent ID", () => {
      const conversation = manager.get("non_existent_id");
      expect(conversation).toBeUndefined();
    });
  });

  describe("getMessages", () => {
    test("returns messages for existing conversation", () => {
      const messages: ChatMessage[] = [{ role: "user", content: "Test" }];
      const id = manager.create(messages);

      expect(manager.getMessages(id)).toEqual(messages);
    });

    test("returns empty array for non-existent conversation", () => {
      expect(manager.getMessages("non_existent_id")).toEqual([]);
    });
  });

  describe("addMessage", () => {
    test("adds message to existing conversation", () => {
      const id = manager.create();
      const message: ChatMessage = { role: "user", content: "Hello" };

      manager.addMessage(id, message);

      expect(manager.getMessages(id)).toEqual([message]);
    });

    test("appends messages in order", () => {
      const id = manager.create();
      const msg1: ChatMessage = { role: "user", content: "First" };
      const msg2: ChatMessage = { role: "assistant", content: "Second" };

      manager.addMessage(id, msg1);
      manager.addMessage(id, msg2);

      expect(manager.getMessages(id)).toEqual([msg1, msg2]);
    });

    test("updates updated_at timestamp", () => {
      const id = manager.create();
      const conversation = manager.get(id);
      const originalUpdatedAt = conversation!.updated_at;

      // Wait a bit to ensure timestamp changes
      const message: ChatMessage = { role: "user", content: "Test" };
      manager.addMessage(id, message);

      const updated = manager.get(id);
      expect(updated!.updated_at).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    test("does nothing for non-existent conversation", () => {
      const message: ChatMessage = { role: "user", content: "Test" };
      manager.addMessage("non_existent", message);

      expect(manager.getMessages("non_existent")).toEqual([]);
    });
  });

  describe("updateMetadata", () => {
    test("updates metadata for existing conversation", () => {
      const id = manager.create([], { initial: "value" });

      manager.updateMetadata(id, { new: "data" });

      const conversation = manager.get(id);
      expect(conversation?.metadata).toEqual({ initial: "value", new: "data" });
    });

    test("merges metadata rather than replacing", () => {
      const id = manager.create([], { key1: "value1", key2: "value2" });

      manager.updateMetadata(id, { key2: "updated", key3: "new" });

      const conversation = manager.get(id);
      expect(conversation?.metadata).toEqual({
        key1: "value1",
        key2: "updated",
        key3: "new",
      });
    });

    test("updates updated_at timestamp", () => {
      const id = manager.create();
      const originalUpdatedAt = manager.get(id)!.updated_at;

      manager.updateMetadata(id, { test: "value" });

      expect(manager.get(id)!.updated_at).toBeGreaterThanOrEqual(
        originalUpdatedAt,
      );
    });

    test("does nothing for non-existent conversation", () => {
      manager.updateMetadata("non_existent", { test: "value" });
      expect(manager.get("non_existent")).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("deletes an existing conversation", () => {
      const id = manager.create();
      expect(manager.get(id)).toBeDefined();

      manager.delete(id);

      expect(manager.get(id)).toBeUndefined();
    });

    test("handles deletion of non-existent conversation gracefully", () => {
      expect(() => manager.delete("non_existent")).not.toThrow();
    });
  });

  describe("size", () => {
    test("returns 0 for empty manager", () => {
      expect(manager.size()).toBe(0);
    });

    test("returns correct count after creating conversations", () => {
      manager.create();
      manager.create();
      manager.create();

      expect(manager.size()).toBe(3);
    });

    test("decrements after deletion", () => {
      const id = manager.create();
      expect(manager.size()).toBe(1);

      manager.delete(id);
      expect(manager.size()).toBe(0);
    });
  });

  describe("clear", () => {
    test("removes all conversations", () => {
      manager.create();
      manager.create();
      manager.create();

      expect(manager.size()).toBe(3);

      manager.clear();

      expect(manager.size()).toBe(0);
    });
  });

  describe("cleanup", () => {
    test("removes conversations older than maxAge (24 hours)", () => {
      // Create a conversation
      const id = manager.create();

      // Get the conversation and manually set it to be old
      const conversation = manager.get(id);
      if (conversation) {
        conversation.updated_at = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      }

      // Create a new conversation, which triggers cleanup
      manager.create();

      // Old conversation should be removed
      expect(manager.get(id)).toBeUndefined();
    });

    test("keeps conversations newer than maxAge", () => {
      const id = manager.create();

      // Create another conversation to trigger cleanup
      manager.create();

      // Recent conversation should still exist
      expect(manager.get(id)).toBeDefined();
    });

    test("removes oldest conversations when exceeding maxConversations limit", () => {
      // Create 101 conversations (limit is 100)
      const ids: string[] = [];
      for (let i = 0; i < 101; i++) {
        const id = manager.create();
        ids.push(id);
        // Small delay to ensure different timestamps
        if (i < 100) {
          const conv = manager.get(id);
          if (conv) {
            conv.updated_at = Date.now() - (100 - i) * 1000;
          }
        }
      }

      // Should be at max limit
      expect(manager.size()).toBeLessThanOrEqual(100);

      // First conversation should be removed (oldest)
      expect(manager.get(ids[0]!)).toBeUndefined();

      // Last conversation should exist (newest)
      expect(manager.get(ids[100]!)).toBeDefined();
    });
  });
});
