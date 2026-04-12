import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from services.auth_service import get_current_user
from services.ownership import require_owned_module

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


class NotionImportRequest(BaseModel):
    notion_token: str
    page_id: str
    module_id: str


class GoogleDriveImportRequest(BaseModel):
    access_token: str
    file_id: str
    module_id: str


@router.post("/notion/import")
async def import_from_notion(
    body: NotionImportRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Import content from a Notion page into a module."""
    import httpx

    from models.module import Module
    from models.document import Document

    module = require_owned_module(db, body.module_id, user)

    module_id = module.id
    user_id = module.user_id

    headers = {
        "Authorization": f"Bearer {body.notion_token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            page_resp = await client.get(
                f"https://api.notion.com/v1/pages/{body.page_id}",
                headers=headers,
            )
            page_resp.raise_for_status()
            page_data = page_resp.json()

            blocks_resp = await client.get(
                f"https://api.notion.com/v1/blocks/{body.page_id}/children?page_size=100",
                headers=headers,
            )
            blocks_resp.raise_for_status()
            blocks_data = blocks_resp.json()

        # Extract text from blocks
        text_parts: list[str] = []
        title = "Notion Import"

        props = page_data.get("properties", {})
        for prop in props.values():
            if prop.get("type") == "title":
                title_items = prop.get("title", [])
                if title_items:
                    title = title_items[0].get("plain_text", "Notion Import")
                break

        for block in blocks_data.get("results", []):
            block_type = block.get("type", "")
            block_content = block.get(block_type, {})

            if "rich_text" in block_content:
                for rt in block_content["rich_text"]:
                    text_parts.append(rt.get("plain_text", ""))
            elif "text" in block_content:
                for rt in block_content["text"]:
                    text_parts.append(rt.get("plain_text", ""))

        raw_text = "\n".join(text_parts)

        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="No text content found in Notion page")

        doc = Document(
            id=str(uuid.uuid4()),
            module_id=module_id,
            filename=f"{title}.notion",
            file_type="TXT",
            file_path="",
            raw_text=raw_text,
            processed=True,
            processing_status="done",
            word_count=len(raw_text.split()),
            user_id=user_id,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        return {
            "status": "imported",
            "document_id": doc.id,
            "title": title,
            "word_count": doc.word_count,
        }

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Notion API error: {e.response.text}",
        )
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to connect to Notion: {str(e)}")


@router.post("/google-drive/import")
async def import_from_google_drive(
    body: GoogleDriveImportRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Import a file from Google Drive into a module."""
    import httpx

    from models.module import Module
    from models.document import Document
    from services.file_processor import extract_text
    from config import settings

    module = require_owned_module(db, body.module_id, user)

    module_id = module.id
    user_id = module.user_id

    headers = {"Authorization": f"Bearer {body.access_token}"}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            meta_resp = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{body.file_id}",
                headers=headers,
                params={"fields": "name,mimeType,size"},
            )
            meta_resp.raise_for_status()
            meta = meta_resp.json()

            filename = meta.get("name", "google-drive-import")
            mime_type = meta.get("mimeType", "")

            download_url = f"https://www.googleapis.com/drive/v3/files/{body.file_id}"
            params: dict[str, str] = {}

            if mime_type == "application/vnd.google-apps.document":
                download_url += "/export"
                params["mimeType"] = "text/plain"
                filename += ".txt"
            elif mime_type == "application/vnd.google-apps.presentation":
                download_url += "/export"
                params["mimeType"] = "text/plain"
                filename += ".txt"
            else:
                download_url += "?alt=media"

            file_resp = await client.get(download_url, headers=headers, params=params)
            file_resp.raise_for_status()
            content = file_resp.content

        # Save file and extract text
        base_upload = os.path.realpath(settings.UPLOAD_DIR)
        upload_dir = os.path.join(base_upload, module_id)
        os.makedirs(upload_dir, exist_ok=True)

        file_id = str(uuid.uuid4())
        ext = os.path.splitext(filename)[1].lower()

        file_type_map = {".pdf": "PDF", ".txt": "TXT", ".md": "MD", ".pptx": "PPTX", ".docx": "DOCX"}
        file_type = file_type_map.get(ext, "TXT")

        saved_path = os.path.join(upload_dir, f"{file_id}{ext}")
        with open(saved_path, "wb") as f:
            f.write(content)

        raw_text = ""
        try:
            if file_type in ("PDF", "TXT", "MD", "PPTX", "DOCX"):
                raw_text = extract_text(saved_path, file_type)
            else:
                raw_text = content.decode("utf-8", errors="replace")
        except Exception:
            raw_text = content.decode("utf-8", errors="replace")

        doc = Document(
            id=file_id,
            module_id=module_id,
            filename=filename,
            file_type=file_type,
            file_path=saved_path,
            raw_text=raw_text,
            processed=bool(raw_text),
            processing_status="done" if raw_text else "failed",
            word_count=len(raw_text.split()) if raw_text else 0,
            user_id=user_id,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        return {
            "status": "imported",
            "document_id": doc.id,
            "filename": filename,
            "word_count": doc.word_count,
        }

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Google Drive API error: {e.response.text}",
        )
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to connect to Google Drive: {str(e)}")
