import { setCustomerIdInput, setCustomerIdOutput } from '../schemas/tools.js';
import { sessionStore } from '../session-context.js';

export async function handleSetCustomerId(args: unknown, sessionId: string) {
  const input = setCustomerIdInput.parse(args);

  sessionStore.update(sessionId, { customerId: input.customerId });

  return setCustomerIdOutput.parse({
    success: true,
    customerId: input.customerId,
  });
}
