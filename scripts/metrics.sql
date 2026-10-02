SELECT substr(timestamp,1,10) AS day, COUNT(*) AS requests,
 SUM(http_status=402) AS payment_required, SUM(paid) AS successful_payments,
 ROUND(100.0*SUM(paid)/NULLIF(SUM(http_status=402),0),2) AS paid_per_402_percent,
 COUNT(DISTINCT CASE WHEN paid=1 THEN client_hash END) AS distinct_paying_wallets,
 SUM(CASE WHEN paid=1 THEN CAST(amount_atomic AS INTEGER) ELSE 0 END)/1000000.0 AS gross_TEST_USDC,
 SUM(paid=1 AND client_cohort='unknown_external_candidate' AND discovery_channel!='self-test') AS unknown_paid_candidates,
 SUM(paid=1 AND json_extract(event,'$.cache')='hit') AS paid_cache_hits
FROM request_events GROUP BY day ORDER BY day DESC;
SELECT discovery_channel, client_cohort, COUNT(*) AS requests, SUM(paid) AS paid
FROM request_events GROUP BY discovery_channel,client_cohort;
SELECT client_hash,COUNT(*) AS paid_calls FROM request_events WHERE paid=1
GROUP BY client_hash HAVING COUNT(*)>1 ORDER BY paid_calls DESC;
