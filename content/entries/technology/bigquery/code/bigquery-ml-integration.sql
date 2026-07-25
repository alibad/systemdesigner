-- Create and train ML model with SQL
CREATE MODEL `dataset.customer_churn_model`
OPTIONS (
    model_type = 'LOGISTIC_REG',
    auto_class_weights = TRUE,
    input_label_cols = ['churned']
) AS
SELECT
    total_purchases,
    avg_order_value,
    days_since_last_purchase,
    customer_segment,
    churned
FROM `dataset.customer_features`
WHERE split_column = 'train';

-- Make predictions
SELECT
    customer_id,
    predicted_churned,
    predicted_churned_probs[OFFSET(1)] as churn_probability
FROM ML.PREDICT(MODEL `dataset.customer_churn_model`,
    (SELECT * FROM `dataset.new_customers`));