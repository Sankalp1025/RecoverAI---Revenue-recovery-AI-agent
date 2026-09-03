import { evaluateRecoveryPolicy } from "./policy.js";

type Payment = {
    id: string;
    amount: number;
    currency: string;
    status: "failed";
    failureReason:
      | "Temporary_Network_Issue"
      | "Card_Expired"
      | "Insufficient_Funds"
      | "Unknown_Error";
    attemptCount: number;
    customerId: string;
  };
  
  type Customer = {
    id: string;
    successfulPayments: number;
    failedPayments: number;
    previousRecoveryAttempts: number;
  };
  
  type RecoveryResult = {
    paymentId: string;
    customerId: string;
    decision: "recovered" | "escalated" | "blocked";
    action: "retry_payment" | "payment_link" | "none";
    reason: string;
    amountAtRisk: number;
    amountRecovered: number;
  };
  
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
  
  function recordAuditEvent(
    payment: Payment,
    decision: RecoveryResult["decision"],
    action: RecoveryResult["action"],
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
  

  // Synthetic batch of failed payments
  
  const failureReasons: Payment["failureReason"][] = [
    "Temporary_Network_Issue",
    "Temporary_Network_Issue",
    "Card_Expired",
    "Insufficient_Funds",
    "Temporary_Network_Issue",
    "Temporary_Network_Issue",
    "Card_Expired",
    "Temporary_Network_Issue",
    "Insufficient_Funds",
    "Temporary_Network_Issue",
    "Temporary_Network_Issue",
    "Card_Expired",
    "Temporary_Network_Issue",
    "Insufficient_Funds",
    "Temporary_Network_Issue",
    "Unknown_Error",
    "Temporary_Network_Issue",
    "Card_Expired",
    "Temporary_Network_Issue",
    "Temporary_Network_Issue",
  ];
  
  const payments: Payment[] = Array.from(
    { length: 100 },
    (_, index) => {
      const number = index + 1;
  
      const failureReason =
        failureReasons[index % failureReasons.length];
  
      let attemptCount = 1;
  
      // Some payments are already close to the retry limit.
      if (number % 10 === 0) {
        attemptCount = 3;
      } else if (number % 7 === 0) {
        attemptCount = 2;
      }
  
      return {
        id: `pay_${String(number).padStart(3, "0")}`,
        amount: 1000 + ((number * 731) % 7000),
        currency: "INR",
        status: "failed",
        failureReason,
        attemptCount,
        customerId: `cust_${String(((number - 1) % 25) + 1).padStart(3, "0")}`,
      };
    }
  );
  
 
  // Synthetic customer history
  
  const customers: Customer[] = Array.from(
    { length: 25 },
    (_, index) => {
      const customerNumber = index + 1;
  
      const customerPayments = payments.filter(
        payment => payment.customerId ===
          `cust_${String(customerNumber).padStart(3, "0")}`
      );
  
      return {
        id: `cust_${String(customerNumber).padStart(3, "0")}`,
        successfulPayments: 5,
        failedPayments: customerPayments.length,
        previousRecoveryAttempts:
          customerNumber % 15 === 0
            ? 2
            : customerNumber % 7 === 0
              ? 1
              : 0,
      };
    }
  );
  
 
  // Recovery policy
  function recoverPayment(
    payment: Payment,
    customer: Customer
  ): RecoveryResult {
  
    const policy = evaluateRecoveryPolicy(
      payment,
      customer
    );
  
  
    // Automatic retry
  
    if (policy.action === "retry_payment") {
  
      const retryFails = payment.id === "pay_005";
  
      if (retryFails) {
        const result: RecoveryResult = {
          paymentId: payment.id,
          customerId: payment.customerId,
          decision: "escalated",
          action: "payment_link",
          reason:
            "Automatic retry failed; stopping further retries and escalating to payment link.",
          amountAtRisk: payment.amount,
          amountRecovered: 0,
        };
  
        recordAuditEvent(
          payment,
          result.decision,
          result.action,
          result.reason,
          result.amountRecovered
        );
  
        return result;
      }
  
      const result: RecoveryResult = {
        paymentId: payment.id,
        customerId: payment.customerId,
        decision: "recovered",
        action: "retry_payment",
        reason: policy.reason,
        amountAtRisk: payment.amount,
        amountRecovered: payment.amount,
      };
  
      recordAuditEvent(
        payment,
        result.decision,
        result.action,
        result.reason,
        result.amountRecovered
      );
  
      return result;
    }
  
    
    // Escalation / blocking
  
    const result: RecoveryResult = {
      paymentId: payment.id,
      customerId: payment.customerId,
      decision: policy.decision,
      action: policy.action,
      reason: policy.reason,
      amountAtRisk: payment.amount,
      amountRecovered: 0,
    };
  
    recordAuditEvent(
      payment,
      result.decision,
      result.action,
      result.reason,
      result.amountRecovered
    );
  
    return result;
  }
  
 
  // Run batch recovery
  
  const results: RecoveryResult[] = [];
  
  for (const payment of payments) {
    const customer = customers.find(
      customer => customer.id === payment.customerId
    );
  
    if (!customer) {
      continue;
    }
  
    const result = recoverPayment(payment, customer);
  
    results.push(result);
  
    console.log(
      `${payment.id} → ${result.decision.toUpperCase()} → ${result.action}`
    );
  }
  

  // Batch metrics
  
  const totalProcessed = results.length;
  
  const recovered = results.filter(
    result => result.decision === "recovered"
  );
  
  const blocked = results.filter(
    result => result.decision === "blocked"
  );
  
  const escalated = results.filter(
    result => result.decision === "escalated"
  );
  
  const amountRecovered = recovered.reduce(
    (total, result) => total + result.amountRecovered,
    0
  );
  
  const totalAtRisk = payments.reduce(
    (total, payment) => total + payment.amount,
    0
  );
  
  const recoveryRate =
    totalAtRisk === 0
      ? 0
      : (amountRecovered / totalAtRisk) * 100;
  
  const automaticRetries = results.filter(
    result => result.action === "retry_payment"
  ).length;
  
  const paymentLinkEscalations = results.filter(
    result => result.action === "payment_link"
  ).length;
  
  const policyBlocked = results.filter(
    result => result.decision === "blocked"
  ).length;
  
// Recovery Report
  
  console.log("\n======================================");
  console.log("RecoverAI Batch Recovery Report");
  console.log("======================================");
  
  console.log(`Payments processed: ${totalProcessed}`);
  console.log(`Recovered: ${recovered.length}`);
  console.log(`Blocked: ${blocked.length}`);
  console.log(`Escalated: ${escalated.length}`);
  
  console.log(
    `Total revenue at risk: ₹${totalAtRisk}`
  );
  
  console.log(
    `Revenue recovered: ₹${amountRecovered}`
  );
  
  console.log(
    `Value recovery rate: ${recoveryRate.toFixed(2)}%`
  );
  
  console.log(
    `Automatic retries: ${automaticRetries}`
  );
  
  console.log(
    `Payment-link escalations: ${paymentLinkEscalations}`
  );
  
  console.log(
    `Policy-blocked payments: ${policyBlocked}`
  );
  
  console.log("\n======================================");
  console.log("Audit Trail Summary");
  console.log("======================================");
  console.log(`Audit events recorded: ${auditLog.length}`);

  console.log("\nSample audit events:");

for (const event of auditLog.slice(0, 5)) {
  console.log({
    paymentId: event.paymentId,
    failureReason: event.failureReason,
    decision: event.decision,
    action: event.action,
    amountAtRisk: event.amountAtRisk,
    amountRecovered: event.amountRecovered,
    reason: event.reason,
  });
}
  
  export {
    payments,
    customers,
    results,
    auditLog,
    totalProcessed,
    recovered,
    blocked,
    escalated,
    amountRecovered,
    totalAtRisk,
    recoveryRate,
    automaticRetries,
    paymentLinkEscalations,
    policyBlocked,
  };