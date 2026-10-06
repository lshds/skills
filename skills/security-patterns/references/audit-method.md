# Audit Method

Prefer findings confirmed from attacker-controlled source to sink over
pattern-match alerts so a security review reports exploitable issues instead
of noise. Apply this file in audit mode before writing any finding; write
mode uses the same source classification before trusting a value in new
code.

## Confirm before reporting

A grep hit is not a vulnerability: the value may be server-controlled,
sanitized on the way, or blocked by the framework. Reporting it anyway buries
the real findings.

- Confirm all three before reporting: (1) an attacker-controlled source
  reaches the sink, (2) no validation or sanitization sits on that path,
  (3) config, middleware, or framework defaults do not already block it.
- HIGH: report with a severity. MEDIUM: list under Needs verification only.
  LOW: do not report. The default output is HIGH only.
- Report each issue once, under its primary category.

## Attacker-controlled vs server-controlled

Whether a value can be steered by a caller decides whether a sink is
reachable at all.

| Investigate | Usually not a vuln alone |
| --- | --- |
| `request.body` / query / path | `process.env`, deploy config |
| Headers, cookies (unsigned) | Hardcoded constants |
| Uploads, Expo deep links | Signed session values |
| Other users’ stored data | Internal URLs from config |

- Trace source → sink before flagging (audit) or before trusting a value in
  new code (write).

## Skip non-findings

Flagging code that never runs in production or that only an operator
controls wastes the reader’s time and erodes trust in the report.

- Do not flag tests (unless the review is about test security), dead or
  commented-out code, or docs.
- Do not flag server-controlled config or environment values on their own.
- Auth-gated does not mean safe — report only when authorization is missing
  or broken after authentication.
