# Filtering GitHub data for quality
def filter_github_code(repo_data):
    filters = {
        'min_stars': 10,  # Repository popularity
        'has_license': True,  # Legal compliance
        'not_fork': True,  # Original content
        'language_confidence': 0.8,  # Clear language detection
        'max_file_size': 1_000_000,  # Avoid huge generated files
        'exclude_extensions': ['.min.js', '.csv', '.json'],
        'exclude_generated': True,  # No auto-generated code
    }

    # Additional quality checks
    if passes_filters(repo_data, filters):
        # Remove sensitive information
        code = remove_secrets(repo_data.code)
        code = remove_api_keys(code)
        return code
    return None
