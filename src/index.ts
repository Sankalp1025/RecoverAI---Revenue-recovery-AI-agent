import { analyzePayment, getAuditLog } from "./ai.js";

const payment = {
  id: "pay_001",
  amount: 2499,
  currency: "INR",
  status: "failed",
  failureReason: "Temporary_Network_Issue",
  attemptCount: 1,
  customerId: "cust_001",
};

const customer = {
  id: "cust_001",
  successfulPayments: 0,
  failedPayments: 2,
  previousRecoveryAttempts: 0,
  customerSince: "2024-01-15",
};

console.log("\nPayment:");
console.log(payment);

console.log("\nCustomer:");
console.log(customer);


async function main() {
  const recommendation = await analyzePayment(
    payment,
    customer
  );

  console.log("\n==============================");
  console.log("Gemini final response:");
  console.log("===============================");

  console.log(recommendation);

  console.log("\n==========================");
  console.log("Audit log:");
  console.log("============================");
  console.log(getAuditLog());
}

main().catch((error) => {
  console.error("\nRecoverAI failed:");
  console.error(error);
});