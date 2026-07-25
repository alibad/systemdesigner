import pandas as pd


def attach_customer_features(
    examples: pd.DataFrame,
    customers: pd.DataFrame,
) -> pd.DataFrame:
    if customers["customer_id"].isna().any():
        raise ValueError("dimension keys must not be null")
    if not customers["customer_id"].is_unique:
        raise ValueError("customer dimension must contain one row per key")

    result = examples.merge(
        customers,
        how="left",
        on="customer_id",
        validate="many_to_one",
        indicator=True,
    )

    unmatched = result["_merge"].ne("both")
    if unmatched.any():
        sample = result.loc[unmatched, "customer_id"].head().tolist()
        raise ValueError(f"unmatched customer keys: {sample}")
    if len(result) != len(examples):
        raise AssertionError("feature join changed the example count")

    return result.drop(columns="_merge")
