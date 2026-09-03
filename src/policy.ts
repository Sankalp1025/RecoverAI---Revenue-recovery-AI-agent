export type PolicyDecision =
  | "recovered"
  | "escalated"
  | "blocked";

export type PolicyAction =
  | "retry_payment"
  | "payment_link"
  | "none";

export type PolicyResult = {
  decision: PolicyDecision;
  action: PolicyAction;
  reason: string;
};

export type PolicyPayment = {
  status: string;
  failureReason: string;
  attemptCount: number;
};

export type PolicyCustomer = {
  previousRecoveryAttempts: number;
};

const MAX_PAYMENT_ATTEMPTS = 3;
const MAX_CUSTOMER_RECOVERY_ATTEMPTS = 2;

export function evaluateRecoveryPolicy(
  payment: PolicyPayment,
  customer: PolicyCustomer
): PolicyResult {

  // STOPPING RULE #1
  // Never act on a payment that is not failed.
  if (payment.status !== "failed") {
    return {
      decision: "blocked",
      action: "none",
      reason: "Payment is not in failed state.",
    };
  }

  // STOPPING RULE #2
  // Never exceed the maximum payment attempts.
  if (payment.attemptCount >= MAX_PAYMENT_ATTEMPTS) {
    return {
      decision: "blocked",
      action: "none",
      reason: "Maximum payment retry limit reached.",
    };
  }

  // STOPPING RULE #3
  // Never exceed customer recovery intervention limit.
  if (
    customer.previousRecoveryAttempts >=
    MAX_CUSTOMER_RECOVERY_ATTEMPTS
  ) {
    return {
      decision: "blocked",
      action: "none",
      reason:
        "Customer recovery intervention limit reached.",
    };
  }

  // NON-RETRYABLE FAILURE
  if (payment.failureReason === "Card_Expired") {
    return {
      decision: "escalated",
      action: "payment_link",
      reason:
        "Card expired; automatic retry is not allowed.",
    };
  }

  if (payment.failureReason === "Insufficient_Funds") {
    return {
      decision: "escalated",
      action: "payment_link",
      reason:
        "Insufficient funds; automatic retry is not allowed.",
    };
  }

  // SAFE AUTOMATIC RECOVERY
  if (payment.failureReason === "Temporary_Network_Issue") {
    return {
      decision: "recovered",
      action: "retry_payment",
      reason:
        "Transient failure; retry permitted within policy limits.",
    };
  }

  // FAIL CLOSED
  return {
    decision: "blocked",
    action: "none",
    reason:
      "Unknown failure reason; automatic recovery is not permitted.",
  };
}