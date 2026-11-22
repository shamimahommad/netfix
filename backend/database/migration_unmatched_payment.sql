-- Add support for UNMATCHED_PAYMENT in transactions.transaction_type
ALTER TABLE transactions MODIFY COLUMN transaction_type VARCHAR(50) NOT NULL DEFAULT 'GATEWAY_PAYMENT';
