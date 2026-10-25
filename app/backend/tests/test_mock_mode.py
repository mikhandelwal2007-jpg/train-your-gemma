import pytest
from httpx import AsyncClient, ASGITransport
from app.backend.main import app
from app.backend.config import settings


@pytest.mark.asyncio
async def test_health_and_capabilities():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["mock_mode"] is True
        assert data["capabilities"]["supports_text"] is True
