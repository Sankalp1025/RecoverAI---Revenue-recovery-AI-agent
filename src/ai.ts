import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { evaluateRecoveryPolicy } from "./policy.js";

type AuditEvent = {
  timestamp: string;
  paymentId: string;
  customerId: string;
  failureReason: string;
  attemptCount: number;
  decision: string;
  action: string;
  reason: string;
  amountAtRisk: number;
  amountRecovered: number;
};

const auditLog: AuditEvent[] = [];

// Tracks payments where an automatic retry was attempted but failed.
const failedRetryPayments = new Set<string>();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing from .env");
}

const ai = new GoogleGenAI({
  apiKey,
});

// Get payment details

const getPaymentDetailsTool = {
  type: "function" as const,
  name: "get_payment_details",
  description:
    "Retrieves details about a payment using its payment ID.",
  parameters: {
    type: "object",
    properties: {
      paymentId: {
        type: "string",
        description: "The ID of the payment to investigate.",
      },
    },
    required: ["paymentId"],
  },
};

// Get customer history

const getCustomerHistoryTool = {
  type: "function" as const,
  name: "get_customer_history",
  description:
    "Retrieves the customer's payment and recovery history using their customer ID.",
  parameters: {
    type: "object",
    properties: {
      customerId: {
        type: "string",
        description: "The ID of the customer.",
      },
    },
    required: ["customerId"],
  },
};

// Retry payment

const retryPaymentTool = {
  type: "function" as const,
  name: "retry_payment",
  description:
    "Attempts to retry a failed payment. The backend policy engine decides whether the retry is allowed.",
  parameters: {
    type: "object",
    properties: {
      paymentId: {
        type: "string",
        description: "The ID of the failed payment to retry.",
      },
    },
    required: ["paymentId"],
  },
};

// Escalate payment

const escalatePaymentTool = {
  type: "function" as const,
  name: "escalate_payment",
  description:
    "Escalates a failed payment to a customer-facing payment link when automatic recovery is not allowed or an automatic retry has failed.",
  parameters: {
    type: "object",
    properties: {
      paymentId: {
        type: "string",
        description: "The payment ID to escalate.",
      },
      reason: {
        type: "string",
        description:
          "Why automatic recovery cannot continue.",
      },
    },
    required: ["paymentId", "reason"],
  },
};

// All tools available to Gemini.
const tools = [
  getPaymentDetailsTool,
  getCustomerHistoryTool,
  retryPaymentTool,
  escalatePaymentTool,
];

// Tool dispatcher
function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  payment: any,
  customer: any
) {
  if (toolName === "get_payment_details") {
    const paymentId = args.paymentId;

    if (
      typeof payment === "object" &&
      payment !== null &&
      "id" in payment &&
      payment.id === paymentId
    ) {
      return {
        found: true,
        payment,
      };
    }

    return {
      found: false,
      message: `Payment ${String(paymentId)} was not found.`,
    };
  }

  if (toolName === "get_customer_history") {
    const customerId = args.customerId;

    if (
      typeof customer === "object" &&
      customer !== null &&
      "id" in customer &&
      customer.id === customerId
    ) {
      return {
        found: true,
        customer,
      };
    }

    return {
      found: false,
      message: `Customer ${String(customerId)} was not found.`,
    };
  }

  if (toolName === "retry_payment") {
    return executeRetryPayment(
      String(args.paymentId),
      payment,
      customer
    );
  }

  if (toolName === "escalate_payment") {
    return executeEscalatePayment(
      String(args.paymentId),
      String(args.reason),
      payment,
      customer
    );
  }

  return {
    found: false,
    message: `Unknown tool: ${toolName}`,
  };
}

// Audit trail

function recordAuditEvent(
  payment: any,
  decision: string,
  action: string,
  reason: string,
  amountRecovered: number
) {
  auditLog.push({
    timestamp: new Date().toISOString(),
    paymentId: payment.id,
    customerId: payment.customerId,
    failureReason: payment.failureReason,
    attemptCount: payment.attemptCount,
    decision,
    action,
    reason,
    amountAtRisk: payment.amount,
    amountRecovered,
  });
}

// Execute retry payment

function executeRetryPayment(
  paymentId: string,
  payment: any,
  customer: any
) {
  // Payment must exist.
  if (!payment || payment.id !== paymentId) {
    return {
      allowed: false,
      status: "blocked",
      reason: "Payment not found.",
    };
  }

  // Customer history must exist.
  if (!customer) {
    return {
      allowed: false,
      status: "blocked",
      reason: "Customer history not found.",
    };
  }

  // Ask the shared policy engine.
  const policy = evaluateRecoveryPolicy(
    payment,
    customer
  );

  // The backend policy is authoritative.
  if (policy.action !== "retry_payment") {
    recordAuditEvent(
      payment,
      policy.decision,
      policy.action,
      policy.reason,
      0
    );

    return {
      allowed: false,
      status: "blocked",
      decision: policy.decision,
      action: policy.action,
      reason: policy.reason,
    };
  }

  
  // Simulated payment execution
  // One synthetic failure demonstrates graceful handling of a failed recovery attempt.
  const success = payment.id !== "pay_005";

  if (success) {
    recordAuditEvent(
      payment,
      "recovered",
      "retry_payment",
      policy.reason,
      payment.amount
    );

    return {
      allowed: true,
      status: "recovered",
      paymentId,
      amountRecovered: payment.amount,
      message: "Payment retry succeeded.",
    };
  }

  // Automatic recovery attempt failed.
  failedRetryPayments.add(paymentId);

  recordAuditEvent(
    payment,
    "escalated",
    "payment_link",
    "Automatic retry failed; further retries stopped.",
    0
  );

  return {
    allowed: true,
    status: "retry_failed",
    paymentId,
    amountRecovered: 0,
    message:
      "Payment retry failed. Further retries are stopped.",
    nextAction: "escalate_payment",
  };
}

// Execute escalation

function executeEscalatePayment(
  paymentId: string,
  reason: string,
  payment: any,
  customer: any
) {
  if (!payment || payment.id !== paymentId) {
    return {
      allowed: false,
      status: "blocked",
      paymentId,
      message: "Payment not found.",
    };
  }

  if (!customer) {
    return {
      allowed: false,
      status: "blocked",
      paymentId,
      message: "Customer history not found.",
    };
  }

  // Check the shared policy first.
  const policy = evaluateRecoveryPolicy(
    payment,
    customer
  );

  // Escalation is allowed when:
  // 1. Policy itself requires payment-link escalation, OR
  // 2. A previously permitted automatic retry failed.
  const retryPreviouslyFailed =
    failedRetryPayments.has(paymentId);

  const escalationAllowed =
    policy.action === "payment_link" ||
    retryPreviouslyFailed;

  if (!escalationAllowed) {
    recordAuditEvent(
      payment,
      "blocked",
      "none",
      "Escalation is not permitted for this payment.",
      0
    );

    return {
      allowed: false,
      status: "blocked",
      paymentId,
      message:
        "Escalation is not permitted by the recovery policy.",
    };
  }

  recordAuditEvent(
    payment,
    "escalated",
    "payment_link",
    reason,
    0
  );

  return {
    allowed: true,
    status: "escalated",
    paymentId,
    action: "payment_link",
    message:
      "Payment escalated to a customer-facing payment link.",
    reason,
  };
}

function getFinalInteractionText(
  interaction: any
): string {
  if (
    typeof interaction.output_text === "string" &&
    interaction.output_text.trim()
  ) {
    return interaction.output_text;
  }

  for (const step of interaction.steps ?? []) {
    if (step.type === "model_output") {
      const text = (step.content ?? [])
        .filter(
          (content: any) => content.type === "text"
        )
        .map(
          (content: any) => content.text
        )
        .join("\n");

      if (text.trim()) {
        return text;
      }
    }
  }

  return "Gemini returned no final text response.";
}

// Gemini agent

export async function analyzePayment(
  payment: unknown,
  customer: unknown
) {
  let interaction = await ai.interactions.create({
    model: "gemini-3.5-flash",

    system_instruction:
      "You are RecoverAI, an AI revenue recovery agent. " +
      "Investigate failed payments using payment details and customer history before taking action. " +
      "Before making any recovery decision, you MUST retrieve both the payment details and the customer's history. " +
      "Choose the safest recovery intervention based on the failure reason, payment attempts, and customer recovery history. " +
      "For transient failures, request retry_payment only when appropriate. " +
      "For non-retryable failures or failed recovery attempts, use escalate_payment when appropriate. " +
      "Never bypass backend policy rules. " +
      "Never invent payment information or action results. " +
      "Never claim money was recovered unless the action tool confirms recovery. " +
      "Respect stopping rules and never repeatedly retry the same failed recovery. " +
      "Explain the decision, action, and final outcome clearly.",

      input:
      "Investigate payment pay_001. " +
      "First retrieve the payment details and then retrieve the customer history. " +
      "Do not make a recovery decision until both have been retrieved. " +
      "Determine whether the payment is recoverable automatically. " +
      "If a bounded automatic retry is allowed, execute retry_payment. " +
      "If automatic recovery is not allowed or recovery cannot continue safely, use escalate_payment. " +
      "Do not take an action outside the backend policy.",

    tools,
  });

  // Continue handling tool calls until Gemini produces a normal final response.
  while (true) {
    const functionCall = interaction.steps.find(
      (step) => step.type === "function_call"
    );

    if (!functionCall) {
      return getFinalInteractionText(interaction);
    }

    console.log("\nGemini requested tool:");
    console.log(functionCall.name);

    console.log("\nArguments:");
    console.log(functionCall.arguments);

    const args =
      typeof functionCall.arguments === "string"
        ? JSON.parse(functionCall.arguments)
        : functionCall.arguments;

    const result = executeTool(
      functionCall.name,
      args,
      payment,
      customer
    );

    console.log("\nTool result:");
    console.log(result);

    interaction = await ai.interactions.create({
      model: "gemini-3.5-flash",

      previous_interaction_id: interaction.id,

      tools,

      input: [
        {
          type: "function_result",
          name: functionCall.name,
          call_id: functionCall.id,
          result: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        },
      ] as any,
    });
  }
}

// Expose audit trail

export function getAuditLog() {
  return auditLog;
}