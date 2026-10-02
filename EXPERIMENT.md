# The commercial experiment

Hypothesis: an independently configured agent can discover a useful capability, encounter x402, autonomously pay a small amount under its authorised spending policy and use the structured result.

This experiment does not assume bots are buyers. Companies House's underlying API is publicly available with credentials. Our offered value is normalisation, aggregation, provenance, caching and removing provider-specific onboarding for the buyer.

## Evidence gates

| Stage                         | Evidence required                                                                                                                | What it does not prove                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 0: We buy our endpoint        | Deployed service; actual 402; funded testnet settlement; live Companies House JSON validated by buyer; cache and metrics checked | External usability or demand                         |
| 1: Independent configuration  | Another operator configures a buyer without source changes and completes a testnet purchase                                      | Organic discovery or willingness to pay real money   |
| 2: Unknown external candidate | Payment from a non-invited wallet, excluding self-tests, with catalogue/referral evidence and reasonable investigation           | Identity or autonomy from headers alone              |
| 3: Repeat usage               | Separate successful payments by external candidates across days and tasks                                                        | Profitability or mainnet demand                      |
| 4: Expand                     | Repeat usage, low failure rate, specific requests for related capabilities, evidence that this saves integration effort          | Justification for speculative endpoint proliferation |

Current status: local technical simulation works; real funded Stage 0 is not yet complete. Testnet gross revenue has zero cash value. No revenue forecast is justified.

## Metrics and interpretation

- 402 challenges and rejected-payment counts, split by outcome. One buyer creates two HTTP requests; do not count those as two customers.
- Successful settled responses and verification/settlement failures, including unknown settlement outcomes.
- Paid/challenge ratio, explicitly a proxy rather than a clean session conversion rate: retries, spam and direct paid calls distort it.
- Distinct paying wallet HMACs and repeat paid wallets. Multiple wallets can be one actor; shared wallets can represent multiple actors.
- Cache hit ratio among paid calls; upstream milliseconds and error/partial rates.
- Gross test USDC: atomic amount / 1,000,000 for settled requests. Record this separately from real cash revenue (always zero here).
- Estimated marginal cost: attributable Worker CPU/request cost + DO request/storage/alarms + D1 writes/storage + any facilitator fee. Measure per 1,000 calls using account invoices/current plan rates. Do not assume free-tier allowance equals a sustainable zero marginal cost.
- Unknown/external candidate paid calls, **excluding** known buyer addresses and `self-test` discovery hints. Missing referral or a new wallet is not proof of independent discovery.
- Discovery-channel performance: Bazaar/MCP/direct/unattributed, keeping self-reported hints separate from actual catalogue listing and invitation records.

`npm run metrics` gives daily counts, payer cohorts, channel aggregates, cached purchases and repeat-wallet candidates. Use D1 JSON extraction for detailed outcomes. Restrict access to account operators. Raw events expire after 30 days; export aggregate experiment results before retention removes them.

## Cohort discipline

Populate `KNOWN_BUYER_ADDRESSES` before running the CLI or inviting testers. Register independent-but-invited testers as known too. Add newly identified invited wallets and reclassify historical rows for analysis where necessary; the current configuration only affects new records. Ignore the fact that a client can self-report a channel. Retain a small invitation ledger outside public source control if needed.

The main future measure is: **settled calls plausibly discovered independently, from wallets we did not send to the endpoint, with repeat task use**. The database column says `unknown_external_candidate` deliberately.

## Conservative observation plan

1. Close Stage 0 with free faucet tokens and a deployed test service.
2. Attempt Stage 1 with two independently configured clients. Measure setup friction and task completion, not compliments.
3. Confirm catalogue inclusion and stable availability before an observation window. A reasonable initial window is 30 days, limited by testnet traffic relevance and retention.
4. If there are no external calls, distinguish no exposure from no demand. Logs plus verified catalogue availability can narrow this, not eliminate the ambiguity.
5. If clients find the service but fail payment, fix compatibility. If they buy once but do not reuse it, investigate task value, accuracy/completeness and alternatives before adding products.

Support: unsolicited successful task use, repeated independent purchases and explicit evidence of reduced integration work. Undermine: only owner/invited traffic, no engagement despite verified relevant exposure, unusable data coverage, fragile payment setup or an easier free integration.

Mainnet remains outside this build. Any real-money experiment requires a separate explicit decision, operational reconciliation and stronger payment recovery controls.
