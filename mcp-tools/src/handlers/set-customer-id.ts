import { setCustomerIdInput, setCustomerIdOutput } from '../schemas/tools.js';
import { sessionStore } from '../session-context.js';
import type { BridgeResult } from '../types.js';

const HEADLESS_URL = process.env['HEADLESS_URL'] || 'http://localhost:3002';

export async function handleSetCustomerId(args: unknown, sessionId: string) {
  const input = setCustomerIdInput.parse(args);
  const context = sessionStore.getOrCreate(sessionId);

  // Update local session store
  sessionStore.update(sessionId, { customerId: input.customerId });

  // If headless session exists, propagate customer ID to shop-ui NgRx store
  if (context.headlessSessionId) {
    await dispatchCustomerIdToHeadless(context.headlessSessionId, input.customerId);
  }

  return setCustomerIdOutput.parse({
    success: true,
    customerId: input.customerId,
  });
}

/**
 * Dispatch [Cart] Set Customer ID action to the headless session.
 * This ensures the shop-ui NgRx store knows the customer ID before cart creation.
 */
async function dispatchCustomerIdToHeadless(headlessSessionId: string, customerId: string): Promise<void> {
  try {
    const response = await fetch(
      `${HEADLESS_URL}/sessions/${headlessSessionId}/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: {
            type: '[Cart] Set Customer ID',
            customerId,
          },
          // Synchronous action - success type is the same as trigger
          successTypes: ['[Cart] Set Customer ID'],
          failureTypes: [],
          timeout: 5000,
        }),
      }
    );

    if (!response.ok && response.status !== 404) {
      // 404 means session doesn't exist yet, which is fine
      console.warn(`[set_customer_id] Failed to propagate to headless: ${response.status}`);
    }
  } catch (error) {
    // Don't fail the operation if headless propagation fails
    console.warn('[set_customer_id] Failed to propagate to headless:', error);
  }
}
