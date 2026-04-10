import os

from config import settings


def _validate_path(file_path: str) -> str:
    """Ensure the file path is within the uploads directory to prevent path traversal."""
    upload_dir = os.path.realpath(settings.UPLOAD_DIR)
    resolved = os.path.realpath(file_path)
    if not resolved.startswith(upload_dir):
        raise ValueError("Access denied: path is outside the uploads directory")
    return resolved


def extract_text(file_path: str, file_type: str) -> str:
    """Extract text from a file based on its type."""
    safe_path = _validate_path(file_path)
    file_type = file_type.upper()

    if file_type == "PDF":
        return _extract_pdf(safe_path)
    elif file_type in ("TXT", "MD"):
        return _extract_text_file(safe_path)
    else:
        raise ValueError(f"Unsupported file type for text extraction: {file_type}")


def _extract_pdf(file_path: str) -> str:
    """Extract text from PDF using PyMuPDF."""
    import fitz

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    doc = fitz.open(file_path)
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()
    return "\n".join(text_parts)


def _extract_text_file(file_path: str) -> str:
    """Read plain text or markdown files."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()
