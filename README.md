# RecoverAI:

### AI Revenue Recovery Agent
RecoverAI is an AI-powered revenue recovery agent that investigates failed payments,understands the reason behind the failure,checks customer history,and chooses the safest recovery action.

The goal is simple:
> **Recover more revenue without blindly retrying payments or over-contacting customers.**

Instead of treating every failed payment the same way, RecoverAI combines an AI agent with deterministic backend policies so that the AI can decide *what to do*, while the policy layer decides *what is actually allowed*.

---

## Why RecoverAI?

A failed payment does not always mean the same thing.

A temporary network failure may be worth retrying.

An expired card should not be retried automatically.

A customer who has already received multiple recovery attempts should not be contacted again.

Traditional recovery systems often rely on fixed retry rules. RecoverAI adds an agentic layer that can investigate the situation,use customer context,select an appropriate action,and execute it through bounded tools.

The important part is that the AI does **not** get unrestricted control over payment actions.

Every action passes through the recovery policy.

---

## What RecoverAI Does

For a failed payment:

1. Retrieves the payment details.
2. Retrieves the customer's payment history.
3. Determines why the payment failed.
4. Evaluates recovery policies and stopping rules.
5. Chooses an allowed recovery action.
6. Executes the action through a controlled tool.
7. Escalates when automatic recovery is not appropriate.
8. Records the decision and outcome in an audit trail.

### Example

For a temporary network failure:

```text
Failed Payment
      ↓
Retrieve Payment Details
      ↓
Retrieve Customer History
      ↓
Policy Check
      ↓
Temporary Network Issue
      ↓
Retry Allowed
      ↓
Retry Payment
      ↓
Payment Recovered
```
---

For non-retryable failure:
```text
Failed Payment
      ↓
Policy Check
      ↓
Card Expired
      ↓
Automatic Retry Blocked
      ↓
Payment Link / Escalation
```
---

## Architecture

                       ┌──────────────────────┐
                       │      Gemini AI       │
                       │    Recovery Agent    │
                       └──────────┬───────────┘
                                  │
                         Tool calls / decisions
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │    Recovery Tools       │
                    │                         │
                    │ • Payment Details       │
                    │ • Customer History      │
                    │ • Retry Payment         │
                    │ • Escalate Payment      │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     Policy Engine       │
                    │                         │
                    │ • Retry limits          │
                    │ • Customer limits       │
                    │ • Failure rules         │
                    │ • Fail-closed behavior  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     Audit + Metrics     │
                    │                         │
                    │ • Decision              │
                    │ • Action                │
                    │ • Reason                │
                    │ • Amount at risk        │
                    │ • Amount recovered      │
                    └─────────────────────────┘
---

## Design principle:
The AI agent is responsible for reasoning and orchestration.
The policy engine is responsible for enforcing boundaries.
This separation prevents the model from bypassing business rules even if it makes a poor decision.

## Recovery Policies & Guardrails:
- RecoverAI currently enforces several stopping rules.

- Payment retry limit --
A payment cannot be retried once the maximum retry limit has been reached.

- Customer intervention limit --
A customer cannot be subjected to unlimited recovery interventions.

- Non-retryable failures --
Some failure reasons are not eligible for automatic retries. <br>

### Examples: <br>
 Card_Expired <br>
 Insufficient_Funds <br>
These are routed toward escalation/payment-link recovery instead.

- Unknown failures --
Unknown failure reasons fail closed.
If RecoverAI does not know whether an automatic action is safe, it does not take the action.

- Failed recovery --
If an allowed retry itself fails, RecoverAI can move the payment into an escalation path rather than repeatedly retrying it.

---

## Batch Results:
RecoverAI includes a deterministic synthetic batch of 100 failed payments to measure the effect of the recovery workflow.

- **Payments processed:** 100
- **Total revenue at risk:** ₹4,45,550
- **Revenue recovered:** ₹2,12,400
- **Value recovery rate:** 47.67%
- **Automatic retries:** 47
- **Payment-link escalations:** 36
- **Policy-blocked payments:** 17
- **Audit events:** 100
  
 These numbers come from the project's synthetic test dataset and are intended to demonstrate the recovery workflow and measurement pipeline. They are not real merchant transaction results.

## Tech Stack:

- TypeScript
- Node.js
- Google Gemini API
- Gemini Interactions API
- Gemini function calling / tools
- ts-node / tsx
- HTML
- CSS

## Current Scope:

This project is a working prototype demonstrating the revenue recovery workflow.
The current payment and customer data are synthetic and the payment actions are simulated locally.
A production version could connect the same recovery workflow to:
- payment APIs
- payment webhooks
- merchant databases
- customer communication channels
- persistent audit storage
- production monitoring and observability
  
The core recovery policy remains deterministic even when the surrounding infrastructure is replaced with production services.

---

## Run Locally:
```text
1. Clone the repository:
- git clone <https://github.com/Sankalp1025/RecoverAI---Revenue-recovery-AI-agent.git>
- cd RecoverAI

2. Install dependencies:
- npm install

3. Configure Gemini:
- Create a .env file in the project root:  GEMINI_API_KEY=your_api_key
- NOTE:- Never commit your API key to GitHub.

4. Type-check the project:
- npx tsc --noEmit

5. Run the AI recovery agent:
- npx tsx src/index.ts

This runs the single-payment agent flow and prints:
- payment details
- customer history
- Gemini tool calls
- recovery result
- final agent response
- audit trail

6. Run the batch simulation:
- npx tsx src/batch.ts
- This processes the 100-payment synthetic dataset and prints recovery metrics.

7. Run the dashboard:
- npx tsx src/server.ts
```
//////////////////////////////////////////////////////////////////////////////////////////
