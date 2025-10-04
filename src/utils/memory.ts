import type { ConversationMemory, ChatMessage } from "../types/index.ts";

export class ConversationMemoryManager {
  private conversations: Map<string, ConversationMemory> = new Map();
  private maxConversations: number = 100;
  private maxAge: number = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Generate a unique conversation ID
   */
  generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Create a new conversation
   */
  create(initialMessages: ChatMessage[] = [], metadata?: Record<string, any>): string {
    const id = this.generateId();
    const now = Date.now();

    this.conversations.set(id, {
      id,
      messages: initialMessages,
      metadata,
      created_at: now,
      updated_at: now,
    });

    this.cleanup();
    return id;
  }

  /**
   * Get a conversation by ID
   */
  get(id: string): ConversationMemory | undefined {
    return this.conversations.get(id);
  }

  /**
   * Get messages from a conversation
   */
  getMessages(id: string): ChatMessage[] {
    const conversation = this.conversations.get(id);
    return conversation?.messages || [];
  }

  /**
   * Add a message to a conversation
   */
  addMessage(id: string, message: ChatMessage): void {
    const conversation = this.conversations.get(id);
    if (conversation) {
      conversation.messages.push(message);
      conversation.updated_at = Date.now();
    }
  }

  /**
   * Update conversation metadata
   */
  updateMetadata(id: string, metadata: Record<string, any>): void {
    const conversation = this.conversations.get(id);
    if (conversation) {
      conversation.metadata = {
        ...conversation.metadata,
        ...metadata,
      };
      conversation.updated_at = Date.now();
    }
  }

  /**
   * Delete a conversation
   */
  delete(id: string): void {
    this.conversations.delete(id);
  }

  /**
   * Clean up old conversations
   */
  private cleanup(): void {
    const now = Date.now();
    const conversations = Array.from(this.conversations.entries());

    // Remove conversations older than maxAge
    for (const [id, conv] of conversations) {
      if (now - conv.updated_at > this.maxAge) {
        this.conversations.delete(id);
      }
    }

    // If still too many, remove oldest ones
    if (this.conversations.size > this.maxConversations) {
      const sorted = conversations
        .sort((a, b) => a[1].updated_at - b[1].updated_at);

      const toRemove = sorted.slice(0, this.conversations.size - this.maxConversations);
      for (const [id] of toRemove) {
        this.conversations.delete(id);
      }
    }
  }

  /**
   * Get conversation count
   */
  size(): number {
    return this.conversations.size;
  }

  /**
   * Clear all conversations
   */
  clear(): void {
    this.conversations.clear();
  }
}

// Export a singleton instance
export const conversationMemory = new ConversationMemoryManager();
