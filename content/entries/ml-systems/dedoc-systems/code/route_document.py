"""Choose explicit Dedoc API parameters from an inspected input contract."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DocumentProfile:
    extension: str
    has_text_layer: bool | None = None
    mixed_pdf_pages: bool = False
    needs_tables: bool = True
    needs_attachments: bool = False


def choose_parameters(profile: DocumentProfile) -> dict[str, str]:
    params = {"structure_type": "tree", "return_format": "json"}

    if profile.extension.lower() == ".pdf":
        if profile.has_text_layer is False:
            params["pdf_with_text_layer"] = "false"
        elif profile.mixed_pdf_pages:
            params["pdf_with_text_layer"] = "auto_tabby"
            params["each_page_textual_layer_detection"] = "true"
        else:
            params["pdf_with_text_layer"] = "auto_tabby"
        params["need_pdf_table_analysis"] = str(profile.needs_tables).lower()
        params["document_orientation"] = "auto"
    elif profile.extension.lower() in {".docx", ".pptx", ".xlsx"}:
        params["with_attachments"] = str(profile.needs_attachments).lower()
        params["need_content_analysis"] = str(profile.needs_attachments).lower()
    else:
        params["document_type"] = "other"

    return params


if __name__ == "__main__":
    mixed_pdf = DocumentProfile(
        extension=".pdf",
        mixed_pdf_pages=True,
        needs_tables=True,
    )
    result = choose_parameters(mixed_pdf)
    assert result["pdf_with_text_layer"] == "auto_tabby"
    assert result["each_page_textual_layer_detection"] == "true"
    print(result)
