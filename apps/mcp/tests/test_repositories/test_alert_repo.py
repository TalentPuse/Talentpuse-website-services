import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from mcp_server.repositories.alert_repo import AlertRepository
from mcp_server.schemas.operations import AlertDispatchResult


@pytest.fixture
def repo():
    return AlertRepository()


class TestAlertDispatch:

    @pytest.mark.asyncio
    async def test_dispatch_success(self, repo):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"alerts_sent": 23, "message": "Done"}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("mcp_server.repositories.alert_repo.httpx.AsyncClient", return_value=mock_client):
            result = await repo.dispatch()

        assert result.status == "success"
        assert result.alerts_sent == 23
        assert result.message == "Done"

    @pytest.mark.asyncio
    async def test_dispatch_http_error(self, repo):
        import httpx

        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message="Server error", request=MagicMock(), response=mock_resp
        )

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("mcp_server.repositories.alert_repo.httpx.AsyncClient", return_value=mock_client):
            result = await repo.dispatch()

        assert result.status == "error"
        assert "Server error" in result.message

    @pytest.mark.asyncio
    async def test_dispatch_connection_error(self, repo):
        import httpx

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("mcp_server.repositories.alert_repo.httpx.AsyncClient", return_value=mock_client):
            result = await repo.dispatch()

        assert result.status == "error"
        assert "Connection refused" in result.message
